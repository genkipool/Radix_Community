'use client';

import { useEffect, useState } from 'react';
import { FileCheck2, RotateCcw } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { DAO_DOCUMENTS, DAO_DOCUMENT_CATEGORIES } from '../data/radixDaoData';
import type { DaoCopy, DaoDocumentCategory } from '../types/radixDao.types';
import { DaoDocumentRow } from './DaoDocumentRow';
import { DaoSection } from './DaoSection';

interface DaoDocumentsSectionProps {
  documents: DaoCopy['documents'];
}

/** Strips a trailing " (N)" from category labels so the count renders in its own aligned badge. */
function stripTrailingCount(label: string): string {
  return label.replace(/\s*\(\d+\)\s*$/, '');
}

const CATEGORY_COUNTS: Record<DaoDocumentCategory, number> = DAO_DOCUMENT_CATEGORIES.reduce(
  (acc, cat) => {
    acc[cat] = DAO_DOCUMENTS.filter((doc) => doc.category === cat).length;
    return acc;
  },
  {} as Record<DaoDocumentCategory, number>
);

export function DaoDocumentsSection({ documents }: DaoDocumentsSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | DaoDocumentCategory>('all');
  const [query, setQuery] = useState('');
  const [openPdfId, setOpenPdfId] = useState<string | null>(null);

  useEffect(() => {
    const openFromHash = () => {
      const hash = window.location.hash;
      if (!hash.startsWith('#doc-')) return;
      const docId = hash.slice('#doc-'.length);
      if (!DAO_DOCUMENTS.some((d) => d.id === docId)) return;

      setSelectedCategory('all');
      setQuery('');
      setOpenPdfId(docId);

      requestAnimationFrame(() => {
        document.getElementById(`doc-${docId}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    };

    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, []);

  const normalized = query.trim().toLowerCase();
  const filteredDocs = DAO_DOCUMENTS.filter((doc) => {
    if (selectedCategory !== 'all' && doc.category !== selectedCategory) {
      return false;
    }
    if (!normalized) return true;

    const meta = documents.items[doc.id as keyof typeof documents.items];
    const title = meta?.title?.toLowerCase() ?? doc.id;
    const desc = meta?.desc?.toLowerCase() ?? '';
    return (
      title.includes(normalized) ||
      desc.includes(normalized) ||
      doc.fileName.toLowerCase().includes(normalized) ||
      doc.sha256.toLowerCase().includes(normalized)
    );
  });

  const countText = documents.showingCount
    .replace('{shown}', String(filteredDocs.length))
    .replace('{total}', String(DAO_DOCUMENTS.length));

  const filterOptions: Array<{
    key: 'all' | DaoDocumentCategory;
    label: string;
    count: number;
  }> = [
    { key: 'all', label: documents.allCategory, count: DAO_DOCUMENTS.length },
    ...DAO_DOCUMENT_CATEGORIES.map((category) => ({
      key: category,
      label: stripTrailingCount(documents.categories[category]),
      count: CATEGORY_COUNTS[category],
    })),
  ];

  return (
    <DaoSection id="documents">
      <SectionHeader
        icon={<FileCheck2 className="size-3.5 text-[var(--color-primary)]" aria-hidden="true" />}
        badge={documents.badge}
        title={documents.title}
        titleAccent={documents.titleAccent}
        subtitle={documents.subtitle}
      />

      {/* Search + Structured 3x3 Category Filter Grid (9 items = exact rectangle, zero orphans) */}
      <div className="space-y-6 mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="w-full md:max-w-md">
            <SearchBar
              id="radix-dao-doc-search"
              variant="sidebar"
              value={query}
              onChange={setQuery}
              placeholder={documents.searchPlaceholder}
            />
          </div>
          <p className="text-sm font-medium text-[var(--color-text-muted)]">{countText}</p>
        </div>

        <div
          className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
          role="tablist"
          aria-label={documents.categoriesLabel}
        >
          {filterOptions.map((opt) => {
            const active = selectedCategory === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedCategory(opt.key)}
                className={[
                  'flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer text-left',
                  active
                    ? 'bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)] text-white border-transparent shadow-sm'
                    : 'bg-[var(--color-surface)] text-[var(--color-text-main)] border-[var(--color-card-border)] hover:border-[var(--color-secondary)]/50',
                ].join(' ')}
              >
                <span className="truncate">{opt.label}</span>
                <span
                  className={[
                    'shrink-0 font-mono text-xs font-bold px-2 py-0.5 rounded-full',
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-[var(--color-bg)] text-[var(--color-text-muted)] border border-[var(--color-card-border)]',
                  ].join(' ')}
                >
                  {opt.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Clean Editorial Document List */}
      {filteredDocs.length === 0 ? (
        <div className="py-16 border-t border-[var(--color-card-border)] text-center space-y-4">
          <p className="text-base text-[var(--color-text-muted)]">{documents.emptyState}</p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSelectedCategory('all');
            }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--color-card-border)] text-[var(--color-text-main)] text-sm font-bold hover:bg-[var(--color-surface)] transition-colors cursor-pointer"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            <span>{documents.resetFilter}</span>
          </button>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-card-border)] border-y border-[var(--color-card-border)]">
          {filteredDocs.map((doc) => {
            const isPreviewOpen = openPdfId === doc.id;
            return (
              <DaoDocumentRow
                key={doc.id}
                doc={doc}
                documents={documents}
                query={query}
                isPreviewOpen={isPreviewOpen}
                onTogglePreview={() => setOpenPdfId(isPreviewOpen ? null : doc.id)}
                onClosePreview={() => setOpenPdfId(null)}
              />
            );
          })}
        </ul>
      )}
    </DaoSection>
  );
}
