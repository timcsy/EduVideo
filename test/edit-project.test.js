import test from 'node:test';
import assert from 'node:assert/strict';
import { newProject, addTake, splitSegment, trimSegment, removeSegment, resolveFrame } from '../src/edit-project.js';

test('new projects contain no fictional footage', () => {
  assert.deepEqual(newProject().segments, []);
});
test('splitting and trimming preserves source offsets and synchronized tracks', () => {
  let p = addTake(newProject(), { id: 'take1', duration: 10 });
  p = splitSegment(p, 0, 4);
  p = trimSegment(p, 1, 6, 9);
  assert.deepEqual(p.segments.map(s => [s.in, s.out]), [[0, 4], [6, 9]]);
  assert.deepEqual(resolveFrame(p, 5), { takeId: 'take1', sourceTime: 7 });
  assert.equal(resolveFrame(p, 7), null);
});
test('deleting a segment closes the gap for all media', () => {
  const original = addTake(newProject(), { id: 'a', duration: 10 });
  const p = removeSegment(splitSegment(original, 0, 4), 0);
  assert.deepEqual(resolveFrame(p, 0), { takeId: 'a', sourceTime: 4 });
  assert.equal(original.segments.length, 1);
});
test('invalid ranges never enter a project', () => {
  const p = addTake(newProject(), { id: 'a', duration: 10 });
  assert.throws(() => trimSegment(p, 0, 8, 2));
  assert.throws(() => splitSegment(p, 0, 10));
  assert.throws(() => addTake(p, { id: 'b', duration: Infinity }));
});
