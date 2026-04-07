import React, { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, X, RefreshCw, Download } from 'lucide-react';
import { cn } from '../lib/utils';

// Set worker source
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfViewerProps {
  url: string;
  title: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ url, title }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const loadPdf = async () => {
      if (!url) return;
      setLoading(true);
      setError(null);
      try {
        // Ensure URL is root-relative if it's a local path
        let finalUrl = url;
        if (url.startsWith('files/')) {
          finalUrl = `/${url}`;
        }

        // Check if the URL is likely a local fallback that will fail
        if (finalUrl.startsWith('/files/')) {
          console.warn("Attempting to load a local PDF file. This may fail if not physically present in /public/files.");
        }

        const loadingTask = pdfjs.getDocument({
          url: finalUrl,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/standard_fonts/',
        });

        const pdfDoc = await loadingTask.promise;
        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);
        setPageNum(pdfDoc.numPages >= 2 ? 2 : 1);
      } catch (err: any) {
        console.error("Error loading PDF:", err);
        
        if (err.message?.includes("Invalid PDF structure") || err.name === "InvalidPDFException") {
          setError("El archivo tiene una estructura inválida o no se encontró (el servidor devolvió HTML). Por favor, elimine este libro y vuelva a importarlo para que se suba correctamente a la nube.");
        } else if (err.name === "MissingPDFException") {
          setError("No se encontró el archivo PDF. Es posible que la ruta sea incorrecta.");
        } else {
          setError("No se pudo cargar el archivo PDF. " + (err.message || "Error desconocido."));
        }
      } finally {
        setLoading(false);
      }
    };

    loadPdf();
  }, [url, retryCount]);

  useEffect(() => {
    const renderPage = async () => {
      if (!pdf || !canvasRef.current) return;

      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context!,
          viewport: viewport,
          canvas: canvas
        };

        await page.render(renderContext).promise;
      } catch (err) {
        console.error("Error rendering page:", err);
      }
    };

    renderPage();
  }, [pdf, pageNum, scale]);

  const changePage = (offset: number) => {
    setPageNum(prev => Math.min(Math.max(1, prev + offset), numPages));
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-surface-container-highest rounded-xl border-2 border-dashed border-outline-variant/30">
        <Loader2 className="animate-spin text-primary mb-4" size={48} />
        <p className="text-on-surface-variant font-medium">Cargando documento...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-surface-container-highest rounded-xl border-2 border-dashed border-outline-variant/30 p-8 text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 text-red-500">
          <X size={32} />
        </div>
        <p className="text-on-surface-variant font-medium mb-2">{error}</p>
        <p className="text-xs text-on-surface-variant/60 mb-6 truncate max-w-md">Ruta: {url}</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={() => setRetryCount(prev => prev + 1)}
            className="flex items-center justify-center gap-2 px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-container transition-all shadow-md active:scale-95"
          >
            <RefreshCw size={18} />
            Reintentar Cargar
          </button>
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 px-6 py-2 bg-surface-container-highest text-primary font-bold rounded-lg hover:bg-surface-variant transition-all border border-outline-variant/30 active:scale-95"
          >
            <Download size={18} />
            Abrir en Nueva Pestaña
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/20 shadow-inner">
      {/* Toolbar */}
      <div className="bg-surface-container-high p-2 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-outline-variant/10">
        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
          <div className="flex items-center gap-1">
            <button 
              onClick={() => changePage(-1)}
              disabled={pageNum <= 1}
              className="p-1.5 sm:p-2 hover:bg-primary/10 rounded-lg disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-xs sm:text-sm font-bold min-w-[60px] sm:min-w-[80px] text-center">
              {pageNum} / {numPages}
            </span>
            <button 
              onClick={() => changePage(1)}
              disabled={pageNum >= numPages}
              className="p-1.5 sm:p-2 hover:bg-primary/10 rounded-lg disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="h-6 w-px bg-outline-variant/30 hidden sm:block" />
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setScale(prev => Math.max(0.5, prev - 0.25))}
              className="p-1.5 sm:p-2 hover:bg-primary/10 rounded-lg transition-colors"
            >
              <ZoomOut size={16} />
            </button>
            <span className="text-[10px] sm:text-xs font-mono w-10 sm:w-12 text-center">{Math.round(scale * 100)}%</span>
            <button 
              onClick={() => setScale(prev => Math.min(3, prev + 0.25))}
              className="p-1.5 sm:p-2 hover:bg-primary/10 rounded-lg transition-colors"
            >
              <ZoomIn size={16} />
            </button>
          </div>
        </div>
        
        <button className="p-1.5 sm:p-2 hover:bg-primary/10 rounded-lg transition-colors ml-auto sm:ml-0">
          <Maximize2 size={18} />
        </button>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center bg-surface-container-lowest scrollbar-thin scrollbar-thumb-primary/20">
        <canvas 
          ref={canvasRef} 
          className="shadow-2xl bg-white max-w-full h-auto"
        />
      </div>
    </div>
  );
};
