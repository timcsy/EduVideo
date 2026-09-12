export const DEFAULT_LAYOUT = { x: .75, y: .68, width: .22, visible: true, mirror: false, background: false, shape:'rectangle', backdrop:'none', color:'#24334d', border:0, borderColor:'#ffffff', shadow:false, fit:'contain', zoom:1, threshold:.45, feather:.12, smoothing:.2 };
export function updateLayout(project, change) {
  const layout = { ...DEFAULT_LAYOUT, ...project.layout, ...change };
  if (!['x', 'y', 'width'].every(k => Number.isFinite(layout[k]))) throw new Error('人像位置無效');
  layout.width = Math.max(.1, Math.min(.6, layout.width));
  layout.x = Math.max(0, Math.min(1 - layout.width, layout.x));
  layout.y = Math.max(0, Math.min(1 - layout.width * (layout.shape==='circle'?16/9:4/3), layout.y));
  return { ...project, layout };
}
export function cameraRect(project, width, height) {
  const layout = { ...DEFAULT_LAYOUT, ...project.layout };
  return { x: layout.x * width, y: layout.y * height, width: layout.width * width, height: layout.width * width * (layout.shape==='circle'?1:.75) };
}
export function drawContained(ctx, source, x, y, width, height, mirror = false) {
  const sw = source.videoWidth || source.naturalWidth || source.width;
  const sh = source.videoHeight || source.naturalHeight || source.height;
  if (!sw || !sh) return;
  const ratio = Math.min(width / sw, height / sh), dw = sw * ratio, dh = sh * ratio;
  ctx.save(); ctx.translate(x + width / 2, y + height / 2); if (mirror) ctx.scale(-1, 1);
  ctx.drawImage(source, -dw / 2, -dh / 2, dw, dh); ctx.restore();
}
