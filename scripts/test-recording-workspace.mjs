// Launches its own isolated Electron profile. Never attaches to the user's app.
import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import electron from 'electron';
const directory=await mkdtemp(join(tmpdir(),'eduv-recording-test-'));
async function freePort(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;}
const cdpPort=await freePort(),inspectorPort=await freePort();
const child=spawn(electron,['.','--user-data-dir='+directory,'--remote-debugging-port='+cdpPort,'--inspect='+inspectorPort,...(process.env.TEST_REAL_CAPTURE==='1'?[]:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])],{stdio:['ignore','pipe','pipe'],env:{...process.env,ELECTRON_DEV:'0'}});
let logs='',page;child.stdout.on('data',x=>logs+=x);child.stderr.on('data',x=>logs+=x);
const delay=ms=>new Promise(r=>setTimeout(r,ms)),connections=[];
async function until(fn,label){for(let n=0;n<100;n++){try{const result=await fn();if(result)return result;}catch{}await delay(100);}const info=page?await page.eval("JSON.stringify({status:document.querySelector('#status')?.textContent,play:document.querySelector('#play')?.textContent,disabled:document.querySelector('#play')?.disabled,time:document.querySelector('#position')?.textContent})"):'';throw new Error(label+'\n'+info+'\n'+logs.slice(-1500));}
async function connect(port,match=()=>true){
  const target=await until(async()=>{const targets=await(await fetch('http://127.0.0.1:'+port+'/json')).json();return targets.find(match);},'CDP target');
  const socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>socket.onopen=r);connections.push(socket);
  let seq=0;const pending=new Map();socket.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){const [yes,no]=pending.get(m.id);pending.delete(m.id);m.error?no(m.error):yes(m.result);}};
  socket.onclose=()=>{for(const [,no] of pending.values())no(new Error('CDP target closed'));pending.clear();};
  const call=(method,params={})=>new Promise((yes,no)=>{const id=++seq;pending.set(id,[yes,no]);socket.send(JSON.stringify({id,method,params}));});
  return {call,async eval(expression){const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;}};
}
let main;
try{
  main=await connect(inspectorPort);
  page=await connect(cdpPort,t=>t.url.endsWith('studio.html'));
  await until(()=>page.eval("document.querySelector('#prepare-source') && !document.querySelector('#status').textContent.includes('讀取')"),'studio loaded');
  if(process.env.TEST_REAL_CAPTURE==='1'){
    await page.eval(`navigator.mediaDevices.getUserMedia=async()=>{const c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');x.fillStyle='green';x.fillRect(0,0,640,480);const stream=c.captureStream(30),a=new AudioContext(),o=a.createOscillator(),g=a.createGain(),d=a.createMediaStreamDestination();g.gain.value=.01;o.connect(g);g.connect(d);o.start();await a.resume();stream.addTrack(d.stream.getAudioTracks()[0]);setInterval(()=>x.fillRect(0,0,640,480),33);return stream;};`);
    await main.eval(`globalThis.testElectron=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron');
      globalThis.fixture=new testElectron.BrowserWindow({x:100,y:100,width:960,height:540,frame:false,title:'EduVideo Capture Fixture',webPreferences:{backgroundThrottling:false}});
      fixture.loadURL('data:text/html,<title>EduVideo Capture Fixture</title><body style="margin:0;background:%232060c0"></body>');`);
    await delay(500);await page.eval("document.querySelector('#prepare-source').click()");
    const picker=await connect(cdpPort,t=>t.url.endsWith('picker.html'));
    await until(()=>picker.eval("Array.from(document.querySelectorAll('.source')).some(b=>b.textContent.includes('EduVideo Capture Fixture'))"),'picker ready');
    const pickerLayout=await picker.eval("(()=>{const list=document.querySelector('#sources'),cards=[...list.querySelectorAll('.source')];return{overflow:list.scrollWidth>list.clientWidth,widths:cards.map(c=>c.getBoundingClientRect().width)};})()");
    assert.equal(pickerLayout.overflow,false);assert.ok(Math.max(...pickerLayout.widths)-Math.min(...pickerLayout.widths)<2,'equal source card widths');
    try{await picker.eval("Array.from(document.querySelectorAll('.source')).find(b=>b.textContent.includes('EduVideo Capture Fixture')).click()");}catch(e){if(!e.message.includes('target closed'))throw e;}
  }else{
    // Synthetic display video provides deterministic colors; native tool windows and IPC are real.
    await page.eval(`navigator.mediaDevices.getDisplayMedia=async()=>{const c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d');x.fillStyle='#2060c0';x.fillRect(0,0,1280,720);const stream=c.captureStream(30);window.fixtureCanvas=c;return stream;};
      document.querySelector('#prepare-source').click();`);
  }
  await until(()=>page.eval("document.querySelectorAll('.prepared-source').length===2"),'prepared source');
  assert.equal(await page.eval("Boolean(document.querySelector('.prepared-sources').closest('.library'))"),true);
  assert.equal(await page.eval("getComputedStyle(document.querySelector('.annotation-bar')).display"),'flex');
  await page.eval("document.querySelector('#devices').click()");
  await until(()=>page.eval("!document.querySelector('#record').disabled"),'camera ready');
  if(process.env.TEST_REAL_CAPTURE!=='1'){
    assert.notEqual(await page.eval("getComputedStyle(document.querySelector('#camera')).display"),'none');
    await page.eval("document.querySelector('#include-chrome').click()");
    assert.notEqual(await page.eval("getComputedStyle(document.querySelector('#camera')).display"),'none');
    await page.eval("document.querySelector('#include-chrome').click()");
  }
  await page.eval("document.querySelector('#desktop-tools').click()");
  const toolbar=await connect(cdpPort,t=>t.url.includes('role=toolbar'));
  const overlay=await connect(cdpPort,t=>t.url.includes('role=overlay'));
  const notes=await connect(cdpPort,t=>t.url.includes('role=notes'));
  const camera=await connect(cdpPort,t=>t.url.includes('role=camera'));
  const visibility=()=>main.eval("(()=>{const e=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron');return Object.fromEntries(e.BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().includes('studio.html')||w.webContents.getURL().includes('desktop-tools.html')).map(w=>[w.webContents.getURL().includes('studio.html')?'main':new URL(w.webContents.getURL()).searchParams.get('role'),w.isVisible()]));})()");
  await until(()=>toolbar.eval("document.querySelector('#sources')?.options.length===2"),'tools sources synchronized');
  assert.equal((await visibility()).main,false,'opening tools hides studio');
  assert.equal(await toolbar.eval("document.querySelectorAll('[data-action=return]').length===1&&!document.querySelector('[data-action=hide-main]')&&!document.querySelector('[data-action=close]')"),true,'one return button only');
  assert.equal(await toolbar.eval("!document.querySelector('[data-action=record]').hidden&&!document.querySelector('[data-action=record]').disabled"),true,'record button always available');
  await until(()=>camera.eval("document.querySelector('video').videoWidth>0"),'independent live camera preview');
  assert.ok(await camera.eval("getComputedStyle(document.querySelector('video')).transform.startsWith('matrix(-1')"),'mirrored camera');
  await toolbar.eval("document.querySelector('[data-action=camera]').click()");
  assert.equal((await visibility()).camera,false,'preview toggle hides only preview');
  assert.equal(await page.eval("document.querySelector('#camera').srcObject.getVideoTracks()[0].readyState"),'live');
  await toolbar.eval("document.querySelector('[data-action=camera]').click()");
  await until(async()=>(await visibility()).camera,'preview can be recalled');
  await until(()=>camera.eval("document.querySelector('video').videoWidth>0"),'preview reconnects without reopening device');
  if(process.env.TEST_REAL_CAPTURE!=='1'){
    const protection=()=>main.eval("process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron').BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().includes('studio.html')||/role=(camera|notes|toolbar)/.test(w.webContents.getURL())).map(w=>w.isContentProtected())");
    assert.ok((await protection()).every(Boolean),'all EduVideo helper windows request capture exclusion');
    await page.eval("document.querySelector('#include-chrome').click()");
    await until(async()=>(await protection()).every(v=>!v),'include switch releases capture protection');
    assert.equal((await visibility()).camera,true,'capture inclusion does not change preview');
    await page.eval("document.querySelector('#include-chrome').click()");
  }
  await toolbar.eval("document.querySelector('[data-action=return]').click()");
  assert.equal(await main.eval("process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron').globalShortcut.isRegistered('CommandOrControl+Shift+H')"),true);
  await until(()=>main.eval("!process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron').BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('role=toolbar')).isVisible()"),'toolbar hidden');
  assert.equal((await visibility()).main,true,'return shows main');assert.equal((await visibility()).camera,false);
  // Same command as the registered H accelerator; its registration survives hiding.
  await toolbar.eval("window.desktopTools.command({type:'close'})");
  await until(()=>main.eval("process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron').BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('role=toolbar')).isVisible()"),'toolbar recalled');
  assert.ok(await toolbar.eval("innerWidth<=340&&innerHeight<=130"),'compact tools window');
  assert.equal(await toolbar.eval("document.querySelector('[data-action=clear]').closest('section').className"),'annotation-controls','trash on first row');
  assert.equal(await toolbar.eval("document.querySelector('[data-action=record]').closest('section').className"),'recording-controls','record on second row');
  assert.ok(await toolbar.eval("document.querySelector('[data-action=clear]').getBoundingClientRect().bottom<document.querySelector('[data-action=record]').getBoundingClientRect().top"),'fixed separate toolbar rows');
  if(process.env.TEST_REAL_CAPTURE==='1'){
    await main.eval("testElectron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().includes('role=overlay')).setBounds(fixture.getContentBounds())");
  }
  await toolbar.eval("document.querySelector('[data-action=notes]').click()");
  await notes.eval("document.querySelector('textarea').value='測試講者筆記';document.querySelector('textarea').dispatchEvent(new Event('input'))");
  await until(()=>page.eval("document.querySelector('#notes').value==='測試講者筆記'"),'notes IPC');
  await toolbar.eval("document.querySelector('[data-action=draw]').click()");
  await until(()=>toolbar.eval("document.querySelector('[data-action=draw]').getAttribute('aria-pressed')==='true'"),'draw mode');
  const point=await overlay.eval("({x:innerWidth*.25,y:innerHeight*.3})");
  await overlay.call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
  await overlay.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x+100,y:point.y,button:'left',buttons:1});
  await overlay.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x+100,y:point.y,button:'left',clickCount:1});
  await delay(200);
  const pixel=await page.eval("Array.from(document.querySelector('#canvas').getContext('2d').getImageData(340,216,1,1).data)");
  assert.ok(pixel[0]>180&&pixel[2]<180,'external annotation reaches recording canvas: '+pixel);
  await page.eval("document.querySelector('#annotation-undo').click()");
  assert.ok(await page.eval("document.querySelector('#canvas').getContext('2d').getImageData(340,216,1,1).data[2]>180"),'studio undo removes desktop stroke');
  await page.eval("document.querySelector('#annotation-redo').click()");
  assert.ok(await page.eval("document.querySelector('#canvas').getContext('2d').getImageData(340,216,1,1).data[0]>180"),'studio redo restores desktop stroke');
  await toolbar.eval("document.querySelector('[data-action=record]').click()");
  await until(()=>page.eval("document.querySelector('#record').textContent==='停止並保存'&&!document.querySelector('#record').disabled"),'recording');
  for(const [name,target] of [['recording',page],['toolbar',toolbar]]){const shot=await target.call('Page.captureScreenshot',{format:'png'});await writeFile(join(directory,name+'.png'),Buffer.from(shot.data,'base64'));}
  assert.equal((await visibility()).main,false,'start recording leaves studio hidden');
  await toolbar.eval("document.querySelector('[data-action=return]').click()");
  await until(()=>main.eval("process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron').BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('studio.html')).isVisible()"),'return to main using toolbar');
  assert.equal((await visibility()).toolbar,false,'return hides tools');
  await page.eval("document.querySelector('#desktop-tools').click()");
  await toolbar.eval("document.querySelector('[data-action=pause-record]').click()");
  await until(()=>toolbar.eval("document.querySelector('[data-action=pause-record]').getAttribute('aria-label')==='繼續錄製'"),'pause from toolbar');
  await delay(200);await toolbar.eval("document.querySelector('[data-action=pause-record]').click()");
  await until(()=>toolbar.eval("document.querySelector('[data-action=pause-record]').getAttribute('aria-label')==='暫停錄製'"),'resume from toolbar');
  await delay(1100);
  await toolbar.eval("document.querySelector('#sources').value='slides';document.querySelector('#sources').dispatchEvent(new Event('change'))");
  await until(()=>page.eval("document.querySelector('#source').value==='slides'"),'source switch during recording');
  await delay(800);
  await toolbar.eval("const s=document.querySelector('#sources');s.selectedIndex=1;s.dispatchEvent(new Event('change'))");
  await until(()=>page.eval("document.querySelector('#source').value==='screen'"),'switch back');
  await delay(800);
  await toolbar.eval("document.querySelector('[data-action=record]').click()");
  await until(()=>page.eval("document.body.dataset.mode==='edit'&&!document.querySelector('#play').disabled"),'finished recording');
  assert.equal(await main.eval("process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron').BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('studio.html')).isVisible()"),true,'stop restores main editor');
  assert.equal(await page.eval("document.querySelector('#output-mirror').checked"),true);
  assert.equal(await page.eval("getComputedStyle(document.querySelector('.annotation-bar')).display"),'none');
  assert.equal(await page.eval("document.querySelectorAll('#segments > button').length"),1);
  assert.equal(await main.eval("process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron').globalShortcut.isRegistered('CommandOrControl+Shift+D')"),false);
  await page.eval("document.querySelector('#play').click()");
  await until(()=>page.eval("parseFloat(document.querySelector('#position').textContent)>0"),'recorded playback advances');
  const result=await page.eval(`(async()=>{const {openStore}=await import('./src/project-store.js');const s=await(await openStore()).load();const a=Object.values(s.assets)[0];return {duration:s.project.takes[0].duration,screen:a.screen.size,camera:a.camera.size,notes:s.notes};})()`);
  assert.ok(result.screen>200&&result.camera>200,JSON.stringify(result));assert.equal(result.notes,'測試講者筆記');
  const frames=await page.eval(`(async()=>{const {openStore}=await import('./src/project-store.js');const s=await(await openStore()).load(),v=document.createElement('video');v.muted=true;v.src=URL.createObjectURL(Object.values(s.assets)[0].screen);await new Promise(r=>v.onloadeddata=r);const c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d'),pixels=[];for(const time of [.5,1.5,2.5]){v.currentTime=time;await new Promise(r=>v.onseeked=r);x.drawImage(v,0,0);pixels.push(Array.from(x.getImageData(100,100,1,1).data));}URL.revokeObjectURL(v.src);return pixels;})()`);
  assert.ok(frames[0][2]>140&&frames[1][2]<80&&frames[2][2]>140,'source switches appear in saved video: '+JSON.stringify(frames));
  const screenshot=await page.call('Page.captureScreenshot',{format:'png'});await writeFile(join(directory,'editor.png'),Buffer.from(screenshot.data,'base64'));
  // Page management: insert, drag, copy, delete, undo/redo, and persist a complete deck.
  await page.eval("document.querySelector('#mode-record').click()");
  const slideCount=()=>page.eval("document.querySelectorAll('#slides .slide-card').length");
  await page.eval("document.querySelector('[data-slide-action=blank]').click()");await until(async()=>await slideCount()===1,'insert blank');
  await page.eval("document.querySelector('[data-slide-action=duplicate]').click()");await until(async()=>await slideCount()===2,'duplicate slide');
  await page.eval(`(async()=>{const c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d');x.fillStyle='#2060c0';x.fillRect(0,0,1280,720);const blob=await new Promise(r=>c.toBlob(r));const dt=new DataTransfer();dt.items.add(new File([blob],'藍色圖片.png',{type:'image/png'}));const f=document.querySelector('#file');f.files=dt.files;f.dispatchEvent(new Event('change'));})()`);
  await until(async()=>await slideCount()===3&&!await page.eval("document.querySelector('#import').disabled"),'insert image without replacing slides');
  await page.eval("document.querySelector('#slides .slide-select').click();const rows=document.querySelectorAll('.slide-card'),dt=new DataTransfer();rows[2].dispatchEvent(new DragEvent('dragstart',{dataTransfer:dt,bubbles:true}));rows[0].dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));");
  await until(()=>page.eval("document.querySelector('#slides .slide-select').title==='藍色圖片.png'"),'drag reorder');
  assert.equal(await page.eval("document.querySelector('#slides [aria-current=page]').closest('.slide-card').dataset.index"),'1','reorder keeps selected slide');
  await page.eval("document.querySelector('[data-slide-action=delete]').click()");await until(async()=>await slideCount()===2,'delete slide');
  await page.eval("document.querySelector('[data-slide-action=undo]').click()");await until(async()=>await slideCount()===3,'restore deleted slide');
  await page.eval("document.querySelector('[data-slide-action=redo]').click()");await until(async()=>await slideCount()===2,'redo deletion');
  await page.eval("document.querySelector('[data-slide-action=undo]').click()");await until(async()=>await slideCount()===3,'restore before save');
  const savedSlides=await page.eval(`(async()=>{const {openStore}=await import('./src/project-store.js'),{projectFiles,restoreProjectFiles}=await import('./src/archive.js');const snapshot=await(await openStore()).load();const restored=await restoreProjectFiles(await projectFiles(snapshot));return restored.slides.map(s=>s.title);})()`);
  assert.deepEqual(savedSlides,['藍色圖片.png','空白頁','空白頁']);
  const slideShot=await page.call('Page.captureScreenshot',{format:'png'});await writeFile(join(directory,'slides.png'),Buffer.from(slideShot.data,'base64'));
  // Reload clears the camera device but preserves the slide deck. Start directly on the toolbar.
  const syntheticCamera=process.env.TEST_REAL_CAPTURE==='1'?await page.eval("navigator.mediaDevices.getUserMedia.toString()"):null;
  await page.call('Page.enable');await page.call('Page.addScriptToEvaluateOnNewDocument',{source:'window.__recordingTestReload=true;'});
  await page.call('Page.reload');await until(()=>page.eval("window.__recordingTestReload&&document.querySelectorAll('#slides .slide-card').length===3&&!document.querySelector('#status').textContent.includes('讀取')"),'reload persisted slides');
  if(syntheticCamera)await page.eval('navigator.mediaDevices.getUserMedia='+syntheticCamera);
  assert.equal(await page.eval("document.querySelector('#camera').srcObject"),null);
  await page.eval("document.querySelector('#desktop-tools').click()");
  await until(()=>toolbar.eval("document.querySelector('#sources').options.length===1"),'reloaded tools state');
  await toolbar.eval("document.querySelector('[data-action=next-slide]').click()");await until(()=>page.eval("document.querySelector('#page-count').textContent==='2 / 3'"),'toolbar next slide');
  await toolbar.eval("document.querySelector('[data-action=prev-slide]').click()");await until(()=>page.eval("document.querySelector('#page-count').textContent==='1 / 3'"),'toolbar previous slide');
  await toolbar.eval("document.querySelector('[data-action=record]').click()");
  await until(()=>toolbar.eval("document.querySelector('#record-state').textContent.startsWith('倒數')"),'toolbar shows countdown');
  await until(()=>toolbar.eval("document.querySelector('[data-action=record]').getAttribute('aria-label')==='停止並保存'&&!document.querySelector('[data-action=record]').disabled"),'toolbar initializes devices and starts recording');
  await until(()=>camera.eval("document.querySelector('video').videoWidth>0"),'camera stream after main reload');
  assert.equal((await visibility()).main,false);
  assert.equal(await page.eval("document.querySelector('[data-slide-action=delete]').disabled"),true,'page mutation locked during recording');
  await delay(800);await toolbar.eval("document.querySelector('[data-action=record]').click()");
  await until(()=>page.eval("document.body.dataset.mode==='edit'&&!document.querySelector('#play').disabled"),'save second recording');
  await main.eval(`globalThis.closeErrors=[];process.on('uncaughtException',e=>closeErrors.push(e.message));const electron=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron');electron.dialog.showErrorBox=(title,message)=>closeErrors.push(message);electron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('studio.html')).close();`);
  await delay(300);
  assert.deepEqual(await main.eval('closeErrors'),[],'normal window close must not access destroyed objects');
  assert.equal(await main.eval("process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron').BrowserWindow.getAllWindows().filter(w=>w.webContents.getURL().includes('desktop-tools.html')).length"),0);
  console.log(JSON.stringify({passed:true,...result,evidence:directory}));
}finally{
  if(main)try{await Promise.race([main.eval("process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron').app.exit(0)"),delay(500)]);}catch{}
  for(const c of connections)c.close();
  if(child.exitCode===null){child.kill();await delay(300);if(child.exitCode===null)child.kill('SIGKILL');}
  await writeFile(join(directory,'electron.log'),logs);
}
