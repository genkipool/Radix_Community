'use client';
/**
 * Small building blocks the Olympia cards and tabs share: the network badge, a
 * link to an Olympia identifier, a labelled stat, a section frame and the
 * loading / error / empty states.
 */
import React from 'react';
import Link from 'next/link';
import { History } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { dashboardRoutes } from '@/features/dashboard/lib/routes';
import type { OlympiaDict } from './dict';
import { OlympiaCsvButton } from './OlympiaCsvButton';
import { BabylonCsvButton } from './BabylonCsvButton';
import { shortHash } from './format';

export function OlympiaBadge({ o, className = '' }: { o: OlympiaDict; className?: string }) {
  return (
    <span
      title={o.badge_tooltip}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400 shrink-0 ${className}`}
    >
      <History className="size-3" aria-hidden="true" />
      {o.badge ?? 'Olympia'}
    </span>
  );
}

/** A row of pill buttons that picks one part of a tab (the filter pills of the Olympia views). */
export function FilterPills<K extends string>({ options, value, onChange, className = '' }: {
  options: { key: K; label: string; tooltip?: string }[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`} role="tablist">
      {options.map((p) => (
        <button
          key={p.key}
          type="button"
          role="tab"
          title={p.tooltip}
          aria-selected={value === p.key}
          onClick={(e) => { e.stopPropagation(); onChange(p.key); }}
          className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors ${value === p.key ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'border-[var(--color-card-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/** Where a merged Babylon + Olympia view reads from. */
export type NetworkScope = 'all' | 'babylon' | 'olympia';

/** The "All / Babylon / Olympia" pills of a Babylon tab that also shows Olympia. */
export function NetworkScopePills({ o, value, onChange, className }: { o: OlympiaDict; value: NetworkScope; onChange: (v: NetworkScope) => void; className?: string }) {
  return (
    <FilterPills
      className={className}
      value={value}
      onChange={onChange}
      options={[
        { key: 'all', label: o.filter_all ?? 'All', tooltip: o.filter_all_tooltip },
        { key: 'babylon', label: o.filter_babylon ?? 'Babylon', tooltip: o.filter_babylon_tooltip },
        { key: 'olympia', label: o.filter_olympia ?? 'Olympia', tooltip: o.filter_olympia_tooltip },
      ]}
    />
  );
}

/** A link to the Olympia card of an address, token or transaction, with copy (and CSV for accounts and validators). */
export function OlympiaRef({ value, locale, head = 10, tail = 6, full = false }: {
  value: string; locale: string; head?: number; tail?: number; full?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1 min-w-0 max-w-full">
      <Link
        href={dashboardRoutes.entity(locale, value)}
        onClick={(e) => e.stopPropagation()}
        className="font-mono text-xs text-[var(--color-primary)] hover:underline truncate"
        title={value}
      >
        {full ? value : shortHash(value, head, tail)}
      </Link>
      <CopyButton value={value} variant="minimal" />
      <OlympiaCsvButton address={value} />
    </span>
  );
}

/** A link to a Babylon entity page, with copy. */
export function BabylonRef({ value, locale, full = false }: { value: string; locale: string; full?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 min-w-0 max-w-full">
      <Link
        href={dashboardRoutes.entity(locale, value, { network: 'mainnet' })}
        onClick={(e) => e.stopPropagation()}
        className="font-mono text-xs text-[var(--color-primary)] hover:underline truncate"
        title={value}
      >
        {full ? value : shortHash(value, 14, 6)}
      </Link>
      <CopyButton value={value} variant="minimal" />
      {/* An account gets its rewards CSV, as on the Babylon account card. */}
      <BabylonCsvButton address={value} />
    </span>
  );
}

export function Stat({ label, value, tone = 'main', title, hint }: {
  label: string; value: React.ReactNode; tone?: 'main' | 'accent' | 'primary' | 'secondary' | 'muted'; title?: string;
  /** A line under the value, e.g. the date it refers to. */
  hint?: string;
}) {
  const color = {
    main: 'text-[var(--color-text-main)]',
    accent: 'text-[var(--color-accent)]',
    primary: 'text-[var(--color-primary)]',
    secondary: 'text-[var(--color-secondary)]',
    muted: 'text-[var(--color-text-muted)]',
  }[tone];
  return (
    <div className="min-w-0 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] truncate">{label}</div>
      <div className={`text-sm font-bold font-mono truncate ${color}`} title={title}>{value}</div>
      {hint && <div className="text-[9px] text-[var(--color-text-muted)] truncate">{hint}</div>}
    </div>
  );
}

export function Section({ title, children, aside }: { title: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[11px] uppercase font-black tracking-widest text-[var(--color-text-muted)]">{title}</h4>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Loading({ text }: { text?: string }) {
  return (
    <p className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] py-2">
      <span className="size-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
      {text ?? 'Loading…'}
    </p>
  );
}

export function ErrorText({ text }: { text?: string }) {
  return <p className="text-xs font-semibold text-[var(--color-danger)] py-2">{text ?? 'Error'}</p>;
}

export function Empty({ text }: { text?: string }) {
  return <p className="text-xs text-[var(--color-text-muted)] py-2">{text}</p>;
}

/** Where the data comes from, under every Olympia view. */
export function SourceNote({ o }: { o: OlympiaDict }) {
  return <p className="text-[10px] text-[var(--color-text-muted)] opacity-80">{o.source}</p>;
}

/** A token by its symbol, linking to its Olympia card. */
export function TokenRef({ rri, symbol, locale }: { rri: string; symbol: string; locale: string }) {
  return (
    <Link
      href={dashboardRoutes.entity(locale, rri)}
      onClick={(e) => e.stopPropagation()}
      className="font-mono text-xs font-bold text-[var(--color-secondary)] hover:underline"
      title={rri}
    >
      {symbol || rri}
    </Link>
  );
}
