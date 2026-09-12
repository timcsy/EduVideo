import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewUrls } from '../src/media.js';

test('creates independent preview URLs for recorded screen and camera blobs', () => {
  const calls = [];
  const urlApi = { createObjectURL(blob) { calls.push(blob); return `blob:${calls.length}`; } };
  const previews = createPreviewUrls({ screen: 'screen-blob', camera: 'camera-blob' }, urlApi);
  assert.deepEqual(previews, { screen: 'blob:1', camera: 'blob:2' });
  assert.deepEqual(calls, ['screen-blob', 'camera-blob']);
});
