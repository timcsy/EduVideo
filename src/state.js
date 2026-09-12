let annotationSequence = 0;
let clipSequence = 0;

export function createInitialState() {
  return {
    title: '未命名教學影片',
    recording: false,
    playhead: 0,
    selectedClipId: 'clip-1',
    activeSlideId: 'slide-1',
    selectedTool: 'pen',
    script: '今天要介紹 EduVideo，讓我們可以一邊解說畫面，一邊保留自然的人像講解。',
    notes: '提醒自己：保持自然語速，示範時先停一下再做標記。',
    outline: ['說明錄製時的觀看體驗', '示範如何保留人像預覽', '錄完後再進行去背與剪輯'],
    slides: [
      { id: 'slide-1', title: '為什麼需要 EduVideo？', subtitle: '讓教學錄製更自然', color: '#18324f', annotations: [] },
      { id: 'slide-2', title: '簡報與講者同步出現', subtitle: '專注內容，也保留人的溫度', color: '#4a2f60', annotations: [] },
      { id: 'slide-3', title: '錄完後再精準剪輯', subtitle: '保留螢幕、人像與聲音的彈性', color: '#234e50', annotations: [] }
    ],
    tracks: [
      { id: 'screen', kind: 'screen', label: '簡報畫面' },
      { id: 'camera', kind: 'camera', label: '人像' },
      { id: 'audio', kind: 'audio', label: '麥克風' }
    ],
    clips: [
      { id: 'clip-1', trackId: 'screen', label: '開場', start: 0, duration: 18 },
      { id: 'clip-2', trackId: 'screen', label: '產品示範', start: 18, duration: 42 },
      { id: 'clip-3', trackId: 'camera', label: '人像同步', start: 0, duration: 60 },
      { id: 'clip-4', trackId: 'audio', label: '旁白', start: 0, duration: 60 }
    ]
  };
}

const copy = (state) => structuredClone(state);

export function selectSlide(state, slideId) {
  const next = copy(state);
  if (next.slides.some(slide => slide.id === slideId)) next.activeSlideId = slideId;
  return next;
}

export function toggleRecording(state) {
  const next = copy(state);
  next.recording = !next.recording;
  return next;
}

export function addAnnotation(state, annotation) {
  const next = copy(state);
  const slide = next.slides.find(item => item.id === next.activeSlideId);
  if (slide) slide.annotations.push({ ...annotation, id: `annotation-${++annotationSequence}` });
  return next;
}

export function removeAnnotation(state, slideId, annotationId) {
  const next = copy(state);
  const slide = next.slides.find(item => item.id === slideId);
  if (slide) slide.annotations = slide.annotations.filter(annotation => annotation.id !== annotationId);
  return next;
}

export function addClip(state, clip) {
  const next = copy(state);
  next.clips.push({ ...clip, id: clip.id ?? `clip-${++clipSequence}` });
  return next;
}

export function setScript(state, script) {
  const next = copy(state);
  next.script = script;
  return next;
}

export function setTitle(state, title) {
  const next = copy(state);
  const value = typeof title === 'string' ? title.trim() : '';
  next.title = value || '未命名教學影片';
  return next;
}

export function setNotes(state, notes) {
  const next = copy(state);
  next.notes = typeof notes === 'string' ? notes : next.notes;
  return next;
}

export function setOutline(state, outline) {
  const next = copy(state);
  next.outline = Array.isArray(outline) ? outline.filter(item => typeof item === 'string') : next.outline;
  return next;
}

export function splitClip(state, clipId, atSeconds) {
  const next = copy(state);
  const index = next.clips.findIndex(clip => clip.id === clipId);
  if (index < 0) return next;
  const clip = next.clips[index];
  const offset = atSeconds - clip.start;
  if (offset <= 0 || offset >= clip.duration) return next;
  next.clips.splice(index, 1,
    { ...clip, id: `${clip.id}-a`, label: `${clip.label}（前段）`, duration: offset },
    { ...clip, id: `${clip.id}-b`, label: `${clip.label}（後段）`, start: atSeconds, duration: clip.duration - offset }
  );
  return next;
}

export function trimClip(state, clipId, newStart, newEnd) {
  const next = copy(state);
  const clip = next.clips.find(item => item.id === clipId);
  if (!clip) return next;
  const originalEnd = clip.start + clip.duration;
  const start = Math.max(clip.start, Number(newStart));
  const end = Math.min(originalEnd, Number(newEnd));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return next;
  clip.start = start;
  clip.duration = end - start;
  return next;
}

export function deleteClip(state, clipId) {
  const next = copy(state);
  next.clips = next.clips.filter(clip => clip.id !== clipId);
  if (next.selectedClipId === clipId) next.selectedClipId = next.clips[0]?.id ?? null;
  return next;
}

export function selectClip(state, clipId) {
  const next = copy(state);
  if (next.clips.some(clip => clip.id === clipId)) next.selectedClipId = clipId;
  return next;
}

export function setPlayhead(state, seconds) {
  const next = copy(state);
  const duration = next.clips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0);
  next.playhead = Math.max(0, Math.min(Number(seconds) || 0, duration));
  return next;
}

export function advancePlayhead(state, seconds) {
  return setPlayhead(state, state.playhead + (Number(seconds) || 0));
}

export function moveClip(state, clipId, newStart) {
  const next = copy(state);
  const clip = next.clips.find(item => item.id === clipId);
  if (!clip) return next;
  const start = Number(newStart);
  if (Number.isFinite(start)) clip.start = Math.max(0, start);
  return next;
}

export function addSlide(state, slide) {
  const next = copy(state);
  const id = `slide-${next.slides.length + 1}`;
  next.slides.push({ id, annotations: [], color: '#4b5368', subtitle: '新投影片', ...slide });
  next.activeSlideId = id;
  return next;
}

export function replaceSlides(state, slides) {
  const next = copy(state);
  next.slides = (Array.isArray(slides) ? slides : []).map((slide, index) => ({
    id: `slide-${index + 1}`,
    annotations: [],
    color: '#4b5368',
    subtitle: '投影片',
    ...slide
  }));
  next.activeSlideId = next.slides[0]?.id ?? null;
  return next;
}
