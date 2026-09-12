export class CaptureSession {
  constructor({ navigator = globalThis.navigator, MediaRecorder = globalThis.MediaRecorder, onUnexpectedStop = null } = {}) {
    this.navigator = navigator;
    this.MediaRecorder = MediaRecorder;
    this.status = 'idle';
    this.streams = { screen: null, camera: null };
    this.recorders = {};
    this.chunks = { screen: [], camera: [] };
    this.cancelled = false;
    this.onUnexpectedStop = onUnexpectedStop;
  }

  async start() {
    if (this.status === 'recording') return;
    if (!this.navigator?.mediaDevices?.getDisplayMedia || !this.navigator?.mediaDevices?.getUserMedia) {
      throw new Error('此瀏覽器不支援螢幕或攝影機擷取');
    }
    this.status = 'starting';
    this.cancelled = false;
    let screen = null;
    let camera = null;
    try {
      // Ask in a predictable order so a cancelled camera prompt can still
      // release the already-approved screen stream.
      screen = await this.navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      if (this.cancelled) throw new DOMException('錄製啟動已取消', 'AbortError');
      camera = await this.navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (this.cancelled) throw new DOMException('錄製啟動已取消', 'AbortError');
      this.streams = { screen, camera };
      const screenTrack = screen.getVideoTracks?.()[0] || screen.getTracks?.().find(track => track.kind === 'video');
      screenTrack?.addEventListener?.('ended', () => {
        if (this.status !== 'recording') return;
        const stopPromise = this.stop();
        Promise.resolve(this.onUnexpectedStop?.(stopPromise)).catch(() => {});
      }, { once: true });
      for (const kind of ['screen', 'camera']) {
        this.chunks[kind] = [];
        const recorder = new this.MediaRecorder(this.streams[kind]);
        recorder.addEventListener('dataavailable', event => { if (event.data?.size !== 0) this.chunks[kind].push(event.data); });
        this.recorders[kind] = recorder;
      }
      Object.values(this.recorders).forEach(recorder => recorder.start());
      this.status = 'recording';
    } catch (error) {
      [screen, camera, ...Object.values(this.streams)].filter(Boolean).forEach(stream => stream.getTracks().forEach(track => track.stop()));
      this.streams = { screen: null, camera: null };
      this.status = 'idle';
      throw error;
    }
  }

  cancelStart() {
    if (this.status !== 'starting') return;
    this.cancelled = true;
    Object.values(this.streams).filter(Boolean).forEach(stream => stream.getTracks().forEach(track => track.stop()));
    this.streams = { screen: null, camera: null };
    this.status = 'idle';
  }

  stop() {
    if (this.status !== 'recording') return Promise.resolve({ screen: null, camera: null });
    this.status = 'stopping';
    const waits = Object.entries(this.recorders).map(([kind, recorder]) => new Promise(resolve => {
      recorder.addEventListener('stop', () => resolve([kind, new Blob(this.chunks[kind], { type: 'video/webm' })]));
      recorder.stop();
    }));
    return Promise.all(waits).then(entries => {
      Object.values(this.streams).filter(Boolean).forEach(stream => stream.getTracks().forEach(track => track.stop()));
      this.streams = { screen: null, camera: null };
      this.recorders = {};
      this.status = 'idle';
      return Object.fromEntries(entries);
    });
  }
}
