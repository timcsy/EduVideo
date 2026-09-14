import {changeSlides} from './slide-deck.js';

export function mountSlideLibrary({getState,apply,select,locked,onImport,status}){
  const list=document.getElementById('slides'),past=[],future=[];
  const bar=document.createElement('div');bar.id='slide-actions';bar.setAttribute('aria-label','簡報頁面操作');
  const actions=[['blank','＋','插入空白頁'],['duplicate','⧉','複製頁面 · ⌘/Ctrl+D'],['delete','⌫','刪除頁面 · Delete'],['up','↑','上移一頁 · Alt+↑'],['down','↓','下移一頁 · Alt+↓'],['undo','↶','復原頁面操作 · ⌘/Ctrl+Z'],['redo','↷','重做頁面操作 · ⌘/Ctrl+Shift+Z']];
  for(const [id,icon,label] of actions){const b=document.createElement('button');b.dataset.slideAction=id;b.textContent=icon;b.title=label;b.setAttribute('aria-label',label);b.onclick=()=>command(id);bar.append(b);}
  list.before(bar);document.getElementById('import').textContent='＋ 插入 PDF／圖片';
  document.getElementById('import').onclick=onImport;
  document.getElementById('library-hint').textContent='拖曳頁面排序 · 新頁插在選取頁之後 · 頁面操作可復原';
  async function commit(next,importing=false){
    if(locked()&&!importing)return;
    const previous=getState();if(next===previous)return;
    past.push(structuredClone(previous));if(past.length>100)past.shift();future.length=0;
    await apply(next);render();
  }
  function blank(){const c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);return {title:'空白頁',image:c.toDataURL('image/png'),annotations:[]};}
  async function command(action){
    if(locked())return;
    try{
      const s=getState();
      if(action==='undo'||action==='redo'){
        const from=action==='undo'?past:future,to=action==='undo'?future:past;if(!from.length)return;
        to.push(structuredClone(s));await apply(from.pop());render();return;
      }
      const op=action==='blank'?{type:'insert',slides:[blank()]}:action==='up'||action==='down'?{type:'move',from:s.page,to:s.page+(action==='up'?-1:1)}:{type:action};
      await commit(changeSlides(s,op));
      if(action==='delete')status('已刪除頁面，可按「復原頁面操作」找回；已錄製影片不受影響');
    }catch(e){status(e.message);}
  }
  function controls(){const {slides,page}=getState();for(const b of bar.querySelectorAll('button')){const action=b.dataset.slideAction;b.disabled=locked()||(action==='undo'?!past.length:action==='redo'?!future.length:action==='blank'?false:!slides.length||action==='up'&&page===0||action==='down'&&page===slides.length-1);}}
  function render(){
    const {slides,page}=getState();
    list.replaceChildren(...slides.map((slide,i)=>{
      const row=document.createElement('div');row.className='slide-card';row.dataset.index=i;
      const b=document.createElement('button'),img=new Image(),label=document.createElement('span');
      b.className='slide-select'+(i===page?' active':'');b.setAttribute('aria-current',i===page?'page':'false');b.title=slide.title||`第 ${i+1} 頁`;img.src=slide.image;img.alt=`第 ${i+1} 頁`;label.textContent=`${i+1} · ${slide.title||'簡報頁面'}`;b.append(img,label);b.onclick=()=>select(i);row.append(b);
      row.draggable=!locked();row.ondragstart=e=>{if(locked()){e.preventDefault();return;}e.dataTransfer.setData('application/x-eduv-slide',String(i));e.dataTransfer.effectAllowed='move';};
      row.ondragover=e=>{if(locked()||!Array.from(e.dataTransfer.types).includes('application/x-eduv-slide'))return;e.preventDefault();e.dataTransfer.dropEffect='move';row.classList.add('drop-target');};row.ondragleave=()=>row.classList.remove('drop-target');
      row.ondrop=e=>{e.preventDefault();row.classList.remove('drop-target');if(locked())return;const raw=e.dataTransfer.getData('application/x-eduv-slide');if(raw==='')return;try{commit(changeSlides(getState(),{type:'move',from:Number(raw),to:i})).catch(e=>status(e.message));}catch(e){status(e.message);}};
      return row;
    }));controls();
  }
  const library=list.closest('.library');
  library.addEventListener('keydown',e=>{
    if(document.body.dataset.mode!=='record'||locked()||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
    const mod=e.metaKey||e.ctrlKey,key=e.key.toLowerCase();
    const action=mod&&key==='d'?'duplicate':mod&&key==='z'?(e.shiftKey?'redo':'undo'):e.altKey&&e.key==='ArrowUp'?'up':e.altKey&&e.key==='ArrowDown'?'down':e.key==='Delete'||e.key==='Backspace'?'delete':null;
    if(action){e.preventDefault();e.stopPropagation();command(action).then(()=>list.querySelector('[aria-current=page]')?.focus());}
  });
  return {render,controls,reset(){past.length=0;future.length=0;},async insert(slides,importing=false){await commit(changeSlides(getState(),{type:'insert',slides}),importing);}};
}
