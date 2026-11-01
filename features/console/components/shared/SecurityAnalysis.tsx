'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';

import { Heading, Note, Sub } from './InfoParts';

export type AnalysisSeverity = 'danger' | 'warning' | 'info' | 'ok';

/** One finding, already in words. */
export interface AnalysisItem {
  severity: AnalysisSeverity;
  text: string;
  /** Addresses it points at, each shown as a line under the text. */
  addresses?: string[];
  /** Left out of the summary on top (the card's headline already says it). */
  notInSummary?: boolean;
}

export interface AnalysisLabels {
  title: string;
  summaryOk: string;
  disclaimer: string;
  /** With `{count}`. */
  show: string;
  hide: string;
  loading: string;
}

/** How many findings the summary shows before the folded list. */
const SUMMARY_SIZE = 3;

const ICONS: Record<AnalysisSeverity, ReactNode> = {
  danger: <CircleAlert className="size-4 shrink-0" style={{ color: 'var(--color-danger)' }} />,
  warning: <TriangleAlert className="size-4 shrink-0" style={{ color: 'var(--color-warning)' }} />,
  info: <Info className="size-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />,
  ok: <CircleCheck className="size-4 shrink-0" style={{ color: 'var(--color-success)' }} />,
};

/**
 * A security analysis as the info cards show it: the worst few findings as
 * notes on top, the whole list folded below, and every time the reminder that
 * it reads permissions, not code. `items` comes worst first; null while loading.
 */
export function SecurityAnalysis({
  labels,
  items,
  address,
}: {
  labels: AnalysisLabels;
  items: AnalysisItem[] | null;
  /** An address as a line with explorer link and copy button. */
  address: (address: string) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (!items) return <Sub>{labels.loading}</Sub>;

  const serious = items.filter((f) => (f.severity === 'danger' || f.severity === 'warning') && !f.notInSummary);
  const headlineRisk = items.some((f) => f.notInSummary && (f.severity === 'danger' || f.severity === 'warning'));
  const lines = (f: AnalysisItem, className: string) =>
    f.addresses?.map((a) => (
      <span key={a} className={`block ${className}`}>
        {address(a)}
      </span>
    ));

  return (
    <div className="space-y-2">
      <Heading>{labels.title}</Heading>
      {serious.slice(0, SUMMARY_SIZE).map((f, i) => (
        <Note key={`${f.text}-${i}`} tone={f.severity === 'danger' ? 'danger' : 'warning'}>
          {f.text}
          {lines(f, 'mt-1')}
        </Note>
      ))}
      {serious.length === 0 && !headlineRisk && <Note tone="success">{labels.summaryOk}</Note>}
      <Sub>{labels.disclaimer}</Sub>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors hover:text-[var(--color-accent)] cursor-pointer"
        style={{ color: 'var(--color-primary)' }}
      >
        <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        {(open ? labels.hide : labels.show).replace('{count}', String(items.length))}
      </button>
      {open && (
        <ul className="divide-y divide-[var(--color-card-border)] text-sm">
          {items.map((f, i) => (
            <li key={`${f.text}-${i}`} className="flex gap-2 py-2" style={{ color: 'var(--color-text-main)' }}>
              {ICONS[f.severity]}
              <span className="min-w-0 flex-1">
                {f.text}
                {lines(f, 'mt-0.5')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
