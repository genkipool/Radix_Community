'use client';

import { useState } from 'react';
import { ChevronDown, ExternalLink, Eye } from 'lucide-react';
import type { DaoCopy, DaoNoticeItem } from '../types/radixDao.types';
import { InlinePdfPreview, preloadPdfJs, type PdfPreviewCopy } from './InlinePdfPreview';

interface DaoNoticesListProps {
  notices: DaoCopy['notices'];
  docCopy: PdfPreviewCopy;
  items: DaoNoticeItem[];
  locale: string;
}

function formatNoticeDate(iso: string, locale: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function DaoNoticesList({ notices, docCopy, items, locale }: DaoNoticesListProps) {
  const [openPdfSlug, setOpenPdfSlug] = useState<string | null>(null);

  return (
    <ul className="divide-y divide-[var(--color-card-border)] border-y border-[var(--color-card-border)]">
      {items.map((item, idx) => {
        const summary =
          notices.summaries[item.slug as keyof typeof notices.summaries] ??
          notices.defaultSummary;
        const isPdfOpen = openPdfSlug === item.slug;

        return (
          <li key={item.id}>
            <details className="dao-notice-details group py-6" open={idx === 0}>
              <summary className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none py-1">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <time
                      dateTime={item.datePublished}
                      className="font-mono text-xs font-semibold text-[var(--color-text-muted)]"
                    >
                      {formatNoticeDate(item.datePublished, locale)}
                    </time>
                    <span className="text-xs font-bold text-[var(--color-primary)]">
                      {item.category}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors">
                    {item.title}
                  </h3>
                </div>

                <span className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-secondary)]">
                  <span>{notices.expandHint}</span>
                  <ChevronDown
                    className="dao-notice-chevron size-4 transition-transform duration-200"
                    aria-hidden="true"
                  />
                </span>
              </summary>

              <div className="pt-5 mt-5 border-t border-[var(--color-card-border)]/70">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-stretch">
                  <p className="text-sm sm:text-base text-[var(--color-text-muted)] leading-relaxed self-center">
                    {summary}
                  </p>

                  <div className="flex flex-col justify-center gap-3.5 items-start lg:items-end text-xs sm:text-sm lg:border-l lg:border-[var(--color-card-border)] lg:pl-10 lg:py-4 lg:min-w-[300px]">
                    {item.pdfUrl && (
                      <button
                        type="button"
                        aria-expanded={isPdfOpen}
                        onPointerEnter={() => void preloadPdfJs()}
                        onClick={() => setOpenPdfSlug(isPdfOpen ? null : item.slug)}
                        title={notices.downloadAttachment}
                        className="inline-flex items-center gap-2 py-1 font-mono text-xs font-semibold text-[var(--color-primary)] hover:underline max-w-full cursor-pointer"
                      >
                        <Eye className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{item.pdfName ?? notices.downloadAttachment}</span>
                      </button>
                    )}

                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 py-1 font-semibold text-[var(--color-secondary)] hover:underline"
                    >
                      <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        {notices.sourceLabel}: radixdao.org
                      </span>
                    </a>
                  </div>
                </div>

                {isPdfOpen && item.pdfUrl && (
                  <InlinePdfPreview
                    directUrl={`/api/radix-dao/notice-pdf?slug=${encodeURIComponent(item.slug)}`}
                    fallbackUrl={item.pdfUrl}
                    fileName={item.pdfName ?? `${item.slug}.pdf`}
                    title={item.title}
                    copy={docCopy}
                    onClose={() => setOpenPdfSlug(null)}
                  />
                )}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
