'use client';

import { useRef, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { getPdfCdnUrl, getPdfDownloadUrl, getSourceViewUrl } from '../data/radixDaoData';
import { usePdfPageRenderer } from '../hooks/usePdfPageRenderer';
import { useSmoothScrollChaining } from '../hooks/useSmoothScrollChaining';
import type { DaoCopy } from '../types/radixDao.types';
import { PdfToolbar } from './PdfToolbar';

export { preloadPdfJs } from '../lib/pdfLoader';

const ZOOM_STEPS = [35, 50, 65, 75, 85, 100, 115, 130, 150, 175, 200, 250] as const;

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
  const [zoomIdx, setZoomIdx] = useState(4); // 85% default — crisp, fits a full sheet comfortably

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const zoom = ZOOM_STEPS[zoomIdx];
  // Scale factor: 1.0 in pdf.js is 72 DPI; 1.333 is 96 DPI (100% screen scale).
  const scale = (zoom / 100) * 1.333;

  const { pdfDoc, totalPages, hasPainted, error, canvasRef, textLayerRef } = usePdfPageRenderer({
    fetchUrl,
    page,
    scale,
  });

  useSmoothScrollChaining(scrollContainerRef);

  const fallbackViewUrl = fallbackUrl ?? (pdfPath ? getSourceViewUrl(pdfPath) : directUrl ?? '#');
  const fallbackDownloadUrl = fallbackUrl ?? (pdfPath ? getPdfDownloadUrl(pdfPath) : directUrl ?? '#');

  const canPrev = page > 1;
  const canNext = totalPages ? page < totalPages : false;
  const canZoomOut = zoomIdx > 0;
  const canZoomIn = zoomIdx < ZOOM_STEPS.length - 1;

  const goToPage = (next: number) => {
    setPage(next);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pageLabel = totalPages
    ? copy.pageOf.replace('{current}', String(page)).replace('{total}', String(totalPages))
    : '...';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' && canPrev) {
      e.preventDefault();
      goToPage(page - 1);
    } else if (e.key === 'ArrowRight' && canNext) {
      e.preventDefault();
      goToPage(page + 1);
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
        onPrevPage={() => goToPage(Math.max(1, page - 1))}
        onNextPage={() => goToPage(totalPages ? Math.min(totalPages, page + 1) : page + 1)}
        zoom={zoom}
        canZoomOut={canZoomOut}
        canZoomIn={canZoomIn}
        onZoomOut={() => setZoomIdx((z) => Math.max(0, z - 1))}
        onZoomIn={() => setZoomIdx((z) => Math.min(ZOOM_STEPS.length - 1, z + 1))}
        downloadUrl={fallbackDownloadUrl}
        viewUrl={fallbackViewUrl}
        copy={copy}
        onClose={onClose}
      />

      {/* Theme-integrated scrollable sheet viewport with custom scrollbar */}
      <div
        ref={scrollContainerRef}
        className="dao-pdf-scroll relative w-full h-[82vh] min-h-[760px] max-h-[960px] overflow-auto bg-[var(--color-surface)] p-6 sm:p-8 flex justify-center items-start"
      >
        {error ? (
          <div className="my-auto text-center space-y-3 px-4">
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
              className={`relative bg-white rounded-md shadow-xl ring-1 ring-black/10 transition-opacity duration-200 shrink-0 ${
                hasPainted ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <canvas ref={canvasRef} className="block rounded-md" />
              <div ref={textLayerRef} className="dao-pdf-text-layer" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
