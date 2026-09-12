import { buildExportPlan } from './export-plan.js';
import { selectCompositionMimeType } from './composition.js';
import { createPersonRenderer, drawComposition, loadBackdrop } from './person-renderer.js';
import {drawClipOverlay,clipOpacity,compositionProject} from './clip-tools.js';
import {drawCaptions} from './captions.js';

export async function exportEdited(project, assets, onProgress = () => {}, { signal } = {}) {
  const plan = buildExportPlan(project);
  const canvas = document.createElement('canvas');
  canvas.width = 1280; canvas.height = 720;
  const ctx = canvas.getContext('2d');
  const audio = new AudioContext();
  const destination = audio.createMediaStreamDestination();
  const output = canvas.captureStream(30);
  destination.stream.getAudioTracks().forEach(t => output.addTrack(t));
  const mimeType = selectCompositionMimeType();
  const recorder = new MediaRecorder(output, { mimeType });
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const finished = new Promise((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = e => reject(e.error);
  });
  const videos = [], urls = [];
  let frame, person, renderError, pendingDraw = Promise.resolve();
  let drawing = false;
  const check = () => { signal?.throwIfAborted(); if (renderError) throw renderError; };
  finished.catch(() => {});
  try {
    check();
    await loadBackdrop(project);
    if (project.segments.some(s=>compositionProject(project,s).layout.background)) person = await createPersonRenderer();
    await audio.resume();
    for (let i = 0; i < plan.length; i++) {
      check();
      const segment = plan[i], media = assets[segment.takeId];
      const settings=project.segments[i],gains=[],composed=compositionProject(project,settings);person?.reset();await loadBackdrop(composed);
      if (!media?.screen || !media?.camera) throw new Error('找不到原始錄影素材');
      const pair = await Promise.all(['screen', 'camera'].map(kind => new Promise((resolve, reject) => {
        const video = document.createElement('video');
        videos.push(video); video.playsInline = true;
        video.onloadedmetadata = () => resolve(video);
        video.onerror = () => reject(new Error('影片載入失敗'));
        const url = URL.createObjectURL(media[kind]); urls.push(url); video.src = url;
        video.playbackRate=settings.speed||1;
        const gain=audio.createGain();gain.gain.value=settings.volume??1;gains.push(gain);audio.createMediaElementSource(video).connect(gain).connect(destination);
      })));
      await Promise.all(pair.map(video => new Promise(resolve => {
        if (Math.abs(video.currentTime - segment.start) < .001) return resolve();
        video.addEventListener('seeked', resolve, { once: true }); video.currentTime = segment.start;
      })));
      drawing = true;
      const draw = async () => {
        try {
          if (!drawing) return;
          check();
          const camera = composed.layout.background&&composed.layout.visible!==false ? await person.process(pair[1],composed.layout) : pair[1];
          if (!drawing) return;
          drawComposition(ctx, pair[0], camera, composed,pair[1]);
          const elapsed=(pair[0].currentTime-segment.start)/(settings.speed||1);
          drawClipOverlay(ctx,settings,elapsed);gains.forEach(g=>g.gain.value=(settings.volume??1)*clipOpacity(settings,elapsed));
          drawCaptions(ctx,settings,pair[0].currentTime,project.captionStyle);
          frame = requestAnimationFrame(() => { pendingDraw = draw(); });
        } catch (error) { renderError = error; }
      };
      await draw();
      check();
      if (recorder.state === 'inactive') recorder.start(); else recorder.resume();
      await Promise.all(pair.map(v => v.play()));
      await new Promise((resolve, reject) => {
        const start = performance.now();
        const timer = setInterval(() => {
          try { check(); } catch (error) { clearInterval(timer); reject(error); return; }
          onProgress((i + Math.min(1, (pair[0].currentTime - segment.start) / (settings.speed||1) / segment.duration)) / plan.length);
          if (pair[0].currentTime >= segment.end || pair[0].ended) { clearInterval(timer); resolve(); }
          else if (performance.now() - start > (segment.duration + 15) * 1000) { clearInterval(timer); reject(new Error('匯出播放逾時')); }
        }, 15);
      });
      drawing = false; pair.forEach(v => v.pause()); cancelAnimationFrame(frame); recorder.pause(); await pendingDraw;
    }
    recorder.stop();
    return await finished;
  } finally {
    drawing = false;
    cancelAnimationFrame(frame);
    await pendingDraw;
    if (recorder.state !== 'inactive') recorder.stop();
    videos.forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); });
    output.getTracks().forEach(t => t.stop());
    await audio.close(); urls.forEach(url => URL.revokeObjectURL(url));
    await person?.close();
  }
}
