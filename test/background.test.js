import test from 'node:test';
import assert from 'node:assert/strict';
import { drawMaskedFrame } from '../src/background.js';

test('draws a camera frame through a segmentation mask on a transparent canvas', () => {
  const calls = [];
  const context = {
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    clearRect: (...args) => calls.push(['clearRect', ...args]),
    drawImage: (...args) => calls.push(['drawImage', ...args]),
    globalCompositeOperation: 'source-over'
  };
  drawMaskedFrame(context, 'camera', 'mask', 640, 360);
  assert.deepEqual(calls, [
    'save', ['clearRect', 0, 0, 640, 360], ['drawImage', 'camera', 0, 0, 640, 360], ['drawImage', 'mask', 0, 0, 640, 360], 'restore'
  ]);
});
