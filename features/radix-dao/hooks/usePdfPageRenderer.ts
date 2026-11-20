import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  pdfDocCache,
  preloadPdfJs,
  type CancellableTask,
  type PdfJsLib,
} from '../lib/pdfLoader';

interface UsePdfPageRendererOptions {
  fetchUrl: string | null;
  page: number;
  scale: number;
  fitContainerWidthPx?: number | null;
}

/**
 * Loads & caches a PDFDocumentProxy via pdfjs-dist and renders the requested page
 * onto a double-buffered HiDPI canvas with a pixel-aligned selectable TextLayer.
 */
export function usePdfPageRenderer({
  fetchUrl,
  page,
  scale,
  fitContainerWidthPx,
}: UsePdfPageRendererOptions) {
  const cachedDoc = fetchUrl ? pdfDocCache.get(fetchUrl) ?? null : null;

  const [loadedDoc, setLoadedDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const [hasPainted, setHasPainted] = useState(false);
  /** Unscaled page size in PDF points (scale 1 = 72 DPI) of the currently rendered page. */
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  const pdfDoc = cachedDoc ?? loadedDoc;
  const totalPages = pdfDoc?.numPages ?? null;

  // 1. Load & cache the PDFDocumentProxy (streaming / range-friendly)
  useEffect(() => {
    if (!fetchUrl || pdfDocCache.has(fetchUrl)) return;

    let cancelled = false;
    let loadingTask: ReturnType<PdfJsLib['getDocument']> | null = null;

    preloadPdfJs()
      .then((pdfjs) => {
        if (cancelled) return null;
        loadingTask = pdfjs.getDocument({ url: fetchUrl });
        return loadingTask.promise;
      })
      .then((doc) => {
        if (cancelled || !doc) return;
        pdfDocCache.set(fetchUrl, doc);
        setLoadedDoc(doc);
        setError(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
        }
      });

    return () => {
      cancelled = true;
      if (loadingTask && !pdfDocCache.has(fetchUrl)) {
        void loadingTask.destroy();
      }
    };
  }, [fetchUrl]);

  // 2. Double-buffered HiDPI canvas render + selectable TextLayer (zero flicker)
  useEffect(() => {
    if (!pdfDoc) return;

    let cancelled = false;
    let renderTask: CancellableTask | null = null;
    let textLayerInstance: CancellableTask | null = null;

    const renderPage = async () => {
      try {
        const [pdfjs, pdfPage] = await Promise.all([
          preloadPdfJs(),
          pdfDoc.getPage(page),
        ]);
        if (cancelled) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const base = pdfPage.getViewport({ scale: 1 });
        const effectiveScale =
          fitContainerWidthPx && fitContainerWidthPx > 0
            ? (Math.max(35, Math.min(75, Math.floor((fitContainerWidthPx / (base.width * 1.333)) * 100))) /
                100) *
              1.333
            : scale;
        const viewport = pdfPage.getViewport({ scale: effectiveScale });
        setPageSize((prev) =>
          prev && prev.width === base.width && prev.height === base.height
            ? prev
            : { width: base.width, height: base.height }
        );

        // Render onto an offscreen canvas first so the visible canvas never flashes blank
        const offscreen = document.createElement('canvas');
        offscreen.width = Math.floor(viewport.width * dpr);
        offscreen.height = Math.floor(viewport.height * dpr);
        const offCtx = offscreen.getContext('2d', { alpha: false });
        if (!offCtx) return;

        const currentRender = pdfPage.render({
          canvasContext: offCtx,
          canvas: offscreen,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });
        renderTask = currentRender;

        await currentRender.promise;
        if (cancelled) return;

        // Atomic swap onto the visible canvas (single frame, zero white flash)
        const visibleCanvas = canvasRef.current;
        if (visibleCanvas) {
          visibleCanvas.width = offscreen.width;
          visibleCanvas.height = offscreen.height;
          visibleCanvas.style.width = `${Math.floor(viewport.width)}px`;
          visibleCanvas.style.height = `${Math.floor(viewport.height)}px`;
          const visCtx = visibleCanvas.getContext('2d', { alpha: false });
          if (visCtx) {
            visCtx.drawImage(offscreen, 0, 0);
          }
        }

        // Render pixel-aligned selectable TextLayer
        const textContainer = textLayerRef.current;
        if (textContainer) {
          textContainer.replaceChildren();
          textContainer.style.width = `${Math.floor(viewport.width)}px`;
          textContainer.style.height = `${Math.floor(viewport.height)}px`;
          textContainer.style.setProperty('--total-scale-factor', String(effectiveScale));

          const textContent = await pdfPage.getTextContent();
          if (cancelled) return;

          const currentTextLayer = new pdfjs.TextLayer({
            textContentSource: textContent,
            container: textContainer,
            viewport,
          });
          textLayerInstance = currentTextLayer;
          await currentTextLayer.render();
        }

        if (!cancelled) {
          setHasPainted(true);
        }
      } catch (err) {
        const name = (err as { name?: string })?.name;
        if (!cancelled && name !== 'RenderingCancelledException') {
          setError(true);
        }
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayerInstance?.cancel();
    };
  }, [pdfDoc, page, scale, fitContainerWidthPx]);

  return { pdfDoc, totalPages, hasPainted, error, pageSize, canvasRef, textLayerRef };
}
