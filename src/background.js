import { selectCompositionMimeType } from './composition.js';

export function drawMaskedFrame(context, cameraFrame, mask, width, height) {
  context.save();
  context.clearRect(0, 0, width, height);
  context.drawImage(cameraFrame, 0, 0, width, height);
  context.globalCompositeOperation = 'destination-in';
  context.drawImage(mask, 0, 0, width, height);
  context.restore();
}

function waitForMetadata(video) {
  return new Promise((resolve, reject) => {
    video.addEventListener('loadedmetadata', resolve, { once: true });
    video.addEventListener('error', () => reject(new Error('人像素材無法載入')), { once: true });
  });
}

export async function removeBackgroundFromRecording(recording, {
  documentRef = globalThis.document,
  urlApi = globalThis.URL,
  MediaRecorderRef = globalThis.MediaRecorder,
  segmenterFactory,
  width = 640,
  height = 360,
  fps = 24,
  requestFrame = globalThis.requestAnimationFrame
} = {}) {
  if (!recording) throw new Error('找不到人像錄製素材');
  if (!segmenterFactory) throw new Error('尚未載入人像去背模型');
  const video = documentRef.createElement('video');
  const url = urlApi.createObjectURL(recording);
  video.src = url; video.muted = true; video.playsInline = true;
  const canvas = documentRef.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context || !canvas.captureStream) throw new Error('此瀏覽器不支援後製去背');
  await waitForMetadata(video);
  const segmenter = await segmenterFactory();
  const output = canvas.captureStream(fps);
  video.captureStream?.().getAudioTracks?.().forEach(track => output.addTrack(track));
  const mimeType = selectCompositionMimeType(MediaRecorderRef);
  const recorder = new MediaRecorderRef(output, { mimeType });
  const chunks = [];
  recorder.addEventListener('dataavailable', event => { if (event.data?.size) chunks.push(event.data); });
  const finished = new Promise((resolve, reject) => {
    recorder.addEventListener('stop', () => resolve(new Blob(chunks, { type: mimeType })));
    recorder.addEventListener('error', event => reject(event.error || new Error('人像去背失敗')));
  });
  segmenter.onResults(results => drawMaskedFrame(context, video, results.segmentationMask, width, height));
  recorder.start();
  const videoFinished = new Promise(resolve => {
    if (video.ended) resolve();
    else video.addEventListener('ended', resolve, { once: true });
  });
  await video.play();
  const renderFrame = async () => {
    if (recorder.state !== 'recording') return;
    await segmenter.send({ image: video });
    requestFrame(renderFrame);
  };
  renderFrame();
  await videoFinished;
  recorder.stop();
  const result = await finished;
  segmenter.close?.();
  urlApi.revokeObjectURL?.(url);
  return result;
}

export function loadSelfieSegmentation({ documentRef = globalThis.document, scriptUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js' } = {}) {
  return new Promise((resolve, reject) => {
    if (globalThis.SelfieSegmentation) { resolve(globalThis.SelfieSegmentation); return; }
    const script = documentRef.createElement('script');
    script.src = scriptUrl;
    script.onload = () => globalThis.SelfieSegmentation ? resolve(globalThis.SelfieSegmentation) : reject(new Error('去背模型載入失敗'));
    script.onerror = () => reject(new Error('去背模型下載失敗'));
    documentRef.head.appendChild(script);
  });
}
