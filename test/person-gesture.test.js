import test from 'node:test';
import assert from 'node:assert/strict';
import { resizePerson } from '../src/person-gesture.js';
test('corner resize preserves top-left and aspect ratio', () => {
  const p = { layout: { x: .2, y: .1, width: .2 } };
  const next = resizePerson(p, .1, .1 * 4 / 3);
  assert.ok(Math.abs(next.layout.width - .3) < 1e-9);
  assert.equal(next.layout.x, .2); assert.equal(next.layout.y, .1);
  assert.equal(p.layout.width, .2);
});
test('resizing stays within the frame and enforces minimum size', () => {
  const p = { layout: { x: .75, y: .68, width: .22 } };
  assert.ok(resizePerson(p, 2, 2).layout.width <= .24);
  assert.equal(resizePerson(p, -2, -2).layout.width, .1);
});
