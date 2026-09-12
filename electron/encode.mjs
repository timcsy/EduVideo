import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function encodeMp4(bytes, { signal, progress = () => {} } = {}) {
  if (!(bytes instanceof Uint8Array) || !bytes.byteLength) throw new Error('沒有可編碼的影片');
  const directory = await mkdtemp(join(tmpdir(), 'eduvideo-encode-'));
  try {
    const input = join(directory, 'input.webm'), output = join(directory, 'output.mp4');
    await writeFile(input, bytes);
    await new Promise((resolve, reject) => {
      const binary = ffmpegPath.replace('app.asar/', 'app.asar.unpacked/');
      const child = spawn(binary, ['-y', '-i', input, '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', '-progress', 'pipe:1', output], { signal });
      let error = '';
      child.stderr.on('data', data => { error = (error + data.toString()).slice(-4000); });
      child.stdout.on('data', data => progress(data.toString()));
      child.on('error', reject); child.on('close', code => code === 0 ? resolve() : reject(new Error(`MP4 編碼失敗：${error}`)));
    });
    return new Uint8Array(await readFile(output));
  } finally { await rm(directory, { recursive: true, force: true }); }
}
