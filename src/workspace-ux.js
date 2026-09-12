// Workspace chrome stays outside recorded/exported canvases.
export function enhanceWorkspace() {
  const $ = id => document.getElementById(id);
  const setup = document.createElement('section'); setup.className = 'device-setup';
  setup.innerHTML = '<h2>錄製設定</h2><p class="hint">選擇來源與裝置，再開啟相機確認畫面。</p>';
  const inspector = document.querySelector('.record-inspector');
  inspector.prepend(setup);
  setup.append($('source').closest('label'), $('camera-device').closest('label'), $('audio-device').closest('label'), $('devices'));
  for (const h of inspector.querySelectorAll(':scope > h2')) if (h.textContent === '錄製裝置') h.remove();
  $('devices').textContent = '開啟相機與麥克風';
  $('toggle-notes').textContent = '側欄'; $('toggle-notes').title = '顯示或隱藏設定與講者筆記';
  $('shortcut-hint').textContent = '空白鍵 播放／暫停 · S 分割 · ⌘Z 復原';
  const ruler = document.createElement('div'); ruler.id = 'time-ruler'; ruler.setAttribute('aria-hidden', 'true'); $('seek').after(ruler);
  const observer = new MutationObserver(() => {
    const duration = Number($('seek').max);
    ruler.replaceChildren(...Array.from({ length: 6 }, (_, i) => { const span = document.createElement('span'); const t = duration * i / 5; span.textContent = `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`; return span; }));
  });
  observer.observe($('seek'), { attributes: true, attributeFilter: ['max'] });
  const badge = document.createElement('span'); badge.id = 'workflow-state'; badge.textContent = '準備錄製'; document.querySelector('.viewer-heading').append(badge);
  const update = () => { const recording = !$('pause-record').hidden; badge.textContent = recording ? ($('pause-record').textContent.includes('繼續') ? '已暫停' : '● 錄製中') : document.body.dataset.mode === 'edit' ? '剪輯工作區' : '準備錄製'; badge.dataset.recording = String(recording); };
  new MutationObserver(update).observe($('pause-record'), { attributes: true, childList: true, subtree: true });
  new MutationObserver(update).observe(document.body, { attributes: true, attributeFilter: ['data-mode'] });
}
