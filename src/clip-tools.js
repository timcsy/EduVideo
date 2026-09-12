export const segmentDuration = s => (s.out - s.in) / (s.speed || 1);
export const compositionProject = (project,segment) => ({...project,layout:{...project.layout,...segment?.layout}});
export function duplicateSegment(project, index) {
  if (!project.segments[index]) throw new Error('請先選取片段');
  const segments = project.segments.slice(); segments.splice(index + 1, 0, { ...segments[index] });
  return { ...project, segments };
}
export function updateSegment(project, index, change) {
  if (!project.segments[index]) throw new Error('請先選取片段');
  const s = { ...project.segments[index], ...change };
  if (s.speed !== undefined && (!Number.isFinite(s.speed) || s.speed < .25 || s.speed > 4)) throw new Error('速度須為 0.25–4 倍');
  if (s.volume !== undefined && (!Number.isFinite(s.volume) || s.volume < 0 || s.volume > 1)) throw new Error('音量須為 0–100%');
  for (const key of ['fadeIn','fadeOut']) if (s[key] !== undefined && (!Number.isFinite(s[key]) || s[key] < 0 || s[key] > 3)) throw new Error('淡入淡出須為 0–3 秒');
  return { ...project, segments: project.segments.map((v,i)=>i === index ? s : v) };
}
export function clipAt(project, time) {
  let offset = 0;
  for (let i=0; i<project.segments.length; i++) { const segment=project.segments[i], duration=segmentDuration(segment); if(time < offset+duration) return { segment, index:i, elapsed:Math.max(0,time-offset) }; offset+=duration; }
  const index=project.segments.length-1; return index>=0 ? {segment:project.segments[index],index,elapsed:segmentDuration(project.segments[index])} : null;
}
export function clipOpacity(segment, elapsed) {
  return Math.max(0, Math.min(1, segment.fadeIn ? elapsed/segment.fadeIn : 1, segment.fadeOut ? (segmentDuration(segment)-elapsed)/segment.fadeOut : 1));
}
export function drawClipOverlay(ctx, segment, elapsed) {
  const {width,height}=ctx.canvas;
  if(segment.title) { ctx.save(); ctx.font=`600 ${height*.047}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle';
    const text=String(segment.title).slice(0,160),top=segment.captions?.length ? .68 : .82; ctx.fillStyle='#10131ddd'; ctx.fillRect(width*.08,height*top,width*.84,height*.12); ctx.fillStyle='#fff'; ctx.fillText(text,width/2,height*(top+.06),width*.8); ctx.restore(); }
  const opacity=clipOpacity(segment,elapsed); if(opacity<1) {ctx.save();ctx.fillStyle=`rgba(0,0,0,${1-opacity})`;ctx.fillRect(0,0,width,height);ctx.restore();}
}
