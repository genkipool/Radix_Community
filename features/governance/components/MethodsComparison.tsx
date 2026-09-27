'use client';

import React, { useId, useState } from 'react';
import {
    Scale, Coins, Users, Hourglass, Shuffle, ChevronDown, BadgeCheck, XCircle, AlertTriangle, Info, Loader2,
    Equal, ArrowLeftRight, PieChart, Target, Crown, Network, ShieldCheck, ShieldAlert, Shield, ShieldX, Gauge, TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { GovernanceSystem } from '../config/systems';
import type { GovernanceEntry } from '../types';
import { useGovernanceTally } from '../hooks/useGovernanceTally';
import { useAccountAges } from '../hooks/useAccountAges';
import { itemChoices } from '../lib/governanceVotes';
import {
    METHODS, METHOD_PARAMS, balanceExtremes, compareMethods, concentrationLevel,
    type ConcentrationLevel, type MethodFamily, type MethodKey, type MethodResult, type MethodVoter, type Resistance,
} from '../lib/votingMethods';
import { fill, formatPct, formatShare, formatXrd } from '../lib/format';
import { TONE, type Gv } from './VoteParts';
import type { G } from './GovernanceBadges';

type C = Partial<NonNullable<G['compare']>>;
type Params = Record<string, string>;

const FAMILY_ICON: Record<MethodFamily, LucideIcon> = { wealth: Coins, address: Users, seniority: Hourglass, hybrid: Shuffle };
const FAMILIES: MethodFamily[] = ['wealth', 'address', 'seniority', 'hybrid'];

const OUTCOME_STYLE = {
    approved: { icon: BadgeCheck, cls: 'text-[var(--color-accent)] border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10' },
    rejected: { icon: XCircle, cls: 'text-red-500 border-red-500/35 bg-red-500/10' },
    no_quorum: { icon: AlertTriangle, cls: 'text-amber-600 dark:text-amber-400 border-amber-500/35 bg-amber-500/10' },
    winner: { icon: Crown, cls: 'text-[var(--color-primary)] border-[var(--color-primary)]/35 bg-[var(--color-primary)]/10' },
    none: { icon: Info, cls: 'text-[var(--color-text-muted)] border-[var(--color-card-border)] bg-[var(--color-surface)]' },
} as const;

const LEVEL_STYLE: Record<ConcentrationLevel, { dot: string; text: string }> = {
    extreme: { dot: 'bg-red-500', text: 'text-red-500' },
    high: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
    moderate: { dot: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400' },
    low: { dot: 'bg-[var(--color-accent)]/60', text: 'text-[var(--color-accent)]' },
    minimal: { dot: 'bg-[var(--color-accent)]', text: 'text-[var(--color-accent)]' },
};

const RESISTANCE_STYLE: Record<Resistance, { icon: LucideIcon; cls: string; dot: string }> = {
    very_low: { icon: ShieldX, cls: 'text-red-500 border-red-500/35 bg-red-500/10', dot: 'bg-red-500' },
    low: { icon: ShieldAlert, cls: 'text-orange-600 dark:text-orange-400 border-orange-500/35 bg-orange-500/10', dot: 'bg-orange-500' },
    medium: { icon: Shield, cls: 'text-yellow-600 dark:text-yellow-400 border-yellow-500/35 bg-yellow-500/10', dot: 'bg-yellow-500' },
    high: { icon: ShieldCheck, cls: 'text-[var(--color-accent)] border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10', dot: 'bg-[var(--color-accent)]' },
};
const RESISTANCE_ORDER: Resistance[] = ['very_low', 'low', 'medium', 'high'];

/** Figures the rule texts quote, in the reader's locale. */
function ruleParams(language: string): Params {
    const n = (x: number) => x.toLocaleString(language);
    return {
        cap: n(METHOD_PARAMS.cap),
        min: n(METHOD_PARAMS.minBalance),
        balance: n(METHOD_PARAMS.sybilBalance),
        years_sybil: n(METHOD_PARAMS.sybilDays / 365),
        years: n(METHOD_PARAMS.veteranDays / 365),
        bonus: formatPct(METHOD_PARAMS.bonusPerYear, language),
        n: n(METHOD_PARAMS.whales),
        share: formatPct(METHOD_PARAMS.capShare, language),
        whale: n(METHOD_PARAMS.whaleMin),
    };
}

/** Hover text, filled with the figures it quotes. */
function tip(c: C, key: string, values: Params = {}): string | undefined {
    const text = ((c.tips ?? {}) as Record<string, string>)[key];
    return text ? fill(text, values) : undefined;
}

function methodText(c: C, key: MethodKey, params: Params) {
    const m = (c.methods as Record<string, { name?: string; rule?: string; attack?: string }> | undefined)?.[key] ?? {};
    return { name: fill(m.name || key, params), rule: fill(m.rule || '', params), attack: fill(m.attack || '', params) };
}

/** Rules whose cheapest attack is many addresses rather than more XRD. */
const PER_ADDRESS_ATTACK = new Set<MethodKey>([
    'quadratic', 'cube_root', 'logarithmic', 'tiered', 'one_address', 'one_address_min', 'one_address_sybil',
    'address_age', 'veterans_address', 'hybrid_half', 'double_majority', 'quadratic_seniority', 'sybil_quadratic',
]);

/** "1 address" / "142 addresses" in the reader's language. */
function addressesText(c: C, n: number, language: string): string {
    return fill(n === 1 ? (c.address_one || '{n} address') : (c.address_many || '{n} addresses'), { n: n.toLocaleString(language) });
}

/** "1 year" / "2 years" in the reader's language. */
function yearsText(c: C, years: number, language: string): string {
    return fill(years === 1 ? (c.year_one || '{n} year') : (c.year_many || '{n} years'), { n: years.toLocaleString(language) });
}

/** What it would take one person to flip this vote under the rule, in one sentence. */
function attackText(r: MethodResult, c: C, language: string): string {
    const a = r.attack;
    if (!a) return c.cost_none || 'There is no clear result to turn around (no quorum or no valid votes).';
    if (a.impossible) return c.cost_impossible || 'Adding votes cannot turn this result around.';
    // Compact, with decimals only when they say something: "1 mil", "864,28 M".
    const amount = (n: number) => new Intl.NumberFormat(language, { notation: 'compact', maximumFractionDigits: 2 }).format(n);
    const values = {
        xrd: amount(a.xrd),
        addresses: a.addresses.toLocaleString(language),
        each: amount(a.addresses ? a.xrd / a.addresses : 0),
        years: yearsText(c, a.years, language),
        pct: r.eligibleXrd > 0 ? formatShare(a.xrd / r.eligibleXrd, language) : '—',
    };
    // Rules gamed with many small addresses are priced per address; the rest in XRD.
    const perAddress = PER_ADDRESS_ATTACK.has(r.key) && !(r.key === 'double_majority' && r.outcome === 'rejected');
    if (perAddress) return fill(a.years ? (c.cost_addresses_aged || '') : (c.cost_addresses || ''), values);
    if (a.years) return fill(c.cost_capital_aged || '', values);
    return fill(a.addresses > 1 ? (c.cost_capital_split || '') : (c.cost_capital || ''), values);
}

function ResistancePill({ r, c, attack, language }: { r: MethodResult; c: C; attack: string; language: string }) {
    const { icon: Icon, cls } = RESISTANCE_STYLE[r.resistance];
    const label = ((c.resistance ?? {}) as Record<string, string>)[r.resistance] || r.resistance;
    // Level, what it means, how this rule is gamed and what it would take here.
    const title = [
        fill(c.resistance_title || 'Resistance to manipulation: {level}', { level: label }),
        tip(c, `resistance_${r.resistance}`),
        '',
        `${c.resistance_how || 'How'}: ${attack}`,
        `${c.resistance_here || 'In this vote'}: ${attackText(r, c, language)}`,
    ].filter(line => line !== undefined).join('\n');
    return (
        <span
            className={`inline-flex items-center gap-1.5 max-w-full h-7 px-2.5 rounded-full border text-[11px] font-bold cursor-help ${cls}`}
            title={title}
        >
            <Icon className="size-3.5 shrink-0" /><span className="truncate">{label}</span>
        </span>
    );
}

function OutcomePill({ r, c }: { r: MethodResult; c: C }) {
    const kind = r.counted === 0 ? 'none' : r.outcome ?? (r.winner ? 'winner' : 'none');
    const { icon: Icon, cls } = OUTCOME_STYLE[kind];
    const label = kind === 'none' ? (c.outcome_none || 'No valid votes')
        : kind === 'winner' ? fill(c.outcome_winner || 'Winner: {label}', { label: r.winner?.label ?? '' })
            : { approved: c.outcome_approved || 'Approved', rejected: c.outcome_rejected || 'Rejected', no_quorum: c.outcome_no_quorum || 'No quorum' }[kind];
    return (
        <span className={`inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-full border text-[11px] font-bold cursor-help ${cls}`} title={tip(c, `outcome_${kind}`)}>
            <Icon className="size-3.5 shrink-0" /><span className="truncate">{label}</span>
        </span>
    );
}

/** Share in favour with the pass line; on a ballot with no sides, the winner's share. */
function SupportMeter({ r, c, threshold, language }: { r: MethodResult; c: C; threshold: number | null; language: string }) {
    const hasSides = r.approvalShare !== null;
    const ratio = hasSides ? r.approvalShare ?? 0 : r.winner?.share ?? 0;
    const ok = hasSides ? threshold === null || ratio >= threshold : true;
    if (r.counted === 0) return <span className="text-xs text-[var(--color-text-muted)]">—</span>;
    const title = hasSides
        ? tip(c, 'support', { pct: formatPct(ratio, language), threshold: threshold === null ? '—' : formatPct(threshold, language) })
        : tip(c, 'support_winner', { pct: formatPct(ratio, language), label: r.winner?.label ?? '' });
    return (
        <span className="flex items-center gap-2.5 w-full cursor-help" title={title}>
            <span className="relative flex-1 h-2 rounded-full bg-[var(--color-card-border)]">
                <span className={`absolute inset-y-0 left-0 rounded-full ${ok ? TONE.positive.bar : TONE.negative.bar}`} style={{ width: `${Math.min(1, ratio) * 100}%` }} />
                {hasSides && threshold !== null && (
                    <span className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-[var(--color-text-main)]" style={{ left: `calc(${threshold * 100}% - 1px)` }} aria-hidden />
                )}
            </span>
            <span className="w-12 text-right font-mono text-xs font-bold text-[var(--color-text-main)] tabular-nums">{formatPct(ratio, language)}</span>
        </span>
    );
}

/** Voters controlling half the weight, against the most possible (everyone weighing the same). */
function SpreadMeter({ r, c, language }: { r: MethodResult; c: C; language: string }) {
    const { nakamoto, spread } = r.concentration;
    const level = concentrationLevel(r.concentration);
    if (nakamoto === null || spread === null || !level) return <span className="text-xs text-[var(--color-text-muted)]">—</span>;
    const levels = (c.levels ?? {}) as Record<string, string>;
    const title = tip(c, 'nakamoto', {
        n: nakamoto.toLocaleString(language), of: r.counted.toLocaleString(language), share: formatPct(nakamoto / r.counted, language),
        eff: r.concentration.effective.toLocaleString(language, { maximumFractionDigits: 1 }), spread: formatPct(spread, language), level: levels[level] || level,
    });
    return (
        <span className="flex flex-col gap-1 w-full min-w-0 cursor-help" title={title}>
            {/* The addresses holding half, then the level and its degree, on one centred line; the bar below. */}
            <span className="flex items-baseline gap-2 min-w-0">
                <span className="font-mono text-sm font-black text-[var(--color-text-main)] tabular-nums">{nakamoto.toLocaleString(language)}</span>
                {/* Same typeface for the level and its degree, so both sit on one baseline. */}
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

/** Largest voter, the next nine and everybody else, as shares of the weight. */
function ConcentrationBar({ r, c, language }: { r: MethodResult; c: C; language: string }) {
    const { top1, top10 } = r.concentration;
    const parts = [
        { key: 'top1', share: top1, cls: 'bg-red-500', label: c.conc_top1 || 'Largest address' },
        { key: 'top10', share: Math.max(0, top10 - top1), cls: 'bg-amber-500', label: c.conc_top10 || 'Next 9' },
        { key: 'rest', share: Math.max(0, 1 - top10), cls: 'bg-[var(--color-accent)]', label: c.conc_rest || 'Everyone else' },
    ];
    return (
        <div>
            <div className="flex h-3 gap-0.5 rounded-full overflow-hidden" role="img" aria-label={parts.map(p => `${p.label}: ${formatPct(p.share, language)}`).join(', ')}>
                {parts.filter(p => p.share > 0).map(p => <span key={p.key} className={`h-full first:rounded-l-full last:rounded-r-full ${p.cls}`} style={{ width: `${p.share * 100}%` }} title={tip(c, `conc_${p.key}`, { pct: formatShare(p.share, language) })} />)}
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {parts.map(p => (
                    <li key={p.key} className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)] cursor-help" title={tip(c, `conc_${p.key}`, { pct: formatShare(p.share, language) })}>
                        <span className={`size-2 rounded-sm ${p.cls}`} />{p.label}
                        <span className="font-mono font-bold text-[var(--color-text-main)]">{formatShare(p.share, language)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function Stat({ label, title, children }: { label: string; title?: string; children: React.ReactNode }) {
    return (
        <div className="min-w-0 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] px-3 py-2.5 cursor-help" title={title}>
            <p className="text-[9px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">{label}</p>
            <p className="mt-1 text-sm font-bold text-[var(--color-text-main)] break-words">{children}</p>
        </div>
    );
}

/** Everything behind one rule's figures. */
function MethodDetail({ r, c, rule, attack, quorum, language }: { r: MethodResult; c: C; rule: string; attack: string; quorum: number | null; language: string }) {
    const d = r.decisive;
    const sideLabel = d ? { for: c.side_for || 'in favour', against: c.side_against || 'against', winner: c.side_winner || 'behind the winner' }[d.side] : '';
    return (
        <div className="grid gap-5 lg:grid-cols-2 px-4 sm:px-5 pb-5 pt-1">
            {/* Each column spreads its blocks over the row's height: no empty band at the bottom. */}
            <div className="flex flex-col justify-between gap-4 min-w-0">
                <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">{rule}</p>
                {r.counted > 0 && (
                    <div>
                        <p className="mb-2 text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">{c.detail_split || 'How the weight splits'}</p>
                        <ul className="space-y-2">
                            {r.rows.filter(x => x.power > 0 || x.tone !== 'neutral').map(x => (
                                <li key={x.key}>
                                    <div className="flex items-center justify-between gap-3 text-xs">
                                        <span className={`font-semibold truncate ${TONE[x.tone].text}`}>{x.label}</span>
                                        <span className="flex items-baseline gap-2 shrink-0">
                                            <span className="text-[11px] text-[var(--color-text-muted)]">{addressesText(c, r.addressesByChoice[x.key] ?? 0, language)}</span>
                                            <span className="font-mono font-bold text-[var(--color-text-main)] w-12 text-right">{formatPct(x.share, language)}</span>
                                        </span>
                                    </div>
                                    <div className="mt-1 h-1.5 rounded-full bg-[var(--color-card-border)] overflow-hidden">
                                        <div className={`h-full rounded-full ${TONE[x.tone].bar}`} style={{ width: `${x.share * 100}%` }} />
                                    </div>
                                </li>
                            ))}
                        </ul>
                        {r.headcountShare !== null && (
                            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                                {fill(c.detail_headcount || 'Counting one vote per address: {pct} in favour.', { pct: formatPct(r.headcountShare, language) })}
                            </p>
                        )}
                    </div>
                )}
                {r.counted > 0 && (
                    <div>
                        <p className="mb-2 text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">{c.detail_concentration || 'Who holds the weight'}</p>
                        <ConcentrationBar r={r} c={c} language={language} />
                    </div>
                )}
            </div>
            <div className="flex flex-col justify-between gap-4 min-w-0">
                <div className="grid grid-cols-2 gap-2">
                    <Stat label={c.detail_counted || 'Addresses that count'} title={tip(c, 'detail_counted')}>
                        {/* "115/120 (5 do not count)": the ones that count out of everyone who voted. */}
                        {r.counted.toLocaleString(language)}/{(r.counted + r.excluded).toLocaleString(language)}
                        {r.excluded > 0 && (
                            <span className="ml-1 text-xs font-normal text-[var(--color-text-muted)]">
                                {fill(r.excluded === 1 ? (c.detail_excluded_one || '(1 does not count)') : (c.detail_excluded || '({n} do not count)'), { n: r.excluded.toLocaleString(language) })}
                            </span>
                        )}
                    </Stat>
                    <Stat label={c.detail_effective || 'Effective voters'} title={tip(c, 'detail_effective', { n: r.concentration.effective.toLocaleString(language, { maximumFractionDigits: 1 }), of: r.counted.toLocaleString(language) })}>
                        {r.concentration.effective ? (
                            <>
                                {r.concentration.effective.toLocaleString(language, { maximumFractionDigits: 1 })}
                                <span className="ml-1 text-xs font-normal text-[var(--color-text-muted)]">{fill(c.of_n || 'of {n}', { n: r.counted.toLocaleString(language) })}</span>
                            </>
                        ) : '—'}
                    </Stat>
                    <Stat label={c.detail_quorum || 'Quorum'} title={tip(c, 'detail_quorum')}>
                        {quorum === null ? '—' : (
                            <span className={r.quorumMet ? 'text-[var(--color-accent)]' : 'text-amber-600 dark:text-amber-400'}>
                                {fill(c.detail_quorum_value || '{xrd} of {quorum} XRD', { xrd: formatXrd(r.eligibleXrd, language), quorum: formatXrd(quorum, language) })}
                            </span>
                        )}
                    </Stat>
                    <Stat label={c.detail_spread || 'Decentralisation'} title={tip(c, 'detail_spread')}>
                        {r.concentration.spread === null ? '—' : fill(c.detail_spread_value || '{pct} ({eff} of {of})', {
                            pct: formatPct(r.concentration.spread, language),
                            eff: r.concentration.effective.toLocaleString(language, { maximumFractionDigits: 1 }),
                            of: r.counted.toLocaleString(language),
                        })}
                    </Stat>
                </div>
                {d ? (
                    <p className="flex items-start gap-2 rounded-xl border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/5 p-3 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                        <Target className="size-4 mt-0.5 shrink-0 text-[var(--color-primary)]" />
                        <span>{fill(c.detail_decisive || 'The {count} largest of the {of} voters {side} ({xrd} XRD) were enough to settle it, even if everyone else had voted the other way.', {
                            count: d.count.toLocaleString(language), of: d.of.toLocaleString(language), side: sideLabel, xrd: formatXrd(d.xrd, language),
                        })}</span>
                    </p>
                ) : (
                    <p className="flex items-start gap-2 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] p-3 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                        <Info className="size-4 mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
                        <span>{r.counted === 0 ? c.detail_nobody : c.detail_no_quorum}</span>
                    </p>
                )}
            </div>
            <div className={`lg:col-span-2 flex flex-col items-start gap-2 rounded-xl border p-3 ${RESISTANCE_STYLE[r.resistance].cls.replace(/text-\S+/g, '')}`}>
                <ResistancePill r={r} c={c} attack={attack} language={language} />
                <div className="min-w-0 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                    <p><span className="font-bold text-[var(--color-text-main)]">{c.detail_attack || 'How it could be gamed'}: </span>{attack}</p>
                    <p className="mt-1 font-semibold text-[var(--color-text-main)]">{attackText(r, c, language)}</p>
                </div>
            </div>
        </div>
    );
}

function MethodRow({ r, c, params, threshold, quorum, ageLoading, language }: {
    r: MethodResult; c: C; params: Params; threshold: number | null; quorum: number | null; ageLoading: boolean; language: string;
}) {
    const [open, setOpen] = useState(r.current);
    const panelId = useId();
    const { name, rule, attack } = methodText(c, r.key, params);
    const pending = r.needsAge && ageLoading;
    const d = r.decisive;
    return (
        <li className={`rounded-2xl border bg-[var(--color-card-bg)] transition-colors ${r.current ? 'border-[var(--color-primary)]/50 shadow-[0_0_0_1px_var(--color-primary)]/10' : 'border-[var(--color-card-border)]'}`}>
            <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                title={open ? tip(c, 'collapse') : tip(c, 'expand')}
                onClick={() => setOpen(o => !o)}
                className="w-full text-left p-4 sm:px-5 grid gap-x-4 gap-y-3 grid-cols-6 lg:gap-x-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.6fr)_minmax(0,1.4fr)_minmax(0,0.75fr)_minmax(0,0.9fr)_16px] lg:items-center rounded-2xl hover:bg-[var(--color-surface)]/60 transition-colors"
            >
                <span className="col-span-6 lg:col-span-1 min-w-0 flex items-start justify-between gap-3">
                    <span className="min-w-0">
                        <span className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate text-sm font-bold text-[var(--color-text-main)]" title={name}>{name}</span>
                            {r.current && <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider font-black bg-[var(--color-primary)] text-white cursor-help" title={tip(c, 'badge_current')}>{c.badge_current || 'Current'}</span>}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] leading-snug text-[var(--color-text-muted)]" title={rule}>{rule}</span>
                    </span>
                    <ChevronDown className={`lg:hidden size-4 mt-0.5 shrink-0 text-[var(--color-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
                </span>

                <span className="col-span-3 sm:col-span-2 lg:col-span-1 min-w-0 flex flex-col gap-1 self-center">
                    <span className="flex items-center h-7 min-w-0">
                        {pending ? (
                            <span className="inline-flex items-center gap-1.5 max-w-full h-7 px-2.5 rounded-full bg-[var(--color-surface)] text-[11px] text-[var(--color-text-muted)]">
                                <Loader2 className="size-3.5 shrink-0 animate-spin" /><span className="truncate">{c.age_pending || 'Waiting for account ages…'}</span>
                            </span>
                        ) : <OutcomePill r={r} c={c} />}
                    </span>
                    <span className="flex items-center h-4 min-w-0">
                        {r.current ? (
                            <span className="truncate text-[9px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] cursor-help" title={tip(c, 'badge_current')}>{c.badge_reference || 'Reference'}</span>
                        ) : !pending && r.sameAsCurrent === false ? (
                            <span className="inline-flex items-center gap-1 truncate text-[9px] uppercase tracking-wider font-black text-amber-600 dark:text-amber-400 cursor-help" title={tip(c, 'badge_changes')}>
                                <ArrowLeftRight className="size-2.5 shrink-0" />{c.badge_changes || 'Changes the result'}
                            </span>
                        ) : !pending && r.sameAsCurrent === true ? (
                            <span className="inline-flex items-center gap-1 truncate text-[9px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] cursor-help" title={tip(c, 'badge_same')}>
                                <Equal className="size-2.5 shrink-0" />{c.badge_same || 'Same result'}
                            </span>
                        ) : null}
                    </span>
                </span>
                <Cell className="col-span-6 sm:col-span-2 lg:col-span-1" label={c.col_support || 'In favour'} pending={pending}>
                    <SupportMeter r={r} c={c} threshold={threshold} language={language} />
                </Cell>
                <Cell className="col-span-2 lg:col-span-1" label={c.col_counted || 'Count'} pending={pending}>
                    <Fraction
                        n={r.counted}
                        of={r.counted + r.excluded}
                        title={tip(c, 'counted', { n: r.counted.toLocaleString(language), out: r.excluded.toLocaleString(language) })}
                        shareTitle={tip(c, 'counted_share', {
                            pct: formatShare(r.counted / Math.max(1, r.counted + r.excluded), language),
                            n: r.counted.toLocaleString(language), of: (r.counted + r.excluded).toLocaleString(language),
                        })}
                        language={language}
                    />
                </Cell>
                <Cell className="col-span-2 lg:col-span-1" label={c.col_nakamoto || 'Control 50 %'} pending={pending}>
                    <SpreadMeter r={r} c={c} language={language} />
                </Cell>
                <Cell className="col-span-2 lg:col-span-1" label={c.col_decisive || 'Enough to decide'} pending={pending}>
                    {d ? (
                        <Fraction
                            n={d.count}
                            of={d.of}
                            title={tip(c, 'decisive', { count: d.count.toLocaleString(language), of: d.of.toLocaleString(language), xrd: formatXrd(d.xrd, language) })}
                            shareTitle={tip(c, 'decisive_share', { pct: formatShare(d.count / Math.max(1, d.of), language), n: d.count.toLocaleString(language), of: d.of.toLocaleString(language) })}
                            language={language}
                        />
                    ) : <span className="text-xs text-[var(--color-text-muted)]">—</span>}
                </Cell>
                <Cell className="col-span-3 sm:col-span-2 lg:col-span-1 row-start-2 col-start-4 sm:row-auto sm:col-auto" label={c.col_resistance || 'Resistance'} pending={false}>
                    <ResistancePill r={r} c={c} attack={attack} language={language} />
                </Cell>
                <ChevronDown className={`hidden lg:block size-4 text-[var(--color-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && !pending && (
                <div id={panelId} className="border-t border-[var(--color-card-border)] pt-4">
                    <MethodDetail r={r} c={c} rule={rule} attack={attack} quorum={quorum} language={language} />
                </div>
            )}
        </li>
    );
}

/** "95/143" with the share underneath, as a row shows it. */
function Fraction({ n, of, title, shareTitle, language }: { n: number; of: number; title?: string; shareTitle?: string; language: string }) {
    return (
        <span className="flex flex-col leading-tight cursor-help" title={title}>
            <span className="font-mono text-sm font-bold text-[var(--color-text-main)] tabular-nums whitespace-nowrap">
                {n.toLocaleString(language)}<span className="text-[11px] font-normal text-[var(--color-text-muted)]">/{of.toLocaleString(language)}</span>
            </span>
            <span className="font-mono text-[10px] text-[var(--color-text-muted)] tabular-nums" title={shareTitle}>{of > 0 ? formatShare(n / of, language) : '—'}</span>
        </span>
    );
}

/** A figure in a method row; its label only shows where the column headers do not. */
function Cell({ label, className, pending, children }: { label: string; className: string; pending: boolean; children: React.ReactNode }) {
    return (
        <span className={`min-w-0 flex flex-col gap-1 ${className}`}>
            <span className="lg:hidden truncate text-[9px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]" title={label}>{label}</span>
            {/* Fixed height: the row does not move when the figures arrive. */}
            <span className="flex items-center h-10 min-w-0">
                {pending ? <span className="block h-2 w-full max-w-24 rounded-full bg-[var(--color-surface)] animate-pulse" aria-hidden /> : children}
            </span>
        </span>
    );
}

function Tile({ icon: Icon, label, value, hint, help }: { icon: LucideIcon; label: string; value?: string; hint?: string; help?: string }) {
    // Fixed height (two lines each for the figure and the note) so the page does not shift as figures change.
    return (
        <div className="min-w-0 flex flex-col rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-4">
            <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)] cursor-help" title={help}>
                <Icon className="size-3.5 text-[var(--color-primary)] shrink-0" /><span className="truncate">{label}</span>
                {help && <Info className="size-3 shrink-0 opacity-60" aria-hidden />}
            </span>
            <span className="mt-2 h-[2lh] line-clamp-2 text-lg font-black leading-tight break-words text-[var(--color-text-main)]" title={value}>{value || '—'}</span>
            <span className="mt-1.5 h-[2lh] line-clamp-2 text-[11px] leading-snug text-[var(--color-text-muted)]" title={hint}>{hint}</span>
        </div>
    );
}

/**
 * Comparison tab: the same ballots counted with other voting rules, what each
 * would have decided and how concentrated power is under each one.
 */
export function MethodsComparison({ entry, system, g, language, now }: {
    entry: GovernanceEntry;
    system: GovernanceSystem;
    g: G;
    language: string;
    now: number;
}) {
    const { item, kind, id } = entry;
    const c: C = g.compare ?? {};
    const gv: Gv = g.vote ?? {};
    const stances = (gv.stances ?? {}) as Record<string, string>;
    const choices = itemChoices(kind, item, s => stances[s] || s);
    const [family, setFamily] = useState<MethodFamily | 'all'>('all');

    // Same query as the result tab: switching tabs does not ask again.
    const tallyQuery = useGovernanceTally({ component: system.component, kind, itemId: id, voters: true }, system.network);
    const rows = tallyQuery.data?.voters ?? [];
    const counted = rows.filter(v => v.votePower !== null && Number(v.votePower) > 0);
    // Account age is measured on the day the vote opened.
    const at = item.start ?? now;
    const ages = useAccountAges(counted.map(v => v.account), system.network, at, counted.length > 0);
    const voters: MethodVoter[] = counted.map(v => ({
        account: v.account,
        choices: v.choices,
        power: Number(v.votePower),
        ageDays: ages.years.has(v.account) ? (ages.years.get(v.account) as number) * 365 : null,
    }));
    const results = voters.length ? compareMethods(voters, choices, item) : [];
    const params = ruleParams(language);
    const pending = rows.length - counted.length;

    if (tallyQuery.isLoading) return <div className="h-64 rounded-2xl bg-[var(--color-surface)] animate-pulse" aria-hidden />;
    if (!results.length) {
        return (
            <p className="flex items-center gap-2 rounded-2xl border border-dashed border-[var(--color-card-border)] p-5 text-sm text-[var(--color-text-muted)]">
                <Info className="size-4 shrink-0" />{c.empty || 'There are no weighed votes to compare yet.'}
            </p>
        );
    }

    const ready = results.filter(r => !(r.needsAge && !ages.done) && r.counted > 0);
    const current = results.find(r => r.current)!;
    const others = ready.filter(r => !r.current);
    const same = others.filter(r => r.sameAsCurrent).length;
    // Ranked by how spread out the weight is, so a method is not favoured just because more addresses count under it.
    // On a tie the method listed first wins (the current one before the rules that weigh just like it).
    // Rounded so float noise (0.9999… against 1) never breaks a real tie.
    const spreadOf = (r: MethodResult) => Math.round((r.concentration.spread ?? 0) * 1e6) / 1e6;
    const most = ready.reduce<MethodResult | undefined>((best, r) => (!best || spreadOf(r) > spreadOf(best) ? r : best), undefined);
    const least = ready.reduce<MethodResult | undefined>((best, r) => (!best || spreadOf(r) < spreadOf(best) ? r : best), undefined);
    const shown = results.filter(r => family === 'all' || r.family === family);
    const unknownAges = ages.done ? voters.filter(v => v.ageDays === null).length : 0;
    const name = (r: MethodResult) => methodText(c, r.key, params).name;
    const balance = balanceExtremes(ready);
    const balanceHint = (r: MethodResult) => fill(c.kpi_balance_hint || '{resistance} resistance · {n} of {of} addresses hold half ({pct} decentralisation)', {
        resistance: (((c.resistance ?? {}) as Record<string, string>)[r.resistance] || r.resistance).toLowerCase(),
        n: (r.concentration.nakamoto ?? 0).toLocaleString(language),
        of: r.counted.toLocaleString(language),
        pct: formatPct(r.concentration.spread ?? 0, language),
    });

    return (
        <div className="space-y-6">
            <section className="relative overflow-hidden rounded-3xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5 sm:p-7">
                <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-[var(--color-primary)]/10 blur-3xl" aria-hidden />
                <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                    {/* The text spreads over the tiles' height: the age bar lines up with their bottom edge. */}
                    <div className="min-w-0 flex flex-col justify-between gap-5">
                        <div className="min-w-0">
                            <span className="grid place-items-center size-12 rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                                <Scale className="size-6" />
                            </span>
                            <h2 className="mt-4 text-xl md:text-2xl font-black text-[var(--color-text-main)]">{c.heading || 'What would another voting method have decided?'}</h2>
                            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">{c.intro}</p>
                        </div>
                        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {[
                                [Users, c.fact_voters || 'Voters', current.counted.toLocaleString(language), tip(c, 'fact_voters')],
                                [Coins, c.fact_xrd || 'XRD that voted', `${formatXrd(current.eligibleXrd, language)}`, tip(c, 'fact_xrd')],
                                [Target, c.fact_quorum || 'Quorum', item.quorum === null ? '—' : formatXrd(item.quorum, language), tip(c, 'fact_quorum')],
                                [BadgeCheck, c.fact_threshold || 'Threshold', item.approvalThreshold === null ? '—' : formatPct(item.approvalThreshold, language), tip(c, 'fact_threshold')],
                                // Addresses behind each option, as they voted.
                                ...current.rows.filter(x => x.power > 0 || x.tone !== 'neutral').map(x => {
                                    const n = current.addressesByChoice[x.key] ?? 0;
                                    return [TONE[x.tone].icon, x.label, n.toLocaleString(language), tip(c, 'fact_option', {
                                        n: n.toLocaleString(language), label: x.label, pct: formatShare(n / Math.max(1, current.counted), language),
                                    }), TONE[x.tone].text] as const;
                                }),
                            ].map(([Icon, label, value, title, tone]) => {
                                const I = Icon as LucideIcon;
                                return (
                                    <div key={label as string} className="min-w-0 rounded-xl border border-[var(--color-card-border)] px-3 py-2 cursor-help" title={title as string | undefined}>
                                        <dt className={`flex items-center gap-1 text-[9px] uppercase font-bold tracking-widest ${tone ?? 'text-[var(--color-text-muted)]'}`}>
                                            <I className={`size-3 shrink-0 ${tone ?? 'text-[var(--color-primary)]'}`} /><span className="truncate">{label as string}</span>
                                        </dt>
                                        <dd className="mt-0.5 font-mono text-sm font-bold text-[var(--color-text-main)] truncate">{value as string}</dd>
                                    </div>
                                );
                            })}
                        </dl>
                        <div className="rounded-2xl bg-[var(--color-surface)] px-4 py-3">
                            <p className="flex items-center gap-2 h-4 text-xs font-semibold text-[var(--color-text-secondary)]">
                                {ages.done
                                    ? <Hourglass className="size-3.5 shrink-0 text-[var(--color-primary)]" />
                                    : <Loader2 className="size-3.5 shrink-0 animate-spin text-[var(--color-primary)]" />}
                                <span className="truncate">
                                    {fill(ages.done ? (c.age_done || 'Age read on the ledger for {total} accounts') : (c.age_loading || 'Reading the age of each account on the ledger: {n} of {total}'), {
                                        n: ages.loaded.toLocaleString(language), total: ages.total.toLocaleString(language),
                                    })}
                                </span>
                            </p>
                            <div className="mt-2 h-1.5 rounded-full bg-[var(--color-card-border)] overflow-hidden">
                                <div className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-500" style={{ width: `${ages.total ? (ages.loaded / ages.total) * 100 : 100}%` }} />
                            </div>
                        </div>
                    </div>
                    {/* In pairs: result and today, centralisation, balance. */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Tile
                            icon={Equal}
                            help={tip(c, 'kpi_consensus')}
                            label={c.kpi_consensus || 'Same result'}
                            value={fill(c.kpi_consensus_value || '{n} of {total}', { n: same.toLocaleString(language), total: others.length.toLocaleString(language) })}
                            hint={same === others.length
                                ? c.kpi_consensus_all
                                : others.length - same === 1
                                    ? c.kpi_consensus_hint_one
                                    : fill(c.kpi_consensus_hint || '{changed} methods would have changed the result', { changed: (others.length - same).toLocaleString(language) })}
                        />
                        <Tile
                            icon={PieChart}
                            help={tip(c, 'kpi_current')}
                            label={c.kpi_current || 'Today (1 XRD = 1 vote)'}
                            value={fill(c.kpi_addresses || '{n} addresses', { n: (current.concentration.nakamoto ?? 0).toLocaleString(language) })}
                            hint={fill(c.kpi_current_hint || 'hold more than half of the weight, out of {total}', { total: current.counted.toLocaleString(language) })}
                        />
                        <Tile
                            icon={Network}
                            help={tip(c, 'kpi_most_spread')}
                            label={c.kpi_most_spread || 'Most decentralised'}
                            value={most ? name(most) : undefined}
                            hint={most ? fill(c.kpi_spread_hint || '{n} addresses needed for half of the weight', { n: (most.concentration.nakamoto ?? 0).toLocaleString(language), pct: formatPct(most.concentration.spread ?? 0, language) }) : undefined}
                        />
                        <Tile
                            icon={Crown}
                            help={tip(c, 'kpi_most_concentrated')}
                            label={c.kpi_most_concentrated || 'Most centralised'}
                            value={least ? name(least) : undefined}
                            hint={least ? fill(c.kpi_spread_hint || '{n} addresses needed for half of the weight', { n: (least.concentration.nakamoto ?? 0).toLocaleString(language), pct: formatPct(least.concentration.spread ?? 0, language) }) : undefined}
                        />
                        <Tile
                            icon={Gauge}
                            help={tip(c, 'kpi_balanced')}
                            label={c.kpi_balanced || 'Most balanced'}
                            value={balance.most ? name(balance.most) : undefined}
                            hint={balance.most ? balanceHint(balance.most) : undefined}
                        />
                        <Tile
                            icon={TriangleAlert}
                            help={tip(c, 'kpi_unbalanced')}
                            label={c.kpi_unbalanced || 'Least balanced'}
                            value={balance.least ? name(balance.least) : undefined}
                            hint={balance.least ? balanceHint(balance.least) : undefined}
                        />
                    </div>
                </div>
            </section>

            <section aria-labelledby="methods-list" className="@container space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 id="methods-list" className="text-sm font-bold text-[var(--color-text-main)]">{fill(c.list_title || '{n} ways to count the same votes', { n: METHODS.length.toLocaleString(language) })}</h3>
                    <div role="group" aria-label={c.filter_label || 'Method family'} className="grid grid-cols-5 gap-1 w-full @xl:w-[580px] shrink-0 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] p-1">
                        {(['all', ...FAMILIES] as const).map(f => {
                            const Icon = f === 'all' ? Scale : FAMILY_ICON[f];
                            const label = f === 'all' ? (c.filter_all || 'All') : ((c.families ?? {}) as Record<string, string>)[f] || f;
                            // A short word keeps the box compact; the full name shows on hover.
                            const short = ((c.families_short ?? {}) as Record<string, string>)[f] || label;
                            return (
                                <button
                                    key={f}
                                    type="button"
                                    aria-pressed={family === f}
                                    aria-label={label}
                                    title={f === 'all' ? tip(c, 'filter_all', { n: METHODS.length.toLocaleString(language) }) : `${label}: ${((c.family_hints ?? {}) as Record<string, string>)[f]}`}
                                    onClick={() => setFamily(f)}
                                    className={`min-w-0 h-8 inline-flex items-center justify-center gap-1.5 px-2 rounded-lg text-xs font-semibold transition-colors ${family === f ? 'bg-[var(--color-card-bg)] text-[var(--color-primary)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                >
                                    <Icon className="size-3.5 shrink-0" /><span className="hidden @xl:inline truncate">{short}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="hidden lg:grid px-5 pt-3 gap-x-5 grid-cols-[minmax(0,1.8fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.6fr)_minmax(0,1.4fr)_minmax(0,0.75fr)_minmax(0,0.9fr)_16px] text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">
                    <span className="cursor-help" title={tip(c, 'col_method')}>{c.col_method || 'Method'}</span>
                    <span className="cursor-help" title={tip(c, 'col_result')}>{c.col_result || 'Result'}</span>
                    <span className="cursor-help" title={tip(c, 'col_support')}>{c.col_support || 'In favour'}</span>
                    <span className="cursor-help" title={tip(c, 'col_counted')}>{c.col_counted || 'Count'}</span>
                    <span className="cursor-help" title={tip(c, 'col_nakamoto')}>{c.col_nakamoto || 'Control 50 %'}</span>
                    <span className="cursor-help" title={tip(c, 'col_decisive')}>{c.col_decisive || 'Enough to decide'}</span>
                    <span className="cursor-help" title={tip(c, 'col_resistance')}>{c.col_resistance || 'Resistance'}</span>
                    <span />
                </div>

                {FAMILIES.filter(f => shown.some(r => r.family === f)).map(f => {
                    const Icon = FAMILY_ICON[f];
                    return (
                        <div key={f} className="space-y-2">
                            <p className="flex items-center gap-2 pt-2 text-[11px] font-bold text-[var(--color-text-secondary)]">
                                <Icon className="size-3.5 text-[var(--color-primary)]" />
                                {((c.families ?? {}) as Record<string, string>)[f] || f}
                                <span className="font-normal text-[var(--color-text-muted)] hidden sm:inline">· {((c.family_hints ?? {}) as Record<string, string>)[f]}</span>
                            </p>
                            <ul className="space-y-2">
                                {shown.filter(r => r.family === f).map(r => (
                                    <MethodRow key={r.key} r={r} c={c} params={params} threshold={item.approvalThreshold} quorum={item.quorum} ageLoading={!ages.done} language={language} />
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </section>

            <section aria-labelledby="methods-glossary" className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5">
                <h3 id="methods-glossary" className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-main)]">
                    <Info className="size-4 text-[var(--color-primary)]" />{c.glossary_title || 'How to read it'}
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
                                <span className={`font-bold ${RESISTANCE_STYLE[l].cls.split(' ')[0]}`}>{fill(c.resistance_legend || 'Resistance {level}', { level: ((c.resistance ?? {}) as Record<string, string>)[l] || l })}</span>
                                {((c.resistance_hints ?? {}) as Record<string, string>)[l]}
                            </span>
                        );
                    })}
                </div>
            </section>

            <div className="space-y-1.5">
                {[
                    c.note_hypothetical,
                    pending > 0 ? fill(c.note_pending || '{n} recent votes are not weighed yet and are left out.', { n: pending.toLocaleString(language) }) : null,
                    unknownAges > 0 ? fill(c.note_unknown_age || 'The age of {n} accounts could not be read; age rules leave them out.', { n: unknownAges.toLocaleString(language) }) : null,
                ].filter(Boolean).map((text, i) => (
                    <p key={i} className="flex items-start gap-1.5 text-[11px] leading-snug text-[var(--color-text-muted)]">
                        <Info className="size-3 mt-0.5 shrink-0" />{text}
                    </p>
                ))}
            </div>
        </div>
    );
}
