import {makeAnnotation,drawAnnotation,hitAnnotation,moveAnnotation} from './annotation-tools.js';
export function installAnnotations({canvas,getSlide,isRecordingView,redraw,save,status}) {
  const bar=document.createElement('div');bar.className='annotation-bar';bar.setAttribute('aria-label','簡報標記工具');
  const names={select:'選取／移動',pen:'畫筆',highlight:'螢光筆',arrow:'箭頭',line:'直線',rectangle:'矩形',ellipse:'橢圓',text:'文字',eraser:'橡皮擦',laser:'雷射筆'};
  bar.innerHTML=`<select id="annotation-tool" aria-label="標記工具">${Object.entries(names).map(([k,v])=>`<option value="${k}" ${k==='pen'?'selected':''}>${v}</option>`).join('')}</select><input id="annotation-color" type="color" value="#ff5268" aria-label="標記顏色"><select id="annotation-width" aria-label="標記粗細"><option value="2">細</option><option value="4" selected>中</option><option value="8">粗</option></select><button id="annotation-undo" title="復原這頁的標記">復原標記</button><button id="annotation-redo">重做</button><button id="annotation-delete">刪除選取</button>`;
  document.querySelector('.slide-tools').before(bar);
  const textInput=document.createElement('input');textInput.id='annotation-text';textInput.placeholder='輸入標記文字，再點畫面';textInput.maxLength=160;textInput.setAttribute('aria-label','標記文字');textInput.hidden=true;bar.append(textInput);
  const $=id=>document.getElementById(id),past=new WeakMap(),future=new WeakMap();let gesture,selected=-1,laser,laserTimer;
  $('annotation-tool').onchange=()=>{textInput.hidden=$('annotation-tool').value!=='text';if(!textInput.hidden)textInput.focus();};
  const snapshot=s=>structuredClone(s.annotations||[]);
  function remember(s) { if(s.strokes?.length){s.annotations||=[];for(const points of s.strokes)if(points.length)s.annotations.push({...makeAnnotation('pen',points[0],points.at(-1)),points:structuredClone(points)});s.strokes=[];}const h=past.get(s)||[];h.push(snapshot(s));past.set(s,h.slice(-100));future.set(s,[]); }
  function finish(){redraw();save().catch(e=>status(e.message));}
  const point=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)/r.width*canvas.width,(e.clientY-r.top)/r.height*canvas.height];};
  $('annotation-undo').onclick=()=>{const s=getSlide(),h=s&&past.get(s);if(!h?.length)return;const f=future.get(s)||[];f.push(snapshot(s));future.set(s,f);s.annotations=h.pop();selected=-1;finish();};
  $('annotation-redo').onclick=()=>{const s=getSlide(),f=s&&future.get(s);if(!f?.length)return;const h=past.get(s)||[];h.push(snapshot(s));past.set(s,h);s.annotations=f.pop();selected=-1;finish();};
  $('annotation-delete').onclick=()=>{const s=getSlide();if(!s?.annotations?.[selected])return;remember(s);s.annotations.splice(selected,1);selected=-1;finish();};
  $('clear').onclick=()=>{const s=getSlide();if(!s)return;remember(s);s.annotations=[];s.strokes=[];finish();};
  canvas.addEventListener('pointerdown',e=>{
    if(!isRecordingView())return;e.stopImmediatePropagation();const s=getSlide();if(!s)return;
    const p=point(e),tool=$('annotation-tool').value; canvas.setPointerCapture(e.pointerId);e.preventDefault();
    if(tool==='laser'){gesture={tool};laser=p;redraw();return;}
    s.annotations||=[];const hit=s.annotations.findLastIndex(a=>hitAnnotation(a,p));
    if(tool==='eraser'){if(hit>=0){remember(s);s.annotations.splice(hit,1);finish();}return;}
    if(tool==='select'){selected=hit;if(hit>=0){remember(s);gesture={tool,s,start:p,original:structuredClone(s.annotations[hit]),index:hit};status('已選取標記：拖曳移動，或按「刪除選取」');}return;}
    const text=tool==='text'?textInput.value.trim():'';if(tool==='text'&&!text){textInput.focus();status('請先在工具列輸入標記文字，再點一下簡報');return;}
    remember(s);const a=makeAnnotation(tool,p,p,{color:$('annotation-color').value,width:Number($('annotation-width').value),text});s.annotations.push(a);selected=s.annotations.length-1;
    if(tool!=='text')gesture={tool,s,index:selected};finish();
  },true);
  canvas.addEventListener('pointermove',e=>{if(!isRecordingView())return;e.stopImmediatePropagation();if(!gesture)return;const p=point(e);
    if(gesture.tool==='laser'){laser=p;redraw();return;}
    const g=gesture,a=g.s.annotations[g.index];if(g.tool==='select')g.s.annotations[g.index]=moveAnnotation(g.original,p[0]-g.start[0],p[1]-g.start[1]);
    else {a.end=p;if(g.tool==='pen'||g.tool==='highlight')a.points.push(p);else a.points=[a.start,p];}redraw();
  },true);
  const end=e=>{if(!isRecordingView())return;e.stopImmediatePropagation();if(gesture?.tool==='laser'){clearTimeout(laserTimer);laserTimer=setTimeout(()=>{laser=null;redraw();},500);}gesture=null;finish();};
  canvas.addEventListener('pointerup',end,true);canvas.addEventListener('pointercancel',end,true);
  return {draw(ctx){for(const a of getSlide()?.annotations||[])drawAnnotation(ctx,a);if(laser){ctx.save();ctx.shadowColor='#ff3344';ctx.shadowBlur=20;ctx.fillStyle='#ff3344';ctx.beginPath();ctx.arc(...laser,7,0,Math.PI*2);ctx.fill();ctx.restore();}}};
}
