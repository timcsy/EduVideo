export async function importImageSlide(file, { createObjectURL = URL.createObjectURL } = {}) {
  const title = file.name.replace(/\.[^.]+$/, '') || '匯入投影片';
  return { title, subtitle: '匯入的投影片', image: createObjectURL(file), color: '#344a63', annotations: [] };
}

export async function renderPdfSlides(file, { pdfjs = globalThis.pdfjsLib, canvasFactory = () => document.createElement('canvas'), onProgress = () => {} } = {}) {
  if (!pdfjs?.getDocument) throw new Error('PDF 支援尚未載入');
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const slides = [];
  const documentTitle = file.name.replace(/\.[^.]+$/, '') || 'PDF 簡報';
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = canvasFactory();
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    slides.push({ title: `${documentTitle} · ${pageNumber}`, subtitle: `第 ${pageNumber} 頁`, image: canvas.toDataURL('image/png'), color: '#344a63', annotations: [] });
    onProgress(pageNumber, pdf.numPages);
  }
  return slides;
}
