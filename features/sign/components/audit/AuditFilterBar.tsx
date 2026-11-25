'use client';

import { useRef, useState } from 'react';
import { FileSearch, Search, X } from 'lucide-react';
import {
  DEFAULT_AUDIT_FILTERS,
  type AuditFilterState,
} from '../../lib/collection-audit';
import { blake2b256Hex } from '../../lib/hash';
import type { AuditLabels } from './AuditFormatters';

type PeriodPreset = 'all' | '7d' | 'month' | 'quarter' | 'year';

function utcDateIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function presetDates(preset: PeriodPreset): { fromDate: string; toDate: string } {
  if (preset === 'all') return { fromDate: '', toDate: '' };
  const now = new Date();
  const toDate = utcDateIso(now);
  if (preset === '7d') {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 6);
    return { fromDate: utcDateIso(start), toDate };
  }
  if (preset === 'month') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { fromDate: utcDateIso(start), toDate };
  }
  if (preset === 'quarter') {
    const qMonth = Math.floor(now.getUTCMonth() / 3) * 3;
    const start = new Date(Date.UTC(now.getUTCFullYear(), qMonth, 1));
    return { fromDate: utcDateIso(start), toDate };
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  return { fromDate: utcDateIso(start), toDate };
}

/**
 * Clean inline filter bar: UTC period presets + custom bounds, operation type,
 * compliance status, free-text search, and local browser-only file hashing
 * (`blake2b-256`) so auditors can drop a PDF and immediately filter its records.
 */
export function AuditFilterBar({
  filters,
  onChange,
  labels,
  signerAlias,
}: {
  filters: AuditFilterState;
  onChange: (next: AuditFilterState) => void;
  labels: AuditLabels;
  signerAlias?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [matchedFileName, setMatchedFileName] = useState<string | null>(null);
  const [hashingFile, setHashingFile] = useState(false);

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

  return (
    <div className="space-y-3">
      {/* Row 1: Period presets + date inputs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="mr-1 text-[11px] font-bold uppercase tracking-wider"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {labels.filters.periodLabel}:
          </span>
          {(
            [
              ['all', labels.filters.presets.all],
              ['7d', labels.filters.presets.days7],
              ['month', labels.filters.presets.month],
              ['quarter', labels.filters.presets.quarter],
              ['year', labels.filters.presets.year],
            ] as const
          ).map(([preset, text]) => {
            const target = presetDates(preset);
            const active =
              filters.fromDate === target.fromDate &&
              filters.toDate === target.toDate;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => onChange({ ...filters, ...target })}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors"
                style={{
                  background: active
                    ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)'
                    : 'var(--color-surface)',
                  color: active
                    ? 'var(--color-primary)'
                    : 'var(--color-text-muted)',
                  border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-card-border)'}`,
                }}
              >
                {text}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5">
            <span style={{ color: 'var(--color-text-muted)' }}>{labels.filters.from}</span>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => onChange({ ...filters, fromDate: e.target.value })}
              className="h-8 rounded-lg border px-2 text-xs outline-none focus:border-[var(--color-primary)]"
              style={{
                background: 'var(--color-card-bg)',
                borderColor: 'var(--color-card-border)',
                color: 'var(--color-text-main)',
              }}
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span style={{ color: 'var(--color-text-muted)' }}>{labels.filters.to}</span>
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => onChange({ ...filters, toDate: e.target.value })}
              className="h-8 rounded-lg border px-2 text-xs outline-none focus:border-[var(--color-primary)]"
              style={{
                background: 'var(--color-card-bg)',
                borderColor: 'var(--color-card-border)',
                color: 'var(--color-text-main)',
              }}
            />
          </label>
        </div>
      </div>

      {/* Row 2: Search + Type + Status + Local File Hash lookup */}
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-12">
        <div className="relative md:col-span-5">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2"
            style={{ color: 'var(--color-text-muted)' }}
          />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => {
              setMatchedFileName(null);
              onChange({ ...filters, query: e.target.value });
            }}
            placeholder={labels.filters.searchPlaceholder}
            className="h-9 w-full rounded-xl border pl-8 pr-3 text-xs outline-none focus:border-[var(--color-primary)]"
            style={{
              background: 'var(--color-card-bg)',
              borderColor: 'var(--color-card-border)',
              color: 'var(--color-text-main)',
            }}
          />
        </div>

        <select
          aria-label={labels.filters.categoryLabel}
          value={filters.category}
          onChange={(e) =>
            onChange({
              ...filters,
              category: e.target.value as AuditFilterState['category'],
            })
          }
          className="h-9 rounded-xl border px-3 text-xs outline-none focus:border-[var(--color-primary)] md:col-span-2"
          style={{
            background: 'var(--color-card-bg)',
            borderColor: 'var(--color-card-border)',
            color: 'var(--color-text-main)',
          }}
        >
          <option value="all">{labels.filters.categories.all}</option>
          <option value="multi_request">{labels.filters.categories.multi_request}</option>
          <option value="solo_signature">{labels.filters.categories.solo_signature}</option>
          <option value="cosign_signature">{labels.filters.categories.cosign_signature}</option>
          <option value="cipher">{labels.filters.categories.cipher}</option>
        </select>

        <select
          aria-label={labels.filters.statusLabel}
          value={filters.status}
          onChange={(e) =>
            onChange({
              ...filters,
              status: e.target.value as AuditFilterState['status'],
            })
          }
          className="h-9 rounded-xl border px-3 text-xs outline-none focus:border-[var(--color-primary)] md:col-span-2"
          style={{
            background: 'var(--color-card-bg)',
            borderColor: 'var(--color-card-border)',
            color: 'var(--color-text-main)',
          }}
        >
          <option value="all">{labels.filters.statuses.all}</option>
          <option value="complete">{labels.filters.statuses.complete}</option>
          <option value="pending">{labels.filters.statuses.pending}</option>
          <option value="recorded">{labels.filters.statuses.recorded}</option>
          <option value="anomaly">{labels.filters.statuses.anomaly}</option>
        </select>

        <div className="flex items-center gap-2 md:col-span-3">
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
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors hover:border-[var(--color-primary)] disabled:opacity-50"
            style={{
              background: 'var(--color-surface)',
              borderColor: matchedFileName
                ? 'var(--color-primary)'
                : 'var(--color-card-border)',
              color: matchedFileName
                ? 'var(--color-primary)'
                : 'var(--color-text-main)',
            }}
          >
            <FileSearch className="size-3.5 shrink-0" />
            <span className="truncate">{labels.filters.fileLookupButton}</span>
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setMatchedFileName(null);
                onChange(DEFAULT_AUDIT_FILTERS);
              }}
              className="inline-flex h-9 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold transition-colors hover:bg-[var(--color-surface)]"
              style={{ color: 'var(--color-text-muted)' }}
              title={labels.filters.clearAll}
            >
              <X className="size-3.5" />
              <span className="sr-only sm:not-sr-only">{labels.filters.clearAll}</span>
            </button>
          )}
        </div>
      </div>

      {/* Active filter context chips */}
      {(matchedFileName || filters.signerFilter) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {matchedFileName && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium"
              style={{
                borderColor: 'var(--color-primary)',
                background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                color: 'var(--color-primary)',
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
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium"
              style={{
                borderColor: 'var(--color-primary)',
                background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                color: 'var(--color-primary)',
              }}
            >
              <span>
                {labels.filters.activeSignerChip}:{' '}
                {signerAlias || filters.signerFilter.slice(0, 14) + '…'}
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
