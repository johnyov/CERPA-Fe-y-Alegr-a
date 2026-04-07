import { extractTextFromPdf } from '../lib/pdf-utils';
import { analyzeBookMetadata } from './geminiService';

export type PdfImportAnalysisResult = {
  text: string;
  coverUrl: string;
  totalPages: number;
  metadata: Awaited<ReturnType<typeof analyzeBookMetadata>>;
};

/**
 * Extrae texto del PDF en el cliente (pdf.js) y envía un fragmento a Gemini para metadatos.
 */
export async function analyzePdfFile(
  file: File,
  signal?: AbortSignal
): Promise<PdfImportAnalysisResult> {
  const { text, coverUrl, totalPages } = await extractTextFromPdf(file, signal);
  const metadata =
    text.trim().length > 0
      ? await analyzeBookMetadata(text, totalPages)
      : null;
  return { text, coverUrl, totalPages, metadata };
}

export async function analyzePdfFromUrl(
  url: string,
  signal?: AbortSignal
): Promise<PdfImportAnalysisResult> {
  const { text, coverUrl, totalPages } = await extractTextFromPdf(url, signal);
  const metadata =
    text.trim().length > 0
      ? await analyzeBookMetadata(text, totalPages)
      : null;
  return { text, coverUrl, totalPages, metadata };
}
