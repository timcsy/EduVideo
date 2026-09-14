export function changeSlides(state,action){
  const slides=state.slides.slice();let page=state.page;
  if(action.type==='insert'){
    if(!action.slides?.length)return state;
    page=slides.length?page+1:0;slides.splice(page,0,...structuredClone(action.slides));
  }else if(action.type==='move'){
    const {from,to}=action;
    if(!Number.isInteger(from)||!Number.isInteger(to)||!slides[from]||!slides[to])throw new Error('無效的頁面位置');
    if(from===to)return state;
    const selected=slides[page],[moved]=slides.splice(from,1);slides.splice(to,0,moved);page=slides.indexOf(selected);
  }else if(action.type==='duplicate'){
    if(!slides[page])return state;
    slides.splice(page+1,0,structuredClone(slides[page]));page++;
  }else if(action.type==='delete'){
    if(!slides[page])return state;
    slides.splice(page,1);page=Math.max(0,Math.min(page,slides.length-1));
  }else throw new Error('不支援的頁面操作');
  return {slides,page};
}
