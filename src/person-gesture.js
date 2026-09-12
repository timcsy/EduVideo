import { DEFAULT_LAYOUT, updateLayout } from './layout.js';
export function resizePerson(project, dx, dy) {
  const l = { ...DEFAULT_LAYOUT, ...project.layout };
  const ratio=l.shape==='circle'?16/9:4/3;
  const delta = (dx + dy / ratio) / 2;
  const width = Math.max(.1, Math.min(.6, 1 - l.x, (1 - l.y) / ratio, l.width + delta));
  return updateLayout(project, { width });
}
