import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const targets=await(await fetch('http://127.0.0.1:9226/json')).json(),socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>socket.onopen=r);let sequence=0;const pending=new Map();socket.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){const[resolve,reject]=pending.get(m.id);pending.delete(m.id);m.error?reject(m.error):resolve(m.result);}};
const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,[resolve,reject]);socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression:`(async()=>eval(${JSON.stringify(expression)}))()`,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const wait=async(expression,label)=>{for(let i=0;i<60;i++){if(await evaluate(expression))return;await delay(100);}throw new Error(`${label}: ${await evaluate(`JSON.stringify({time:document.querySelector('#seek').value,play:document.querySelector('#play').textContent,disabled:document.querySelector('#play').disabled,focus:document.activeElement.id,status:document.querySelector('#status').textContent})`)}`);};
const space=async()=>{await call('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});await call('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});};
const playing=()=>wait(`document.querySelector('#play').textContent==='暫停' && Number(document.querySelector('#seek').value)>.1 && !document.querySelector('#play').disabled`,'playback must advance');
const ended=()=>wait(`document.querySelector('#play').textContent==='播放' && Number(document.querySelector('#seek').value)>=1.6 && !document.querySelector('#play').disabled`,'playback must finish');
try{
  const screen=(await readFile('/tmp/eduvideo-source-screen.webm')).toString('base64'),camera=(await readFile('/tmp/eduvideo-source-camera.webm')).toString('base64');
  await evaluate(`(async()=>{const {openStore}=await import('./src/project-store.js');const blob=s=>new Blob([Uint8Array.from(atob(s),c=>c.charCodeAt(0))],{type:'video/webm'});await(await openStore()).save({project:{version:2,takes:[{id:'replay',duration:5}],segments:[{takeId:'replay',in:0,out:1.6}]},assets:{replay:{screen:blob(${JSON.stringify(screen)}),camera:blob(${JSON.stringify(camera)})}},slides:[]});})()`);
  await call('Page.reload');await delay(700);await evaluate(`document.querySelector('#mode-edit').click()`);await wait(`!document.querySelector('#play').disabled`,'ready');
  await evaluate(`document.querySelector('#play').focus()`);await space();await playing();await ended();
  await space();await playing();await ended();console.log('Direct Space replay after natural end: passed');
  // Timeline pointer interaction must take focus away from a previously edited field.
  await evaluate(`document.querySelector('#properties-captions').click();document.querySelector('#caption-search').focus()`);
  const point=await evaluate(`(()=>{const r=document.querySelector('#time-ruler').getBoundingClientRect();return{x:r.x+2,y:r.y+r.height/2}})()`);
  await call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});await delay(200);
  await space();await playing();await ended();console.log('Move timeline to start then Space after editing a field: passed');
  // Sliders are transport controls, not text editing fields.
  await evaluate(`document.querySelector('#timeline-zoom').focus()`);await space();await playing();await ended();console.log('Replay with timeline zoom focused: passed');
  await evaluate(`document.querySelector('#caption-search').focus()`);await space();assert.equal(await evaluate(`document.querySelector('#play').textContent`),'播放');console.log('Text editing does not start playback: passed');
}finally{socket.close();}
