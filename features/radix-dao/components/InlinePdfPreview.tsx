'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Loader2 } from 'lucide-react';
import { getPdfCdnUrl, getPdfDownloadUrl, getSourceViewUrl } from '../data/radixDaoData';
import { usePdfPageRenderer } from '../hooks/usePdfPageRenderer';
import { usePinchZoom } from '../hooks/usePinchZoom';
import { useSmoothScrollChaining } from '../hooks/useSmoothScrollChaining';
import type { DaoCopy } from '../types/radixDao.types';
import { PdfToolbar } from './PdfToolbar';

export { preloadPdfJs } from '../lib/pdfLoader';

const ZOOM_STEPS = [35, 50, 65, 75, 85, 100, 115, 130, 150, 175, 200, 250] as const;
const MIN_ZOOM = ZOOM_STEPS[0];
const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1];
const MOBILE_BREAKPOINT_PX = 640;

/** pdf.js scale 1.0 is 72 DPI; 1.333 is 96 DPI (100% screen scale). */
const PT_TO_CSS_PX = 1.333;
/**
 * Safe fallback dimensions before the first PDF page metadata resolves:
 * width uses US Letter (612pt, wider than A4's 595pt) so mobile never overflows horizontally;
 * height uses A4 (842pt, taller than Letter's 792pt) so desktop reserves enough vertical room.
 */
const FALLBACK_PAGE_PT = { width: 612, height: 842 } as const;

/** Default reading zoom on desktop (75% shows the full sheet at comfortable reading size). */
const DEFAULT_DESKTOP_ZOOM = 75;

/** Sheet padding inside the viewport (mobile / desktop), in CSS px. */
const SHEET_PADDING_MOBILE = 8;
const SHEET_PADDING_DESKTOP = 24;
/** Approximate horizontal page chrome around the viewer on mobile before ResizeObserver fires. */
const INITIAL_MOBILE_CHROME_PX = 36;

function getAdjacentZoomStep(currentZoom: number, direction: 'in' | 'out'): number {
  if (direction === 'in') {
    for (let i = 0; i < ZOOM_STEPS.length; i++) {
      if (ZOOM_STEPS[i] > currentZoom) return ZOOM_STEPS[i];
    }
    return MAX_ZOOM;
  }
  for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
    if (ZOOM_STEPS[i] < currentZoom) return ZOOM_STEPS[i];
  }
  return MIN_ZOOM;
}

export type PdfPreviewCopy = Pick<
  DaoCopy['documents'],
  | 'downloadFile'
  | 'openNewTab'
  | 'hidePdf'
  | 'loadingPdf'
  | 'pdfLoadError'
  | 'prevPage'
  | 'nextPage'
  | 'zoomOut'
  | 'zoomIn'
  | 'pageOf'
>;

interface InlinePdfPreviewProps {
  /** Path inside RadixDAO/governance-framework (fetched from raw.githubusercontent.com) */
  pdfPath?: string;
  /** Direct same-origin or CORS-enabled PDF URL (e.g. /api/radix-dao/notice-pdf?slug=...) */
  directUrl?: string;
  /** Fallback external URL if inline fetch fails */
  fallbackUrl?: string;
  fileName: string;
  title: string;
  copy: PdfPreviewCopy;
  onClose: () => void;
}

interface SheetNavButtonProps {
  side: 'left' | 'right';
  label: string;
  disabled: boolean;
  hideOnMobile: boolean;
  onClick: () => void;
}

function SheetNavButton({ side, label, disabled, hideOnMobile, onClick }: SheetNavButtonProps) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`absolute top-1/2 -translate-y-1/2 ${
        side === 'left' ? 'left-1.5 sm:left-4' : 'right-1.5 sm:right-4'
      } z-10 ${
        hideOnMobile ? 'hidden sm:inline-flex' : 'inline-flex'
      } items-center justify-center size-9 sm:size-12 rounded-full border border-[var(--color-card-border)] bg-[var(--color-card-bg)]/85 backdrop-blur-sm text-[var(--color-text-main)] shadow-lg hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/50 disabled:opacity-0 disabled:pointer-events-none transition-all cursor-pointer`}
    >
      <Icon className="size-4 sm:size-6" aria-hidden="true" />
    </button>
  );
}

export function InlinePdfPreview({
  pdfPath,
  directUrl,
  fallbackUrl,
  fileName,
  title,
  copy,
  onClose,
}: InlinePdfPreviewProps) {
  const fetchUrl = directUrl ?? (pdfPath ? getPdfCdnUrl(pdfPath) : null);

  const [page, setPage] = useState(1);
  const [userZoom, setUserZoom] = useState<number | null>(null);
  const [viewportMetrics, setViewportMetrics] = useState<{
    containerWidth: number;
    isMobile: boolean;
  }>(() => {
    if (typeof window === 'undefined') {
      return { containerWidth: 1024, isMobile: false };
    }
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT_PX;
    return {
      containerWidth: Math.max(260, window.innerWidth - INITIAL_MOBILE_CHROME_PX),
      isMobile,
    };
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const swipeStartRef = useRef<{
    x: number;
    y: number;
    time: number;
    multiTouch: boolean;
  } | null>(null);

  // Measure the real inner width of the PDF viewport container via ResizeObserver
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const measuredW = Math.round(entry.contentRect.width || el.clientWidth);
      if (measuredW <= 0) return;
      const isMobile = window.innerWidth < MOBILE_BREAKPOINT_PX;
      setViewportMetrics((prev) =>
        prev.containerWidth === measuredW && prev.isMobile === isMobile
          ? prev
          : { containerWidth: measuredW, isMobile }
      );
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sheetPadding = viewportMetrics.isMobile ? SHEET_PADDING_MOBILE : SHEET_PADDING_DESKTOP;
  const mobileFitWidthPx =
    viewportMetrics.isMobile && userZoom === null
      ? Math.max(200, viewportMetrics.containerWidth - sheetPadding * 2 - 4)
      : null;

  const preliminaryFitZoom = viewportMetrics.isMobile
    ? Math.max(
        MIN_ZOOM,
        Math.min(
          DEFAULT_DESKTOP_ZOOM,
          Math.floor(
            ((viewportMetrics.containerWidth - SHEET_PADDING_MOBILE * 2 - 4) /
              (FALLBACK_PAGE_PT.width * PT_TO_CSS_PX)) *
              100
          )
        )
      )
    : DEFAULT_DESKTOP_ZOOM;

  const preliminaryScale = ((userZoom ?? preliminaryFitZoom) / 100) * PT_TO_CSS_PX;

  const { pdfDoc, totalPages, hasPainted, error, pageSize, canvasRef, textLayerRef } =
    usePdfPageRenderer({
      fetchUrl,
      page,
      scale: preliminaryScale,
      fitContainerWidthPx: mobileFitWidthPx,
    });

  const pageWidthPt = pageSize?.width ?? FALLBACK_PAGE_PT.width;
  const pageHeightPt = pageSize?.height ?? FALLBACK_PAGE_PT.height;

  // Exact opening fit zoom: 75% on desktop; exact container-width fit on mobile
  const fitZoom = viewportMetrics.isMobile
    ? Math.max(
        MIN_ZOOM,
        Math.min(
          DEFAULT_DESKTOP_ZOOM,
          Math.floor(
            ((viewportMetrics.containerWidth - sheetPadding * 2 - 4) /
              (pageWidthPt * PT_TO_CSS_PX)) *
              100
          )
        )
      )
    : DEFAULT_DESKTOP_ZOOM;

  const zoom = userZoom ?? fitZoom;

  useSmoothScrollChaining(scrollContainerRef);

  const pinchScale = usePinchZoom({
    containerRef: scrollContainerRef,
    zoom,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    onZoomCommit: (nextZoom) => setUserZoom(nextZoom),
  });

  // Viewer height = full sheet at the opening fitZoom + padding, so the full sheet is visible without scrolling
  const viewerHeight = Math.ceil(
    pageHeightPt * PT_TO_CSS_PX * (fitZoom / 100) + sheetPadding * 2 + 4
  );

  const isFitted = zoom <= fitZoom && pinchScale === 1;

  const fallbackViewUrl = fallbackUrl ?? (pdfPath ? getSourceViewUrl(pdfPath) : directUrl ?? '#');
  const fallbackDownloadUrl = fallbackUrl ?? (pdfPath ? getPdfDownloadUrl(pdfPath) : directUrl ?? '#');

  const canPrev = page > 1;
  const canNext = totalPages ? page < totalPages : false;
  const canZoomOut = zoom > MIN_ZOOM;
  const canZoomIn = zoom < MAX_ZOOM;

  const handleZoomOut = () => setUserZoom(getAdjacentZoomStep(zoom, 'out'));
  const handleZoomIn = () => setUserZoom(getAdjacentZoomStep(zoom, 'in'));

  const displayedZoom = Math.round(zoom * pinchScale);

  const goToPage = (next: number) => {
    setPage(next);
    scrollContainerRef.current?.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  const goPrev = () => goToPage(Math.max(1, page - 1));
  const goNext = () => goToPage(totalPages ? Math.min(totalPages, page + 1) : page + 1);

  const pageLabel = totalPages
    ? copy.pageOf.replace('{current}', String(page)).replace('{total}', String(totalPages))
    : '...';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' && canPrev) {
      e.preventDefault();
      goPrev();
    } else if (e.key === 'ArrowRight' && canNext) {
      e.preventDefault();
      goNext();
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isFitted || e.touches.length !== 1) {
      swipeStartRef.current = { x: 0, y: 0, time: 0, multiTouch: true };
      return;
    }
    const touch = e.touches[0];
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: performance.now(),
      multiTouch: false,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 1 && swipeStartRef.current) {
      swipeStartRef.current.multiTouch = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || start.multiTouch || !isFitted || e.changedTouches.length === 0) return;

    const el = scrollContainerRef.current;
    if (el && el.scrollWidth > el.clientWidth + 4) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const elapsed = performance.now() - start.time;

    if (elapsed < 800 && Math.abs(dx) >= 42 && Math.abs(dx) > Math.abs(dy) * 1.35) {
      if (dx < 0 && canNext) {
        goNext();
      } else if (dx > 0 && canPrev) {
        goPrev();
      }
    }
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={title}
      className="mt-5 rounded-2xl overflow-hidden border border-[var(--color-card-border)] bg-[var(--color-surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
    >
      <PdfToolbar
        fileName={fileName}
        showControls={Boolean(pdfDoc)}
        pageLabel={pageLabel}
        canPrev={canPrev}
        canNext={canNext}
        onPrevPage={goPrev}
        onNextPage={goNext}
        zoom={displayedZoom}
        canZoomOut={canZoomOut}
        canZoomIn={canZoomIn}
        onZoomOut={handleZoomOut}
        onZoomIn={handleZoomIn}
        downloadUrl={fallbackDownloadUrl}
        viewUrl={fallbackViewUrl}
        copy={copy}
        onClose={onClose}
      />

      <div className="relative">
        {/* Theme-integrated sheet viewport sized to show the whole page at the opening zoom */}
        <div
          ref={scrollContainerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => { swipeStartRef.current = null; }}
          style={{ height: viewerHeight, padding: sheetPadding }}
          className={`dao-pdf-scroll relative w-full bg-[var(--color-surface)] flex items-start ${
            isFitted ? 'overflow-x-hidden overflow-y-auto justify-center' : 'overflow-auto'
          }`}
        >
          {error ? (
            <div className="m-auto text-center space-y-3 px-4">
              <p className="text-sm text-[var(--color-text-muted)]">{copy.pdfLoadError}</p>
              <a
                href={fallbackViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-secondary)] hover:underline"
              >
                <ExternalLink className="size-4" aria-hidden="true" />
                <span>{copy.openNewTab}</span>
              </a>
            </div>
          ) : (
            <>
              {/* Loading overlay — fades smoothly once Page 1 has painted */}
              {!hasPainted && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                  <Loader2 className="size-5 animate-spin text-[var(--color-primary)]" aria-hidden="true" />
                  <p className="text-xs sm:text-sm font-medium text-[var(--color-text-muted)]">
                    {copy.loadingPdf}
                  </p>
                </div>
              )}

              {/* Untouched crisp white PDF sheet floating cleanly on the theme backdrop */}
              <div
                style={
                  pinchScale !== 1
                    ? { transform: `scale(${pinchScale})`, transformOrigin: 'top center' }
                    : undefined
                }
                className={`relative bg-white rounded-md shadow-xl ring-1 ring-black/10 transition-opacity duration-200 shrink-0 ${
                  isFitted ? '' : 'mx-auto'
                } ${hasPainted ? 'opacity-100' : 'opacity-0'}`}
              >
                <canvas ref={canvasRef} className="block rounded-md" />
                <div ref={textLayerRef} className="dao-pdf-text-layer" />
              </div>
            </>
          )}
        </div>

        {/* Vertically centered page navigation overlaid on the viewer (hidden on mobile when no horizontal scroll) */}
        {pdfDoc && !error && totalPages !== null && totalPages > 1 && (
          <>
            <SheetNavButton
              side="left"
              label={copy.prevPage}
              disabled={!canPrev}
              hideOnMobile={isFitted}
              onClick={goPrev}
            />
            <SheetNavButton
              side="right"
              label={copy.nextPage}
              disabled={!canNext}
              hideOnMobile={isFitted}
              onClick={goNext}
            />
          </>
        )}
      </div>
    </div>
  );
}
