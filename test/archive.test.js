import test from 'node:test';
import assert from 'node:assert/strict';
import { packProject, unpackProject } from '../src/archive.js';
test('portable archive restores original media bytes and editing decisions', async () => {
  const snapshot = { project: { version: 2, takes: [{ id: 'a', duration: 2 }], segments: [{ takeId: 'a', in: .5, out: 2 }] }, assets: { a: { screen: new Blob(['screen']), camera: new Blob(['camera']) } }, slides: [], notes: '筆記' };
  const restored = await unpackProject(await packProject(snapshot));
  assert.deepEqual(restored.project, snapshot.project);
  assert.equal(await restored.assets.a.camera.text(), 'camera');
  assert.equal(restored.notes, '筆記');
});
test('invalid or missing media rejects an archive', async () => {
  await assert.rejects(() => unpackProject(new Blob(['invalid'])));
  await assert.rejects(() => packProject({ project: { version: 2, takes: [{ id: 'a', duration: 1 }], segments: [] }, assets: {} }));
});
