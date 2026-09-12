import {captionEntries} from './captions.js';

export const captionTime=seconds=>{
  const ms=Math.round(Math.max(0,seconds)*1000);
  return `${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;
};

export function mountCaptionWorkspace(host,actions){
  host.innerHTML=`<div class="caption-navigation"><input id="caption-search" type="search" placeholder="搜尋全片字幕…" aria-label="搜尋全片字幕"><div class="two-columns"><select id="caption-scope" aria-label="字幕範圍"><option value="all">整支影片</option><option value="clip">選取片段</option></select><button id="caption-current">定位目前字幕</button></div><div class="two-columns"><label><input id="caption-follow" type="checkbox" checked> 跟隨播放</label><input id="caption-go-time" placeholder="跳至 02:30 或秒數" aria-label="跳至影片時間"></div><p id="caption-count" class="hint" role="status"></p></div><div id="caption-rows"></div><div class="caption-pagination"><button id="caption-page-prev">上一頁</button><span id="caption-page"></span><button id="caption-page-next">下一頁</button></div>`;
  const $=id=>host.querySelector(`#${id}`),pageSize=40;
  let project,index=0,busy=false,entries=[],filtered=[],page=0,selectedKey=null,currentKey=null,position=0;
  const editing=()=>Boolean(document.activeElement?.closest('#caption-rows textarea, #caption-rows input'));
  function filter(){const query=$('caption-search').value.trim().toLocaleLowerCase();filtered=entries.filter(c=>($('caption-scope').value==='all'||c.segmentIndex===index)&&(!query||c.text.toLocaleLowerCase().includes(query)));page=Math.min(page,Math.max(0,Math.ceil(filtered.length/pageSize)-1));}
  function locate(){const cue=entries.find(c=>position>=c.start&&position<c.end)||entries.find(c=>c.start>=position)||entries.at(-1);if(!cue)return;$('caption-search').value='';$('caption-scope').value='all';filter();page=Math.floor(filtered.findIndex(c=>c.key===cue.key)/pageSize);selectedKey=cue.key;render();scrollCurrent(cue.key);}
  function scrollCurrent(key){const container=$('caption-rows'),row=[...container.children].find(r=>r.dataset.key===key);if(!row)return;const bounds=container.getBoundingClientRect(),item=row.getBoundingClientRect();if(item.top<bounds.top)container.scrollTop+=item.top-bounds.top;else if(item.bottom>bounds.bottom)container.scrollTop+=item.bottom-bounds.bottom;}
  function render(){
    filter();const pages=Math.max(1,Math.ceil(filtered.length/pageSize));$('caption-count').textContent=`${filtered.length} / ${entries.length} 句 · 點選文字編輯，時間按鈕可跳轉`;$('caption-page').textContent=`${page+1} / ${pages}`;$('caption-page-prev').disabled=page===0;$('caption-page-next').disabled=page+1>=pages;
    $('caption-rows').replaceChildren(...filtered.slice(page*pageSize,(page+1)*pageSize).map(cue=>{
      const row=document.createElement('article');row.className='caption-row compact-caption';row.dataset.key=cue.key;row.dataset.active=String(cue.key===currentKey);
      const head=document.createElement('div');head.className='caption-row-head';const jump=document.createElement('button');jump.textContent=captionTime(cue.start);jump.title='跳至這句字幕';jump.onclick=()=>actions.seek(cue.start);
      const number=document.createElement('span');number.className='hint';number.textContent=`#${entries.indexOf(cue)+1} · 片段 ${cue.segmentIndex+1}`;head.append(jump,number);row.append(head);
      if(selectedKey!==cue.key){const text=document.createElement('button');text.className='caption-text-button';text.textContent=cue.text;text.disabled=busy;text.onclick=()=>{selectedKey=cue.key;render();const field=[...$('caption-rows').children].find(r=>r.dataset.key===cue.key)?.querySelector('textarea');field?.focus({preventScroll:true});};row.append(text);return row;}
      const field=document.createElement('textarea');field.value=cue.text;field.rows=3;field.setAttribute('aria-label',`編輯字幕 ${entries.indexOf(cue)+1}`);field.onchange=()=>actions.update(cue.id,{text:field.value},cue.segmentIndex);row.append(field);
      field.onkeydown=event=>{if(event.key==='Escape'){field.blur();selectedKey=null;render();}if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){event.preventDefault();field.blur();const next=filtered[filtered.findIndex(c=>c.key===cue.key)+1];if(next){selectedKey=next.key;page=Math.floor(filtered.indexOf(next)/pageSize);render();[...$('caption-rows').children].find(r=>r.dataset.key===next.key)?.querySelector('textarea')?.focus();}}};
      const times=document.createElement('div');times.className='two-columns';for(const side of ['start','end']){const label=document.createElement('label');label.textContent=side==='start'?'開始（影片秒）':'結束（影片秒）';const input=document.createElement('input');input.type='number';input.step='.01';input.value=cue[side].toFixed(2);input.min=cue.offset;const segment=project.segments[cue.segmentIndex];input.onchange=()=>actions.update(cue.id,{[side]:segment.in+(Number(input.value)-cue.offset)*(segment.speed||1)},cue.segmentIndex);label.append(input);times.append(label);}row.append(times);
      const buttons=document.createElement('div');buttons.className='caption-row-actions';for(const[label,callback]of [['在播放頭分割',()=>actions.split(cue.id,field.selectionStart,cue.segmentIndex)],['與下一句合併',()=>actions.merge(cue.id,cue.segmentIndex)],['刪除',()=>actions.remove(cue.id,cue.segmentIndex)]]){const button=document.createElement('button');button.textContent=label;button.onclick=callback;buttons.append(button);}row.append(buttons);for(const element of row.querySelectorAll('textarea,input,button'))element.disabled=busy;return row;
    }));
    if(!filtered.length){const empty=document.createElement('p');empty.className='hint';empty.textContent=entries.length?'找不到符合的字幕，請更換搜尋文字或範圍。':'尚無字幕。展開「自動辨識與模型」，或匯入 SRT 開始。';$('caption-rows').append(empty);}
  }
  $('caption-search').oninput=$('caption-scope').onchange=()=>{page=0;render();$('caption-rows').scrollTop=0;};$('caption-current').onclick=locate;
  $('caption-page-prev').onclick=()=>{page--;render();$('caption-rows').scrollTop=0;};$('caption-page-next').onclick=()=>{page++;render();$('caption-rows').scrollTop=0;};
  $('caption-go-time').onkeydown=event=>{if(event.key!=='Enter')return;const input=event.currentTarget,parts=input.value.trim().split(':').map(Number),seconds=parts.reduce((sum,p)=>sum*60+p,0);if(!input.value.trim()||parts.length>3||parts.some(p=>!Number.isFinite(p)||p<0)){input.setCustomValidity('請輸入秒數或 分:秒');input.reportValidity();return;}input.setCustomValidity('');position=Math.min(seconds,entries.at(-1)?.end??seconds);actions.seek(position);locate();};
  return {
    sync(next,selected,isBusy){const changed=project!==next||index!==selected||busy!==isBusy;project=next;index=selected;busy=isBusy;if(changed){entries=captionEntries(project);render();}},
    update(time){position=time;const cue=entries.find(c=>time>=c.start&&time<c.end);const key=cue?.key||null;if(key===currentKey)return;currentKey=key;
      for(const row of $('caption-rows').children)row.dataset.active=String(row.dataset.key===key);
      if(!$('caption-follow').checked||editing()||!host.offsetParent||!cue||$('caption-search').value)return;
      const at=filtered.findIndex(c=>c.key===key);if(at<0)return;const nextPage=Math.floor(at/pageSize);if(nextPage!==page){page=nextPage;render();}scrollCurrent(key);
    }
  };
}
