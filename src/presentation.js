const root = document.querySelector('#presentation');
const channel = new BroadcastChannel('eduvideo-presentation');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function annotationMarkup(annotation) {
  if (annotation.type === 'stroke') {
    const points = (annotation.points || []).map(point => `${Number(point.x)},${Number(point.y)}`).join(' ');
    return `<svg class="stroke-annotation" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${points}" fill="none" stroke="${annotation.color || '#ff6b72'}" stroke-width="${annotation.width || 1.4}" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
  }
  return `<span class="annotation ${annotation.type}" style="left:${Number(annotation.x) || 0}%;top:${Number(annotation.y) || 0}%;--marker-color:${annotation.color || '#ff6b72'}">${annotation.type === 'text' ? escapeHtml(annotation.text) : '↗'}</span>`;
}

function render(slide) {
  root.innerHTML = `<section class="clean-slide" style="--slide-color:${slide.color || '#334b66'}">
    ${slide.image ? `<img class="slide-background" src="${slide.image}" alt="" />` : `<div class="slide-copy"><span class="eyebrow">EDUVIDEO</span><h1>${escapeHtml(slide.title)}</h1><p>${escapeHtml(slide.subtitle)}</p><div class="rule"></div></div>`}
    ${(slide.annotations || []).map(annotationMarkup).join('')}
  </section>`;
}

channel.addEventListener('message', event => { if (event.data?.type === 'slide' && event.data.slide) render(event.data.slide); });
channel.postMessage({ type: 'request-slide' });
window.addEventListener('keydown', event => { if (event.key === 'Escape') window.close(); });
