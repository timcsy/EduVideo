import { zipSync, unzipSync, strToU8, strFromU8 } from '../vendor/fflate.mjs';
import {updateSegment} from './clip-tools.js';
import {validateCues} from './captions.js';
function validate(value) {
  if (value?.project?.version !== 2 || !Array.isArray(value.project.takes) || !Array.isArray(value.project.segments)) throw new Error('不是有效的 EduVideo 專案');
  const ids = new Set();
  for (const take of value.project.takes) {
    if (typeof take.id !== 'string' || ids.has(take.id) || !Number.isFinite(take.duration) || take.duration <= 0) throw new Error('素材資料無效');
    ids.add(take.id);
  }
  for (const s of value.project.segments) {
    updateSegment(value.project,value.project.segments.indexOf(s),{});
    if(s.captions)validateCues(s.captions);
    const t = value.project.takes.find(t => t.id === s.takeId);
    if (!t || !Number.isFinite(s.in) || !Number.isFinite(s.out) || s.in < 0 || s.out > t.duration || s.out <= s.in) throw new Error('剪輯資料無效');
  }
}
export async function projectFiles(snapshot) {
  validate(snapshot);
  const { assets, ...manifest } = snapshot;
  const files = { 'project.json': strToU8(JSON.stringify(manifest)) };
  for (let i = 0; i < manifest.project.takes.length; i++) for (const kind of ['screen', 'camera']) {
    const blob = assets[manifest.project.takes[i].id]?.[kind];
    if (!(blob instanceof Blob) || !blob.size) throw new Error('專案缺少原始影片');
    files[`media/${i}-${kind}.webm`] = new Uint8Array(await blob.arrayBuffer());
  }
  return files;
}
export async function packProject(snapshot) {return new Blob([zipSync(await projectFiles(snapshot), {level:0})],{type:'application/zip'});}
export async function unpackProject(blob) {
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  return restoreProjectFiles(files);
}
export function restoreProjectFiles(files) {
  if (!files['project.json']) throw new Error('專案檔不完整');
  const value = JSON.parse(strFromU8(files['project.json'])); validate(value);
  const assets = Object.create(null);
  for (let i = 0; i < value.project.takes.length; i++) {
    const take = value.project.takes[i]; assets[take.id] = {};
    for (const kind of ['screen', 'camera']) {
      const bytes = files[`media/${i}-${kind}.webm`]; if (!bytes?.length) throw new Error('專案缺少原始影片');
      assets[take.id][kind] = new Blob([bytes], { type: 'video/webm' });
    }
  }
  return { ...value, assets, slides: value.slides || [], notes: value.notes || '' };
}
