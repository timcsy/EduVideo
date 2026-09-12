// Run only against an isolated test Electron with --inspect=9230 and CDP 9226.
// Mock the native file chooser, not the actual IPC or filesystem implementation.
import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {readPackage} from '../electron/project-package.mjs';
async function connect(port){const targets=await(await fetch(`http://127.0.0.1:${port}/json`)).json();const socket=new WebSocket(targets.find(t=>t.webSocketDebuggerUrl).webSocketDebuggerUrl);await new Promise(r=>socket.onopen=r);let seq=0;const pending=new Map();socket.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){const [yes,no]=pending.get(m.id);pending.delete(m.id);m.error?no(m.error):yes(m.result);}};return{socket,async eval(expression){const id=++seq;const p=new Promise((yes,no)=>pending.set(id,[yes,no]));socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));const r=await p;if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}};}
const root=await mkdtemp(join(tmpdir(),'eduv-native-')),path=join(root,'lesson.eduv');const main=await connect(9230),renderer=await connect(9226);const delay=ms=>new Promise(r=>setTimeout(r,ms));
try{
  await main.eval(`globalThis.testDialog=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron').dialog;testDialog.showSaveDialog=async()=>({canceled:false,filePath:${JSON.stringify(path)}});testDialog.showOpenDialog=async()=>({canceled:false,filePaths:[${JSON.stringify(path)}]});`);
  await renderer.eval(`window.confirm=()=>true;document.querySelector('#project-save').click()`);
  let files;for(let i=0;i<100;i++){try{files=await readPackage(path);break;}catch{}await delay(100);}
  assert.ok(files);const original=JSON.parse(new TextDecoder().decode(files['project.json']));assert.ok(original.project.takes.length);
  await renderer.eval(`document.querySelector('#notes').value='unsaved modification';document.querySelector('#notes').dispatchEvent(new Event('change'))`);await delay(300);
  await renderer.eval(`document.querySelector('#project-open').click()`);await delay(1000);
  assert.equal(await renderer.eval(`document.querySelector('#notes').value`),original.notes);
  assert.equal(await renderer.eval(`(async()=>{const {openStore}=await import('./src/project-store.js');return(await(await openStore()).load()).project.takes.length})()`),original.project.takes.length);
  await renderer.eval(`document.querySelector('#project-save').click()`);await delay(500);await readPackage(path);
  console.log('Native .eduv save/open IPC, uncompressed media, metadata and repeated save: passed');
}finally{await renderer.eval(`window.studioNative.forgetProject()`);main.socket.close();renderer.socket.close();await rm(root,{recursive:true,force:true});}
