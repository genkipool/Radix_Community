'use client';

import React from 'react';
import {
    Scale, Coins, Users, Hourglass, Shuffle, Info, PieChart, Target, Search, X,
    ShieldCheck, ShieldAlert, Shield, ShieldX, ArrowUpDown, ArrowUp, ArrowDown,
    BadgeCheck, XCircle, AlertTriangle, Crown,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { VoteOutcome } from '../lib/governanceVotes';
import {
    METHODS,
    type ConcentrationLevel, type MethodFamily, type Resistance,
} from '../lib/votingMethods';
import { fill } from '../lib/format';
import {
    ruleParams, tip, methodText, matchesMethodQuery, resistanceTooltip, formatBalanceHint, formatAttackCost, nextSort, sortComparisonRows,
    type CompareDict, type HistoricalDict, type Params, type SortState,
} from '../lib/comparisonUtils';
import { LEVEL_STYLE, ProgressBar, FractionCell, SpreadMeterBar, ConcentrationBar } from './ComparisonCharts';

export {
    ruleParams, tip, methodText, matchesMethodQuery, resistanceTooltip, formatBalanceHint, formatAttackCost, nextSort, sortComparisonRows,
    LEVEL_STYLE, ProgressBar, FractionCell, SpreadMeterBar, ConcentrationBar,
    type CompareDict, type HistoricalDict, type Params, type SortState,
};

export const FAMILY_ICON: Record<MethodFamily, LucideIcon> = {
    wealth: Coins,
    address: Users,
    seniority: Hourglass,
    hybrid: Shuffle,
};
export const FAMILIES: MethodFamily[] = ['wealth', 'address', 'seniority', 'hybrid'];

export const RESISTANCE_STYLE: Record<Resistance, { icon: LucideIcon; cls: string; dot: string }> = {
    very_low: { icon: ShieldX, cls: 'text-red-500 border-red-500/35 bg-red-500/10', dot: 'bg-red-500' },
    low: { icon: ShieldAlert, cls: 'text-orange-600 dark:text-orange-400 border-orange-500/35 bg-orange-500/10', dot: 'bg-orange-500' },
    medium: { icon: Shield, cls: 'text-yellow-600 dark:text-yellow-400 border-yellow-500/35 bg-yellow-500/10', dot: 'bg-yellow-500' },
    high: { icon: ShieldCheck, cls: 'text-[var(--color-accent)] border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10', dot: 'bg-[var(--color-accent)]' },
};

export const RESISTANCE_ORDER: Resistance[] = ['very_low', 'low', 'medium', 'high'];

export const OUTCOME_STYLE = {
    approved: { icon: BadgeCheck, cls: 'text-[var(--color-accent)] border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10' },
    rejected: { icon: XCircle, cls: 'text-red-500 border-red-500/35 bg-red-500/10' },
    no_quorum: { icon: AlertTriangle, cls: 'text-amber-600 dark:text-amber-400 border-amber-500/35 bg-amber-500/10' },
    winner: { icon: Crown, cls: 'text-[var(--color-primary)] border-[var(--color-primary)]/35 bg-[var(--color-primary)]/10' },
    none: { icon: Info, cls: 'text-[var(--color-text-muted)] border-[var(--color-card-border)] bg-[var(--color-surface)]' },
} as const;

/** Compact outcome pill shared by single-vote and historical comparison tables. */
export function OutcomeBadge({ outcome, winnerLabel, counted, c, compact = false }: {
    outcome: VoteOutcome | null;
    winnerLabel: string | null;
    counted: number;
    c: CompareDict;
    compact?: boolean;
}) {
    const kind = counted === 0 ? 'none' : outcome ?? (winnerLabel ? 'winner' : 'none');
    const { icon: Icon, cls } = OUTCOME_STYLE[kind];
    const label = kind === 'none' ? (c.outcome_none || '')
        : kind === 'winner' ? fill(c.outcome_winner || '{label}', { label: winnerLabel ?? '' })
            : { approved: c.outcome_approved || '', rejected: c.outcome_rejected || '', no_quorum: c.outcome_no_quorum || '' }[kind];
    return (
        <span
            className={`inline-flex items-center max-w-full rounded-full border font-bold cursor-help ${compact ? 'gap-1 px-2 py-0.5 text-[10px]' : 'gap-1.5 px-2.5 py-1 text-[11px]'} ${cls}`}
            title={tip(c, `outcome_${kind}`) || label}
        >
            <Icon className={`${compact ? 'size-3' : 'size-3.5'} shrink-0`} />
            <span className="truncate">{label}</span>
        </span>
    );
}

/** Compact search input placed next to the family filter bar in both comparison tabs. */
export function MethodSearchInput({ value, onChange, placeholder, clearLabel, shownCount, totalCount }: {
    value: string;
    onChange: (next: string) => void;
    placeholder: string;
    clearLabel: string;
    shownCount?: number;
    totalCount?: number;
}) {
    return (
        <label className="relative flex-1 min-w-[200px]">
            <span className="sr-only">{placeholder}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[var(--color-text-muted)]" />
            <input
                type="search"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full h-10 pl-8 pr-20 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] text-xs text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] [&::-webkit-search-cancel-button]:hidden"
            />
            {value && (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5">
                    {shownCount !== undefined && totalCount !== undefined && (
                        <span className="font-mono text-[10px] font-bold text-[var(--color-text-muted)] tabular-nums">
                            {shownCount}/{totalCount}
                        </span>
                    )}
                    <button
                        type="button"
                        aria-label={clearLabel}
                        title={clearLabel}
                        onClick={() => onChange('')}
                        className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors cursor-pointer"
                    >
                        <X className="size-3.5" />
                    </button>
                </span>
            )}
        </label>
    );
}

export function DetailStatBox({ label, title, children }: {
    label: string;
    title?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={`min-w-0 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] px-3 py-2.5 ${title ? 'cursor-help' : ''}`} title={title}>
            <p className="text-[9px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">{label}</p>
            <p className="mt-1 font-mono text-sm font-bold text-[var(--color-text-main)] break-words">{children}</p>
        </div>
    );
}

/** Metric tile used in the comparison hero summary grids. */
export function FactTile({ icon: Icon, label, value, title, tone }: {
    icon: LucideIcon;
    label: string;
    value: string;
    title?: string;
    tone?: string;
}) {
    return (
        <div className={`min-w-0 flex flex-col justify-center rounded-xl border border-[var(--color-card-border)] px-4 py-3.5 min-h-[76px] ${title ? 'cursor-help' : ''}`} title={title}>
            <dt className={`flex items-center gap-1 text-[9px] uppercase font-bold tracking-widest ${tone ?? 'text-[var(--color-text-muted)]'}`}>
                <Icon className={`size-3 shrink-0 ${tone ?? 'text-[var(--color-primary)]'}`} />
                <span className="truncate">{label}</span>
            </dt>
            <dd className="mt-1.5 font-mono text-base font-bold text-[var(--color-text-main)] truncate">{value}</dd>
        </div>
    );
}

/** Bottom attack/resistance callout shared by both comparison detail panels. */
export function ResistanceCallout({ resistance, pill, children }: {
    resistance: Resistance;
    pill: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className={`lg:col-span-2 flex flex-col items-start gap-2 rounded-xl border p-3 ${RESISTANCE_STYLE[resistance].cls.replace(/text-\S+/g, '')}`}>
            {pill}
            {children}
        </div>
    );
}

export function GroupedMethodList<T extends { key: string; family: MethodFamily }>({ items, sorted, sort, c, renderRow }: {
    items: T[];
    sorted: T[];
    sort: SortState;
    c: CompareDict;
    renderRow: (item: T) => React.ReactNode;
}) {
    if (items.length === 0) {
        return (
            <p className="flex items-center gap-2 rounded-2xl border border-dashed border-[var(--color-card-border)] p-5 text-sm text-[var(--color-text-muted)]">
                <Info className="size-4 shrink-0" />{c.search_empty}
            </p>
        );
    }
    if (sort) {
        return <ul className="space-y-2">{sorted.map(renderRow)}</ul>;
    }
    return (
        <>
            {FAMILIES.filter(f => items.some(r => r.family === f)).map(f => {
                const Icon = FAMILY_ICON[f];
                return (
                    <div key={f} className="space-y-2">
                        <p className="flex items-center gap-2 pt-2 text-[11px] font-bold text-[var(--color-text-secondary)]">
                            <Icon className="size-3.5 text-[var(--color-primary)]" />
                            {((c.families ?? {}) as Record<string, string>)[f] || f}
                            <span className="font-normal text-[var(--color-text-muted)] hidden sm:inline">· {((c.family_hints ?? {}) as Record<string, string>)[f]}</span>
                        </p>
                        <ul className="space-y-2">
                            {items.filter(r => r.family === f).map(renderRow)}
                        </ul>
                    </div>
                );
            })}
        </>
    );
}

export function ComparisonTile({ icon: Icon, label, value, hint, help, onClick }: {
    icon: LucideIcon;
    label: string;
    value?: string;
    hint?: string;
    help?: string;
    onClick?: () => void;
}) {
    const content = (
        <>
            <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)] cursor-help" title={help}>
                <Icon className="size-3.5 text-[var(--color-primary)] shrink-0" />
                <span className="truncate">{label}</span>
                {help && <Info className="size-3 shrink-0 opacity-60" aria-hidden />}
            </span>
            <span className="mt-2 h-[2lh] line-clamp-2 text-lg font-black leading-tight break-words text-[var(--color-text-main)]" title={value}>{value || '—'}</span>
            <span className="mt-1.5 min-h-[2lh] line-clamp-3 text-[11px] leading-snug text-[var(--color-text-muted)]" title={hint}>{hint}</span>
        </>
    );
    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className="min-w-0 flex flex-col text-left rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-4 cursor-pointer hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface)]/50 transition-colors"
            >
                {content}
            </button>
        );
    }
    return (
        <div className="min-w-0 flex flex-col rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-4">
            {content}
        </div>
    );
}

/** A figure in a method row; its label only shows where the column headers do not. */
export function ComparisonCell({ label, className, pending, children }: {
    label: string;
    className: string;
    pending: boolean;
    children: React.ReactNode;
}) {
    return (
        <span className={`min-w-0 flex flex-col gap-1 ${className}`}>
            <span className="lg:hidden truncate text-[9px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]" title={label}>{label}</span>
            <span className="flex items-center h-10 min-w-0">
                {pending ? <span className="block h-2 w-full max-w-24 rounded-full bg-[var(--color-surface)] animate-pulse" aria-hidden /> : children}
            </span>
        </span>
    );
}

export function FamilyFilterBar({ family, onChange, c, language }: {
    family: MethodFamily | 'all';
    onChange: (next: MethodFamily | 'all') => void;
    c: CompareDict;
    language: string;
}) {
    return (
        <div role="group" aria-label={c.filter_label} className="grid grid-cols-5 gap-1 w-full @xl:w-[580px] shrink-0 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] p-1">
            {(['all', ...FAMILIES] as const).map(f => {
                const Icon = f === 'all' ? Scale : FAMILY_ICON[f];
                const label = f === 'all' ? (c.filter_all || '') : ((c.families ?? {}) as Record<string, string>)[f] || f;
                const short = ((c.families_short ?? {}) as Record<string, string>)[f] || label;
                return (
                    <button
                        key={f}
                        type="button"
                        aria-pressed={family === f}
                        aria-label={label}
                        title={f === 'all' ? tip(c, 'filter_all', { n: METHODS.length.toLocaleString(language) }) : `${label}: ${((c.family_hints ?? {}) as Record<string, string>)[f]}`}
                        onClick={() => onChange(f)}
                        className={`min-w-0 h-8 inline-flex items-center justify-center gap-1.5 px-2 rounded-lg text-xs font-semibold transition-colors ${family === f ? 'bg-[var(--color-card-bg)] text-[var(--color-primary)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                    >
                        <Icon className="size-3.5 shrink-0" /><span className="hidden @xl:inline truncate">{short}</span>
                    </button>
                );
            })}
        </div>
    );
}

export function SortableHeaderButton({ label, title, active, dir, onClick }: {
    label: string;
    title?: string;
    active: boolean;
    dir?: 'asc' | 'desc';
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={`inline-flex items-center gap-1 text-left uppercase tracking-widest hover:text-[var(--color-text-main)] transition-colors cursor-pointer ${active ? 'text-[var(--color-primary)]' : ''}`}
        >
            <span className="truncate">{label}</span>
            {active
                ? (dir === 'asc' ? <ArrowUp className="size-3 shrink-0" /> : <ArrowDown className="size-3 shrink-0" />)
                : <ArrowUpDown className="size-3 shrink-0 opacity-60" />}
        </button>
    );
}

export function ComparisonGlossary({ id, c }: { id: string; c: CompareDict }) {
    return (
        <section aria-labelledby={id} className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5">
            <h3 id={id} className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-main)]">
                <Info className="size-4 text-[var(--color-primary)]" />{c.glossary_title}
            </h3>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {([
                    [PieChart, c.g_nakamoto_t, c.g_nakamoto],
                    [Target, c.g_decisive_t, c.g_decisive],
                    [Users, c.g_effective_t, c.g_effective],
                    [Hourglass, c.g_age_t, c.g_age],
                    [ShieldCheck, c.g_resistance_t, c.g_resistance],
                ] as const).map(([Icon, t, body], i) => (
                    <div key={i} className="rounded-xl bg-[var(--color-surface)] p-4 sm:last:col-span-2 xl:last:col-span-1">
                        <dt className="flex items-center gap-2 text-xs font-bold text-[var(--color-text-main)]"><Icon className="size-3.5 text-[var(--color-primary)]" />{t}</dt>
                        <dd className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-secondary)]">{body}</dd>
                    </div>
                ))}
            </dl>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {(Object.keys(LEVEL_STYLE) as ConcentrationLevel[]).map(l => (
                    <span key={l} className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)] cursor-help" title={tip(c, `level_${l}`)}>
                        <span className={`font-bold ${LEVEL_STYLE[l].text}`}>{((c.levels ?? {}) as Record<string, string>)[l]}</span>
                        {((c.level_hints ?? {}) as Record<string, string>)[l]}
                    </span>
                ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
                {RESISTANCE_ORDER.map(l => {
                    const Icon = RESISTANCE_STYLE[l].icon;
                    return (
                        <span key={l} className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)] cursor-help" title={tip(c, `resistance_${l}`)}>
                            <Icon className={`size-3 ${RESISTANCE_STYLE[l].cls.split(' ')[0]}`} />
                            <span className={`font-bold ${RESISTANCE_STYLE[l].cls.split(' ')[0]}`}>{fill(c.resistance_legend || '', { level: ((c.resistance ?? {}) as Record<string, string>)[l] || l })}</span>
                            {((c.resistance_hints ?? {}) as Record<string, string>)[l]}
                        </span>
                    );
                })}
            </div>
        </section>
    );
}
