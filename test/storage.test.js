import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, setScript } from '../src/state.js';
import { serializeProject, restoreProject } from '../src/project.js';

test('restores a serialized project while resetting transient recording state', () => {
  const state = setScript(createInitialState(), '新的講稿');
  const restored = restoreProject(serializeProject(state));
  assert.equal(restored.script, '新的講稿');
  assert.equal(restored.recording, false);
  assert.equal(restored.slides.length, 3);
});

test('rejects unsupported project versions', () => {
  assert.throws(() => restoreProject({ version: 99 }), /不支援/);
});
