'use client';

import type { ReactNode } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Minus,
  Plus,
  X,
} from 'lucide-react';
import type { PdfPreviewCopy } from './InlinePdfPreview';

interface ToolbarIconButtonProps {
  disabled: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}

function ToolbarIconButton({ disabled, onClick, label, children }: ToolbarIconButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex items-center justify-center size-6 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
    >
      {children}
    </button>
  );
}

interface PdfToolbarProps {
  fileName: string;
  showControls: boolean;
  pageLabel: string;
  canPrev: boolean;
  canNext: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
  zoom: number;
  canZoomOut: boolean;
  canZoomIn: boolean;
  onZoomOut: () => void;
  onZoomIn: () => void;
  downloadUrl: string;
  viewUrl: string;
  copy: PdfPreviewCopy;
  onClose: () => void;
}

export function PdfToolbar({
  fileName,
  showControls,
  pageLabel,
  canPrev,
  canNext,
  onPrevPage,
  onNextPage,
  zoom,
  canZoomOut,
  canZoomIn,
  onZoomOut,
  onZoomIn,
  downloadUrl,
  viewUrl,
  copy,
  onClose,
}: PdfToolbarProps) {
  return (
    <div className="px-4 sm:px-5 py-2.5 border-b border-[var(--color-card-border)] bg-[var(--color-card-bg)] flex flex-wrap items-center justify-between gap-3">
      {/* Left: Filename */}
      <div className="flex items-center gap-2.5 min-w-0 max-w-[220px] sm:max-w-[300px]">
        <span
          className="size-2 rounded-full bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)] shrink-0"
          aria-hidden="true"
        />
        <span
          title={fileName}
          className="font-mono text-xs font-medium text-[var(--color-text-muted)] truncate"
        >
          {fileName}
        </span>
      </div>

      {/* Center: Borderless Page & Zoom Controls */}
      {showControls && (
        <div className="flex items-center gap-4 text-xs">
          <div className="inline-flex items-center gap-1">
            <ToolbarIconButton disabled={!canPrev} onClick={onPrevPage} label={copy.prevPage}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </ToolbarIconButton>
            <span className="px-1.5 font-mono text-xs font-semibold text-[var(--color-text-main)] select-none whitespace-nowrap">
              {pageLabel}
            </span>
            <ToolbarIconButton disabled={!canNext} onClick={onNextPage} label={copy.nextPage}>
              <ChevronRight className="size-4" aria-hidden="true" />
            </ToolbarIconButton>
          </div>

          <span className="hidden sm:block w-px h-4 bg-[var(--color-card-border)]" aria-hidden="true" />

          <div className="hidden sm:inline-flex items-center gap-1">
            <ToolbarIconButton disabled={!canZoomOut} onClick={onZoomOut} label={copy.zoomOut}>
              <Minus className="size-3.5" aria-hidden="true" />
            </ToolbarIconButton>
            <span className="px-1 font-mono text-xs font-semibold text-[var(--color-text-muted)] select-none w-10 text-center">
              {zoom}%
            </span>
            <ToolbarIconButton disabled={!canZoomIn} onClick={onZoomIn} label={copy.zoomIn}>
              <Plus className="size-3.5" aria-hidden="true" />
            </ToolbarIconButton>
          </div>
        </div>
      )}

      {/* Right: Download, Open in tab, Close */}
      <div className="flex items-center gap-1 shrink-0">
        <a
          href={downloadUrl}
          download={fileName}
          target="_blank"
          rel="noopener noreferrer"
          title={copy.downloadFile}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[var(--color-text-main)] hover:bg-[var(--color-surface)] hover:text-[var(--color-primary)] transition-colors"
        >
          <Download className="size-3.5" aria-hidden="true" />
          <span className="hidden md:inline">{copy.downloadFile}</span>
        </a>

        <a
          href={viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={copy.openNewTab}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-main)] transition-colors"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          <span className="hidden md:inline">{copy.openNewTab}</span>
        </a>

        <button
          type="button"
          onClick={onClose}
          aria-label={copy.hidePdf}
          title={copy.hidePdf}
          className="inline-flex items-center justify-center size-7 rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-main)] transition-colors cursor-pointer"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
