'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Calendar, ChevronDown, FileSearch, Search, X } from 'lucide-react';
import { CalendarDropdown, type DateRange } from '@/components/ui/CalendarDropdown';
import { Portal } from '@/components/ui/Portal';
import { SelectPopup, SelectPopupRow } from '@/components/ui/SelectPopup';
import { usePickerPopup } from '@/features/console/hooks/usePickerPopup';
import {
  DEFAULT_AUDIT_FILTERS,
  type AuditFilterState,
} from '../../lib/collection-audit';
import { blake2b256Hex } from '../../lib/hash';
import type { AuditLabels } from './AuditFormatters';

/**
 * Compact single-row filter toolbar using the console's native `SelectPopup`
 * dropdowns and `CalendarDropdown` range picker, plus local browser-only file
 * hashing (`blake2b-256`).
 */
export function AuditFilterBar({
  filters,
  onChange,
  labels,
  signerAlias,
  highlightedDays,
}: {
  filters: AuditFilterState;
  onChange: (next: AuditFilterState) => void;
  labels: AuditLabels;
  signerAlias?: string;
  highlightedDays?: ReadonlySet<string>;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const calendarWrapRef = useRef<HTMLDivElement | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [matchedFileName, setMatchedFileName] = useState<string | null>(null);
  const [hashingFile, setHashingFile] = useState(false);

  const {
    open: categoryOpen,
    show: showCategory,
    close: closeCategory,
    buttonRef: categoryButtonRef,
    popupRef: categoryPopupRef,
    layoutFor: categoryLayoutFor,
  } = usePickerPopup();
  const {
    open: statusOpen,
    show: showStatus,
    close: closeStatus,
    buttonRef: statusButtonRef,
    popupRef: statusPopupRef,
    layoutFor: statusLayoutFor,
  } = usePickerPopup();

  useEffect(() => {
    if (!calendarOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!calendarWrapRef.current?.contains(e.target as Node)) {
        setCalendarOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCalendarOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [calendarOpen]);

  const hasActiveFilters =
    !!filters.fromDate ||
    !!filters.toDate ||
    filters.category !== 'all' ||
    filters.status !== 'all' ||
    !!filters.query.trim() ||
    !!filters.signerFilter;

  const handleLocalFile = async (file: File | null) => {
    if (!file) return;
    setHashingFile(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const hash = blake2b256Hex(bytes);
      setMatchedFileName(file.name);
      onChange({ ...filters, query: hash });
    } finally {
      setHashingFile(false);
    }
  };

  const dateRange: DateRange = {
    start: filters.fromDate || null,
    end: filters.toDate || null,
  };

  const handleSelectRange = (next: DateRange) => {
    onChange({
      ...filters,
      fromDate: next.start ?? '',
      toDate: next.end ?? '',
    });
    if (next.start && next.end) {
      setCalendarOpen(false);
    }
  };

  const dateLabel =
    filters.fromDate && filters.toDate
      ? `${filters.fromDate} → ${filters.toDate}`
      : filters.fromDate
        ? `${labels.filters.from} ${filters.fromDate}`
        : filters.toDate
          ? `${labels.filters.to} ${filters.toDate}`
          : labels.filters.dateRangePlaceholder;

  const categoryOptions: Array<{
    value: AuditFilterState['category'];
    label: string;
  }> = [
    { value: 'all', label: labels.filters.categories.all },
    { value: 'multi_request', label: labels.filters.categories.multi_request },
    { value: 'solo_signature', label: labels.filters.categories.solo_signature },
    { value: 'cosign_signature', label: labels.filters.categories.cosign_signature },
    { value: 'cipher', label: labels.filters.categories.cipher },
  ];

  const statusOptions: Array<{
    value: AuditFilterState['status'];
    label: string;
  }> = [
    { value: 'all', label: labels.filters.statuses.all },
    { value: 'complete', label: labels.filters.statuses.complete },
    { value: 'pending', label: labels.filters.statuses.pending },
    { value: 'recorded', label: labels.filters.statuses.recorded },
    { value: 'anomaly', label: labels.filters.statuses.anomaly },
  ];

  const categoryLayout = categoryLayoutFor(240);
  const statusLayout = statusLayoutFor(240);

  return (
    <div className="space-y-2.5">
      {/* Single unified filter row */}
      <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => {
              setMatchedFileName(null);
              onChange({ ...filters, query: e.target.value });
            }}
            placeholder={labels.filters.searchPlaceholder}
            className="h-9 w-full rounded-lg border border-[var(--color-card-border)] bg-[var(--color-card-bg)] pl-8 pr-3 text-xs text-[var(--color-text-main)] outline-none focus:border-[var(--color-primary)]"
          />
        </div>

        {/* Operation Type SelectPopup */}
        <div className="shrink-0">
          <button
            ref={categoryButtonRef}
            type="button"
            aria-label={labels.filters.categoryLabel}
            title={labels.filters.categoryTooltip}
            aria-expanded={categoryOpen}
            onClick={() => (categoryOpen ? closeCategory() : showCategory())}
            className={`inline-flex h-9 items-center justify-between gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors hover:border-[var(--color-primary)] ${
              categoryOpen || filters.category !== 'all'
                ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-card-bg)]'
                : 'border-[var(--color-card-border)] text-[var(--color-text-main)] bg-[var(--color-card-bg)]'
            }`}
          >
            <span className="truncate max-w-[130px]">
              {labels.filters.categories[filters.category]}
            </span>
            <ChevronDown
              className={`size-3.5 shrink-0 transition-transform ${categoryOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <Portal>
            <AnimatePresence>
              {categoryOpen && (
                <SelectPopup
                  ref={categoryPopupRef}
                  title={labels.filters.categoryLabel}
                  onClose={closeCategory}
                  closeLabel={labels.filters.closePopup}
                  direction={categoryLayout.direction}
                  style={{
                    ...categoryLayout.style,
                    height: 'auto',
                    maxHeight: categoryLayout.style.height,
                  }}
                >
                  {categoryOptions.map((opt) => (
                    <SelectPopupRow
                      key={opt.value}
                      selected={filters.category === opt.value}
                      label={opt.label}
                      onClick={() => {
                        onChange({ ...filters, category: opt.value });
                        closeCategory();
                      }}
                    />
                  ))}
                </SelectPopup>
              )}
            </AnimatePresence>
          </Portal>
        </div>

        {/* Status SelectPopup */}
        <div className="shrink-0">
          <button
            ref={statusButtonRef}
            type="button"
            aria-label={labels.filters.statusLabel}
            title={labels.filters.statusTooltip}
            aria-expanded={statusOpen}
            onClick={() => (statusOpen ? closeStatus() : showStatus())}
            className={`inline-flex h-9 items-center justify-between gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors hover:border-[var(--color-primary)] ${
              statusOpen || filters.status !== 'all'
                ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-card-bg)]'
                : 'border-[var(--color-card-border)] text-[var(--color-text-main)] bg-[var(--color-card-bg)]'
            }`}
          >
            <span className="truncate max-w-[120px]">
              {labels.filters.statuses[filters.status]}
            </span>
            <ChevronDown
              className={`size-3.5 shrink-0 transition-transform ${statusOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <Portal>
            <AnimatePresence>
              {statusOpen && (
                <SelectPopup
                  ref={statusPopupRef}
                  title={labels.filters.statusLabel}
                  onClose={closeStatus}
                  closeLabel={labels.filters.closePopup}
                  direction={statusLayout.direction}
                  style={{
                    ...statusLayout.style,
                    height: 'auto',
                    maxHeight: statusLayout.style.height,
                  }}
                >
                  {statusOptions.map((opt) => (
                    <SelectPopupRow
                      key={opt.value}
                      selected={filters.status === opt.value}
                      label={opt.label}
                      onClick={() => {
                        onChange({ ...filters, status: opt.value });
                        closeStatus();
                      }}
                    />
                  ))}
                </SelectPopup>
              )}
            </AnimatePresence>
          </Portal>
        </div>

        {/* CalendarDropdown trigger */}
        <div ref={calendarWrapRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setCalendarOpen((v) => !v)}
            aria-expanded={calendarOpen}
            title={labels.filters.periodTooltip}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors hover:border-[var(--color-primary)] ${
              calendarOpen || filters.fromDate || filters.toDate
                ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-card-bg)]'
                : 'border-[var(--color-card-border)] text-[var(--color-text-main)] bg-[var(--color-card-bg)]'
            }`}
          >
            <Calendar className="size-3.5 shrink-0" />
            <span className="tabular-nums whitespace-nowrap">{dateLabel}</span>
            <ChevronDown
              className={`size-3.5 shrink-0 transition-transform ${calendarOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <CalendarDropdown
            open={calendarOpen}
            align="right"
            calendarT={labels.filters.calendar}
            dateRange={dateRange}
            onSelectRange={handleSelectRange}
            onReset={() => {
              onChange({ ...filters, fromDate: '', toDate: '' });
              setCalendarOpen(false);
            }}
            highlightedDays={highlightedDays}
          />
        </div>

        {/* Local File Hash lookup */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = '';
            void handleLocalFile(f);
          }}
        />
        <button
          type="button"
          disabled={hashingFile}
          onClick={() => fileInputRef.current?.click()}
          title={labels.filters.fileLookupHint}
          className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors hover:border-[var(--color-primary)] disabled:opacity-50 ${
            matchedFileName
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-[var(--color-card-border)] text-[var(--color-text-main)]'
          }`}
        >
          <FileSearch className="size-3.5 shrink-0" />
          <span className="whitespace-nowrap">{labels.filters.fileLookupButton}</span>
        </button>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setMatchedFileName(null);
              onChange(DEFAULT_AUDIT_FILTERS);
            }}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg px-2 text-xs font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-main)]"
            title={labels.filters.clearAllTooltip}
            aria-label={labels.filters.clearAll}
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Active filter context chips (only shown when filtering by file or signer) */}
      {(matchedFileName || filters.signerFilter) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {matchedFileName && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-primary)] px-2.5 py-0.5 font-medium text-[var(--color-primary)]"
              style={{
                background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
              }}
            >
              <FileSearch className="size-3" />
              {labels.filters.fileLookupMatched.replace('{name}', matchedFileName)}
              <button
                type="button"
                onClick={() => {
                  setMatchedFileName(null);
                  onChange({ ...filters, query: '' });
                }}
                aria-label={labels.filters.fileLookupClear}
              >
                <X className="size-3" />
              </button>
            </span>
          )}
          {filters.signerFilter && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-primary)] px-2.5 py-0.5 font-medium text-[var(--color-primary)]"
              style={{
                background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
              }}
            >
              <span>
                {labels.filters.activeSignerChip}:{' '}
                {signerAlias || `${filters.signerFilter.slice(0, 14)}…`}
              </span>
              <button
                type="button"
                onClick={() => onChange({ ...filters, signerFilter: '' })}
                aria-label={labels.filters.clearSigner}
              >
                <X className="size-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
