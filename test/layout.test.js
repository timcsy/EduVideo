import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraRect, updateLayout } from '../src/layout.js';
test('preview and export share normalized layout at any resolution', () => {
  const p = updateLayout({}, { x: .1, y: .2, width: .3 });
  assert.deepEqual(cameraRect(p, 1000, 600), { x: 100, y: 120, width: 300, height: 225 });
  assert.deepEqual(cameraRect(p, 2000, 1200), { x: 200, y: 240, width: 600, height: 450 });
});
test('layout input cannot place the person beyond the canvas', () => {
  const p = updateLayout({}, { x: 9, y: -3, width: .3 });
  assert.equal(p.layout.x, .7); assert.equal(p.layout.y, 0);
  assert.throws(() => updateLayout({}, { width: NaN }));
});
