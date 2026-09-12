import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';
let targets;
for (let i = 0; i < 60; i++) {
  try { targets = await (await fetch('http://127.0.0.1:9226/json')).json(); if (targets.some(t => t.type === 'page')) break; } catch {}
  await new Promise(resolve => setTimeout(resolve, 500));
}
if (!targets?.some(t => t.type === 'page')) throw new Error('Test Electron was not ready on port 9226');
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let sequence = 0; const pending = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (pending.has(m.id)) { const [resolve, reject] = pending.get(m.id); pending.delete(m.id); m.error ? reject(m.error) : resolve(m.result); } };
const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, [resolve, reject]); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const r = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
const delay = ms => new Promise(r => setTimeout(r, ms));
try {
  await call('Page.navigate', { url: process.env.STUDIO_TEST_URL || 'http://127.0.0.1:4173/studio.html' }); await delay(900);
  await evaluate(`(async () => { const {openStore}=await import('./src/project-store.js'); const {newProject}=await import('./src/edit-project.js'); const c=document.createElement('canvas'); c.width=1280;c.height=720;const x=c.getContext('2d');x.fillStyle='#205080';x.fillRect(0,0,1280,720);x.fillStyle='white';x.font='70px sans-serif';x.fillText('TDD Recording',180,350);await (await openStore()).save({project:newProject(),assets:{},slides:[{image:c.toDataURL()}],notes:'test'}); })()`);
  await call('Page.reload'); await delay(900);
  assert.equal(await evaluate(`document.querySelectorAll('#segments button').length`), 0);
  await evaluate(`document.querySelector('#annotation-tool').value='arrow'`);
  const annotationPoint=await evaluate(`(()=>{const r=document.querySelector('#canvas').getBoundingClientRect();return{x:r.x+r.width*.25,y:r.y+r.height*.25};})()`);
  await call('Input.dispatchMouseEvent',{type:'mousePressed',...annotationPoint,button:'left',clickCount:1});
  await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:annotationPoint.x+100,y:annotationPoint.y+60,button:'left',buttons:1});
  await call('Input.dispatchMouseEvent',{type:'mouseReleased',x:annotationPoint.x+100,y:annotationPoint.y+60,button:'left',clickCount:1});await delay(300);
  assert.equal(await evaluate(`(async()=>{const {openStore}=await import('./src/project-store.js');return (await(await openStore()).load()).slides[0].annotations[0].type;})()`),'arrow');
  await evaluate(`document.querySelector('#annotation-undo').click()`);await delay(200);
  assert.equal(await evaluate(`(async()=>{const {openStore}=await import('./src/project-store.js');return (await(await openStore()).load()).slides[0].annotations.length;})()`),0);
  await evaluate(`document.querySelector('#annotation-redo').click()`);await delay(200);
  await evaluate(`document.querySelector('#devices').click()`); await delay(1500);
  assert.equal(await evaluate(`document.querySelector('#record').disabled`), false);
  await evaluate(`document.querySelector('#record').click()`); await delay(5600);
  await evaluate(`document.querySelector('#pause-record').click()`); await delay(600);
  assert.equal(await evaluate(`document.querySelector('#pause-record').textContent`), '繼續錄製');
  await evaluate(`document.querySelector('#pause-record').click()`); await delay(300);
  await evaluate(`document.querySelector('#record').click()`); await delay(1500);
  assert.equal(await evaluate(`document.querySelectorAll('#segments button').length`), 1);
  assert.equal(await evaluate(`document.body.dataset.mode`), 'edit');
  assert.equal(await evaluate(`document.querySelector('#output-x')`), null);
  assert.equal(await evaluate(`document.querySelector('#person-box').hidden`),true);
  const person = await evaluate(`(()=>{const r=document.querySelector('#canvas').getBoundingClientRect();return {x:r.x+r.width*.86,y:r.y+r.height*(.68+.22*2/3)};})()`);
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...person, button: 'left', clickCount: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: person.x - 80, y: person.y - 50, button: 'left', buttons: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: person.x - 80, y: person.y - 50, button: 'left', clickCount: 1 });
  await delay(300);
  const layout = await evaluate(`(async()=>{const {openStore}=await import('./src/project-store.js');return (await(await openStore()).load()).project.segments[0].layout;})()`);
  assert.ok(layout.x < .75 && layout.y < .68);
  const corner = await evaluate(`(()=>{const r=document.querySelector('#person-resize').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...corner, button: 'left', clickCount: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: corner.x + 25, y: corner.y + 19, button: 'left', buttons: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: corner.x + 25, y: corner.y + 19, button: 'left', clickCount: 1 });
  await delay(300);
  assert.ok(await evaluate(`(async()=>{const {openStore}=await import('./src/project-store.js');return (await(await openStore()).load()).project.segments[0].layout.width;})()`) > layout.width);
  await evaluate(`document.querySelector('#undo').click()`); await delay(300);
  assert.equal(await evaluate(`(async()=>{const {openStore}=await import('./src/project-store.js');return (await(await openStore()).load()).project.segments[0].layout.width;})()`), layout.width);
  await evaluate(`document.querySelector('#start').value='1';document.querySelector('#trim').click()`); await delay(500);
  const result = await evaluate(`(async()=>{const {openStore}=await import('./src/project-store.js');const s=await(await openStore()).load();return {start:s.project.segments[0].in,screen:s.assets[s.project.takes[0].id].screen.size,camera:s.assets[s.project.takes[0].id].camera.size};})()`);
  assert.equal(result.start, 1); assert.ok(result.screen > 0 && result.camera > 0);
  console.log('recorded sources', result);
  const raw = await evaluate(`(async()=>{const {openStore}=await import('./src/project-store.js');const s=await(await openStore()).load();const out={};for(const kind of ['screen','camera']) {let binary='';for(const b of new Uint8Array(await s.assets[s.project.takes[0].id][kind].arrayBuffer()))binary+=String.fromCharCode(b);out[kind]=btoa(binary);}return out;})()`);
  for(const kind of ['screen','camera'])await writeFile('/tmp/eduvideo-source-'+kind+'.webm',Buffer.from(raw[kind],'base64'));
  const exported = await evaluate(`(async()=>{const {openStore}=await import('./src/project-store.js');const {exportEdited}=await import('./src/edited-export.js');const s=await(await openStore()).load();const blob=await exportEdited(s.project,s.assets);return {size:blob.size,type:blob.type};})()`);
  assert.ok(exported.size > 0);
  const native = await evaluate(`(async()=>{
    const {openStore}=await import('./src/project-store.js'); const {exportEdited}=await import('./src/edited-export.js');
    const s=await(await openStore()).load(); s.project.layout={x:.1,y:.1,width:.3,visible:true,mirror:false,background:true};
    const source={...s.project.segments[0],layout:s.project.layout};s.project.segments=[{...source,out:source.in+.5,layout:{...source.layout,visible:false}},{...source,in:source.in+.8,speed:1.5,title:'Test title',volume:.7,layout:{...source.layout,shape:'circle',backdrop:'solid',color:'#553388'}}];
    const blob=await exportEdited(s.project,s.assets);
    const mp4=await window.studioNative.encodeMp4(new Uint8Array(await blob.arrayBuffer()));
    let binary=''; for(const b of mp4)binary+=String.fromCharCode(b);
    return {data:btoa(binary),expected:s.project.segments.reduce((n,s)=>n+(s.out-s.in)/(s.speed||1),0)};
  })()`);
  await writeFile('/tmp/eduvideo-complete.mp4', Buffer.from(native.data,'base64'));
  console.log('MP4 with background removal expected duration:', native.expected);
  const info = JSON.parse(execFileSync('ffprobe', ['-v','error','-show_entries','format=duration:stream=codec_type,codec_name','-of','json','/tmp/eduvideo-complete.mp4'], {encoding:'utf8'}));
  assert.ok(Math.abs(Number(info.format.duration) - native.expected) < .25);
  assert.ok(info.streams.some(s => s.codec_type === 'video' && s.codec_name === 'h264'));
  assert.ok(info.streams.some(s => s.codec_type === 'audio' && s.codec_name === 'aac'));
  for(const [at,expected]of [[.2,[32,80,128]],[.8,[85,51,136]]]){
    const rgb=execFileSync(ffmpeg,['-v','error','-ss',String(at),'-i','/tmp/eduvideo-complete.mp4','-vf','crop=2:2:320:264,format=rgb24','-frames:v','1','-f','rawvideo','pipe:1']);
    assert.ok(expected.every((v,i)=>Math.abs(v-rgb[i])<24),'export must switch from screen-only to the chosen person backdrop at the clip boundary');
  }
  await call('Page.reload'); await delay(900);
  assert.equal(await evaluate(`document.querySelector('#start').value`), '1');
  const screenshot = await call('Page.captureScreenshot'); await writeFile('/tmp/eduvideo-v2.png', Buffer.from(screenshot.data, 'base64'));
  await evaluate(`document.querySelector('#mode-edit').click()`); await delay(500);
  assert.equal(await evaluate(`document.body.dataset.mode`), 'edit');
  const handle = await evaluate(`(()=>{const r=document.querySelector('.trim-handle.in').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...handle, button: 'left', clickCount: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: handle.x + 40, y: handle.y, button: 'left', buttons: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: handle.x + 40, y: handle.y, button: 'left', clickCount: 1 });
  await delay(600);
  assert.ok(Number(await evaluate(`document.querySelector('#start').value`)) > 1);
  await evaluate(`document.querySelector('#undo').click()`); await delay(500);
  assert.equal(await evaluate(`document.querySelector('#start').value`), '1');
  const editShot = await call('Page.captureScreenshot'); await writeFile('/tmp/eduvideo-v2-edit.png', Buffer.from(editShot.data, 'base64'));
  await evaluate(`document.querySelector('#duplicate').click()`);await delay(400);
  assert.equal(await evaluate(`document.querySelectorAll('#segments button').length`),2);
  await evaluate(`document.querySelectorAll('#segments button')[1].click()`);await delay(400);
  await evaluate(`document.querySelector('#output-visible').click()`);await delay(400);
  await evaluate(`const shape=document.querySelector('#person-shape');shape.value='circle';shape.dispatchEvent(new Event('change'))`);await delay(400);
  await evaluate(`const speed=document.querySelector('#clip-speed');speed.value='2';speed.dispatchEvent(new Event('change'))`);await delay(400);
  const settings=await evaluate(`(async()=>{const {openStore}=await import('./src/project-store.js');return (await(await openStore()).load()).project.segments;})()`);
  assert.equal(settings[0].layout.visible,true);assert.equal(settings[1].layout.visible,false);assert.equal(settings[1].layout.shape,'circle');assert.equal(settings[1].speed,2);
  for(let i=0;i<4;i++){await evaluate(`document.querySelector('#undo').click()`);await delay(300);}
  const cancelled = await evaluate(`(async()=>{const {openStore}=await import('./src/project-store.js');const {exportEdited}=await import('./src/edited-export.js');const s=await(await openStore()).load();const c=new AbortController();c.abort();try{await exportEdited(s.project,s.assets,()=>{},{signal:c.signal});return false;}catch(e){return e.name==='AbortError';}})()`);
  assert.equal(cancelled, true);
  await evaluate(`(async()=>{const {openStore}=await import('./src/project-store.js');const store=await openStore();const s=await store.load();const media=s.assets[s.project.takes[0].id];await store.saveRecovery({id:'recovered-take',duration:.5,...media});})()`);
  await call('Page.reload'); await delay(900);
  assert.equal(await evaluate(`(async()=>{const {openStore}=await import('./src/project-store.js');const s=await(await openStore()).load();return s.project.takes.some(t=>t.id==='recovered-take');})()`), true);
  if (process.env.STUDIO_TEST_PDF) {
    await call('DOM.enable'); const root=await call('DOM.getDocument'); const input=await call('DOM.querySelector',{nodeId:root.root.nodeId,selector:'#file'});
    await call('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[process.env.STUDIO_TEST_PDF]});
    let count=0;
    for(let i=0;i<120;i++){count=await evaluate(`document.querySelectorAll('#slides button').length`);if(count>1)break;await delay(500);}
    assert.ok(count>1);console.log('Packaged local PDF imported:',count);
  }
  console.log(JSON.stringify({ result, exported, reload: 'passed' }));
} finally { ws.close(); }
