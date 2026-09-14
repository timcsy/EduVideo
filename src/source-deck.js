export function containRect(sw,sh,w=1280,h=720){
  if(!(sw>0&&sh>0))return {x:0,y:0,width:w,height:h};
  const scale=Math.min(w/sw,h/sh),width=sw*scale,height=sh*scale;
  return {x:(w-width)/2,y:(h-height)/2,width,height};
}
export class SourceDeck {
  constructor(){this.items=[{id:'slides',name:'簡報',annotations:[]}];this.activeId='slides';}
  get current(){return this.items.find(s=>s.id===this.activeId);}
  add(source){if(this.items.some(s=>s.id===source.id))throw new Error('來源已存在');this.items.push({...source,annotations:[]});}
  select(id){if(!this.items.some(s=>s.id===id))throw new Error('來源已關閉，請重新準備');this.activeId=id;return this.current;}
  remove(id){if(id==='slides')return;if(this.activeId===id)this.activeId='slides';const s=this.items.find(s=>s.id===id);s?.stream?.getTracks().forEach(t=>t.stop());if(s?.video){s.video.pause();s.video.srcObject=null;s.video.remove();}this.items=this.items.filter(s=>s.id!==id);}
  dispose(){for(const s of [...this.items])this.remove(s.id);}
}
