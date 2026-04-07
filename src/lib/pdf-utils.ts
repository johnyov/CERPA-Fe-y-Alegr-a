import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Set worker source
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export const extractTextFromPdf = async (fileOrUrl: File | string, signal?: AbortSignal): Promise<{ text: string; coverUrl: string; totalPages: number }> => {
  let loadingTask: any = null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // Strict 30s timeout

  const internalSignal = controller.signal;

  try {
    if (signal?.aborted || internalSignal.aborted) throw new Error('Aborted');
    
    if (typeof fileOrUrl === 'string') {
      loadingTask = pdfjs.getDocument({ 
        url: fileOrUrl,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/standard_fonts/',
      });
    } else {
      const arrayBuffer = await fileOrUrl.arrayBuffer();
      loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    }
    
    const onAbort = () => {
      if (loadingTask) {
        loadingTask.destroy().catch(() => {});
      }
    };

    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    internalSignal.addEventListener('abort', onAbort, { once: true });

    const pdf = await loadingTask.promise;
    
    if (signal?.aborted || internalSignal.aborted) throw new Error('Aborted');
    const totalPages = pdf.numPages;
    let fullText = '';
    let coverUrl = '';

    // Extract cover from first page
    try {
      const firstPage = await pdf.getPage(1);
      const viewport = firstPage.getViewport({ scale: 0.4 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (context) {
        await firstPage.render({ 
          canvasContext: context, 
          viewport,
          canvas: canvas
        }).promise;
        coverUrl = canvas.toDataURL('image/jpeg', 0.6);
      }
    } catch (coverErr) {
      console.error("Error extracting cover:", coverErr);
    }

    // Smart Sampling: Pages 1, 2, 3 and Last Page
    const pagesToAnalyze = new Set<number>();
    for (let i = 1; i <= Math.min(3, totalPages); i++) pagesToAnalyze.add(i);
    if (totalPages > 3) pagesToAnalyze.add(totalPages);

    const sortedPages = Array.from(pagesToAnalyze).sort((a, b) => a - b);

    for (const pageNum of sortedPages) {
      if (signal?.aborted || internalSignal.aborted) break;
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .filter((str: string) => str.trim().length > 0)
          .join(' ');
        
        if (pageText.length > 0) {
          fullText += `--- P${pageNum} ---\n${pageText}\n\n`;
        }
      } catch (pageErr) {
        console.warn(`Could not extract text from page ${pageNum}.`);
      }
    }

    clearTimeout(timeoutId);
    return { text: fullText, coverUrl, totalPages };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && (error.message === 'Aborted' || error.name === 'AbortError')) {
      throw new Error('Aborted');
    }
    console.error('Error extracting text from PDF:', error);
    return { text: '', coverUrl: '', totalPages: 0 };
  }
};
