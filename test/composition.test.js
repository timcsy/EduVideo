import test from 'node:test';
import assert from 'node:assert/strict';
import { selectCompositionMimeType, connectAudioTracks } from '../src/composition.js';

test('selects the first supported composition format', () => {
  const Recorder = { isTypeSupported(type) { return type === 'video/webm;codecs=vp9,opus'; } };
  assert.equal(selectCompositionMimeType(Recorder), 'video/webm;codecs=vp9,opus');
});

test('falls back when the browser does not expose MIME support checks', () => {
  assert.equal(selectCompositionMimeType({}), 'video/webm');
});

test('mixes audio from both recorded video elements into one output track', () => {
  const connected = [];
  const destination = { stream: { getAudioTracks: () => ['mixed-track'] } };
  const context = {
    createMediaStreamDestination: () => destination,
    createMediaElementSource: element => ({ connect: target => connected.push([element, target]) })
  };
  assert.deepEqual(connectAudioTracks(['screen-video', 'camera-video'], context), ['mixed-track']);
  assert.equal(connected.length, 2);
});
