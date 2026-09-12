export function buildMp4Arguments(inputName = 'input.webm', outputName = 'output.mp4') {
  return ['-i', inputName, '-c:v', 'libx264', '-c:a', 'aac', '-movflags', 'faststart', outputName];
}

export async function transcodeWebmToMp4(blob, {
  ffmpeg,
  fetchFile,
  inputName = 'eduvideo-input.webm',
  outputName = 'eduvideo-output.mp4'
} = {}) {
  if (!blob || !ffmpeg || !fetchFile) throw new Error('MP4 編碼器尚未準備好');
  const bytes = await fetchFile(blob);
  if (ffmpeg.FS && ffmpeg.run) {
    ffmpeg.FS('writeFile', inputName, bytes);
    await ffmpeg.run(...buildMp4Arguments(inputName, outputName));
    const output = ffmpeg.FS('readFile', outputName);
    return new Blob([output.buffer || output], { type: 'video/mp4' });
  }
  if (ffmpeg.writeFile && ffmpeg.exec && ffmpeg.readFile) {
    await ffmpeg.writeFile(inputName, bytes);
    await ffmpeg.exec(buildMp4Arguments(inputName, outputName));
    const output = await ffmpeg.readFile(outputName);
    return new Blob([output.buffer || output], { type: 'video/mp4' });
  }
  throw new Error('不支援的 FFmpeg 介面');
}

export function loadFfmpeg({
  documentRef = globalThis.document,
  scriptUrl = 'https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js'
} = {}) {
  return new Promise((resolve, reject) => {
    if (globalThis.FFmpeg?.createFFmpeg) { resolve(globalThis.FFmpeg); return; }
    const script = documentRef.createElement('script');
    script.src = scriptUrl;
    script.onload = () => globalThis.FFmpeg?.createFFmpeg ? resolve(globalThis.FFmpeg) : reject(new Error('MP4 編碼器載入失敗'));
    script.onerror = () => reject(new Error('MP4 編碼器下載失敗'));
    documentRef.head.appendChild(script);
  });
}
