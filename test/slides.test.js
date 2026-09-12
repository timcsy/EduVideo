import test from 'node:test';
import assert from 'node:assert/strict';
import { importImageSlide, renderPdfSlides } from '../src/slides.js';

test('imports an image file as a slide without uploading it', async () => {
  const file = { name: 'lesson.png', type: 'image/png' };
  const slide = await importImageSlide(file, { createObjectURL: () => 'blob:lesson' });
  assert.equal(slide.title, 'lesson');
  assert.equal(slide.image, 'blob:lesson');
});

test('renders each PDF page through an injected PDF renderer', async () => {
  const pdfjs = { getDocument: () => ({ promise: Promise.resolve({ numPages: 2, getPage: async n => ({ getViewport: () => ({ width: 100, height: 50 }), render: ({ canvasContext }) => { canvasContext.page = n; return { promise: Promise.resolve() }; } }) }) }) };
  const canvasFactory = () => ({ width: 0, height: 0, getContext: () => ({}), toDataURL: () => 'data:image/png;base64,page' });
  const progress = [];
  const pages = await renderPdfSlides({ name: 'lesson.pdf', arrayBuffer: async () => new ArrayBuffer(1) }, { pdfjs, canvasFactory, onProgress: (done, total) => progress.push([done, total]) });
  assert.equal(pages.length, 2);
  assert.equal(pages[0].title, 'lesson · 1');
  assert.equal(pages[0].image, 'data:image/png;base64,page');
  assert.deepEqual(progress, [[1, 2], [2, 2]]);
});
