import { newProject, addTake, splitSegment, trimSegment, removeSegment, resolveFrame, projectDuration } from './edit-project.js';
import { openStore } from './project-store.js';
import { exportEdited } from './edited-export.js';
import { renderPdfSlides } from './slides.js';
import { mountStudio } from './studio-view.js';
import { updateLayout, cameraRect, DEFAULT_LAYOUT } from './layout.js';
import { createPersonRenderer, drawComposition, loadBackdrop } from './person-renderer.js';
import { packProject, unpackProject,projectFiles,restoreProjectFiles } from './archive.js';
import { resizePerson } from './person-gesture.js';
import { enhanceWorkspace } from './workspace-ux.js';
import {installAnnotations} from './annotation-ui.js';
import {mountEditorTools} from './editor-ui.js';
import {mediaPreview,waveform} from './media-preview.js';
import {mountLibrary} from './library-workspace.js';
import {renameTake,appendTake,removeTake} from './media-library.js';
import {mountTimeline} from './timeline-ui.js';
import {audioLandmarks} from './timeline-snap.js';
import {mountCaptions} from './caption-ui.js';
import {drawCaptions,outputCues,applyOutputCues,parseSrt,serializeSrt,updateCue,splitCue,splitReadableCues,mergeCaption} from './captions.js';
import {browserModelStatuses,downloadBrowserModel,removeBrowserModel,importBrowserModel,transcribeInBrowser} from './browser-speech.js';
import {transcribeWithApi} from './speech-api.js';
import {duplicateSegment,updateSegment,segmentDuration,clipAt,drawClipOverlay,clipOpacity,compositionProject} from './clip-tools.js';
import {mountRecordingWorkspace} from './recording-workspace.js';
import {mountSlideLibrary} from './slide-library.js';

mountStudio();
const $ = id => document.getElementById(id);
document.querySelector('header nav').insertAdjacentHTML('afterend', '<button id="project-save" title="⌘S 儲存專案">儲存專案</button><button id="project-open">開啟專案</button><input id="project-file" type="file" accept=".eduv,.eduvideo,.zip" hidden>');
document.querySelector('.library').insertAdjacentHTML('beforeend', '<button id="project-new">建立新專案</button><button id="download-originals">下載原始素材</button>');
document.querySelector('.edit-inspector').insertAdjacentHTML('beforeend', '<h2>成品人像</h2><p class="hint">直接拖曳預覽中的人像移動位置，拉右下角圓點調整大小。匯出會套用相同設定。</p><label><input id="output-visible" type="checkbox" checked> 顯示人像</label><label><input id="output-mirror" type="checkbox"> 成品鏡像</label><label><input id="output-background" type="checkbox"> 人像去背</label>');
document.querySelector('.timeline-toolbar').insertAdjacentHTML('beforeend', '<button id="redo">重做</button><button id="move-left">往前移</button><button id="move-right">往後移</button>');
document.querySelector('.record-dock').insertAdjacentHTML('beforeend', '<button id="pause-record" hidden>暫停錄製</button>');
document.querySelector('.record-inspector').insertAdjacentHTML('beforeend', '<h2>錄製裝置</h2><label>相機<select id="camera-device"><option value="">系統預設</option></select></label><label>麥克風<select id="audio-device"><option value="">系統預設</option></select></label>');
document.querySelector('header').insertAdjacentHTML('beforeend', '<select id="export-format" aria-label="匯出格式"><option value="mp4">MP4</option><option value="webm">WebM</option></select><button id="cancel-export" hidden>取消匯出</button>');
if (!window.studioNative) { $('export-format').value = 'webm'; $('export-format').options[0].disabled = true; }
enhanceWorkspace();
let future = [], personRenderer, renderPromise, exportController;
async function drawEdited() {
  if (renderPromise) await renderPromise;
  if (!videos[0].videoWidth || !videos[1].videoWidth) return;
  renderPromise = (async () => {
    const active=clipAt(project,time),composed=compositionProject(project,active?.segment);if(active&&selected!==active.index){selected=active.index;timeline();}await loadBackdrop(composed);
    let camera = videos[1];
    if (composed.layout?.background&&composed.layout.visible!==false) { personRenderer ||= await createPersonRenderer({preview:true}); camera = await personRenderer.process(camera,composed.layout); }
    if (mode === 'edit' || currentTake) {drawComposition(ctx, videos[0], camera, composed,videos[1]);if(active){drawClipOverlay(ctx,active.segment,active.elapsed);drawCaptions(ctx,active.segment,active.segment.in+active.elapsed*(active.segment.speed||1),project.captionStyle);}}
    if(active){videos.forEach(v=>{v.playbackRate=active.segment.speed||1;v.volume=(active.segment.volume??1)*clipOpacity(active.segment,active.elapsed);});updatePersonBox(composed);}
  })();
  try { await renderPromise; } finally { renderPromise = null; }
}
function updatePersonBox(p){const l={...DEFAULT_LAYOUT,...p.layout};personBox.hidden=!l.visible||!project.segments.length||!personEditing;Object.assign(personBox.style,{left:`${l.x*100}%`,top:`${l.y*100}%`,width:`${l.width*100}%`,height:`${l.width*(l.shape==='circle'?16/9:4/3)*100}%`,borderRadius:l.shape==='circle'?'50%':l.shape==='rounded'?'9%':'0'});}
function layoutControls() { const p=compositionProject(project,project.segments[selected]),l={...DEFAULT_LAYOUT,...p.layout};for(const key of ['visible','mirror','background'])$(`output-${key}`).checked=l[key];updatePersonBox(p);editorUI?.sync(project,selected,busy); }
function changePerson(p,change){const layout=updateLayout(compositionProject(p,p.segments[selected]),change).layout;return updateSegment(p,selected,{layout});}
function download(blob, name) { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 60000); }
let mode = 'record', audioMeterContext, analyser;
async function setMode(next) {
  if (recording || busy) return;
  pause();personEditing=false;mode = next; document.body.dataset.mode = next;
  if(next==='edit')await recordingWorkspace?.hide();
  $('mode-record').setAttribute('aria-pressed', next === 'record');
  $('mode-edit').setAttribute('aria-pressed', next === 'edit');
  $('viewer-title').textContent = next === 'record' ? '錄製預覽' : '成品預覽';
  $('library-title').textContent = next === 'record' ? '簡報頁面' : '錄製素材';
  if (next === 'record') { showSlide(); $('camera').hidden = !preview; }
  else { $('camera').hidden = true; if (project.segments.length) await seek(); else { ctx.clearRect(0, 0, 1280, 720); } }
}
const canvas = $('canvas'), ctx = canvas.getContext('2d');
const personBox = document.createElement('div'); personBox.id = 'person-box'; personBox.hidden = true;
personBox.innerHTML = '<button id="person-resize" aria-label="調整人像大小" title="拖曳縮放人像"></button>'; canvas.after(personBox);
const displayLive = document.createElement('video'); displayLive.id = 'display-live'; displayLive.autoplay = true; displayLive.muted = true; displayLive.playsInline = true; displayLive.hidden = true; canvas.after(displayLive);
let project = newProject(), assets = {}, slides = [], page = 0, preview = null, recording = null, busy = false;
let selected = 0, time = 0, playing = false, last = 0, image = null, drawing = false, history = [], currentTake = null;
const videos = [$('screen-video'), $('camera-video')];
let urls = [], store;
let outputDrag = null;
let editorUI,annotations,clipClipboard,libraryUI,timelineUI,captionUI,personEditing=false,speechCancelled=false;
let recordingWorkspace,slideLibrary;
const takeLandmarks={};
const status = message => { $('status').textContent = message; };
async function save() { await store.save({ project, assets, slides, notes: $('notes').value });$('project-save').textContent='儲存專案 •'; status('已自動暫存素材與剪輯 · ⌘S 儲存至 .eduv 專案'); }
function controls() {
  slideLibrary?.controls();
  recordingWorkspace?.syncTools();
  libraryUI?.sync(project,assets,busy||Boolean(recording));captionUI?.sync(project,selected,busy||Boolean(recording));
  if($('project-save-as'))$('project-save-as').disabled=busy||Boolean(recording);
  editorUI?.sync(project,selected,busy||Boolean(recording));
  $('project-new').disabled = $('download-originals').disabled = busy || Boolean(recording); $('download-originals').disabled ||= !project.takes.length;
  $('pause-record').hidden = !recording; $('pause-record').disabled = busy;
  for (const id of ['project-open','project-save','camera-device','audio-device','move-left','move-right','redo','output-background','output-visible','output-mirror','person-resize']) $(id).disabled = busy || Boolean(recording);
  $('redo').disabled ||= !future.length;
  $('mode-record').disabled = $('mode-edit').disabled = busy || Boolean(recording);
  $('record').disabled = busy;
  $('record').textContent = recording ? '停止並保存' : '開始錄製';
  for (const id of ['import', 'source', 'devices', 'export', 'play', 'split', 'delete', 'trim', 'undo']) $(id).disabled = busy || Boolean(recording);
  $('export').disabled ||= !project.segments.length;
  for (const id of ['play', 'split', 'delete', 'trim']) $(id).disabled ||= !project.segments.length;
  $('undo').disabled ||= !history.length;
}
async function guarded(action) { if (busy) return; const wasRecording = Boolean(recording); busy = true; controls(); try { await action(); } catch (e) { status(`操作失敗：${e.message}`); } finally { busy = false; try { if (wasRecording && !recording && project.segments.length) await setMode('edit'); } finally {controls();} } }
function timeline() {
  layoutControls();
  $('timeline-empty').hidden = Boolean(project.segments.length);
  libraryUI?.sync(project,assets,busy||Boolean(recording));
  $('segments').replaceChildren(...project.segments.map((s, i) => {
    const button = document.createElement('button'); button.textContent = `${s.title||`片段 ${i + 1}`} · ${segmentDuration(s).toFixed(1)} 秒 · ${compositionProject(project,s).layout.visible===false?'無人像':'人像'}${s.speed&&s.speed!==1?` · ${s.speed}×`:''}`; button.className = i === selected ? 'active' : '';button.title='點選編輯 · 拖曳排序 · 拉兩端裁切 · 右鍵操作';
    button.style.flexGrow = segmentDuration(s);
    if(assets[s.takeId])mediaPreview(assets[s.takeId]).then(preview=>{if(!button.isConnected)return;const take=project.takes.find(t=>t.id===s.takeId);button.style.backgroundImage=`url("${preview.poster}")`;button.classList.add('has-preview');if(preview.peaks.length&&take){takeLandmarks[s.takeId]=preview.landmarks||audioLandmarks(preview.peaks,take.duration);const wave=document.createElement('img');wave.className='clip-waveform';wave.alt='聲音波形';wave.src=waveform(preview.peaks,s.in,s.out,take.duration);button.append(wave);}}).catch(()=>{});
    button.onclick = () => { if(busy||recording)return;personEditing=false;selected = i; time = project.segments.slice(0, i).reduce((sum, s) => sum + segmentDuration(s), 0); timeline(); seek().catch(e => status(e.message)); };
    button.draggable=true;button.ondragstart=e=>{if(busy||recording){e.preventDefault();return;}e.dataTransfer.setData('text/eduv-clip',String(i));};button.ondragover=e=>e.preventDefault();button.ondrop=e=>{e.preventDefault();const raw=e.dataTransfer.getData('text/eduv-clip');if(raw==='')return;const from=Number(raw);if(!Number.isInteger(from)||!project.segments[from]||from===i)return;guarded(()=>edit(p=>{const segments=p.segments.slice(),[clip]=segments.splice(from,1);segments.splice(i,0,clip);selected=i;return {...p,segments};}));};
    button.oncontextmenu=e=>{e.preventDefault();button.click();showClipMenu(e.clientX,e.clientY);};
    for (const edge of ['in', 'out']) {
      const handle = document.createElement('span'); handle.className = `trim-handle ${edge}`; handle.title = edge === 'in' ? '拖曳裁切起點' : '拖曳裁切終點';
      handle.onpointerdown = e => {
        e.stopPropagation(); e.preventDefault(); if (busy || recording) return;
        const x = e.clientX, width = button.getBoundingClientRect().width; let delta = 0;
        handle.setPointerCapture(e.pointerId);
        handle.onpointermove = event => { const take=project.takes.find(t=>t.id===s.takeId),base=edge==='in'?s.in:s.out;const proposed=base+(event.clientX-x)/width*(s.out-s.in),play=resolveFrame(project,time);const points=[0,take.duration,...(takeLandmarks[s.takeId]||[]),...(play?.takeId===s.takeId?[play.sourceTime]:[]),...(s.captions||[]).flatMap(c=>[c.start,c.end])];delta=(timelineUI?.snapSource(proposed,points,(s.out-s.in)/width*8,event)??proposed)-base;handle.style.transform=`translateX(${delta/(s.out-s.in)*width}px)`; };
        handle.onpointerup = event => { event.stopPropagation(); handle.onpointermove = null; handle.onpointerup = null; handle.style.transform = ''; selected = i; const duration=project.takes.find(t=>t.id===s.takeId).duration;guarded(() => edit(p => trimSegment(p, i, edge === 'in' ? Math.max(0, Math.min(s.out - .05, s.in + delta)) : s.in, edge === 'out' ? Math.min(duration, Math.max(s.in + .05, s.out + delta)) : s.out))); };
      };
      handle.onclick = e => e.stopPropagation(); button.append(handle);
    }
    return button;
  }));
  const segment = project.segments[selected]; $('start').value = segment ? Math.ceil(segment.in * 1000) / 1000 : ''; $('end').value = segment ? Math.floor(segment.out * 1000) / 1000 : '';
  $('seek').max = projectDuration(project); $('seek').value = time;
  $('position').textContent = `${time.toFixed(2)} / ${projectDuration(project).toFixed(2)} 秒`;controls();timelineUI?.update();
}
async function edit(operation) { await flushLiveEdit();const next = operation(project);if(next===project)return; history.push(project); future = []; project = next; selected = Math.max(0, Math.min(selected, project.segments.length - 1));const start=project.segments.slice(0,selected).reduce((n,s)=>n+segmentDuration(s),0);time=Math.max(start,Math.min(time,start+(project.segments[selected]?segmentDuration(project.segments[selected])-.001:0))); timeline(); layoutControls(); await save(); await seek(); }
let liveBefore=null,liveTimer=null;
function liveEdit(operation){const next=operation(project);if(next===project)return;if(!liveBefore)liveBefore=project;project=next;future=[];timeline();layoutControls();drawEdited().catch(error=>status(error.message));clearTimeout(liveTimer);liveTimer=setTimeout(()=>flushLiveEdit().catch(error=>status(error.message)),300);}
async function flushLiveEdit(){if(!liveBefore)return;clearTimeout(liveTimer);const before=liveBefore;liveBefore=null;history.push(before);await save();controls();}
function fit(source, x = 0, y = 0, w = 1280, h = 720) {
  const sw = source.videoWidth || source.naturalWidth, sh = source.videoHeight || source.naturalHeight;
  if (!sw || !sh) return; const scale = Math.min(w / sw, h / sh); ctx.drawImage(source, x + (w - sw * scale) / 2, y + (h - sh * scale) / 2, sw * scale, sh * scale);
}
function drawSlide() {
  ctx.fillStyle = '#080d15'; ctx.fillRect(0, 0, 1280, 720);
  if(recordingWorkspace?.draw()){annotations?.draw(ctx);return;}
  if (image) fit(image); else { ctx.fillStyle = '#91a7c0'; ctx.font = '28px system-ui'; ctx.fillText('匯入簡報，或選擇錄製其他視窗', 340, 360); }
  ctx.strokeStyle = '#ff5268'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  for (const points of slides[page]?.strokes || []) { ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke(); }
  annotations?.draw(ctx);
}
function showSlide() {
  $('page-count').textContent = `${slides.length ? page + 1 : 0} / ${slides.length}`;
  pause(); currentTake = null; image = null;
  const currentSlide=slides[page];
  if (currentSlide) { const img = new Image(); img.onload = () => { if(slides[page]!==currentSlide)return;image = img; if (mode === 'record' && !currentTake) drawSlide(); }; img.src = currentSlide.image; } else drawSlide();
  slideLibrary?.render();recordingWorkspace?.syncTools();
}
function pause() { playing = false; videos.forEach(v => v.pause()); $('play').textContent = '播放'; }
function resumeVideos(){for(const video of videos)if(video.paused)video.play().catch(error=>{if(playing)status(`播放素材失敗：${error.message}`);});}
async function seek() {
  const target = resolveFrame(project, Math.min(time,Math.max(0,projectDuration(project)-.001))); if (!target) return;
  const active=clipAt(project,time);if(active){selected=active.index;videos.forEach(v=>{v.playbackRate=active.segment.speed||1;v.volume=active.segment.volume??1;});layoutControls();}personRenderer?.reset();
  if (currentTake !== target.takeId) {
    urls.forEach(u => URL.revokeObjectURL(u)); urls = []; currentTake = target.takeId;
    await Promise.all(videos.map((v, i) => new Promise((resolve, reject) => { v.onloadeddata = resolve; v.onerror = () => reject(new Error('素材無法讀取')); const url = URL.createObjectURL(assets[target.takeId][i ? 'camera' : 'screen']); urls.push(url); v.src = url; })));
  }
  // Some recorded WebM files expose metadata at zero before a drawable frame.
  // A 1 ms seek resolves the first frame without advancing the project playhead.
  await Promise.all(videos.map(v => new Promise(resolve => { const sourceTime=Math.max(.001,target.sourceTime);if(v.currentTime>0&&Math.abs(v.currentTime-sourceTime)<.03)return resolve();v.addEventListener('seeked',resolve,{once:true});v.currentTime=sourceTime; })));
  await drawEdited();if(playing)resumeVideos();$('camera').hidden = true;
}
async function openDevices(){
  const next = await navigator.mediaDevices.getUserMedia({ video: $('camera-device').value ? { deviceId: { exact: $('camera-device').value } } : true, audio: $('audio-device').value ? { deviceId: { exact: $('audio-device').value } } : true });
  preview?.getTracks().forEach(t => t.stop()); await audioMeterContext?.close(); preview = next;
  $('camera').srcObject = preview; $('camera').hidden = false; await $('camera').play();
  audioMeterContext = new AudioContext(); await audioMeterContext.resume(); analyser = audioMeterContext.createAnalyser(); audioMeterContext.createMediaStreamSource(preview).connect(analyser);
  const devices = await navigator.mediaDevices.enumerateDevices();
  for (const [id, kind] of [['camera-device','videoinput'], ['audio-device','audioinput']]) { const value = $(id).value; $(id).replaceChildren(new Option('系統預設', ''), ...devices.filter(d => d.kind === kind).map((d, i) => new Option(d.label || `裝置 ${i + 1}`, d.deviceId))); $(id).value = value; }
  $('devices').textContent = '相機與麥克風 ✓'; status('相機與麥克風已開啟，確認鏡像人像後即可錄製');
}
$('devices').onclick = () => guarded(openDevices);
$('import').onclick = () => $('file').click();
$('file').onchange = () => guarded(async () => {
  const files=Array.from($('file').files);$('file').value='';if(!files.length)return;
  const incoming=[];
  for(const file of files){
    if (file.type === 'application/pdf'||file.name.toLowerCase().endsWith('.pdf')) { const pdfjs = await import('../vendor/pdfjs/pdf.mjs'); pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.mjs', import.meta.url).href; incoming.push(...await renderPdfSlides(file, { pdfjs, onProgress: (n, total) => status(`匯入 ${n}/${total} 頁`) })); }
    else if(file.type.startsWith('image/')) { const data = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); }); incoming.push({ title:file.name,image: data,annotations:[] }); }
    else throw new Error('請選擇 PDF 或圖片');
  }
  // Import owns the busy guard; the prepared pages are committed as one undoable edit.
  await slideLibrary.insert(incoming,true);
});
for (const [id, step] of [['prev', -1], ['next', 1]]) $(id).onclick = () => { page = Math.max(0, Math.min(slides.length - 1, page + step)); showSlide(); };
canvas.onpointerdown = e => {
  if (busy) return;
  if (mode === 'edit') {
    const composed=compositionProject(project,project.segments[selected]);if (!project.segments.length || composed.layout?.visible === false) return;
    const rect = canvas.getBoundingClientRect(), camera = cameraRect(composed, 1280, 720);
    const x = (e.clientX - rect.left) / rect.width * 1280, y = (e.clientY - rect.top) / rect.height * 720;
    if (x < camera.x || x > camera.x + camera.width || y < camera.y || y > camera.y + camera.height) {personEditing=false;layoutControls();return;}
    personEditing=true;$('properties-person').click();layoutControls();outputDrag = { before: project, dx: x - camera.x, dy: y - camera.y }; canvas.setPointerCapture(e.pointerId); return;
  }
  if (!slides[page] || currentTake) return; drawing = true; canvas.setPointerCapture(e.pointerId); (slides[page].strokes ||= []).push([]);
};
canvas.onpointermove = e => {
  const r = canvas.getBoundingClientRect();
  if (outputDrag) { project = changePerson(project, { x: (e.clientX - r.left) / r.width - outputDrag.dx / 1280, y: (e.clientY - r.top) / r.height - outputDrag.dy / 720 }); layoutControls(); drawEdited().catch(e => status(e.message)); return; }
  if (!drawing) return; slides[page].strokes.at(-1).push([(e.clientX - r.left) / r.width * 1280, (e.clientY - r.top) / r.height * 720]); drawSlide();
};
canvas.onpointerup = () => { let changed=drawing;if(outputDrag){changed=project!==outputDrag.before;if(changed){history.push(outputDrag.before);future=[];}outputDrag=null;controls();}drawing=false;if(changed)save().catch(e=>status(e.message)); };
canvas.onpointercancel = () => { if (outputDrag) { project = outputDrag.before; outputDrag = null; layoutControls(); drawEdited().catch(e => status(e.message)); } drawing = false; };
let resizeDrag;
$('person-resize').onpointerdown = e => {
  if (busy || mode !== 'edit') return;
  e.preventDefault(); resizeDrag = { before: project, x: e.clientX, y: e.clientY, rect: canvas.getBoundingClientRect() }; e.currentTarget.setPointerCapture(e.pointerId);
};
$('person-resize').onpointermove = e => {
  if (!resizeDrag) return;
  const d = resizeDrag; const resized=resizePerson(compositionProject(d.before,d.before.segments[selected]), (e.clientX - d.x) / d.rect.width, (e.clientY - d.y) / d.rect.height);project=changePerson(d.before,resized.layout);
  layoutControls(); drawEdited().catch(e => status(e.message));
};
$('person-resize').onpointerup = () => { if (!resizeDrag) return; history.push(resizeDrag.before); future = []; resizeDrag = null; controls(); save().catch(e => status(e.message)); };
$('person-resize').onpointercancel = () => { if (!resizeDrag) return; project = resizeDrag.before; resizeDrag = null; layoutControls(); drawEdited().catch(e => status(e.message)); };
$('clear').onclick = () => { if (slides[page]) { slides[page].strokes = []; drawSlide(); save().catch(e => status(e.message)); } };
$('notes').onchange = () => guarded(save);
$('record').onclick = () => guarded(async () => {
  if (recording) {
    const take = recording; const duration = elapsed(take); recording = null; clearInterval(take.timer); clearInterval(take.checkpoint);clearInterval(take.frames);
    const blobs = await Promise.all(take.recorders.map(r => new Promise((resolve, reject) => { r.recorder.onstop = () => resolve(new Blob(r.chunks, { type: r.recorder.mimeType })); r.recorder.onerror = e => reject(e.error); r.recorder.stop(); })));
    take.stream.getTracks().forEach(t => t.stop()); displayLive.srcObject = null; displayLive.hidden = true;
    assets[take.id] = { screen: blobs[0], camera: blobs[1] }; history.push(project); future = []; project = addTake(project, { id: take.id, duration });
    selected = project.segments.length - 1; time = projectDuration(project) - duration; timeline();
    await save(); await store.saveRecovery(null); await seek(); return;
  }
  pause(); showSlide(); $('camera').hidden = false;
  if ($('source').value === 'slides' && !slides.length) throw new Error('請先匯入簡報');
  if(!preview)await openDevices();
  const stream = await recordingWorkspace.capture();
  try {
    const recorders = [stream, preview].map(s => { const recorder = new MediaRecorder(s), chunks = []; recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); }; return { recorder, chunks }; });
    try { $('countdown').hidden = false; for (let n = 3; n > 0; n--) { $('countdown').textContent = n;recordingWorkspace.syncTools(); await new Promise(resolve => setTimeout(resolve, 1000)); } } finally { $('countdown').hidden = true; }
    recorders.forEach(r => r.recorder.start(1000)); recording = { id: crypto.randomUUID(), started: performance.now(), stream, recorders, pausedAt: null, pausedMs: 0 };
    recording.frames=setInterval(drawSlide,1000/30);
    const active = recording; active.timer = setInterval(() => { $('clock').textContent = `${elapsed(active).toFixed(0)} 秒`;recordingWorkspace.syncTools(); }, 250);
    active.checkpoint = setInterval(() => {
      if (!active.recorders.every(r => r.chunks.length)) return;
      const duration = Math.max(.01, elapsed(active) - 1);
      store.saveRecovery({ id: active.id, duration, screen: new Blob(active.recorders[0].chunks, { type: active.recorders[0].recorder.mimeType }), camera: new Blob(active.recorders[1].chunks, { type: active.recorders[1].recorder.mimeType }) }).catch(e => status(`錄製備援保存失敗：${e.message}`));
    }, 5000);
    stream.getVideoTracks()[0].onended = () => { if (recording === active) $('record').click(); };
    status('錄製中：簡報／螢幕與人像分開保存');
  } catch (e) { stream.getTracks().forEach(t => t.stop()); throw e; }
});
$('seek').oninput = () => scrubTo(Number($('seek').value));
$('split').onclick = () => guarded(() => { const target = resolveFrame(project, time); if (!target) throw new Error('請把播放頭放在片段內');const index=clipAt(project,time).index; return edit(p => splitSegment(p, index, target.sourceTime)); });
$('delete').onclick = () => guarded(() => edit(p => removeSegment(p, selected)));
$('trim').onclick = () => guarded(() => edit(p => trimSegment(p, selected, Number($('start').value), Number($('end').value))));
$('undo').onclick = () => guarded(async () => { await flushLiveEdit();if (!history.length) return; future.push(project); project = history.pop();time=Math.min(time,Math.max(0,projectDuration(project)-.001)); timeline(); layoutControls(); await save(); await seek(); });
$('redo').onclick = () => guarded(async () => { await flushLiveEdit();if (!future.length) return; history.push(project); project = future.pop();time=Math.min(time,Math.max(0,projectDuration(project)-.001)); timeline(); layoutControls(); await save(); await seek(); });
$('play').onclick = () => guarded(async () => { if (playing) return pause();personEditing=false; if (time >= projectDuration(project)) time = 0; await seek(); playing = true;layoutControls(); $('play').textContent = '暫停'; last = performance.now(); });
async function tick(now) {
  try {
    if (analyser) { const values = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(values); $('mic-meter').value = Math.min(1, Math.sqrt(values.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / values.length) * 5); }
    if (mode==='record'&&!currentTake&&!recording) drawSlide();
    if (playing && !recording) {
      time += (now - last) / 1000; last = now;
      if (time >= projectDuration(project)) { time = projectDuration(project); pause(); }
      else {
        const target = resolveFrame(project, time);
        if (!target) {time=projectDuration(project);pause();}
        else {if (currentTake !== target.takeId || Math.abs(videos[0].currentTime - target.sourceTime) > .2) await seek();
          resumeVideos();
          await drawEdited();}
      }
      $('seek').value = time; $('position').textContent = `${time.toFixed(2)} / ${projectDuration(project).toFixed(2)} 秒`;
      timelineUI?.update();
    } else last = now;
    captionUI?.update(time);
  } catch (e) { console.error(e);pause(); status(e.message); }
  requestAnimationFrame(tick);
}
$('export').onclick = () => guarded(async () => {
  pause(); exportController = new AbortController(); $('cancel-export').hidden = false;
  const format = $('export-format').value;
  try {
    status('正在合成剪輯影片…');
    let blob = await exportEdited(project, assets, value => status(`合成 ${Math.round(value * 100)}%`), { signal: exportController.signal });
    exportController.signal.throwIfAborted();
    if (format === 'mp4') { status('正在編碼 MP4…'); const bytes = await window.studioNative.encodeMp4(new Uint8Array(await blob.arrayBuffer())); exportController.signal.throwIfAborted(); blob = new Blob([bytes], { type: 'video/mp4' }); }
    download(blob, `EduVideo-edited.${format}`); status(`已匯出 ${format.toUpperCase()} 成品，包含剪輯與人像設定`);
  } finally { $('cancel-export').hidden = true; exportController = null; }
});
$('cancel-export').onclick = () => { exportController?.abort(); window.studioNative?.cancelEncode(); status('正在取消匯出…'); };
function elapsed(take) { return ((take.pausedAt || performance.now()) - take.started - take.pausedMs) / 1000; }
$('pause-record').onclick = () => {
  if (!recording || busy) return;
  if (recording.pausedAt) { recording.pausedMs += performance.now() - recording.pausedAt; recording.pausedAt = null; recording.recorders.forEach(r => r.recorder.resume()); $('pause-record').textContent = '暫停錄製'; }
  else { recording.pausedAt = performance.now(); recording.recorders.forEach(r => r.recorder.pause()); $('pause-record').textContent = '繼續錄製'; }
  recordingWorkspace?.syncTools();
};
for (const [id, step] of [['move-left', -1], ['move-right', 1]]) $(id).onclick = () => guarded(() => edit(p => { const index = selected + step; if (index < 0 || index >= p.segments.length) return p; const segments = p.segments.slice(); [segments[index], segments[selected]] = [segments[selected], segments[index]]; selected = index; return { ...p, segments }; }));
for (const key of ['visible','mirror','background']) $(`output-${key}`).onchange = () => guarded(() => edit(p => changePerson(p, { [key]: $(`output-${key}`).checked })));
$('project-save').onclick = () => guarded(()=>saveDiskProject(false));
async function saveDiskProject(saveAs){const snapshot={project,assets,slides,notes:$('notes').value};status('正在儲存專案與原始影片…');if(window.studioNative?.saveProject){const result=await window.studioNative.saveProject(await projectFiles(snapshot),saveAs);if(result)$('project-save').textContent='儲存專案';status(result?`已儲存 ${result.path}（未壓縮專案資料夾）`:'已取消儲存');}else{download(await packProject(snapshot),'EduVideo.eduv');$('project-save').textContent='儲存專案';status('已下載 .eduv 可攜專案（瀏覽器版使用封裝檔）');}}
$('project-open').onclick = () => {if(!window.studioNative?.openProject){$('project-file').click();return;}guarded(async()=>{if(project.takes.length&&!confirm('開啟另一專案將替換目前工作，請確認已儲存 .eduv 專案。繼續？'))return;const result=await window.studioNative.openProject();if(result)await acceptNativeProject(result);});};
async function acceptNativeProject(result){try{await acceptProject(result.files?restoreProjectFiles(result.files):await unpackProject(new Blob([result.bytes])));status(result.path?`已開啟 ${result.path}`:'已開啟可攜專案');}catch(e){await window.studioNative?.forgetProject();throw e;}}
async function acceptProject(incoming){pause();({project,assets,slides}=incoming);slideLibrary?.reset();$('notes').value=incoming.notes;page=0;time=0;selected=0;currentTake=null;history=[];future=[];clipClipboard=null;timeline();layoutControls();await save();if(mode==='record')showSlide();else await seek();}
const saveAsButton=document.createElement('button');saveAsButton.id='project-save-as';saveAsButton.textContent='另存專案…';saveAsButton.onclick=()=>guarded(()=>saveDiskProject(true));document.querySelector('.library').append(saveAsButton);
$('project-new').onclick = () => guarded(async () => {
  if ((project.takes.length || slides.length) && !confirm('建立新專案會替換目前工作。請先使用「備份專案」保存；確定建立？')) return;
  await window.studioNative?.forgetProject();pause(); project = newProject(); assets = {}; slides = []; $('notes').value = ''; page = 0; time = 0; selected = 0; currentTake = null; history = []; future = [];clipClipboard=null;
  slideLibrary?.reset();
  timeline(); layoutControls(); showSlide(); await save();
});
$('download-originals').onclick = () => guarded(async () => {
  const take = project.takes.find(t => t.id === project.segments[selected]?.takeId) || project.takes.at(-1);
  if (!take) return;
  download(assets[take.id].screen, `EduVideo-${take.id}-screen.webm`); download(assets[take.id].camera, `EduVideo-${take.id}-camera.webm`); status('已下載原始畫面與人像素材（人像素材包含麥克風聲音）');
});
$('project-file').onchange = () => guarded(async () => {
  const file = $('project-file').files[0]; if (!file) return;
  const incoming = await unpackProject(file);
  if (project.takes.length && !confirm('開啟另一個專案前，要取代目前專案嗎？請先使用「備份專案」保存目前工作。')) return;
  await window.studioNative?.forgetProject();await acceptProject(incoming);
});
$('mode-record').onclick = () => setMode('record').catch(e => status(e.message));
$('mode-edit').onclick = () => setMode('edit').catch(e => status(e.message));
$('toggle-notes').onclick = () => { document.body.classList.toggle('inspector-hidden'); $('toggle-notes').setAttribute('aria-pressed', !document.body.classList.contains('inspector-hidden')); };
$('camera-size').oninput = () => { $('camera').style.width = `${$('camera-size').value}%`; };
$('camera').onpointerdown = e => {
  const video = $('camera'), stage = video.parentElement.getBoundingClientRect(), rect = video.getBoundingClientRect();
  const dx = e.clientX - rect.left, dy = e.clientY - rect.top; video.setPointerCapture(e.pointerId);
  video.onpointermove = event => { video.style.left = `${Math.max(0, Math.min(stage.width - rect.width, event.clientX - stage.left - dx)) / stage.width * 100}%`; video.style.top = `${Math.max(0, Math.min(stage.height - rect.height, event.clientY - stage.top - dy)) / stage.height * 100}%`; video.style.right = video.style.bottom = 'auto'; };
  video.onpointerup = () => { video.onpointermove = null; };
};
function stepTime(delta){guarded(async()=>{time=Math.max(0,Math.min(projectDuration(project),time+delta));await seek();timeline();});}
let pendingScrub=null,scrubbing=false;
async function scrubTo(value){if(busy||recording)return;personEditing=false;pendingScrub=Math.max(0,Math.min(projectDuration(project),value));if(scrubbing)return;scrubbing=true;try{while(pendingScrub!==null){time=pendingScrub;pendingScrub=null;timelineUI?.update();await seek();}timeline();}catch(e){status(e.message);}finally{scrubbing=false;}}
function clipCommand(id){
  if(id==='copy'||id==='cut'){if(!project.segments[selected])return;clipClipboard=structuredClone(project.segments[selected]);if(id==='cut')$('delete').click();else status('已複製片段，⌘V 貼到選取片段後方');return;}
  guarded(()=>edit(p=>{const s=p.segments[selected];if(!s&&id!=='paste')throw new Error('請先選取片段');
    if(id==='duplicate')return duplicateSegment(p,selected);
    if(id==='paste'){if(!clipClipboard||!p.takes.some(t=>t.id===clipClipboard.takeId))throw new Error('請先複製此專案的片段');const segments=p.segments.slice();segments.splice(selected+1,0,structuredClone(clipClipboard));return {...p,segments};}
    if(id==='restore-clip')return trimSegment(p,selected,0,p.takes.find(t=>t.id===s.takeId).duration);
    const target=resolveFrame(p,time),active=clipAt(p,time);if(!target||active.index!==selected)throw new Error('請先將播放頭移到選取片段內');
    return trimSegment(p,selected,id==='trim-head'?target.sourceTime:s.in,id==='trim-tail'?target.sourceTime:s.out);
  }));
}
function showClipMenu(x,y){document.querySelector('.clip-menu')?.remove();const menu=document.createElement('div');menu.className='clip-menu';menu.setAttribute('role','menu');
  for(const [label,id]of [['分割','split'],['複製片段','duplicate'],['複製','copy'],['剪下','cut'],['貼上','paste'],['刪除並接合','delete'],['還原完整素材','restore-clip']]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{menu.remove();if(id==='split'||id==='delete')$(id).click();else clipCommand(id);};menu.append(b);}
  document.body.append(menu);menu.style.left=`${Math.min(x,innerWidth-190)}px`;menu.style.top=`${Math.min(y,innerHeight-menu.offsetHeight-10)}px`;setTimeout(()=>document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))menu.remove();},{once:true}),0);
}
editorUI=mountEditorTools({command:clipCommand,clip:(key,value,options)=>options?.live?liveEdit(p=>updateSegment(p,selected,{[key]:value})):guarded(()=>edit(p=>updateSegment(p,selected,{[key]:value}))),layout:(key,value,options)=>{const operation=p=>changePerson(p,{[key]:value,...(key==='backdrop'&&value!=='none'?{background:true}:{}),...(key==='backgroundPreset'?{backdrop:'image',background:true,backgroundImage:null}:{})});return options?.live?liveEdit(operation):guarded(()=>edit(operation));},step:stepTime,image:file=>guarded(async()=>{if(!file)return;if(file.size>15*1024*1024)throw new Error('背景圖片請小於 15 MB');const url=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});await edit(p=>changePerson(p,{backgroundImage:url,backgroundPreset:null,backdrop:'image',background:true}));})});
libraryUI=mountLibrary({seek:scrubTo,favorite:(id,value)=>guarded(()=>edit(p=>({...p,takes:p.takes.map(t=>t.id===id?{...t,favorite:value}:t)}))),rename:(id,name)=>guarded(()=>edit(p=>renameTake(p,id,name))),append:id=>guarded(async()=>{selected=project.segments.length;await edit(p=>appendTake(p,id));if(mode!=='edit')await setMode('edit');}),locate:id=>{const index=project.segments.findIndex(s=>s.takeId===id);if(index>=0)scrubTo(project.segments.slice(0,index).reduce((n,s)=>n+segmentDuration(s),0));},download:id=>guarded(()=>{const media=assets[id];if(media){download(media.screen,`EduVideo-${id}-screen.webm`);download(media.camera,`EduVideo-${id}-camera.webm`);}}),remove:id=>guarded(async()=>{const count=project.segments.filter(s=>s.takeId===id).length;if(!confirm(count?`此素材用於 ${count} 個片段。要從本專案移除素材及這些片段？可用復原找回，磁碟上已儲存的版本不會刪除。`:'要從本專案移除此素材？可用復原找回。'))return;await edit(p=>removeTake(p,id,true));status('已從本專案移除素材；可復原，既有磁碟版本仍保留');})});
timelineUI=mountTimeline({getState:()=>({project,time,audio:takeLandmarks}),seek:scrubTo});
let speechRequestController=null,modelDownloadProgress=null,modelDownloadController=null;
window.studioNative?.onModelProgress(value=>modelDownloadProgress?.(value));
async function recognizeCaptions(all,settings){await guarded(async()=>{const indexes=all?project.segments.map((_,i)=>i):[selected];if(indexes.some(i=>project.segments[i]?.captions?.length)&&!confirm('重新辨識會取代所選範圍的字幕，可用復原找回。繼續？'))return;
    personEditing=false;const ids=[...new Set(indexes.map(i=>project.segments[i]?.takeId).filter(Boolean))],results={},sources={};speechCancelled=false;speechRequestController=new AbortController();captionUI.working(true);
    try{for(let i=0;i<ids.length;i++){const id=ids[i],blob=assets[id].camera,duration=project.takes.find(t=>t.id===id).duration;captionUI.progress(`${settings.provider==='api'?'API':'離線'}辨識 ${i+1}/${ids.length} 份素材…`);if(speechCancelled)throw new Error('已取消字幕辨識');let cues;
        if(settings.provider==='api')cues=await transcribeWithApi(blob,{endpoint:settings.endpoint,apiKey:settings.apiKey,model:settings.apiModel,language:settings.language,duration,signal:speechRequestController.signal});
        else if(window.studioNative?.transcribe)cues=await window.studioNative.transcribe(new Uint8Array(await blob.arrayBuffer()),{language:settings.language,modelId:settings.modelId});
        else cues=await transcribeInBrowser(blob,{language:settings.language,modelId:settings.modelId});
        if(speechCancelled)throw new Error('已取消字幕辨識');sources[id]={version:1,provider:settings.provider,model:settings.provider==='api'?settings.apiModel:settings.modelId,language:settings.language,cues:structuredClone(cues)};results[id]=splitReadableCues(cues.map(c=>({...c,start:Math.max(0,c.start),end:Math.min(duration,c.end)})).filter(c=>c.end>c.start),{phrasing:settings.phrasing});}
      await edit(p=>({...p,takes:p.takes.map(t=>sources[t.id]?{...t,captionSource:sources[t.id]}:t),segments:p.segments.map((s,i)=>indexes.includes(i)?{...s,captions:structuredClone(results[s.takeId])}:s)}));const count=indexes.reduce((n,i)=>n+(project.segments[i].captions?.length||0),0);captionUI.progress(count?`辨識完成：${count} 句，已保留原始文字與時間資訊，請逐句校對。`:'未辨識到可用語音；可手動新增或匯入 SRT。');
    }catch(error){captionUI.progress(speechCancelled||error.name==='AbortError'?'已取消辨識，原有字幕未變更。':`辨識失敗：${error.message}`);if(!speechCancelled&&error.name!=='AbortError')throw error;}finally{speechRequestController=null;captionUI.working(false);}
  });}
captionUI=mountCaptions({recognize:recognizeCaptions,cancel:()=>{speechCancelled=true;speechRequestController?.abort();window.studioNative?.cancelSpeech();captionUI.progress('正在取消辨識…');},seek:scrubTo,
  modelStatuses:()=>window.studioNative?.speechModels?window.studioNative.speechModels():browserModelStatuses(),
  downloadModel:async(id,progress)=>{modelDownloadProgress=progress;try{if(window.studioNative?.downloadSpeechModel)await window.studioNative.downloadSpeechModel(id);else{modelDownloadController=new AbortController();await downloadBrowserModel(id,{signal:modelDownloadController.signal,progress});}}finally{modelDownloadProgress=null;modelDownloadController=null;}},
  cancelModel:()=>{window.studioNative?.cancelModelDownload();modelDownloadController?.abort();},removeModel:id=>window.studioNative?.removeSpeechModel?window.studioNative.removeSpeechModel(id):removeBrowserModel(id),importModel:importBrowserModel,
  resegment:phrasing=>guarded(()=>edit(p=>({...p,segments:p.segments.map(s=>({...s,captions:splitReadableCues(s.captions||[],{phrasing})}))}))),
  merge:(id,index=selected)=>guarded(()=>edit(p=>mergeCaption(p,index,id))),
  split:(id,caret,index=selected)=>guarded(()=>edit(p=>{const active=clipAt(p,time);if(active?.index!==index)throw new Error('請先把播放頭移到這句字幕中間');return splitCue(p,index,id,active.segment.in+active.elapsed*(active.segment.speed||1),caret);})),
  add:()=>guarded(()=>edit(p=>{const s=p.segments[selected];if(!s)throw new Error('請先選取片段');const active=clipAt(p,time),start=active?.index===selected?Math.min(s.out-.01,s.in+active.elapsed*(s.speed||1)):s.in;return updateSegment(p,selected,{captions:[...(s.captions||[]),{id:crypto.randomUUID(),start,end:Math.min(s.out,start+2*(s.speed||1)),text:'請輸入字幕'}]});})),
  update:(id,change,index=selected)=>guarded(()=>edit(p=>{const s=p.segments[index];if(change.start!==undefined&&(change.start<s.in||change.start>=s.out)||change.end!==undefined&&(change.end>s.out||change.end<=s.in))throw new Error('字幕時間須在所屬片段內');return updateCue(p,index,id,{...change,timing:'edited'});})),
  remove:(id,index=selected)=>guarded(()=>edit(p=>updateSegment(p,index,{captions:(p.segments[index].captions||[]).filter(c=>c.id!==id)}))),clear:()=>guarded(async()=>{if(confirm('清除此片段的所有字幕？可復原。'))await edit(p=>updateSegment(p,selected,{captions:[]}));}),
  import:file=>guarded(async()=>{if(!file)return;const cues=parseSrt(await file.text());if(outputCues(project).length&&!confirm('SRT 使用整支成品的時間，將取代目前所有字幕，繼續？'))return;await edit(p=>applyOutputCues(p,cues));}),
  export:()=>guarded(()=>{const cues=outputCues(project);if(!cues.length)throw new Error('尚無可匯出的字幕');download(new Blob(['\uFEFF',serializeSrt(cues)],{type:'text/plain;charset=utf-8'}),'EduVideo.srt');}),style:(key,value)=>liveEdit(p=>({...p,captionStyle:{...p.captionStyle,[key]:value}}))});
window.studioNative?.onSpeechProgress(value=>captionUI.progress(value.stage==='extract'?'正在準備音訊…':`本機辨識中 ${value.percent}%`));
$('properties-person').addEventListener('click',()=>{personEditing=true;layoutControls();});
for(const id of ['properties-clip','properties-captions'])$(id).addEventListener('click',()=>{personEditing=false;layoutControls();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){personEditing=false;layoutControls();}});
slideLibrary=mountSlideLibrary({getState:()=>({slides,page}),apply:async next=>{({slides,page}=next);showSlide();await save();},select:i=>{page=i;recordingWorkspace?.select('slides');showSlide();},locked:()=>busy||Boolean(recording),onImport:()=>$('file').click(),status});$('file').multiple=true;
recordingWorkspace=mountRecordingWorkspace({canvas,ctx,getMode:()=>mode,getBusy:()=>busy,getRecording:()=>recording,getPreview:()=>preview,getPage:()=>page,getSlideCount:()=>slides.length,getSlide:()=>slides[page],getNotes:()=>$('notes').value,setNotes:value=>{$('notes').value=value;},redraw:drawSlide,replaceAnnotations:(items,transient)=>annotations?.replace(items,transient),status});
annotations=installAnnotations({canvas,getSlide:()=>recordingWorkspace.document,isRecordingView:()=>mode==='record'&&!busy,redraw:()=>{drawSlide();recordingWorkspace.syncTools();},save,status});
$('source').onchange=()=>{if($('source').value==='slides')recordingWorkspace.select('slides');else recordingWorkspace.prepare();};
document.addEventListener('keydown', e => {
  const mod=e.metaKey||e.ctrlKey,key=e.key.toLowerCase();
  if(mod&&key==='s'){e.preventDefault();if(!busy&&!recording)$('project-save').click();return;}
  const focus=document.activeElement,transport=focus?.closest('#timeline');
  if(e.code==='Space'&&transport&&focus?.matches('input[type=range]')&&!busy&&!recording&&mode==='edit'){e.preventDefault();if(!e.repeat)$('play').click();return;}
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || busy || recording || mode !== 'edit') return;
  if(mod&&['c','x','v','d'].includes(key)){e.preventDefault();clipCommand({c:'copy',x:'cut',v:'paste',d:'duplicate'}[key]);return;}
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();stepTime((e.key==='ArrowLeft'?-1:1)*(e.shiftKey?1:1/30));return;}
  const id=mod&&key==='z'?(e.shiftKey?'redo':'undo'):mod&&key==='b'?'split':e.code==='Space'?'play':key==='s'?'split':key==='i'?'trim-head':key==='o'?'trim-tail':e.key==='Delete'||e.key==='Backspace'?'delete':null;if(id){e.preventDefault();if(id!=='play'||!e.repeat)$(id).click();}
});
document.body.dataset.mode = 'record';
window.onbeforeunload = e => { if (recording || busy) { e.preventDefault(); e.returnValue = ''; } };
try {
  store = await openStore(); const saved = await store.load();
  if (saved) { ({ project, assets, slides } = saved); $('notes').value = saved.notes || ''; }
  const recovery = await store.recovery();
  if (recovery?.screen?.size && recovery?.camera?.size && !project.takes.some(t => t.id === recovery.id)) {
    assets[recovery.id] = { screen: recovery.screen, camera: recovery.camera }; project = addTake(project, { id: recovery.id, duration: recovery.duration }); await save(); await store.saveRecovery(null); status('已恢復上次中斷錄製的備援片段');
  } else status(saved ? '已還原專案與原始素材' : '先匯入簡報，再開啟相機與麥克風');
  showSlide(); timeline(); layoutControls();
  const receiveNative=()=>guarded(async()=>{if(recording){status('請先停止錄製，再從「開啟專案」載入檔案');return;}if(project.takes.length&&!confirm('要開啟傳入的 .eduv 專案？請先確認目前工作已儲存。')){await window.studioNative?.forgetProject();return;}const incoming=await window.studioNative?.pendingProject();if(incoming)await acceptNativeProject(incoming);});
  const incoming=await window.studioNative?.pendingProject();if(incoming){if(!project.takes.length||confirm('要開啟 .eduv 專案並取代目前工作？'))await acceptNativeProject(incoming);else await window.studioNative?.forgetProject();}
  window.studioNative?.onProjectAvailable(receiveNative);
} catch (e) { status(`儲存空間無法開啟：${e.message}`); }
requestAnimationFrame(tick);
