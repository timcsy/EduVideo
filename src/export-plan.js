import {segmentDuration,updateSegment} from './clip-tools.js';
export function buildExportPlan(project) {
  if (!project.segments.length) throw new Error('請先錄製並保留至少一個片段');
  return project.segments.map((segment,index) => {
    updateSegment(project,index,{});
    const take = project.takes.find(t => t.id === segment.takeId);
    if (!take || !Number.isFinite(segment.in) || !Number.isFinite(segment.out) || segment.in < 0 || segment.out > take.duration || segment.out <= segment.in) throw new Error('素材或剪輯範圍無效');
    return { takeId: take.id, start: segment.in, end: segment.out, duration: segmentDuration(segment) };
  });
}
