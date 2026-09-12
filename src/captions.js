import {segmentDuration} from './clip-tools.js';
const cueId=()=>globalThis.crypto?.randomUUID?.()||`c-${Math.random().toString(36).slice(2)}`;
export function splitCue(project,index,id,sourceTime,caret){const segment=project.segments[index],c=segment?.captions?.find(c=>c.id===id);if(!c||!Number.isFinite(sourceTime)||sourceTime<=Math.max(c.start,segment.in)||sourceTime>=Math.min(c.end,segment.out))throw new Error('請先把播放頭移到這句字幕中間');if(c.text.length<2)throw new Error('字幕至少需要兩個字才能分割');const cut=Math.max(1,Math.min(c.text.length-1,caret||Math.floor(c.text.length/2)));const captions=segment.captions.flatMap(item=>item.id!==id?[item]:[{...c,end:sourceTime,text:c.text.slice(0,cut).trim()},{...c,id:cueId(),start:sourceTime,text:c.text.slice(cut).trim()}]);return {...project,segments:project.segments.map((s,i)=>i===index?{...s,captions}:s)};}
export function validateCues(cues){if(!Array.isArray(cues))throw new Error('字幕資料無效');for(const c of cues)if(!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end<=c.start||typeof c.text!=='string')throw new Error('字幕起終點或文字無效');return cues;}
export function outputCues(project){const result=[];let offset=0;for(const s of project.segments){for(const c of s.captions||[]){const start=Math.max(s.in,c.start),end=Math.min(s.out,c.end);if(end>start)result.push({...c,start:offset+(start-s.in)/(s.speed||1),end:offset+(end-s.in)/(s.speed||1)});}offset+=segmentDuration(s);}return result.sort((a,b)=>a.start-b.start);}
export function applyOutputCues(project,cues){validateCues(cues);let offset=0;return {...project,segments:project.segments.map(s=>{const duration=segmentDuration(s),captions=[];for(const c of cues){const start=Math.max(offset,c.start),end=Math.min(offset+duration,c.end);if(end>start)captions.push({id:cueId(),text:c.text,start:s.in+(start-offset)*(s.speed||1),end:s.in+(end-offset)*(s.speed||1)});}offset+=duration;return {...s,captions};})};}
export function updateCue(project,index,id,change){const segment=project.segments[index];if(!segment)throw new Error('請先選取片段');const captions=(segment.captions||[]).map(c=>c.id===id?{...c,...change}:c);validateCues(captions);const take=project.takes.find(t=>t.id===segment.takeId);if(captions.some(c=>c.end>take.duration+.001))throw new Error('字幕不能超出原始素材');return {...project,segments:project.segments.map((s,i)=>i===index?{...s,captions}:s)};}
export function parseSrt(text){const blocks=String(text).replace(/^\uFEFF/,'').replace(/\r/g,'').trim().split(/\n\s*\n/),cues=[];const stamp=s=>{const m=s.match(/^(\d+):(\d{2}):(\d{2})[,.](\d{3})$/);if(!m||Number(m[2])>59||Number(m[3])>59)throw new Error('字幕時間格式無效');return Number(m[1])*3600+Number(m[2])*60+Number(m[3])+Number(m[4])/1000;};for(const block of blocks){const lines=block.split('\n');const i=lines.findIndex(l=>l.includes('-->'));if(i<0)throw new Error('不是有效的 SRT 字幕');const m=lines[i].trim().match(/^(\S+)\s+-->\s+(\S+)/);if(!m)throw new Error('字幕時間格式無效');cues.push({id:cueId(),start:stamp(m[1]),end:stamp(m[2]),text:lines.slice(i+1).join('\n')});}return validateCues(cues);}
export function serializeSrt(cues){const stamp=t=>{const ms=Math.round(Math.max(0,t)*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};return validateCues(cues).map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n');}
export function splitReadableCues(cues,{phrasing='natural'}={}){
  const split=validateCues(cues).flatMap(cue=>{
    const text=cue.text.trim();if(!text)return [];
    const boundaries=new Set([0,text.length]);
    // Use language sentence boundaries first; never slice by a character count.
    for(const sentence of new Intl.Segmenter(undefined,{granularity:'sentence'}).segment(text))boundaries.add(sentence.index+sentence.segment.length);
    // ASR often omits punctuation in Mandarin. A sentence particle followed by
    // a new subject, question or discourse starter is an audible clause ending.
    for(const match of text.matchAll(/[呢嗎吧喔哦囉啦](?=(?:那|我們|你們|他們|大家|我|你|他|她|它|這|不是|是不是|要不要|怎麼|為什麼|接下來|接著|然後|但是|所以))/gu))boundaries.add(match.index+match[0].length);
    if(phrasing!=='sentence'){
      for(const match of text.matchAll(/[，；;！？。]+[」』”’）)]*\s*|,(?=\s+(?:and|but|so|because|then|however)\b)\s*/gi))boundaries.add(match.index+match[0].length);
      // Discourse connectors are potential clause starts, never arbitrary character cuts.
      for(const match of text.matchAll(/(?:接著|然後|但是|因此|所以|不過|另外|最後)(?=\p{L})/gu))if(match.index>=4)boundaries.add(match.index);
      // A renewed subject + predicate starts another teaching statement. Keep
      // embedded clauses attached to their governing verb or conjunction.
      for(const match of text.matchAll(/(?:那)?(?:我們|你們|他們|大家|你|我)(?=(?:可以|需要|應該|要|會|先|再|現在|接下來))/gu)){
        const prefix=text.slice(0,match.index);
        if(match.index<4||/(?:如果|假如|只要|當|讓|把|跟|和|對|因為|知道|認為|覺得|希望|期待|告訴|提醒|表示|說|請|問|例如|比方說)$/.test(prefix))continue;
        boundaries.add(match.index);
      }
    }
    const words=[];let cursor=0;
    for(const word of cue.words||[]){const token=String(word.text??word.word??'').trim();const at=text.indexOf(token,cursor);if(!token||at<0||!Number.isFinite(word.start)||!Number.isFinite(word.end)||word.end<word.start)continue;const start=Math.max(cue.start,words.at(-1)?.end??cue.start,Math.min(cue.end,word.start)),end=Math.max(start,Math.min(cue.end,word.end));words.push({...word,text:token,start,end,from:at,to:at+token.length});cursor=at+token.length;}
    const wordStarts=new Set([...new Intl.Segmenter(undefined,{granularity:'word'}).segment(text)].map(w=>w.index));
    if(phrasing!=='sentence')for(let i=1;i<words.length;i++)if(words[i].start-words[i-1].end>=.65&&wordStarts.has(words[i].from)&&! /^[呢嗎吧喔哦囉啦齁啊的了][\p{P}\s]*$/u.test(text.slice(words[i].from)))boundaries.add(words[i].from);
    // Every split uses one shared source clock. Missing tokens interpolate only
    // between their nearest audio anchors, never against the whole paragraph.
    const clockAt=(position,side)=>{
      const containing=words.find(w=>side==='start'?w.from<=position&&position<w.to:w.from<position&&position<=w.to);
      if(containing)return containing.start+(containing.end-containing.start)*(position-containing.from)/(containing.to-containing.from);
      const left=words.findLast(w=>w.to<=position),right=words.find(w=>w.from>=position);
      if(side==='start'&&right&&!text.slice(position,right.from).replace(/[\p{P}\s]/gu,''))return right.start;
      if(side==='end'&&left&&!text.slice(left.to,position).replace(/[\p{P}\s]/gu,''))return left.end;
      const from=left?.to??0,to=right?.from??text.length,start=left?.end??cue.start,end=right?.start??cue.end;
      return to===from?start:start+(end-start)*(position-from)/(to-from);
    };
    const points=[...boundaries].sort((a,b)=>a-b),result=[];
    for(let i=1;i<points.length;i++){
      const raw=text.slice(points[i-1],points[i]),part=raw.trim();if(!part)continue;const from=points[i-1]+raw.indexOf(part),to=from+part.length;
      const aligned=words.filter(w=>w.to>from&&w.from<to).map(w=>{const start=Math.max(from,w.from),end=Math.min(to,w.to);return {...w,text:text.slice(start,end),start:clockAt(start,'start'),end:clockAt(end,'end'),from:start,to:end};});
      const exact=aligned.length&&text.slice(from,to).replace(/\s/g,'')===aligned.map(w=>text.slice(w.from,w.to)).join('').replace(/\s/g,'');
      const start=clockAt(from,'start'),end=clockAt(to,'end');
      if(end>start)result.push({...cue,id:result.length?cueId():cue.id,text:part,start,end,words:aligned.map(({from,to,...w})=>w),timing:exact?'aligned':words.length?'interpolated':'estimated'});
    }
    return result;
  });
  const result=[];for(const cue of split){const previous=result.at(-1);if(previous&&/^[呢嗎吧喔哦囉啦齁啊的了][\p{P}\s]*$/u.test(cue.text)&&cue.start>=previous.end-.05&&cue.start-previous.end<=1.5){previous.text+=cue.text;previous.end=Math.max(previous.end,cue.end);previous.words=[...(previous.words||[]),...(cue.words||[])];if(previous.timing!==cue.timing)previous.timing='interpolated';}else result.push({...cue});}return result;
}

export function captionEntries(project){
  let offset=0;const entries=[];
  project.segments.forEach((segment,segmentIndex)=>{
    for(const cue of segment.captions||[]){const start=Math.max(segment.in,cue.start),end=Math.min(segment.out,cue.end);if(end>start)entries.push({...cue,sourceStart:cue.start,sourceEnd:cue.end,start:offset+(start-segment.in)/(segment.speed||1),end:offset+(end-segment.in)/(segment.speed||1),offset,segmentIndex,key:`${segmentIndex}:${cue.id}`});}
    offset+=segmentDuration(segment);
  });return entries.sort((a,b)=>a.start-b.start||a.end-b.end);
}
export function mergeCaption(project,index,id){
  const captions=[...(project.segments[index]?.captions||[])].sort((a,b)=>a.start-b.start),at=captions.findIndex(c=>c.id===id),first=captions[at],next=captions[at+1];
  if(!first||!next)throw new Error('這是片段的最後一句，沒有下一句可合併');
  const separator=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]$/u.test(first.text.replace(/[\p{P}\s]+$/gu,''))?'':' ';
  captions.splice(at,2,{...first,end:Math.max(first.end,next.end),text:first.text+separator+next.text,words:undefined});
  return {...project,segments:project.segments.map((s,i)=>i===index?{...s,captions}:s)};
}

const hex=value=>/^#[0-9a-f]{6}$/i.test(value||'')?value.toLowerCase():null;
export function normalizeCaptionStyle(style={}){
  const presets=['plate','outline','shadow','minimal','brand'];
  return {enabled:style.enabled!==false,preset:presets.includes(style.preset)?style.preset:'plate',size:Math.max(18,Math.min(72,Number(style.size)||32)),position:['top','middle','bottom'].includes(style.position)?style.position:'bottom',color:hex(style.color)||'#ffffff',accentColor:hex(style.accentColor)||'#6aa9ff',backgroundColor:hex(style.backgroundColor)||'#000000',backgroundOpacity:Math.max(0,Math.min(1,Number(style.backgroundOpacity??.72))),outlineColor:hex(style.outlineColor)||'#000000',outlineWidth:Math.max(0,Math.min(8,Number(style.outlineWidth??3))),fontWeight:['500','600','700','800'].includes(String(style.fontWeight))?String(style.fontWeight):'600'};
}
export function drawCaptions(ctx,segment,sourceTime,style={}) {
  style=normalizeCaptionStyle(style);if(style.enabled===false)return;
  const active=(segment.captions||[]).filter(c=>sourceTime>=c.start&&sourceTime<c.end);if(!active.length)return;
  const {width,height}=ctx.canvas;let size=(style.size||32)*height/720,lines=[];
  ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
  const paragraphs=active.map(c=>c.text).join('\n').split('\n');
  // Reflow long captions without silently discarding their trailing lines.
  do{ctx.font=`${style.fontWeight} ${size}px system-ui`;lines=[];for(const para of paragraphs){let line='';for(const char of para){if(ctx.measureText(line+char).width>width*.86&&line){lines.push(line);line='';}line+=char;}if(line)lines.push(line);}if(lines.length*size*1.4<=height*.42||size<=10)break;size=Math.max(10,size-2);}while(true);
  const lineHeight=size*1.4,total=lines.length*lineHeight,y=style.position==='top'?height*.08:style.position==='middle'?height*.5-total/2:Math.max(height*.04,height*.95-total);
  const alpha=Math.round(style.backgroundOpacity*255).toString(16).padStart(2,'0');
  if(style.preset==='plate'){ctx.fillStyle=`${style.backgroundColor}${alpha}`;ctx.fillRect(width*.05,y-8,width*.9,total+16);}
  if(style.preset==='brand'){ctx.fillStyle=`${style.backgroundColor}${alpha}`;ctx.fillRect(width*.08,y-10,width*.84,total+20);ctx.fillStyle=style.accentColor;ctx.fillRect(width*.08,y-10,Math.max(7,width*.008),total+20);}
  if(style.preset==='shadow'){ctx.shadowColor='#000';ctx.shadowBlur=size*.28;ctx.shadowOffsetY=size*.12;}
  ctx.fillStyle=style.color;ctx.strokeStyle=style.outlineColor;ctx.lineWidth=style.outlineWidth*height/720;
  lines.forEach((line,i)=>{const lineY=y+lineHeight*(i+.5);if(style.preset==='outline'&&style.outlineWidth)ctx.strokeText(line,width/2,lineY);ctx.fillText(line,width/2,lineY);});ctx.restore();
}
