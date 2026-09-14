import {makeAnnotation,drawAnnotation,hitAnnotation} from './annotation-tools.js';
import {cameraPreviewReceiver} from './camera-preview.js';
const api=window.desktopTools,role=new URLSearchParams(location.search).get('role'),root=document.querySelector('#tools');
document.body.dataset.role=role;
let state={},items=[],past=[],gesture=null,tool='pen',color='#ff5268',width=4;
const icons={
  camera:'M3 6h12v12H3z M15 10l6-4v12l-6-4',
  record:'M12 4a8 8 0 110 16 8 8 0 010-16',
  'prev-slide':'M15 5l-7 7 7 7',
  'next-slide':'M9 5l7 7-7 7',
  draw:'M4 20l4-1 12-12-4-4L4 15v5 M14 5l4 4',
  notes:'M5 3h11l3 3v15H5z M8 9h8 M8 13h8 M8 17h5',
  return:'M3 11l9-8 9 8 M6 9v12h12V9 M10 21v-7h4v7',
  undo:'M8 4L3 9l5 5 M3 9h10a7 7 0 010 14',
  clear:'M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',
  align:'M8 3H3v5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5 M7 7h10v10H7z',
  'pause-record':'M8 5v14 M16 5v14',
  'stop-record':'M6 6h12v12H6z',
  close:'M5 9l7 7 7-7',
  play:'M7 4l14 8-14 8z'
};
const svg=name=>'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="'+icons[name]+'"/></svg>';
function labelButton(button,label,icon){button.title=label;button.setAttribute('aria-label',label);button.innerHTML=svg(icon||button.dataset.action);}
if(role==='toolbar'){
  root.innerHTML='<header><span>⠿ EduVideo</span><output id="record-state" role="status">待機</output><button data-action="return">回工作室 · ⌘/Ctrl+Shift+H</button></header><section><button data-action="record">開始錄製</button><button data-action="pause-record">暫停錄製</button><button data-action="camera">人像預覽</button><button data-action="notes">講者筆記</button><button data-action="draw">開始畫記</button><select id="tool" aria-label="畫記工具"><option value="pen">畫筆</option><option value="highlight">螢光筆</option><option value="arrow">箭頭</option><option value="line">直線</option><option value="rectangle">矩形</option><option value="ellipse">橢圓</option><option value="eraser">橡皮擦</option></select><input id="color" type="color" value="#ff5268" aria-label="顏色"><button data-action="undo">復原</button><button data-action="clear">清除</button><select id="sources" aria-label="準備好的來源"></select><button data-action="align">對齊視窗範圍</button><button data-action="prev-slide">上一頁</button><button data-action="next-slide">下一頁</button></section><small id="hint"></small>';
  root.onclick=e=>{const button=e.target.closest('[data-action]');if(button)api.command({type:button.dataset.action});};
  document.querySelector('#tool').onchange=e=>api.command({type:e.target.value});
  document.querySelector('#color').oninput=e=>api.command({type:'color',value:e.target.value});
  document.querySelector('#sources').onchange=e=>api.command({type:'source',id:e.target.value});
  const annotationRow=root.querySelector('section');annotationRow.className='annotation-controls';annotationRow.setAttribute('aria-label','畫記與預覽');
  const recordingRow=document.createElement('section');recordingRow.className='recording-controls';recordingRow.setAttribute('aria-label','錄製與來源');annotationRow.after(recordingRow);
  for(const selector of ['[data-action=record]','[data-action=pause-record]','#sources','[data-action=align]','[data-action=prev-slide]','[data-action=next-slide]'])recordingRow.append(root.querySelector(selector));
  for(const selector of ['[data-action=draw]','#tool','#color','[data-action=undo]','[data-action=clear]','[data-action=notes]','[data-action=camera]'])annotationRow.append(root.querySelector(selector));
  for(const button of root.querySelectorAll('[data-action]'))labelButton(button,button.textContent);
}else if(role==='camera'){
  root.innerHTML='<header><span>人像預覽 · 鏡像</span><button title="收起人像預覽（不影響錄製）" aria-label="收起人像預覽">×</button></header><video autoplay muted playsinline></video><p id="camera-error" role="status"></p>';
  root.querySelector('button').onclick=()=>api.command({type:'camera'});
  cameraPreviewReceiver(api,root.querySelector('video'),e=>{document.querySelector('#camera-error').textContent='人像預覽連線失敗：'+e.message;});
}else if(role==='notes'){
  root.innerHTML='<header>講者筆記 <button data-action="notes">收起</button></header><textarea aria-label="講者筆記" placeholder="輸入大綱或逐字稿…"></textarea>';
  root.querySelector('button').onclick=()=>api.command({type:'notes'});
  root.querySelector('textarea').oninput=e=>api.notes(e.target.value);
}else{
  root.innerHTML='<canvas></canvas><div id="align" hidden><header>拖曳與調整視窗邊緣，對齊錄製視窗的內容範圍；再按一次「對齊視窗範圍」完成。</header></div>';
  const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d');
  function redraw(){
    canvas.width=innerWidth;canvas.height=innerHeight;
    const r=state.rect||{x:0,y:0,width:1280,height:720};
    ctx.scale(canvas.width/r.width,canvas.height/r.height);ctx.translate(-r.x,-r.y);
    for(const a of items)drawAnnotation(ctx,a);
  }
  function publish(transient=false){api.annotations({sourceId:state.source?.id,annotations:items,transient});redraw();}
  const point=e=>{const r=state.rect||{x:0,y:0,width:1280,height:720};return[r.x+e.clientX/innerWidth*r.width,r.y+e.clientY/innerHeight*r.height];};
  canvas.onpointerdown=e=>{
    if(!state.draw)return;
    past.push(structuredClone(items));past=past.slice(-100);canvas.setPointerCapture(e.pointerId);
    const p=point(e);
    if(tool==='eraser'){const i=items.findLastIndex(a=>hitAnnotation(a,p));if(i>=0)items.splice(i,1);publish();return;}
    gesture=makeAnnotation(tool,p,p,{color,width});items.push(gesture);redraw();
  };
  canvas.onpointermove=e=>{if(!gesture)return;gesture.end=point(e);gesture.points.push(gesture.end);publish(true);};
  canvas.onpointerup=()=>{gesture=null;publish();};canvas.onpointercancel=canvas.onpointerup;
  api.onCommand(value=>{if(value.type==='undo'){if(past.length)items=past.pop();publish();}else if(value.type==='clear'){past.push(structuredClone(items));items=[];publish();}else if(value.type==='color')color=value.value;else tool=value.type;});
  window.onresize=redraw;
  window.addEventListener('keydown',e=>{if(e.key==='Escape')api.command({type:'draw'});});
  api.onState(value=>{
    if(state.source?.id!==value.source?.id){past=[];gesture=null;}
    state=value;if(!gesture)items=structuredClone(value.annotations||[]);
    document.body.dataset.align=String(value.align);document.querySelector('#align').hidden=!value.align;
    redraw();
  });
}
if(role!=='overlay')api.onState(value=>{
  state=value;
  if(role==='camera')return;
  if(role==='notes'){const el=root.querySelector('textarea');if(el!==document.activeElement)el.value=value.notes||'';return;}
  const draw=root.querySelector('[data-action=draw]');labelButton(draw,value.draw?'結束畫記／操作桌面 · ⌘/Ctrl+Shift+D':'開始畫記 · ⌘/Ctrl+Shift+D');draw.setAttribute('aria-pressed',Boolean(value.draw));
  draw.disabled=value.source?.kind==='slides';
  root.querySelector('[data-action=notes]').setAttribute('aria-pressed',Boolean(value.notesVisible));
  const record=root.querySelector('[data-action=record]');record.disabled=Boolean(value.busy);labelButton(record,value.recording?'停止並保存':'開始錄製',value.recording?'stop-record':'record');record.dataset.recording=Boolean(value.recording);
  root.querySelector('[data-action=pause-record]').disabled=!value.recording||value.busy;labelButton(root.querySelector('[data-action=pause-record]'),value.paused?'繼續錄製':'暫停錄製',value.paused?'play':'pause-record');
  const camera=root.querySelector('[data-action=camera]'),previewShown=value.cameraVisible&&value.cameraReady;camera.disabled=Boolean(value.busy);camera.setAttribute('aria-pressed',Boolean(previewShown));labelButton(camera,previewShown?'收起人像預覽（不影響錄製）':'顯示人像預覽（不影響錄製）');
  document.querySelector('#record-state').textContent=value.countdown?'倒數 '+value.countdown:value.busy?'處理中…':value.status?.startsWith('操作失敗')?value.status:value.recording?(value.paused?'暫停 · ':'錄製 · ')+(value.clock||'0 秒'):'待機';
  document.querySelector('#record-state').title=value.status||'';
  for(const action of ['prev-slide','next-slide']){const b=root.querySelector('[data-action='+action+']');b.hidden=value.source?.kind!=='slides';b.disabled=value.busy||!value.slideCount||(action==='prev-slide'?value.page<=0:value.page>=value.slideCount-1);}
  root.querySelector('[data-action=align]').hidden=value.source?.kind!=='window';
  const list=document.querySelector('#sources');list.replaceChildren(...(value.sources||[]).map(s=>new Option(s.name,s.id)));list.value=value.source?.id||'slides';
  document.querySelector('#hint').textContent='⌘/Ctrl+Shift+D 畫記 · N 筆記 · H 關閉 · 1–5 切換來源。'+(value.source?.kind==='screen'?'整個螢幕錄製可能包含工具與筆記，建議移至未錄製的螢幕。':value.source?.kind==='window'?'首次請對齊視窗範圍；移動或縮放來源後請重新對齊。':'簡報標記請在工作室操作。');
});
