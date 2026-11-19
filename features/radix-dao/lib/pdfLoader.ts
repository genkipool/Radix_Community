import type { PDFDocumentProxy } from 'pdfjs-dist';

export type PdfJsLib = typeof import('pdfjs-dist');
export type CancellableTask = { cancel: () => void };

let pdfJsPromise: Promise<PdfJsLib> | null = null;

/** Pre-warms pdfjs-dist & its worker on hover so clicking "Ver PDF" feels instant. */
export function preloadPdfJs(): Promise<PdfJsLib> {
  if (!pdfJsPromise) {
    pdfJsPromise = import('pdfjs-dist').then((lib) => {
      if (!lib.GlobalWorkerOptions.workerSrc) {
        lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      }
      return lib;
    });
  }
  return pdfJsPromise;
}

/** Module-level cache of parsed PDF documents so reopening any PDF is instantaneous. */
export const pdfDocCache = new Map<string, PDFDocumentProxy>();
