import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMp4Arguments, transcodeWebmToMp4 } from '../src/mp4.js';

test('builds a browser-side FFmpeg command that preserves audio and enables fast start', () => {
  assert.deepEqual(buildMp4Arguments('recording.webm', 'lesson.mp4'), [
    '-i', 'recording.webm', '-c:v', 'libx264', '-c:a', 'aac', '-movflags', 'faststart', 'lesson.mp4'
  ]);
});

test('writes a WebM blob to the modern FFmpeg API and returns an MP4 blob', async () => {
  const calls = [];
  const ffmpeg = {
    async writeFile(name, bytes) { calls.push(['writeFile', name, bytes]); },
    async exec(args) { calls.push(['exec', args]); },
    async readFile(name) { calls.push(['readFile', name]); return new Uint8Array([1, 2, 3]); }
  };
  const output = await transcodeWebmToMp4(new Blob(['webm']), { ffmpeg, fetchFile: async () => new Uint8Array([9]) });
  assert.equal(output.type, 'video/mp4');
  assert.deepEqual(calls.map(call => call[0]), ['writeFile', 'exec', 'readFile']);
  assert.deepEqual(calls[1][1], buildMp4Arguments('eduvideo-input.webm', 'eduvideo-output.mp4'));
});
