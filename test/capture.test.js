import test from 'node:test';
import assert from 'node:assert/strict';
import { CaptureSession } from '../src/capture.js';

function fakeRecorder() {
  return class {
    static instances = [];
    constructor(stream) { this.stream = stream; this.state = 'inactive'; this.events = {}; this.chunks = []; }
    addEventListener(name, handler) { this.events[name] = handler; }
    start() { this.state = 'recording'; this.events.start?.(); }
    stop() { this.state = 'inactive'; this.events.dataavailable?.({ data: new Blob(['clip']) }); this.events.stop?.(); }
  };
}

test('starts screen and camera recorders from injected browser APIs', async () => {
  const screenStream = { getTracks: () => [{ stop() {} }] };
  const cameraStream = { getTracks: () => [{ stop() {} }] };
  const nav = { mediaDevices: { getDisplayMedia: async () => screenStream, getUserMedia: async () => cameraStream } };
  const session = new CaptureSession({ navigator: nav, MediaRecorder: fakeRecorder() });
  await session.start();
  assert.equal(session.status, 'recording');
  assert.equal(session.streams.screen, screenStream);
  assert.equal(session.streams.camera, cameraStream);
});

test('stops recorders and returns separate media blobs', async () => {
  const stream = { getTracks: () => [{ stop() {} }] };
  const nav = { mediaDevices: { getDisplayMedia: async () => stream, getUserMedia: async () => stream } };
  const session = new CaptureSession({ navigator: nav, MediaRecorder: fakeRecorder() });
  await session.start();
  const result = await session.stop();
  assert.equal(session.status, 'idle');
  assert.ok(result.screen instanceof Blob);
  assert.ok(result.camera instanceof Blob);
});

test('releases the screen stream when camera permission is cancelled', async () => {
  let stopped = 0;
  const screenStream = { getTracks: () => [{ stop() { stopped += 1; } }] };
  const nav = { mediaDevices: {
    getDisplayMedia: async () => screenStream,
    getUserMedia: async () => { throw new Error('NotAllowedError'); }
  } };
  const session = new CaptureSession({ navigator: nav, MediaRecorder: fakeRecorder() });
  await assert.rejects(() => session.start(), /NotAllowedError/);
  assert.equal(stopped, 1);
  assert.equal(session.status, 'idle');
  assert.equal(session.streams.screen, null);
});

test('cancels a pending recording start and returns to idle', async () => {
  let resolveScreen;
  let stopped = 0;
  const screenStream = { getTracks: () => [{ stop() { stopped += 1; } }] };
  const nav = { mediaDevices: {
    getDisplayMedia: () => new Promise(resolve => { resolveScreen = resolve; }),
    getUserMedia: async () => { throw new Error('should not request camera after cancellation'); }
  } };
  const session = new CaptureSession({ navigator: nav, MediaRecorder: fakeRecorder() });
  const start = session.start();
  session.cancelStart();
  resolveScreen(screenStream);
  await assert.rejects(() => start, /錄製啟動已取消/);
  assert.equal(stopped, 1);
  assert.equal(session.status, 'idle');
});

test('stops when the shared screen track ends unexpectedly', async () => {
  let ended;
  let stopped = 0;
  const screenTrack = { kind: 'video', stop() { stopped += 1; }, addEventListener(name, handler) { if (name === 'ended') ended = handler; } };
  const cameraTrack = { kind: 'video', stop() { stopped += 1; } };
  const screenStream = { getTracks: () => [screenTrack], getVideoTracks: () => [screenTrack] };
  const cameraStream = { getTracks: () => [cameraTrack], getVideoTracks: () => [cameraTrack] };
  const nav = { mediaDevices: { getDisplayMedia: async () => screenStream, getUserMedia: async () => cameraStream } };
  let unexpected;
  const session = new CaptureSession({ navigator: nav, MediaRecorder: fakeRecorder(), onUnexpectedStop: promise => { unexpected = promise; } });
  await session.start();
  ended();
  await unexpected;
  assert.equal(session.status, 'idle');
  assert.equal(stopped, 2);
});
