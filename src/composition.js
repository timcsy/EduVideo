const MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm'
];

export function connectAudioTracks(videoElements, audioContext) {
  const destination = audioContext.createMediaStreamDestination();
  videoElements.forEach(element => audioContext.createMediaElementSource(element).connect(destination));
  return destination.stream.getAudioTracks();
}

export function selectCompositionMimeType(MediaRecorderRef = globalThis.MediaRecorder) {
  if (!MediaRecorderRef?.isTypeSupported) return 'video/webm';
  return MIME_CANDIDATES.find(type => {
    try { return MediaRecorderRef.isTypeSupported(type); } catch { return false; }
  }) || 'video/webm';
}

function waitForMetadata(video) {
  return new Promise((resolve, reject) => {
    video.addEventListener('loadedmetadata', resolve, { once: true });
    video.addEventListener('error', () => reject(new Error('錄製素材無法載入')), { once: true });
  });
}

export async function composeRecordings(recordings, {
  documentRef = globalThis.document,
  urlApi = globalThis.URL,
  MediaRecorderRef = globalThis.MediaRecorder,
  width = 1280,
  height = 720,
  fps = 30
} = {}) {
  if (!recordings?.screen || !recordings?.camera) throw new Error('需要螢幕與人像兩個素材才能合成');
  if (!documentRef?.createElement || !MediaRecorderRef) throw new Error('此瀏覽器不支援影片合成');
  const screen = documentRef.createElement('video');
  const camera = documentRef.createElement('video');
  const urls = [urlApi.createObjectURL(recordings.screen), urlApi.createObjectURL(recordings.camera)];
  screen.src = urls[0]; camera.src = urls[1];
  screen.playsInline = camera.playsInline = true;
  screen.muted = camera.muted = false;
  const canvas = documentRef.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context || !canvas.captureStream) throw new Error('此瀏覽器不支援畫布串流');
  await Promise.all([waitForMetadata(screen), waitForMetadata(camera)]);
  const output = canvas.captureStream(fps);
  const AudioContextRef = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (AudioContextRef) {
    try {
      const audioContext = new AudioContextRef();
      connectAudioTracks([screen, camera], audioContext).forEach(track => output.addTrack(track));
    } catch {
      camera.captureStream?.().getAudioTracks?.().forEach(track => output.addTrack(track));
    }
  } else {
    camera.captureStream?.().getAudioTracks?.().forEach(track => output.addTrack(track));
  }
  const recorder = new MediaRecorderRef(output, { mimeType: selectCompositionMimeType(MediaRecorderRef) });
  const chunks = [];
  recorder.addEventListener('dataavailable', event => { if (event.data?.size) chunks.push(event.data); });
  const draw = () => {
    context.drawImage(screen, 0, 0, width, height);
    const cameraWidth = Math.round(width * 0.22);
    const cameraHeight = Math.round(cameraWidth * 9 / 16);
    context.drawImage(camera, width - cameraWidth - 32, height - cameraHeight - 32, cameraWidth, cameraHeight);
    if (recorder.state === 'recording') globalThis.requestAnimationFrame(draw);
  };
  const finished = new Promise((resolve, reject) => {
    recorder.addEventListener('stop', () => resolve(new Blob(chunks, { type: selectCompositionMimeType(MediaRecorderRef) })));
    recorder.addEventListener('error', event => reject(event.error || new Error('影片合成失敗')));
  });
  recorder.start();
  draw();
  // Register before play(): very short recordings can reach ended between
  // the play() promise resolving and a later listener being attached.
  const screenFinished = new Promise(resolve => {
    if (screen.ended) resolve();
    else screen.addEventListener('ended', resolve, { once: true });
  });
  await Promise.all([screen.play(), camera.play()]);
  await screenFinished;
  recorder.stop();
  const result = await finished;
  urls.forEach(url => urlApi.revokeObjectURL?.(url));
  return result;
}
