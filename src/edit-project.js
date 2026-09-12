// All synchronized media use the same source range. Edits never mutate originals.
import { segmentDuration } from './clip-tools.js';
export const newProject = () => ({ version: 2, takes: [], segments: [] });
export function addTake(project, take) {
  if (!take.id || !Number.isFinite(take.duration) || take.duration <= 0 || project.takes.some(t => t.id === take.id)) throw new Error('Invalid take');
  return { ...project, takes: [...project.takes, { ...take }], segments: [...project.segments, { takeId: take.id, in: 0, out: take.duration }] };
}
function segmentAt(project, index) {
  const segment = project.segments[index];
  if (!segment) throw new Error('Unknown segment');
  return segment;
}
export function splitSegment(project, index, sourceTime) {
  const segment = segmentAt(project, index);
  if (!Number.isFinite(sourceTime) || sourceTime <= segment.in || sourceTime >= segment.out) throw new Error('Split must be inside segment');
  const segments = project.segments.slice();
  segments.splice(index, 1, { ...segment, out: sourceTime }, { ...segment, in: sourceTime });
  return { ...project, segments };
}
export function trimSegment(project, index, start, end) {
  const segment = segmentAt(project, index);
  const take = project.takes.find(t => t.id === segment.takeId);
  if (![start, end].every(Number.isFinite) || start < 0 || end > take.duration || end <= start) throw new Error('Invalid trim range');
  return { ...project, segments: project.segments.map((s, i) => i === index ? { ...s, in: start, out: end } : s) };
}
export function removeSegment(project, index) {
  segmentAt(project, index);
  return { ...project, segments: project.segments.filter((_, i) => i !== index) };
}
export const projectDuration = project => project.segments.reduce((sum, s) => sum + segmentDuration(s), 0);
export function resolveFrame(project, time) {
  if (!Number.isFinite(time) || time < 0) return null;
  for (const segment of project.segments) {
    const length = segmentDuration(segment);
    if (time < length) return { takeId: segment.takeId, sourceTime: segment.in + time * (segment.speed || 1) };
    time -= length;
  }
  return null;
}
