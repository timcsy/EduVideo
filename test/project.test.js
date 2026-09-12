import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, addAnnotation, setTitle } from '../src/state.js';
import { serializeProject, restoreProject, getRecordingFileNames } from '../src/project.js';

test('serializes editable project data without embedding media blobs', () => {
  const state = addAnnotation(createInitialState(), { type: 'arrow', x: 20, y: 30 });
  const project = serializeProject(state);
  assert.equal(project.version, 1);
  assert.equal(project.slides[0].annotations.length, 1);
  assert.equal(project.notes, state.notes);
  assert.equal('recordings' in project, false);
  assert.equal(typeof project.exportedAt, 'string');
});

test('restores presenter notes from an exported project', () => {
  const state = createInitialState();
  const restored = restoreProject({ ...serializeProject(state), notes: '只給講者看的提醒' });
  assert.equal(restored.notes, '只給講者看的提醒');
});

test('serializes and restores the editable project title', () => {
  const state = setTitle(createInitialState(), '演算法課程第一集');
  const restored = restoreProject(serializeProject(state));
  assert.equal(restored.title, '演算法課程第一集');
});

test('uses stable names for independent recording outputs', () => {
  assert.deepEqual(getRecordingFileNames('lesson-01'), {
    screen: 'lesson-01-screen.webm',
    camera: 'lesson-01-camera.webm'
  });
});
