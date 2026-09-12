export function makeAnnotation(type,start,end,style={}) { return {type,start:[...start],end:[...end],color:style.color||'#ff5268',width:style.width||4,text:style.text||'',points:[start,end]}; }
export function hitAnnotation(a,p) {
  const points=a.type==='pen'||a.type==='highlight'?a.points:[a.start,a.end];
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const right=a.type==='text'?a.start[0]+Math.max(40,a.text.length*22):Math.max(...xs);
  const bottom=a.type==='text'?a.start[1]+38:Math.max(...ys);
  return p[0]>=Math.min(...xs)-12&&p[0]<=right+12&&p[1]>=Math.min(...ys)-12&&p[1]<=bottom+12;
}
export function moveAnnotation(a,dx,dy) { const move=p=>[p[0]+dx,p[1]+dy];return {...a,start:move(a.start),end:move(a.end),points:a.points.map(move)}; }
export function drawAnnotation(ctx,a) {
  ctx.save(); ctx.strokeStyle=a.color;ctx.fillStyle=a.color;ctx.lineWidth=a.width;ctx.lineCap='round';ctx.lineJoin='round';
  const [x,y]=a.start,[ex,ey]=a.end;
  ctx.beginPath();
  if(a.type==='rectangle') ctx.rect(Math.min(x,ex),Math.min(y,ey),Math.abs(ex-x),Math.abs(ey-y));
  else if(a.type==='ellipse') ctx.ellipse((x+ex)/2,(y+ey)/2,Math.abs(ex-x)/2,Math.abs(ey-y)/2,0,0,Math.PI*2);
  else if(a.type==='text') { ctx.font='32px system-ui';ctx.textBaseline='top';ctx.fillText(a.text,x,y); }
  else if(a.type==='arrow'||a.type==='line') {ctx.moveTo(x,y);ctx.lineTo(ex,ey);if(a.type==='arrow'){const angle=Math.atan2(ey-y,ex-x),size=16+a.width;ctx.moveTo(ex-size*Math.cos(angle-.5),ey-size*Math.sin(angle-.5));ctx.lineTo(ex,ey);ctx.lineTo(ex-size*Math.cos(angle+.5),ey-size*Math.sin(angle+.5));}}
  else { if(a.type==='highlight'){ctx.globalAlpha=.3;ctx.lineWidth=a.width*5;}a.points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p)); }
  ctx.stroke();ctx.restore();
}
