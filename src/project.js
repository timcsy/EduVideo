import { createInitialState } from './state.js';

export function serializeProject(state, clock = () => new Date().toISOString()) {
  return {
    version: 1,
    exportedAt: clock(),
    title: state.title,
    activeSlideId: state.activeSlideId,
    script: state.script,
    notes: state.notes,
    outline: state.outline,
    slides: state.slides,
    tracks: state.tracks,
    clips: state.clips
  };
}

export function restoreProject(project) {
  if (!project || project.version !== 1) throw new Error('不支援的 EduVideo 專案版本');
  const defaults = createInitialState();
  return {
    ...defaults,
    title: typeof project.title === 'string' && project.title.trim() ? project.title.trim() : defaults.title,
    activeSlideId: project.activeSlideId ?? defaults.activeSlideId,
    script: typeof project.script === 'string' ? project.script : defaults.script,
    notes: typeof project.notes === 'string' ? project.notes : defaults.notes,
    outline: Array.isArray(project.outline) ? project.outline.filter(item => typeof item === 'string') : defaults.outline,
    slides: Array.isArray(project.slides) ? project.slides : defaults.slides,
    tracks: Array.isArray(project.tracks) ? project.tracks : defaults.tracks,
    clips: Array.isArray(project.clips) ? project.clips : defaults.clips,
    recording: false
  };
}

export function getRecordingFileNames(projectName = 'eduvideo-project') {
  const safeName = projectName.trim().replace(/[^a-zA-Z0-9_-]+/g, '-') || 'eduvideo-project';
  return { screen: `${safeName}-screen.webm`, camera: `${safeName}-camera.webm` };
}

export function downloadBlob(blob, filename, documentRef = globalThis.document) {
  if (!blob || !documentRef) return false;
  const url = URL.createObjectURL(blob);
  const anchor = documentRef.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}
