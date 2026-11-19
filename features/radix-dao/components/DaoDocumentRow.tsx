'use client';

import { ChevronDown, Code2, Eye } from 'lucide-react';
import { HighlightText } from '@/components/ui/HighlightText';
import { CopyButton } from '@/components/ui/CopyButton';
import { getSourceViewUrl } from '../data/radixDaoData';
import type { DaoCopy, DaoDocument } from '../types/radixDao.types';
import { InlinePdfPreview, preloadPdfJs } from './InlinePdfPreview';

interface DaoDocumentRowProps {
  doc: DaoDocument;
  documents: DaoCopy['documents'];
  query: string;
  isPreviewOpen: boolean;
  onTogglePreview: () => void;
  onClosePreview: () => void;
}

function getStatusLabel(doc: DaoDocument, copy: DaoCopy['documents']): string {
  if (doc.status === 'filed') return copy.statusFiled;
  if (doc.status === 'issued') return copy.statusIssued;
  return copy.statusRatified;
}

export function DaoDocumentRow({
  doc,
  documents,
  query,
  isPreviewOpen,
  onTogglePreview,
  onClosePreview,
}: DaoDocumentRowProps) {
  const meta = documents.items[doc.id as keyof typeof documents.items];
  const title = meta?.title ?? doc.id;
  const desc = meta?.desc ?? '';
  const sourceUrl = doc.sourcePath ? getSourceViewUrl(doc.sourcePath) : null;

  return (
    <li id={`doc-${doc.id}`} className="dao-section py-6">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 lg:gap-8">
        {/* Document info */}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center flex-wrap gap-2.5">
            <h3 className="text-base sm:text-lg font-bold text-[var(--color-text-main)]">
              <HighlightText text={title} query={query} />
            </h3>
            <span className="text-xs font-medium text-[var(--color-text-muted)]">
              {getStatusLabel(doc, documents)}
            </span>
            {doc.version && (
              <span className="font-mono text-[11px] font-semibold text-[var(--color-primary)]">
                {doc.version}
              </span>
            )}
            {doc.fileSize && (
              <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
                · {doc.fileSize}
              </span>
            )}
          </div>

          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed max-w-3xl">
            <HighlightText text={desc} query={query} />
          </p>

          <div className="pt-1 flex items-center gap-2 max-w-3xl">
            <span
              title={documents.hashTitle}
              className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] shrink-0 cursor-help underline decoration-dotted underline-offset-2"
            >
              {documents.showHash}:
            </span>
            <code className="text-xs font-mono text-[var(--color-text-muted)] break-all">
              <HighlightText text={doc.sha256} query={query} />
            </code>
            <CopyButton
              value={doc.sha256}
              title={documents.copyHash}
              variant="ghost"
              size="xs"
              className="shrink-0"
            />
          </div>
        </div>

        {/* Inline PDF Toggle & Source Actions */}
        <div className="flex flex-wrap items-center gap-3 shrink-0 lg:pt-1">
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[var(--color-surface)] border border-[var(--color-card-border)] text-[var(--color-text-main)] hover:border-[var(--color-secondary)]/50 transition-colors"
            >
              <Code2 className="size-3.5 text-[var(--color-secondary)]" aria-hidden="true" />
              <span>{documents.viewSource}</span>
            </a>
          )}

          <button
            type="button"
            aria-expanded={isPreviewOpen}
            onPointerEnter={() => void preloadPdfJs()}
            onClick={onTogglePreview}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)] text-white hover:opacity-90 transition-opacity shadow-sm cursor-pointer"
          >
            <Eye className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="inline-grid text-center">
              <span
                className={`col-start-1 row-start-1 ${isPreviewOpen ? 'invisible' : ''}`}
                aria-hidden={isPreviewOpen}
              >
                {documents.downloadPdf}
              </span>
              <span
                className={`col-start-1 row-start-1 ${isPreviewOpen ? '' : 'invisible'}`}
                aria-hidden={!isPreviewOpen}
              >
                {documents.hidePdf}
              </span>
            </span>
            <ChevronDown
              className={`size-3.5 shrink-0 transition-transform duration-200 ${isPreviewOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {isPreviewOpen && (
        <InlinePdfPreview
          pdfPath={doc.pdfPath}
          fileName={doc.fileName}
          title={title}
          copy={documents}
          onClose={onClosePreview}
        />
      )}
    </li>
  );
}
