import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, addAnnotation, removeAnnotation, selectSlide, toggleRecording, addClip, setScript, setNotes, setOutline, splitClip, trimClip, deleteClip, addSlide, replaceSlides, setPlayhead, advancePlayhead, moveClip, selectClip } from '../src/state.js';

test('creates a presentation workspace with the expected default tracks', () => {
  const state = createInitialState();
  assert.equal(state.slides.length, 3);
  assert.equal(state.activeSlideId, 'slide-1');
  assert.deepEqual(state.tracks.map(t => t.kind), ['screen', 'camera', 'audio']);
  assert.equal(state.recording, false);
});

test('adds and removes an annotation without mutating the source state', () => {
  const state = createInitialState();
  const marked = addAnnotation(state, { type: 'arrow', x: 42, y: 36, color: '#ff6b6b' });
  assert.equal(marked.slides[0].annotations.length, 1);
  assert.equal(state.slides[0].annotations.length, 0);
  const clean = removeAnnotation(marked, 'slide-1', marked.slides[0].annotations[0].id);
  assert.equal(clean.slides[0].annotations.length, 0);
});

test('stores freehand annotation points for later rendering', () => {
  const points = [{ x: 10, y: 20 }, { x: 25, y: 35 }, { x: 40, y: 30 }];
  const state = addAnnotation(createInitialState(), { type: 'stroke', points, color: '#ff6b72' });
  assert.deepEqual(state.slides[0].annotations[0].points, points);
});

test('changes the active slide and recording state predictably', () => {
  let state = createInitialState();
  state = selectSlide(state, 'slide-2');
  assert.equal(state.activeSlideId, 'slide-2');
  state = toggleRecording(state);
  assert.equal(state.recording, true);
  state = toggleRecording(state);
  assert.equal(state.recording, false);
});

test('stores clips and presenter script as editable project data', () => {
  let state = createInitialState();
  state = addClip(state, { trackId: 'screen', label: '產品示範', start: 14, duration: 48 });
  state = setScript(state, '先介紹問題，再展示產品如何解決。');
  assert.equal(state.clips.at(-1).label, '產品示範');
  assert.equal(state.clips.at(-1).duration, 48);
  assert.equal(state.script, '先介紹問題，再展示產品如何解決。');
});

test('stores an editable outline as project state', () => {
  const state = setOutline(createInitialState(), ['開場', '示範', '總結']);
  assert.deepEqual(state.outline, ['開場', '示範', '總結']);
});

test('stores private presenter notes separately from the script', () => {
  const state = setNotes(createInitialState(), '停頓後再切換下一頁。');
  assert.equal(state.notes, '停頓後再切換下一頁。');
  assert.notEqual(state.notes, state.script);
});

test('splits a clip at the requested timeline position', () => {
  const state = createInitialState();
  const next = splitClip(state, 'clip-2', 30);
  const pieces = next.clips.filter(clip => clip.trackId === 'screen' && clip.start >= 18);
  assert.equal(pieces.length, 2);
  assert.deepEqual(pieces.map(clip => clip.duration), [12, 30]);
  assert.equal(pieces[0].label, '產品示範（前段）');
});

test('trims a clip to the requested timeline range and rejects empty ranges', () => {
  const state = createInitialState();
  const trimmed = trimClip(state, 'clip-2', 24, 45);
  const clip = trimmed.clips.find(item => item.id === 'clip-2');
  assert.deepEqual({ start: clip.start, duration: clip.duration }, { start: 24, duration: 21 });
  const unchanged = trimClip(trimmed, 'clip-2', 45, 45);
  assert.deepEqual(unchanged.clips.find(item => item.id === 'clip-2'), clip);
});

test('deletes a clip and can append an imported slide', () => {
  let state = createInitialState();
  state = selectClip(state, 'clip-1');
  state = deleteClip(state, 'clip-1');
  state = addSlide(state, { title: '匯入的課程頁面', subtitle: '自訂投影片', color: '#644e39' });
  assert.equal(state.clips.some(clip => clip.id === 'clip-1'), false);
  assert.equal(state.slides.at(-1).title, '匯入的課程頁面');
  assert.notEqual(state.selectedClipId, 'clip-1');
});

test('replaces the starter deck with an imported presentation', () => {
  const source = createInitialState();
  const next = replaceSlides(source, [{ title: '第一頁', image: 'data:first' }, { title: '第二頁', image: 'data:second' }]);
  assert.deepEqual(next.slides.map(slide => slide.id), ['slide-1', 'slide-2']);
  assert.equal(next.activeSlideId, 'slide-1');
  assert.equal(next.slides[0].title, '第一頁');
  assert.equal(source.slides.length, 3);
});

test('tracks the selected clip and clamps the playhead to the project duration', () => {
  let state = createInitialState();
  state = selectClip(state, 'clip-2');
  state = setPlayhead(state, 999);
  assert.equal(state.selectedClipId, 'clip-2');
  assert.equal(state.playhead, 60);
  state = setPlayhead(state, -5);
  assert.equal(state.playhead, 0);
});

test('advances the playhead and clamps playback at the project end', () => {
  let state = createInitialState();
  state = advancePlayhead(state, 12.5);
  assert.equal(state.playhead, 12.5);
  state = advancePlayhead(state, 999);
  assert.equal(state.playhead, 60);
});

test('moves a clip without allowing it to start before zero', () => {
  const state = createInitialState();
  const moved = moveClip(state, 'clip-2', 8);
  assert.equal(moved.clips.find(clip => clip.id === 'clip-2').start, 8);
  const clamped = moveClip(moved, 'clip-2', -20);
  assert.equal(clamped.clips.find(clip => clip.id === 'clip-2').start, 0);
});
