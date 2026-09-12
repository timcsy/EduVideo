import { createInitialState, selectSlide, toggleRecording, addAnnotation, removeAnnotation, setScript, setNotes, setOutline, setTitle, addSlide, replaceSlides, splitClip, trimClip, deleteClip, selectClip, setPlayhead, advancePlayhead, moveClip } from './state.js';
import { CaptureSession } from './capture.js';
import { serializeProject, restoreProject, getRecordingFileNames, downloadBlob } from './project.js';
import { importImageSlide, renderPdfSlides } from './slides.js';
import { createPreviewUrls } from './media.js';
import { composeRecordings } from './composition.js';
import { removeBackgroundFromRecording, loadSelfieSegmentation } from './background.js';
import { createHistory, commitHistory, undoHistory, redoHistory } from './history.js';
import { loadFfmpeg, transcodeWebmToMp4 } from './mp4.js';

const app = document.querySelector('#app');
const PROJECT_KEY = 'eduvideo-project-v1';
const captureUnavailable = typeof navigator?.mediaDevices?.getDisplayMedia !== 'function' || typeof navigator?.mediaDevices?.getUserMedia !== 'function';
let state = (() => { try { const saved = localStorage.getItem(PROJECT_KEY); return saved ? restoreProject(JSON.parse(saved)) : createInitialState(); } catch { return createInitialState(); } })();
let history = createHistory(state);
let markerMode = 'pen';
let previewMode = 'presenter';
const capture = new CaptureSession({ onUnexpectedStop: async stopPromise => {
  try {
    const recordings = await stopPromise;
    latestRecordings = recordings;
    previewUrls = createPreviewUrls(recordings);
    previewMode = 'output';
    timelineExpanded = true;
    stopRecordingTimer();
    captureBusy = false;
    if (state.recording) applyState(toggleRecording(state));
    else render();
    toast('簡報分享已停止，已保存目前的人像與音訊素材');
  } catch (error) {
    captureBusy = false;
    render();
    toast(`螢幕分享已中斷：${error?.message || '素材保存失敗'}`);
  }
} });
let latestRecordings = null;
let previewUrls = null;
let composedUrl = null;
let composedBlob = null;
let teleprompterTimer = null;
let playbackTimer = null;
let playing = false;
let cameraVisible = true;
let timelineZoom = 1;
let scriptFontScale = 1;
let rightMode = 'script';
let textDraft = null;
let captureBusy = false;
let projectNameDraft = null;
let toastTimer = null;
let recordingStartedAt = null;
let recordingTimer = null;
let importBusy = false;
let importProgress = '';
let timelineExpanded = false;
let presentationWindow = null;
const presentationChannel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('eduvideo-presentation') : null;

const activeSlide = () => state.slides.find(slide => slide.id === state.activeSlideId);
function syncPresentation() { const slide = activeSlide(); if (slide) presentationChannel?.postMessage({ type: 'slide', slide }); }
function openPresentationWindow() {
  if (!presentationWindow || presentationWindow.closed) presentationWindow = window.open('./presentation.html', 'eduvideo-presentation', 'popup,width=1280,height=720');
  setTimeout(syncPresentation, 250);
  return presentationWindow;
}
presentationChannel?.addEventListener('message', event => { if (event.data?.type === 'request-slide') syncPresentation(); });
const totalDuration = () => state.clips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0);
const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
const recordingElapsed = () => recordingStartedAt ? Math.max(0, (Date.now() - recordingStartedAt) / 1000) : 0;
function stopRecordingTimer() { if (recordingTimer) clearInterval(recordingTimer); recordingTimer = null; recordingStartedAt = null; }
function updateRecordingTimer() { const element = document.querySelector('.recording-duration'); if (element) element.textContent = formatTime(recordingElapsed()); }
function startRecordingTimer() { stopRecordingTimer(); recordingStartedAt = Date.now(); recordingTimer = setInterval(updateRecordingTimer, 500); updateRecordingTimer(); }
const escapeHtml = (value) => String(value).replace(/[&<>\"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' })[char]);
const annotationMarkup = annotation => annotation.type === 'stroke'
  ? `<svg class="stroke-annotation annotation" data-annotation-id="${annotation.id}" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${(annotation.points || []).map(point => `${Number(point.x)},${Number(point.y)}`).join(' ')}" fill="none" stroke="${annotation.color || '#ff6b72'}" stroke-width="${annotation.width || 1.4}" stroke-linecap="round" stroke-linejoin="round" /></svg>`
  : `<span class="annotation ${annotation.type}" data-annotation-id="${annotation.id}" style="left:${annotation.x}%;top:${annotation.y}%;--marker-color:${annotation.color || '#ff6b72'}">${annotation.type === 'text' ? escapeHtml(annotation.text) : '↗'}</span>`;
function applyState(next) { history = commitHistory(history, next); state = history.present; render(); }
function persist() { try { localStorage.setItem(PROJECT_KEY, JSON.stringify(serializeProject(state))); } catch { /* private browsing or storage quota */ } }
function commitDraft() { if (JSON.stringify(state) !== JSON.stringify(history.present)) { history = commitHistory(history, state); state = history.present; render(); } }
function undo() { if (!history.past.length) return; history = undoHistory(history); state = history.present; render(); toast('已復原上一個操作'); }
function redo() { if (!history.future.length) return; history = redoHistory(history); state = history.present; render(); toast('已重做操作'); }
function stopPlayback() { if (playbackTimer) clearInterval(playbackTimer); playbackTimer = null; playing = false; }
function stopTeleprompter() { if (teleprompterTimer) clearInterval(teleprompterTimer); teleprompterTimer = null; }
function updatePlaybackDisplay() {
  const duration = totalDuration();
  const ratio = duration ? state.playhead / duration : 0;
  const timeLabel = document.querySelector('.timeline-title span');
  const playhead = document.querySelector('.playhead');
  if (timeLabel) timeLabel.textContent = `${formatTime(state.playhead)} / ${formatTime(duration)}`;
  if (playhead) playhead.style.left = `calc(${86 * (1 - ratio)}px + ${ratio * 100}%)`;
}
function togglePlayback() {
  if (playing) { stopPlayback(); render(); return; }
  if (state.playhead >= totalDuration()) state = setPlayhead(state, 0);
  playing = true;
  playbackTimer = setInterval(() => {
    state = advancePlayhead(state, 0.1);
    updatePlaybackDisplay();
    if (state.playhead >= totalDuration()) { stopPlayback(); render(); }
  }, 100);
  render();
}

function render() {
  try { localStorage.setItem(PROJECT_KEY, JSON.stringify(serializeProject(state))); } catch { /* private browsing or storage quota */ }
  const slide = activeSlide() || state.slides[0] || { id: 'slide-1', title: '新投影片', subtitle: '', color: '#334b66', annotations: [] };
  const playheadRatio = totalDuration() ? state.playhead / totalDuration() : 0;
  app.innerHTML = `
    <main class="studio-shell ${timelineExpanded ? '' : 'timeline-is-collapsed'}">
      <header class="topbar">
        <div class="brand"><span class="brand-mark">E</span><span>EduVideo</span><small>STUDIO</small></div>
        ${projectNameDraft !== null ? `<input class="project-name-input" data-project-name value="${escapeHtml(projectNameDraft)}" aria-label="專案名稱" />` : `<button class="project-name" data-action="rename-project" aria-label="重新命名專案" title="重新命名專案">${escapeHtml(state.title || '未命名教學影片')} <span>⌄</span></button>`}
        <div class="top-actions"><span class="save-state">● 已儲存</span>${captureUnavailable ? '<span class="capture-note" role="status">錄製請使用 Chrome/Edge</span>' : ''}<button class="ghost-button history-button" data-action="undo" title="復原 (⌘/Ctrl+Z)" aria-label="復原" ${history.past.length ? '' : 'disabled'}>↶</button><button class="ghost-button history-button" data-action="redo" title="重做 (⌘/Ctrl+Shift+Z)" aria-label="重做" ${history.future.length ? '' : 'disabled'}>↷</button><button class="ghost-button" data-action="import-project" title="開啟先前備份的 JSON 專案">開啟專案</button><button class="ghost-button" data-action="export" title="${latestRecordings ? '下載螢幕與人像素材' : '備份可編輯專案'}" aria-label="${latestRecordings ? '下載錄製素材' : '備份可編輯專案'}">${latestRecordings ? '下載素材' : '備份專案'}</button><button class="record-button ${state.recording ? 'is-recording' : ''}" data-action="record" aria-pressed="${state.recording}" aria-busy="${captureBusy}" ${captureBusy || captureUnavailable ? 'disabled' : ''} title="${captureUnavailable ? '此環境不支援螢幕與攝影機錄製，請使用最新版 Chrome 或 Edge' : captureBusy ? (state.recording ? '正在保存錄製素材' : '正在等待錄製權限') : state.recording ? '停止並保存錄製素材' : '同時錄製簡報、人像與麥克風'}"><i></i>${captureUnavailable ? '需用網頁版錄製' : captureBusy ? (state.recording ? '儲存錄製…' : '準備錄製…') : state.recording ? `停止錄製 <span class="recording-duration" aria-label="已錄製時間">${formatTime(recordingElapsed())}</span>` : '開始錄製'}</button></div>
      </header>
      <section class="workspace">
        <aside class="left-panel panel">
          <div class="panel-heading"><span>簡報頁面 <small>${state.slides.length}</small></span><button class="add-slide-button" data-action="add-slide" ${importBusy ? 'disabled' : ''}>${importBusy ? escapeHtml(importProgress || '匯入中…') : '＋ 匯入簡報'}</button></div>
          <div class="slide-list">${state.slides.map((item, index) => `<button class="slide-thumb ${item.id === state.activeSlideId ? 'active' : ''}" data-slide="${item.id}" title="${escapeHtml(item.title)}"><span class="slide-number">${String(index + 1).padStart(2, '0')}</span><span class="mini-slide ${item.image ? 'has-image' : ''}" style="--mini-color:${item.color}">${item.image ? `<img src="${item.image}" alt="" />` : `<b>${escapeHtml(item.title)}</b>`}</span></button>`).join('')}</div>
          <div class="left-footer"><button class="outline-button" data-action="outline">☷　編輯大綱</button><button class="outline-button" data-action="notes">▤　講者備註</button></div>
        </aside>
        <section class="center-panel">
          <div class="stage-toolbar"><div class="view-tabs"><button class="tab ${previewMode === 'presenter' ? 'active' : ''}" data-action="presenter-preview" aria-selected="${previewMode === 'presenter'}">錄製畫面</button><button class="tab ${previewMode === 'output' ? 'active' : ''}" data-action="output-preview" aria-selected="${previewMode === 'output'}">錄製結果${previewUrls ? ' ●' : ''}</button></div><div class="stage-actions"><button class="small-button" data-action="presentation-window" title="開啟不含人像與操作介面的純簡報視窗">▣ 純簡報視窗</button><button class="small-button" data-action="camera" aria-pressed="${cameraVisible}" title="${cameraVisible ? '隱藏講者人像預覽' : '顯示講者人像預覽'}">${cameraVisible ? '◉ 隱藏人像' : '◉ 顯示人像'}</button><button class="small-button" data-action="fullscreen" aria-label="切換全螢幕" title="切換全螢幕">⛶</button></div></div>
          <div class="presentation-stage ${previewMode === 'output' ? 'is-output-preview' : ''}" id="preview-panel" aria-label="${previewMode === 'presenter' ? '講者預覽畫布' : '成品預覽畫布'}">
            ${previewMode === 'presenter' ? `<div class="slide-canvas" style="--slide-color:${slide.color};">
              ${slide.image ? `<img class="slide-background" src="${slide.image}" alt="" aria-hidden="true" />` : ''}
              ${slide.image ? '' : `<div class="slide-copy"><span class="eyebrow">EDUVIDEO / ${String(Number(state.activeSlideId.split('-')[1])).padStart(2, '0')}</span><h1>${escapeHtml(slide.title)}</h1><p>${escapeHtml(slide.subtitle)}</p><div class="slide-rule"></div></div><div class="slide-graphic"><span class="graphic-ring"></span><span class="graphic-dot"></span><span class="graphic-line"></span></div>`}
              ${slide.annotations.map(annotationMarkup).join('')}
            </div>
            ${textDraft ? `<div class="text-marker-dialog" role="dialog" aria-label="新增文字標記"><div class="text-marker-title">新增文字標記</div><input class="text-marker-input" data-text-input value="${escapeHtml(textDraft.text || '重點')}" aria-label="標記文字" /><div class="text-marker-actions"><button class="tiny-button" data-action="cancel-text-annotation">取消</button><button class="tiny-button primary-button" data-action="add-text-annotation">加入標記</button></div></div>` : ''}
            ${cameraVisible ? '<div class="camera-preview"><video class="camera-live" autoplay muted playsinline></video><div class="camera-light"></div><div class="face"><span class="hair"></span><span class="face-eye left"></span><span class="face-eye right"></span><span class="face-mouth"></span></div><div class="shoulders"></div><span class="camera-label">● 人像預覽</span></div>' : ''}
            <div class="preview-caption">錄製時可看見鏡像人像；素材會分開保存</div>` : `<div class="review-stage"><div class="review-header"><div><strong>${previewUrls ? '錄製完成' : '尚未錄製'}</strong><span>${previewUrls ? '先檢查兩個原始素材，再決定是否去背或合成。' : '回到「錄製畫面」後按右上角「開始錄製」。'}</span></div>${previewUrls ? `<div class="review-actions"><button class="small-button" data-action="remove-bg">✦ 人像去背</button><button class="small-button primary-action" data-action="compose">▶ 合成預覽</button>${composedBlob ? '<button class="small-button primary-action" data-action="export-mp4">⇩ 匯出 MP4</button>' : ''}</div>` : ''}</div>${composedUrl ? `<div class="review-output"><span>成品預覽</span><video controls autoplay muted src="${composedUrl}"></video></div>` : ''}${previewUrls ? `<div class="review-grid"><label class="review-card"><span>① 簡報畫面</span><video controls src="${previewUrls.screen || ''}"></video></label><label class="review-card"><span>② 人像素材</span><video controls src="${previewUrls.camera || ''}"></video></label></div>` : '<div class="review-empty">完成一次錄製後，簡報、人像與合成結果會集中顯示在這裡。</div>'}</div>`}
          </div>
          ${previewMode === 'presenter' ? `<div class="annotation-toolbar"><span class="tool-label">互動標記</span>${[['pen','✎','畫筆'],['highlight','▰','螢光筆'],['arrow','➜','箭頭'],['text','T','文字'],['eraser','⌫','橡皮擦']].map(([tool,icon,label]) => `<button class="tool-button ${markerMode === tool ? 'selected' : ''}" data-tool="${tool}" aria-label="${label}" aria-pressed="${markerMode === tool}" title="${label}">${icon}</button>`).join('')}<span class="toolbar-divider"></span><span class="annotation-tip">在簡報上點一下加入標記</span></div>` : ''}
        </section>
        <aside class="right-panel panel">
          <div class="panel-heading"><span>講者工作區</span><span class="live-badge">LIVE</span></div>
          ${rightMode === 'script' ? `<section class="script-section"><div class="section-label">提詞器 <button class="tiny-button" data-action="script-size" title="調整提詞文字大小">Aᵃ</button></div><div class="script-box" style="font-size:${13 * scriptFontScale}px" contenteditable="true" data-script>${escapeHtml(state.script)}</div><div class="script-controls"><button class="tiny-button" data-action="script-play" aria-pressed="${Boolean(teleprompterTimer)}">${teleprompterTimer ? '❚❚ 停止自動捲動' : '▶ 自動捲動'}</button><span>速度　<span class="speed">1.0×</span></span></div></section>` : `<section class="script-section notes-view"><div class="section-label">講者備註 <button class="tiny-button" data-action="script-mode">↩ 逐字稿</button></div><textarea class="notes-box" data-notes>${escapeHtml(state.notes || '')}</textarea><div class="notes-hint">只給講者看的提醒，不會出現在成品影片。</div></section>`}
          <section class="outline-section"><div class="section-label">本頁大綱 <span class="outline-hint">每行一個重點</span></div><textarea class="outline-box" data-outline>${escapeHtml((state.outline || []).join('\n'))}</textarea></section>
          <section class="audio-section"><div class="section-label">音訊狀態</div><div class="audio-meter"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div><div class="audio-source">● MacBook Pro 麥克風 <span>良好</span></div></section>
        </aside>
      </section>
      <section class="timeline-panel ${timelineExpanded ? '' : 'collapsed'}" style="--timeline-zoom:${timelineZoom}" aria-label="剪輯時間軸"><div class="timeline-top"><div class="timeline-title">剪輯時間軸 <span>${formatTime(state.playhead)} / ${formatTime(totalDuration())}</span></div><button class="small-button timeline-toggle" data-action="timeline-toggle" aria-expanded="${timelineExpanded}">${timelineExpanded ? '收合剪輯區 ↓' : '展開剪輯區 ↑'}</button><div class="timeline-tools"><button class="small-button playback-button" data-action="playback" ${state.clips.length ? '' : 'disabled'}>${playing ? '❚❚ 暫停' : '▶ 播放'}</button><button class="small-button" data-action="trim-start" ${state.selectedClipId ? '' : 'disabled'}>◀ 裁切開始</button><button class="small-button" data-action="trim-end" ${state.selectedClipId ? '' : 'disabled'}>裁切結束 ▶</button><button class="small-button" data-action="split" ${state.selectedClipId ? '' : 'disabled'}>✂ 分割</button><button class="small-button" data-action="delete" ${state.selectedClipId ? '' : 'disabled'}>⌫ 刪除片段</button><button class="small-button" data-action="zoom" title="縮放時間軸">${timelineZoom === 1 ? '＋　−' : `${timelineZoom.toFixed(1)}×`}</button></div></div><div class="timeline-scroll"><div class="timeline-content"><div class="ruler"><span>00:00</span><span>01:00</span><span>02:00</span><span>03:00</span><span>04:00</span><span>05:00</span><span>06:00</span></div>${state.tracks.map(track => `<div class="track-row"><span class="track-label">${track.label}</span><div class="track-lane" data-lane="${track.id}" aria-label="${track.label}軌道，點擊移動播放頭">${state.clips.filter(clip => clip.trackId === track.id).map(clip => `<button class="clip clip-${track.kind} ${clip.id === state.selectedClipId ? 'selected' : ''}" data-clip="${clip.id}" style="left:${clip.start / totalDuration() * 100}%;width:${clip.duration / totalDuration() * 100}%">${clip.label}</button>`).join('')}</div></div>`).join('')}<div class="playhead" style="left:calc(${86 * (1 - playheadRatio)}px + ${playheadRatio * 100}%)"><span></span></div></div></div></section>
      <div class="toast" id="toast" aria-live="polite"></div>
    </main>`;
  bindEvents();
  if (projectNameDraft !== null) {
    const titleInput = app.querySelector('[data-project-name]');
    titleInput?.focus();
    titleInput?.select();
  }
  const viewTabs = app.querySelector('.view-tabs');
  viewTabs?.setAttribute('role', 'tablist');
  viewTabs?.setAttribute('aria-label', '預覽模式');
  app.querySelectorAll('.view-tabs .tab').forEach((tab, index) => {
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', 'preview-panel');
    tab.id = index === 0 ? 'presenter-tab' : 'output-tab';
  });
  const previewPanel = app.querySelector('.presentation-stage');
  previewPanel?.setAttribute('role', 'tabpanel');
  previewPanel?.setAttribute('aria-labelledby', previewMode === 'presenter' ? 'presenter-tab' : 'output-tab');
  app.querySelectorAll('[data-slide]').forEach(slideButton => slideButton.setAttribute('aria-current', slideButton.dataset.slide === state.activeSlideId ? 'true' : 'false'));
  requestAnimationFrame(() => app.querySelector(`[data-slide="${state.activeSlideId}"]`)?.scrollIntoView({ block: 'nearest' }));
  syncPresentation();
  if (textDraft) app.querySelector('[data-text-input]')?.focus();
}

function toast(message) { const element = document.querySelector('#toast'); if (element) { if (toastTimer) clearTimeout(toastTimer); element.textContent = message; element.classList.add('visible'); toastTimer = setTimeout(() => { element.classList.remove('visible'); toastTimer = null; }, 2200); } }

function bindEvents() {
  app.querySelectorAll('[data-slide]').forEach(button => button.addEventListener('click', () => applyState(selectSlide(state, button.dataset.slide))));
  app.querySelectorAll('[data-clip]').forEach(button => {
    let drag = null; let dragged = false;
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      const lane = button.closest('[data-lane]'); const rect = lane?.getBoundingClientRect();
      if (!rect) return;
      drag = { rect, offset: event.clientX - button.getBoundingClientRect().left };
      button.setPointerCapture?.(event.pointerId);
    });
    button.addEventListener('pointermove', event => {
      if (!drag) return;
      dragged = true;
      const start = Math.max(0, (event.clientX - drag.rect.left - drag.offset) / drag.rect.width * totalDuration());
      button.style.left = `${start / totalDuration() * 100}%`;
    });
    button.addEventListener('pointerup', event => {
      if (!drag) return;
      const start = Math.max(0, (event.clientX - drag.rect.left - drag.offset) / drag.rect.width * totalDuration());
      button.releasePointerCapture?.(event.pointerId); drag = null;
      if (dragged) { applyState(moveClip(state, button.dataset.clip, start)); event.stopPropagation(); }
      dragged = false;
    });
    button.addEventListener('click', event => { event.stopPropagation(); if (dragged) { dragged = false; return; } applyState(selectClip(state, button.dataset.clip)); });
  });
  app.querySelectorAll('[data-lane]').forEach(lane => lane.addEventListener('click', event => { const rect = lane.getBoundingClientRect(); applyState(setPlayhead(state, (event.clientX - rect.left) / rect.width * totalDuration())); }));
  app.querySelector('[data-action="record"]')?.addEventListener('click', async () => {
    if (captureBusy) return;
    captureBusy = true;
    render();
    if (!state.recording) {
      try {
        let timeoutId;
        try {
          openPresentationWindow();
          await new Promise(resolve => setTimeout(resolve, 450));
          const startPromise = capture.start();
          const timeoutPromise = new Promise((_, reject) => { timeoutId = setTimeout(() => reject(new Error('錄製權限等待逾時')), 12000); });
          await Promise.race([startPromise, timeoutPromise]);
        } catch (error) {
          if (error?.message === '錄製權限等待逾時') capture.cancelStart();
          throw error;
        } finally { clearTimeout(timeoutId); }
        if (composedUrl) URL.revokeObjectURL(composedUrl);
        latestRecordings = null; previewUrls = null; composedUrl = null; composedBlob = null;
        captureBusy = false;
        startRecordingTimer();
        applyState(toggleRecording(state)); attachMediaPreviews(); toast('錄製已開始：簡報、人像與音訊同步中');
      }
      catch (error) {
        captureBusy = false;
        const reason = error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError'
          ? '你取消了螢幕或攝影機權限；請允許兩者後再試一次。'
          : error?.name === 'NotFoundError'
            ? '找不到可用的攝影機或麥克風，請檢查裝置連線。'
          : error?.message === '錄製權限等待逾時'
            ? '權限視窗沒有回應；請重新點擊並在分享畫面視窗中完成選擇。'
            : '目前環境不支援螢幕擷取；請用最新版 Chrome/Edge 網頁版錄製，再回到此工具剪輯。';
        render(); toast(`無法開始錄製：${reason}`);
      }
    } else {
      try {
        const recordings = await capture.stop(); stopRecordingTimer(); latestRecordings = recordings; previewUrls = createPreviewUrls(recordings); previewMode = 'output'; timelineExpanded = true; captureBusy = false; applyState(toggleRecording(state)); toast(recordings.screen ? '錄製已停止，螢幕與人像素材已分開保存' : '錄製已停止');
      } catch (error) { captureBusy = false; render(); toast(`停止錄製失敗：${error.message}`); }
    }
  });
  app.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => { markerMode = button.dataset.tool; render(); }));
  const canvas = app.querySelector('.slide-canvas');
  let drawing = false; let points = []; let suppressClick = false;
  canvas?.addEventListener('pointerdown', event => {
    if (!['pen', 'highlight'].includes(markerMode)) return;
    const rect = canvas.getBoundingClientRect();
    drawing = true; points = [{ x: Math.round((event.clientX - rect.left) / rect.width * 1000) / 10, y: Math.round((event.clientY - rect.top) / rect.height * 1000) / 10 }];
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas?.addEventListener('pointermove', event => {
    if (!drawing) return;
    const rect = canvas.getBoundingClientRect();
    points.push({ x: Math.round((event.clientX - rect.left) / rect.width * 1000) / 10, y: Math.round((event.clientY - rect.top) / rect.height * 1000) / 10 });
  });
  canvas?.addEventListener('pointerup', event => {
    if (!drawing) return;
    drawing = false; canvas.releasePointerCapture?.(event.pointerId);
    if (points.length > 1) { suppressClick = true; applyState(addAnnotation(state, { type: 'stroke', points, color: markerMode === 'highlight' ? '#ffd166aa' : '#ff6b72', width: markerMode === 'highlight' ? 4 : 1.5 })); }
    points = [];
  });
  canvas?.addEventListener('click', event => { if (suppressClick) { suppressClick = false; return; } if (markerMode === 'eraser') { const clicked = event.target.closest?.('.annotation'); const annotation = clicked ? activeSlide().annotations.find(item => item.id === clicked.dataset.annotationId) : activeSlide().annotations.at(-1); if (annotation) { applyState(removeAnnotation(state, state.activeSlideId, annotation.id)); toast('已移除標記'); } return; } const rect = event.currentTarget.getBoundingClientRect(); if (markerMode === 'text') { textDraft = { x: Math.round((event.clientX - rect.left) / rect.width * 100), y: Math.round((event.clientY - rect.top) / rect.height * 100), text: '重點' }; render(); return; } applyState(addAnnotation(state, { type: markerMode, x: Math.round((event.clientX - rect.left) / rect.width * 100), y: Math.round((event.clientY - rect.top) / rect.height * 100), color: markerMode === 'highlight' ? '#ffd166' : '#ff6b72', text: '' })); });
  app.querySelector('[data-text-input]')?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); app.querySelector('[data-action="add-text-annotation"]')?.click(); } if (event.key === 'Escape') { event.preventDefault(); app.querySelector('[data-action="cancel-text-annotation"]')?.click(); } });
  app.querySelector('[data-script]')?.addEventListener('input', event => { state = setScript(state, event.currentTarget.textContent); persist(); });
  app.querySelector('[data-script]')?.addEventListener('blur', commitDraft);
  app.querySelector('[data-notes]')?.addEventListener('input', event => { state = setNotes(state, event.currentTarget.value); persist(); });
  app.querySelector('[data-notes]')?.addEventListener('blur', commitDraft);
  app.querySelector('[data-outline]')?.addEventListener('input', event => { state = setOutline(state, event.currentTarget.value.split('\n').map(item => item.trim()).filter(Boolean)); persist(); });
  app.querySelector('[data-outline]')?.addEventListener('blur', commitDraft);
  const titleInput = app.querySelector('[data-project-name]');
  const commitProjectName = () => {
    if (projectNameDraft === null) return;
    const nextTitle = titleInput?.value.trim() || '未命名教學影片';
    projectNameDraft = null;
    applyState(setTitle(state, nextTitle));
    toast('專案名稱已更新');
  };
  titleInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); commitProjectName(); }
    if (event.key === 'Escape') { event.preventDefault(); projectNameDraft = null; render(); }
  });
  titleInput?.addEventListener('blur', commitProjectName);
  app.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', async () => {
    const action = button.dataset.action;
    if (action === 'record' && captureUnavailable) { toast('桌面版 WebView 不支援螢幕擷取，請用最新版 Chrome 或 Edge 開啟網頁版錄製。'); return; }
    if (action === 'cancel-text-annotation') { textDraft = null; render(); return; }
    if (action === 'add-text-annotation') {
      const text = app.querySelector('[data-text-input]')?.value.trim() || '重點';
      const draft = textDraft;
      textDraft = null;
      if (draft) applyState(addAnnotation(state, { type: 'text', x: draft.x, y: draft.y, color: '#ff6b72', text }));
      else render();
      toast('已加入文字標記'); return;
    }
    if (action === 'rename-project') { projectNameDraft = state.title || '未命名教學影片'; render(); return; }
    if (action === 'add-slide') {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.pdf,image/*';
      input.addEventListener('change', async () => {
        const file = input.files?.[0]; if (!file) return;
        importBusy = true; importProgress = '準備中…'; render();
        try {
          const imported = file.type === 'application/pdf'
            ? await importPdfWithWorker(file, (done, total) => {
              importProgress = `${done}/${total}`;
              const progressButton = app.querySelector('[data-action="add-slide"]');
              if (progressButton) progressButton.textContent = `匯入中 ${importProgress}`;
            })
            : [await importImageSlide(file)];
          const starterTitles = ['為什麼需要 EduVideo？', '簡報與講者同步出現', '錄完後再精準剪輯'];
          const isStarterDeck = state.slides.length === starterTitles.length
            && state.slides.every((item, index) => item.title === starterTitles[index] && !(item.annotations || []).length);
          if (isStarterDeck) state = replaceSlides(state, imported);
          else {
            const firstImportedId = `slide-${state.slides.length + 1}`;
            imported.forEach(slideData => { state = addSlide(state, slideData); });
            state = selectSlide(state, firstImportedId);
          }
          if (state.title === '未命名教學影片') state = setTitle(state, file.name.replace(/\.[^.]+$/, ''));
          history = commitHistory(history, state);
          importBusy = false; importProgress = ''; previewMode = 'presenter'; render(); toast(`已匯入 ${imported.length} 張投影片`);
        } catch (error) { importBusy = false; importProgress = ''; render(); toast(`匯入失敗：${error.message}`); }
      });
      input.click(); return;
    }
    if (action === 'import-project') {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'application/json,.json';
      input.addEventListener('change', async () => {
        const file = input.files?.[0]; if (!file) return;
        try {
          state = restoreProject(JSON.parse(await file.text()));
          history = createHistory(state);
          latestRecordings = null; previewUrls = null; composedUrl = null; composedBlob = null; previewMode = 'presenter'; projectNameDraft = null;
          render(); toast('專案已匯入');
        } catch (error) { toast(`專案匯入失敗：${error.message}`); }
      });
      input.click(); return;
    }
    if (action === 'undo') { undo(); return; }
    if (action === 'redo') { redo(); return; }
    if (action === 'timeline-toggle') { timelineExpanded = !timelineExpanded; render(); return; }
    if (action === 'playback') { togglePlayback(); return; }
    if (action === 'split') {
      const clip = state.clips.find(item => item.id === state.selectedClipId);
      if (!clip) { toast('請先選取要分割的片段'); return; }
      if (state.playhead <= clip.start || state.playhead >= clip.start + clip.duration) { toast('請把播放頭放在片段中間再分割'); return; }
      applyState(splitClip(state, clip.id, state.playhead)); toast('已在播放頭位置建立剪輯點'); return;
    }
    if (action === 'trim-start' || action === 'trim-end') {
      const clip = state.clips.find(item => item.id === state.selectedClipId);
      if (!clip) { toast('請先選取要裁切的片段'); return; }
      const end = clip.start + clip.duration;
      const next = action === 'trim-start'
        ? trimClip(state, clip.id, state.playhead, end)
        : trimClip(state, clip.id, clip.start, state.playhead);
      applyState(next); toast(action === 'trim-start' ? '已裁切播放頭前的片段' : '已裁切播放頭後的片段'); return;
    }
    if (action === 'delete') {
      if (!state.clips.some(item => item.id === state.selectedClipId)) { toast('請先選取要刪除的片段'); return; }
      applyState(deleteClip(state, state.selectedClipId)); toast('已刪除選取片段，可用復原還原'); return;
    }
    if (action === 'export') {
      if (latestRecordings?.screen && latestRecordings?.camera) {
        const files = getRecordingFileNames('eduvideo-lesson');
        downloadBlob(latestRecordings.screen, files.screen);
        downloadBlob(latestRecordings.camera, files.camera);
        toast('已下載螢幕與人像兩個獨立素材');
      } else {
        downloadBlob(new Blob([JSON.stringify(serializeProject(state), null, 2)], { type: 'application/json' }), 'eduvideo-project.json');
        toast('已匯出可編輯專案資料');
      }
      return;
    }
    if (action === 'compose') {
      if (!latestRecordings) { toast('請先完成一次錄製'); return; }
      button.disabled = true; button.textContent = '合成中…';
      try {
        const composed = await composeRecordings(latestRecordings);
        if (composedUrl) URL.revokeObjectURL(composedUrl);
        composedBlob = composed;
        composedUrl = URL.createObjectURL(composed);
        previewMode = 'output';
        render(); toast('成品預覽已完成');
      } catch (error) { button.disabled = false; button.textContent = '▶ 合成成品預覽'; toast(`合成失敗：${error.message}`); }
      return;
    }
    if (action === 'export-mp4') {
      if (!composedBlob) { toast('請先完成成品合成'); return; }
      if (!globalThis.crossOriginIsolated) {
        downloadBlob(composedBlob, 'eduvideo-lesson.webm');
        toast('目前環境無法啟用 MP4 編碼，已先下載 WebM 成品');
        return;
      }
      button.disabled = true; button.textContent = 'MP4 編碼中…';
      try {
        const FFmpeg = await loadFfmpeg();
        const ffmpeg = FFmpeg.createFFmpeg({ log: false, corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js' });
        await ffmpeg.load();
        const mp4 = await transcodeWebmToMp4(composedBlob, { ffmpeg, fetchFile: FFmpeg.fetchFile });
        downloadBlob(mp4, 'eduvideo-lesson.mp4');
        button.disabled = false; button.textContent = '⇩ 匯出 MP4'; toast('MP4 已匯出');
      } catch (error) { button.disabled = false; button.textContent = '⇩ 匯出 MP4'; toast(`MP4 匯出失敗：${error.message}`); }
      return;
    }
    if (action === 'remove-bg') {
      if (!latestRecordings?.camera) { toast('請先完成一次錄製'); return; }
      button.disabled = true; button.textContent = '去背處理中…';
      try {
        const SelfieSegmentation = await loadSelfieSegmentation();
        const processed = await removeBackgroundFromRecording(latestRecordings.camera, {
          segmenterFactory: async () => {
            const segmenter = new SelfieSegmentation({ locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}` });
            segmenter.setOptions({ modelSelection: 1 });
            return segmenter;
          }
        });
        if (previewUrls?.camera) URL.revokeObjectURL(previewUrls.camera);
        latestRecordings = { ...latestRecordings, camera: processed };
        previewUrls = { ...previewUrls, camera: URL.createObjectURL(processed) };
        render(); toast('人像去背完成，已套用到後續成品合成');
      } catch (error) { button.disabled = false; button.textContent = '✦ 後製人像去背'; toast(`去背失敗：${error.message}`); }
      return;
    }
    if (action === 'presenter-preview' || action === 'output-preview') {
      if (action === 'output-preview') stopTeleprompter();
      previewMode = action === 'output-preview' ? 'output' : 'presenter';
      render();
      return;
    }
    if (action === 'script-play') {
      const scriptBox = app.querySelector('[data-script]');
      if (teleprompterTimer) { clearInterval(teleprompterTimer); teleprompterTimer = null; button.textContent = '▶ 自動捲動'; button.setAttribute('aria-pressed', 'false'); toast('提詞器自動捲動已暫停'); }
      else if (scriptBox) { teleprompterTimer = setInterval(() => { scriptBox.scrollTop += 1; }, 80); button.textContent = '❚❚ 停止自動捲動'; button.setAttribute('aria-pressed', 'true'); toast('提詞器自動捲動已啟用'); }
      return;
    }
    if (action === 'outline') { const outline = app.querySelector('[data-outline]'); outline?.focus(); outline?.scrollIntoView({ block: 'nearest' }); return; }
    if (action === 'notes') { stopTeleprompter(); rightMode = 'notes'; render(); app.querySelector('[data-notes]')?.focus(); return; }
    if (action === 'script-mode') { rightMode = 'script'; render(); app.querySelector('[data-script]')?.focus(); return; }
    if (action === 'camera') { cameraVisible = !cameraVisible; render(); attachMediaPreviews(); toast(cameraVisible ? '人像預覽已顯示' : '人像預覽已隱藏'); return; }
    if (action === 'presentation-window') { const opened = openPresentationWindow(); toast(opened ? '已開啟純簡報視窗；錄製時請選擇它' : '瀏覽器阻擋了純簡報視窗，請允許彈出式視窗'); return; }
    if (action === 'fullscreen') { const stage = app.querySelector('.presentation-stage'); try { if (document.fullscreenElement) await document.exitFullscreen(); else await stage?.requestFullscreen?.(); toast(document.fullscreenElement ? '已進入全螢幕預覽' : '已離開全螢幕預覽'); } catch { toast('目前環境不允許全螢幕預覽'); } return; }
    if (action === 'zoom') { timelineZoom = timelineZoom >= 2 ? 1 : timelineZoom + 0.5; render(); toast(`時間軸縮放 ${timelineZoom.toFixed(1)}×`); return; }
    if (action === 'script-size') { scriptFontScale = scriptFontScale >= 1.3 ? 1 : scriptFontScale + 0.15; render(); toast(`提詞文字 ${scriptFontScale === 1 ? '標準' : '放大'}`); return; }
  }));
}

function attachMediaPreviews() {
  const video = app.querySelector('.camera-live');
  if (!video) return;
  const preview = video.closest('.camera-preview');
  if (capture.streams.camera) {
    video.srcObject = capture.streams.camera;
    video.style.display = 'block';
    // Some Chromium/Electron builds do not start a newly attached live
    // MediaStream from the autoplay attribute alone. Only hide the fallback
    // illustration after playback actually succeeds.
    video.play().then(() => preview?.classList.add('has-live')).catch(() => {
      video.style.display = 'none';
      preview?.classList.remove('has-live');
    });
  } else {
    video.pause?.();
    video.srcObject = null;
    video.style.display = 'none';
    preview?.classList.remove('has-live');
  }
}

async function importPdfWithWorker(file, onProgress) {
  const pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
  return renderPdfSlides(file, { pdfjs, onProgress });
}

render();
window.addEventListener('beforeunload', event => {
  if (!latestRecordings && !state.recording && !composedBlob) return;
  event.preventDefault();
  event.returnValue = '';
});
document.addEventListener('keydown', event => {
  if (event.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && document.activeElement?.contentEditable !== 'true') { event.preventDefault(); togglePlayback(); return; }
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
  if (event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
  if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
});
