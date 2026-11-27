'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { concentrationLevel, type ConcentrationLevel } from '../lib/votingMethods';
import { formatPct, formatShare } from '../lib/format';
import { tip, type CompareDict } from '../lib/comparisonUtils';

export const LEVEL_STYLE: Record<ConcentrationLevel, { dot: string; text: string }> = {
    extreme: { dot: 'bg-red-500', text: 'text-red-500' },
    high: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
    moderate: { dot: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400' },
    low: { dot: 'bg-[var(--color-accent)]/60', text: 'text-[var(--color-accent)]' },
    minimal: { dot: 'bg-[var(--color-accent)]', text: 'text-[var(--color-accent)]' },
};

export function ProgressBar({ done, icon: Icon, label, ratio }: {
    done: boolean;
    icon: LucideIcon;
    label: string;
    ratio: number;
}) {
    const pct = Math.max(0, Math.min(1, ratio)) * 100;
    return (
        <div className="rounded-2xl bg-[var(--color-surface)] px-4 py-3">
            <p className="flex items-center gap-2 h-4 text-xs font-semibold text-[var(--color-text-secondary)]">
                {done
                    ? <Icon className="size-3.5 shrink-0 text-[var(--color-primary)]" />
                    : <Loader2 className="size-3.5 shrink-0 animate-spin text-[var(--color-primary)]" />}
                <span className="truncate">{label}</span>
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-[var(--color-card-border)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-500" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

/** "95/143" with the percentage share underneath. */
export function FractionCell({ n, of, title, shareTitle, language }: {
    n: number;
    of: number;
    title?: string;
    shareTitle?: string;
    language: string;
}) {
    return (
        <span className={`flex flex-col leading-tight ${title ? 'cursor-help' : ''}`} title={title}>
            <span className="font-mono text-sm font-bold text-[var(--color-text-main)] tabular-nums whitespace-nowrap">
                {n.toLocaleString(language)}
                <span className="text-[11px] font-normal text-[var(--color-text-muted)]">/{of.toLocaleString(language)}</span>
            </span>
            <span className="font-mono text-[10px] text-[var(--color-text-muted)] tabular-nums" title={shareTitle}>
                {of > 0 ? formatShare(n / of, language) : '—'}
            </span>
        </span>
    );
}

/** Nakamoto figure + decentralisation level + progress bar. */
export function SpreadMeterBar({ nakamoto, spread, title, emptyTitle, c, language, maxFractionDigits = 0 }: {
    nakamoto: number | null;
    spread: number | null;
    title?: string;
    emptyTitle?: string;
    c: CompareDict;
    language: string;
    maxFractionDigits?: number;
}) {
    const level = concentrationLevel({
        nakamoto: nakamoto === null ? null : Math.round(nakamoto),
        spread,
    });
    if (nakamoto === null || spread === null || !level) {
        return <span className={`text-xs text-[var(--color-text-muted)] ${emptyTitle ? 'cursor-help' : ''}`} title={emptyTitle}>—</span>;
    }
    const levels = (c.levels ?? {}) as Record<string, string>;
    return (
        <span className={`flex flex-col gap-1 w-full min-w-0 ${title ? 'cursor-help' : ''}`} title={title}>
            <span className="flex items-baseline gap-2 min-w-0">
                <span className="font-mono text-sm font-black text-[var(--color-text-main)] tabular-nums">
                    {nakamoto.toLocaleString(language, { maximumFractionDigits: maxFractionDigits })}
                </span>
                <span className={`flex items-baseline gap-1 min-w-0 text-[10px] font-bold ${LEVEL_STYLE[level].text}`}>
                    <span className="truncate">{levels[level] || level}</span>
                    <span className="shrink-0 tabular-nums">{formatPct(spread, language)}</span>
                </span>
            </span>
            <span className="h-1.5 rounded-full bg-[var(--color-card-border)] overflow-hidden">
                <span className={`block h-full rounded-full ${LEVEL_STYLE[level].dot}`} style={{ width: `${Math.max(3, Math.min(1, spread) * 100)}%` }} />
            </span>
        </span>
    );
}

/**
 * Concentration chart showing top 1, top 10, and remaining voters' share of weight.
 * - `horizontal`: stacked horizontal bar with inline legend underneath (`MethodsComparison`).
 * - `vertical`: boxless vertical bars with each legend underneath (`HistoricalComparison`).
 */
export function ConcentrationBar({ top1, top10, c, language, orientation = 'horizontal' }: {
    top1: number;
    top10: number;
    c: CompareDict;
    language: string;
    orientation?: 'horizontal' | 'vertical';
}) {
    const parts = [
        { key: 'top1', share: top1, cls: 'bg-red-500', label: c.conc_top1 || '' },
        { key: 'top10', share: Math.max(0, top10 - top1), cls: 'bg-amber-500', label: c.conc_top10 || '' },
        { key: 'rest', share: Math.max(0, 1 - top10), cls: 'bg-[var(--color-accent)]', label: c.conc_rest || '' },
    ];
    if (orientation === 'horizontal') {
        const legendCols = parts.map(p => `minmax(max-content, ${Math.max(1, Math.round(p.share * 100))}fr)`).join(' ');
        return (
            <div>
                <div className="flex h-3 gap-0.5 rounded-full overflow-hidden" role="img" aria-label={parts.map(p => `${p.label}: ${formatPct(p.share, language)}`).join(', ')}>
                    {parts.filter(p => p.share > 0).map(p => (
                        <span
                            key={p.key}
                            className={`h-full first:rounded-l-full last:rounded-r-full ${p.cls}`}
                            style={{ width: `${p.share * 100}%` }}
                            title={tip(c, `conc_${p.key}`, { pct: formatShare(p.share, language) })}
                        />
                    ))}
                </div>
                <div className="mt-2 grid gap-x-2" style={{ gridTemplateColumns: legendCols }}>
                    {parts.map(p => {
                        const pct = formatShare(p.share, language);
                        return (
                            <div
                                key={p.key}
                                className="inline-flex items-center justify-start gap-1.5 min-w-0 whitespace-nowrap text-[11px] text-[var(--color-text-secondary)] cursor-help"
                                title={tip(c, `conc_${p.key}`, { pct })}
                            >
                                <span className={`size-2 rounded-sm shrink-0 ${p.cls}`} />
                                <span>{p.label}</span>
                                <span className="font-mono font-bold text-[var(--color-text-main)] tabular-nums">{pct}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
    return (
        <div
            className="flex-1 flex flex-col min-h-36"
            role="img"
            aria-label={parts.map(p => `${p.label}: ${formatPct(p.share, language)}`).join(', ')}
        >
            <div className="flex-1 grid grid-cols-3 gap-4 items-end border-b border-[var(--color-card-border)] pb-1">
                {parts.map(p => {
                    const pct = formatShare(p.share, language);
                    const heightPct = p.share > 0 ? Math.max(3, Math.min(100, p.share * 100)) : 0;
                    return (
                        <div
                            key={p.key}
                            className="h-full min-h-24 flex items-end justify-center cursor-help"
                            title={tip(c, `conc_${p.key}`, { pct })}
                        >
                            <span
                                className={`block w-full max-w-20 rounded-t-lg transition-[height] duration-500 ${p.cls}`}
                                style={{ height: `${heightPct}%` }}
                            />
                        </div>
                    );
                })}
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-4">
                {parts.map(p => {
                    const pct = formatShare(p.share, language);
                    return (
                        <div
                            key={p.key}
                            className="flex flex-col items-center text-center min-w-0 leading-tight cursor-help"
                            title={tip(c, `conc_${p.key}`, { pct })}
                        >
                            <span className="inline-flex items-center gap-1.5 max-w-full text-[11px] text-[var(--color-text-secondary)]">
                                <span className={`size-2 rounded-sm shrink-0 ${p.cls}`} />
                                <span className="truncate">{p.label}</span>
                            </span>
                            <span className="mt-0.5 font-mono text-xs font-bold text-[var(--color-text-main)] tabular-nums">{pct}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
