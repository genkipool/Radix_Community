'use client';

import React, { useId, useState } from 'react';
import {
    Scale, Coins, Users, Hourglass, ChevronDown, BadgeCheck, XCircle, Info, Loader2,
    Equal, ArrowLeftRight, PieChart, Target, Crown, Network, Gauge, TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { GovernanceSystem } from '../config/systems';
import type { GovernanceEntry } from '../types';
import { useGovernanceTally } from '../hooks/useGovernanceTally';
import { toMethodVoters, useAccountAges } from '../hooks/useAccountAges';
import { itemChoices } from '../lib/governanceVotes';
import {
    METHODS, balanceExtremes, compareMethods, concentrationLevel, effectiveExtremes, spreadExtremes,
    type MethodFamily, type MethodResult,
} from '../lib/votingMethods';
import { fill, formatPct, formatShare, formatXrd } from '../lib/format';
import { TONE } from './VoteParts';
import { stanceResolver, type G } from './GovernanceBadges';
import { useRegisterTabExport, type RegisterTabExport } from './JsonExportPill';
import {
    RESISTANCE_STYLE,
    ruleParams, tip, methodText, matchesMethodQuery, resistanceTooltip, formatBalanceHint, nextSort, sortComparisonRows,
    OutcomeBadge, ComparisonTile, ComparisonCell, ConcentrationBar, FamilyFilterBar, MethodSearchInput, SortableHeaderButton, ComparisonGlossary,
    ProgressBar, FractionCell, SpreadMeterBar, DetailStatBox, FactTile, ResistanceCallout, GroupedMethodList,
    type CompareDict, type Params, type SortState,
} from './ComparisonParts';

type C = CompareDict;

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
    // Exact amounts, in full: no compact notation and no rounding beyond cents.
    const amount = (n: number) => n.toLocaleString(language, { maximumFractionDigits: 2 });
    const values = {
        xrd: amount(a.xrd),
        addresses: a.addresses.toLocaleString(language),
        each: amount(a.addresses ? a.xrd / a.addresses : 0),
        years: yearsText(c, a.years, language),
        pct: r.eligibleXrd > 0 ? formatShare(a.xrd / r.eligibleXrd, language) : '—',
    };
    // Rules gamed with many small addresses are priced per address; the rest in XRD.
    if (a.perAddress) return fill(a.years ? (c.cost_addresses_aged || '') : (c.cost_addresses || ''), values);
    if (a.years) return fill(a.addresses > 1 ? (c.cost_capital_split_aged || c.cost_capital_aged || '') : (c.cost_capital_aged || ''), values);
    return fill(a.addresses > 1 ? (c.cost_capital_split || '') : (c.cost_capital || ''), values);
}

function ResistancePill({ r, c, attack, language }: { r: MethodResult; c: C; attack: string; language: string }) {
    const { icon: Icon, cls } = RESISTANCE_STYLE[r.resistance];
    const label = ((c.resistance ?? {}) as Record<string, string>)[r.resistance] || r.resistance;
    const title = resistanceTooltip(c, r.resistance, attack, `${c.resistance_here || 'In this vote'}: ${attackText(r, c, language)}`);
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
    return <OutcomeBadge outcome={r.outcome} winnerLabel={r.winner?.label ?? null} counted={r.counted} c={c} />;
}

/** Share in favour with the pass line; on a ballot with no sides, the winner's share. */
function SupportMeter({ r, c, threshold, language }: { r: MethodResult; c: C; threshold: number | null; language: string }) {
    const hasSides = r.approvalShare !== null;
    const ratio = hasSides ? r.approvalShare ?? 0 : r.winner?.share ?? 0;
    const ok = hasSides ? threshold === null || ratio >= threshold : true;
    if (r.counted === 0) return <span className="text-xs text-[var(--color-text-muted)] cursor-help" title={tip(c, 'outcome_none') || c.outcome_none}>—</span>;
    const title = hasSides
        ? tip(c, 'support', { pct: formatPct(ratio, language), threshold: threshold === null ? '—' : formatPct(threshold, language) })
        : tip(c, 'support_winner', { pct: formatPct(ratio, language), label: r.winner?.label ?? '' });
    const showThreshold = hasSides && threshold !== null;
    return (
        <span className="flex flex-col gap-1.5 w-full cursor-help" title={title}>
            {/* The share in favour on the left; the threshold on the right, marked with the same tick as the bar. */}
            <span className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-xs font-bold text-[var(--color-text-main)] tabular-nums">{formatPct(ratio, language)}</span>
                {showThreshold && (
                    <span className="inline-flex items-baseline gap-1 text-[10px] text-[var(--color-text-muted)] tabular-nums" title={tip(c, 'threshold_mark', { pct: formatPct(threshold, language) })}>
                        <span className="self-center w-0.5 h-2.5 rounded-full bg-[var(--color-text-main)]" aria-hidden />
                        <span>{fill(c.threshold_short || 'threshold {pct}', { pct: formatPct(threshold, language) })}</span>
                    </span>
                )}
            </span>
            <span className="relative h-2 rounded-full bg-[var(--color-card-border)]">
                <span className={`absolute inset-y-0 left-0 rounded-full ${ok ? TONE.positive.bar : TONE.negative.bar}`} style={{ width: `${Math.min(1, ratio) * 100}%` }} />
                {showThreshold && (
                    <span className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-[var(--color-text-main)]" style={{ left: `calc(${threshold * 100}% - 1px)` }} aria-hidden />
                )}
            </span>
        </span>
    );
}

/** Voters controlling half the weight, against the most possible (everyone weighing the same). */
function SpreadMeter({ r, c, language }: { r: MethodResult; c: C; language: string }) {
    const { nakamoto, spread } = r.concentration;
    const level = concentrationLevel(r.concentration);
    const levels = (c.levels ?? {}) as Record<string, string>;
    const title = nakamoto !== null && spread !== null && level
        ? tip(c, 'nakamoto', {
            n: nakamoto.toLocaleString(language), of: r.counted.toLocaleString(language), share: formatPct(nakamoto / r.counted, language),
            eff: r.concentration.effective.toLocaleString(language, { maximumFractionDigits: 1 }), spread: formatPct(spread, language), level: levels[level] || level,
        })
        : undefined;
    return <SpreadMeterBar nakamoto={nakamoto} spread={spread} title={title} emptyTitle={tip(c, 'outcome_none') || c.outcome_none} c={c} language={language} />;
}

/** Everything behind one rule's figures. */
function MethodDetail({ r, c, rule, attack, quorum, threshold, language }: { r: MethodResult; c: C; rule: string; attack: string; quorum: number | null; threshold: number | null; language: string }) {
    const d = r.decisive;
    // The bars show shares of all the weight, abstentions included; the threshold counts only for and against,
    // so the mark sits where the bar in favour has to reach: threshold × (for + against) / total.
    const decisiveShare = r.rows.filter(x => x.tone !== 'neutral').reduce((sum, x) => sum + x.share, 0);
    const thresholdMark = threshold !== null && r.approvalShare !== null && decisiveShare > 0 ? threshold * decisiveShare : null;
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
                                            {/* The threshold on the row whose bar carries its tick. */}
                                            {x.tone === 'positive' && thresholdMark !== null && threshold !== null && (
                                                <span className="inline-flex items-baseline gap-1 mr-1 text-[10px] text-[var(--color-text-muted)] tabular-nums cursor-help" title={tip(c, 'threshold_mark', { pct: formatPct(threshold, language) })}>
                                                    <span className="self-center w-0.5 h-2.5 rounded-full bg-[var(--color-text-main)]" aria-hidden />
                                                    <span>{fill(c.threshold_short || 'threshold {pct}', { pct: formatPct(threshold, language) })}</span>
                                                </span>
                                            )}
                                            <span className="text-[11px] text-[var(--color-text-muted)]">{addressesText(c, r.addressesByChoice[x.key] ?? 0, language)}</span>
                                            <span className="font-mono font-bold text-[var(--color-text-main)] w-12 text-right">{formatPct(x.share, language)}</span>
                                        </span>
                                    </div>
                                    <div className="relative mt-1 h-1.5 rounded-full bg-[var(--color-card-border)]">
                                        <div className={`h-full rounded-full ${TONE[x.tone].bar}`} style={{ width: `${x.share * 100}%` }} />
                                        {x.tone === 'positive' && thresholdMark !== null && (
                                            <span className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-[var(--color-text-main)]" style={{ left: `calc(${Math.min(1, thresholdMark) * 100}% - 1px)` }} aria-hidden />
                                        )}
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
                        <ConcentrationBar top1={r.concentration.top1} top10={r.concentration.top10} c={c} language={language} />
                    </div>
                )}
            </div>
            <div className="flex flex-col justify-between gap-4 min-w-0">
                <div className="grid grid-cols-2 gap-2">
                    <DetailStatBox label={c.detail_counted || 'Addresses that count'} title={tip(c, 'detail_counted')}>
                        {/* "115/120 (5 do not count)": the ones that count out of everyone who voted. */}
                        {r.counted.toLocaleString(language)}/{(r.counted + r.excluded).toLocaleString(language)}
                        {r.excluded > 0 && (
                            <span className="ml-1 text-xs font-normal text-[var(--color-text-muted)]">
                                {fill(r.excluded === 1 ? (c.detail_excluded_one || '(1 does not count)') : (c.detail_excluded || '({n} do not count)'), { n: r.excluded.toLocaleString(language) })}
                            </span>
                        )}
                    </DetailStatBox>
                    <DetailStatBox label={c.detail_effective || 'Effective voters'} title={tip(c, 'detail_effective', { n: r.concentration.effective.toLocaleString(language, { maximumFractionDigits: 1 }), of: r.counted.toLocaleString(language) })}>
                        {r.concentration.effective ? (
                            <>
                                {r.concentration.effective.toLocaleString(language, { maximumFractionDigits: 1 })}
                                <span className="ml-1 text-xs font-normal text-[var(--color-text-muted)]">{fill(c.of_n || 'of {n}', { n: r.counted.toLocaleString(language) })}</span>
                            </>
                        ) : '—'}
                    </DetailStatBox>
                    <DetailStatBox label={c.detail_quorum || 'Quorum'} title={tip(c, 'detail_quorum')}>
                        {quorum === null ? '—' : (
                            <span className={r.quorumMet ? 'text-[var(--color-accent)]' : 'text-amber-600 dark:text-amber-400'}>
                                {fill(c.detail_quorum_value || '{xrd} of {quorum} XRD', { xrd: formatXrd(r.eligibleXrd, language), quorum: formatXrd(quorum, language) })}
                            </span>
                        )}
                    </DetailStatBox>
                    <DetailStatBox label={c.detail_spread || 'Decentralisation'} title={tip(c, 'detail_spread')}>
                        {r.concentration.spread === null ? '—' : fill(c.detail_spread_value || '{pct} ({eff} of {of})', {
                            pct: formatPct(r.concentration.spread, language),
                            eff: r.concentration.effective.toLocaleString(language, { maximumFractionDigits: 1 }),
                            of: r.counted.toLocaleString(language),
                        })}
                    </DetailStatBox>
                </div>
                {d ? (
                    <p className="flex items-start gap-2 rounded-xl border border-[var(--color-primary)]/25 bg-[var(--color-primary)]/5 p-3 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                        <Target className="size-4 mt-0.5 shrink-0 text-[var(--color-primary)]" />
                        <span>{fill(c.detail_decisive || '', {
                            count: d.count.toLocaleString(language),
                            of: r.counted.toLocaleString(language),
                            pct: r.counted > 0 ? formatShare(d.count / r.counted, language) : '—',
                            side: sideLabel,
                            xrd: formatXrd(d.xrd, language),
                        })}</span>
                    </p>
                ) : (
                    <p className="flex items-start gap-2 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] p-3 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                        <Info className="size-4 mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
                        <span>{r.counted === 0 ? c.detail_nobody : c.detail_no_quorum}</span>
                    </p>
                )}
            </div>
            <ResistanceCallout resistance={r.resistance} pill={<ResistancePill r={r} c={c} attack={attack} language={language} />}>
                <div className="min-w-0 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                    <p><span className="font-bold text-[var(--color-text-main)]">{c.detail_attack || 'How it could be gamed'}: </span>{attack}</p>
                    <p className="mt-1 font-semibold text-[var(--color-text-main)]">{attackText(r, c, language)}</p>
                </div>
            </ResistanceCallout>
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
                            <span className="inline-flex items-center gap-1.5 max-w-full h-7 px-2.5 rounded-full bg-[var(--color-surface)] text-[11px] text-[var(--color-text-muted)]" title={c.age_pending || 'Waiting for account ages…'}>
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
                <ComparisonCell className="col-span-6 sm:col-span-2 lg:col-span-1" label={c.col_support || 'In favour'} pending={pending}>
                    <SupportMeter r={r} c={c} threshold={threshold} language={language} />
                </ComparisonCell>
                <ComparisonCell className="col-span-2 lg:col-span-1" label={c.col_counted || 'Count'} pending={pending}>
                    <FractionCell
                        n={r.counted}
                        of={r.counted + r.excluded}
                        title={tip(c, 'counted', { n: r.counted.toLocaleString(language), out: r.excluded.toLocaleString(language) })}
                        shareTitle={tip(c, 'counted_share', {
                            pct: formatShare(r.counted / Math.max(1, r.counted + r.excluded), language),
                            n: r.counted.toLocaleString(language), of: (r.counted + r.excluded).toLocaleString(language),
                        })}
                        language={language}
                    />
                </ComparisonCell>
                <ComparisonCell className="col-span-2 lg:col-span-1" label={c.col_nakamoto || 'Control 50 %'} pending={pending}>
                    <SpreadMeter r={r} c={c} language={language} />
                </ComparisonCell>
                <ComparisonCell className="col-span-2 lg:col-span-1" label={c.col_decisive || 'Enough to decide'} pending={pending}>
                    {d ? (
                        <FractionCell
                            n={d.count}
                            of={d.of}
                            title={tip(c, 'decisive', { count: d.count.toLocaleString(language), of: d.of.toLocaleString(language), xrd: formatXrd(d.xrd, language) })}
                            shareTitle={tip(c, 'decisive_share', { pct: formatShare(d.count / Math.max(1, d.of), language), n: d.count.toLocaleString(language), of: d.of.toLocaleString(language) })}
                            language={language}
                        />
                    ) : <span className="text-xs text-[var(--color-text-muted)] cursor-help" title={r.counted === 0 ? c.detail_nobody : c.detail_no_quorum}>—</span>}
                </ComparisonCell>
                <ComparisonCell className="col-span-3 sm:col-span-2 lg:col-span-1 row-start-2 col-start-4 sm:row-auto sm:col-auto" label={c.col_resistance || 'Resistance'} pending={false}>
                    <ResistancePill r={r} c={c} attack={attack} language={language} />
                </ComparisonCell>
                <ChevronDown className={`hidden lg:block size-4 text-[var(--color-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && !pending && (
                <div id={panelId} className="border-t border-[var(--color-card-border)] pt-4">
                    <MethodDetail r={r} c={c} rule={rule} attack={attack} quorum={quorum} threshold={threshold} language={language} />
                </div>
            )}
        </li>
    );
}

/**
 * Comparison tab: the same ballots counted with other voting rules, what each
 * would have decided and how concentrated power is under each one.
 */
export function MethodsComparison({ entry, system, g, language, now, onRegisterExport }: {
    entry: GovernanceEntry;
    system: GovernanceSystem;
    g: G;
    language: string;
    now: number;
    onRegisterExport?: RegisterTabExport;
}) {
    const { item, kind, id } = entry;
    const c: C = g.compare ?? {};
    const choices = itemChoices(kind, item, stanceResolver(g));
    const [family, setFamily] = useState<MethodFamily | 'all'>('all');
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<SortState>(null);

    // Same query as the result tab: switching tabs does not ask again.
    const tallyQuery = useGovernanceTally({ component: system.component, kind, itemId: id, voters: true }, system.network);
    const rows = tallyQuery.data?.voters ?? [];
    const counted = rows.filter(v => v.votePower !== null && Number(v.votePower) > 0);
    // Account age is measured on the day the vote opened.
    const at = item.start ?? now;
    const ages = useAccountAges(counted.map(v => v.account), system.network, at, counted.length > 0);
    const voters = toMethodVoters(counted, ages);
    const results = voters.length ? compareMethods(voters, choices, item) : [];
    const params = ruleParams(language);
    const pending = rows.length - counted.length;

    useRegisterTabExport(onRegisterExport, () => {
        const currentResult = results.find(r => r.current);
        const readyResults = results.filter(r => !(r.needsAge && !ages.done) && r.counted > 0);
        const otherResults = readyResults.filter(r => !r.current);
        return {
            tab: 'compare',
            exportedAt: new Date().toISOString(),
            system: {
                key: system.key,
                name: system.name,
                network: system.network,
                component: system.component,
            },
            vote: {
                kind,
                id,
                title: item.title,
                start: item.start,
                deadline: item.deadline,
                quorum: item.quorum,
                approvalThreshold: item.approvalThreshold,
            },
            filters: { family, query, sort },
            summary: {
                totalVoters: rows.length,
                countedVoters: currentResult?.counted ?? 0,
                pendingVoters: pending,
                eligibleXrd: currentResult?.eligibleXrd ?? 0,
                agesLoaded: ages.loaded,
                agesTotal: ages.total,
                agesDone: ages.done,
                unknownAges: ages.done ? voters.filter(v => v.ageDays === null).length : 0,
                sameOutcomeCount: otherResults.filter(r => r.sameAsCurrent).length,
                comparedMethodsCount: otherResults.length,
            },
            methods: results,
        };
    });

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
    const { most, least } = spreadExtremes(ready, r => r.concentration.spread);
    const outcomeLabel = (r: MethodResult) => (
        r.counted === 0 ? c.outcome_none
            : r.outcome === 'approved' ? c.outcome_approved
                : r.outcome === 'rejected' ? c.outcome_rejected
                    : r.outcome === 'no_quorum' ? c.outcome_no_quorum
                        : r.winner?.label
    );
    const shown = results.filter(r =>
        (family === 'all' || r.family === family)
        && matchesMethodQuery(c, {
            key: r.key,
            family: r.family,
            resistance: r.resistance,
            spread: r.concentration.spread,
            nakamoto: r.concentration.nakamoto,
            extra: [
                outcomeLabel(r),
                r.current ? c.badge_current : r.sameAsCurrent === false ? c.badge_changes : r.sameAsCurrent === true ? c.badge_same : undefined,
            ],
        }, params, query));
    const sortedShown = sortComparisonRows(shown, sort, r => r.concentration.spread, r => r.resistance);
    const unknownAges = ages.done ? voters.filter(v => v.ageDays === null).length : 0;
    const name = (r: MethodResult) => methodText(c, r.key, params).name;
    const balance = balanceExtremes(ready);
    const effective = effectiveExtremes(ready);
    const balanceHint = (r: MethodResult) =>
        formatBalanceHint(c, r.resistance, r.concentration.nakamoto, r.counted, r.concentration.spread, language);
    const effectiveHint = (r: MethodResult) => fill(c.kpi_effective_hint || '', {
        resistance: (((c.resistance ?? {}) as Record<string, string>)[r.resistance] || r.resistance).toLowerCase(),
        pct: formatPct(r.concentration.spread ?? 0, language),
        quorum: r.quorumMet === null ? (c.kpi_quorum_none || '') : r.quorumMet ? (c.kpi_quorum_ok || '') : (c.kpi_quorum_ko || ''),
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
                        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
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
                            ].map(([Icon, label, value, title, tone]) => (
                                <FactTile
                                    key={label as string}
                                    icon={Icon as LucideIcon}
                                    label={label as string}
                                    value={value as string}
                                    title={title as string | undefined}
                                    tone={tone as string | undefined}
                                />
                            ))}
                        </dl>
                        <ProgressBar
                            done={ages.done}
                            icon={Hourglass}
                            label={fill(ages.done ? (c.age_done || 'Age read on the ledger for {total} accounts') : (c.age_loading || 'Reading the age of each account on the ledger: {n} of {total}'), {
                                n: ages.loaded.toLocaleString(language), total: ages.total.toLocaleString(language),
                            })}
                            ratio={ages.total ? ages.loaded / ages.total : 1}
                        />
                    </div>
                    {/* In pairs: result and today, centralisation, balance. */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <ComparisonTile
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
                        <ComparisonTile
                            icon={PieChart}
                            help={tip(c, 'kpi_current')}
                            label={c.kpi_current || 'Today (1 XRD = 1 vote)'}
                            value={fill(c.kpi_addresses || '{n} addresses', { n: (current.concentration.nakamoto ?? 0).toLocaleString(language) })}
                            hint={fill(c.kpi_current_hint || 'hold more than half of the weight, out of {total}', { total: current.counted.toLocaleString(language) })}
                        />
                        <ComparisonTile
                            icon={Network}
                            help={tip(c, 'kpi_most_spread')}
                            label={c.kpi_most_spread || 'Most decentralised'}
                            value={most ? name(most) : undefined}
                            hint={most ? fill(c.kpi_spread_hint || '{n} addresses needed for half of the weight', { n: (most.concentration.nakamoto ?? 0).toLocaleString(language), pct: formatPct(most.concentration.spread ?? 0, language) }) : undefined}
                        />
                        <ComparisonTile
                            icon={Crown}
                            help={tip(c, 'kpi_most_concentrated')}
                            label={c.kpi_most_concentrated || 'Most centralised'}
                            value={least ? name(least) : undefined}
                            hint={least ? fill(c.kpi_spread_hint || '{n} addresses needed for half of the weight', { n: (least.concentration.nakamoto ?? 0).toLocaleString(language), pct: formatPct(least.concentration.spread ?? 0, language) }) : undefined}
                        />
                        <ComparisonTile
                            icon={Gauge}
                            help={tip(c, 'kpi_balanced')}
                            label={c.kpi_balanced || 'Most balanced'}
                            value={balance.most ? name(balance.most) : undefined}
                            hint={balance.most ? balanceHint(balance.most) : undefined}
                        />
                        <ComparisonTile
                            icon={TriangleAlert}
                            help={tip(c, 'kpi_unbalanced')}
                            label={c.kpi_unbalanced || 'Least balanced'}
                            value={balance.least ? name(balance.least) : undefined}
                            hint={balance.least ? balanceHint(balance.least) : undefined}
                        />
                        <ComparisonTile
                            icon={BadgeCheck}
                            help={tip(c, 'kpi_effective')}
                            label={c.kpi_effective || ''}
                            value={effective.most ? name(effective.most) : undefined}
                            hint={effective.most ? effectiveHint(effective.most) : undefined}
                        />
                        <ComparisonTile
                            icon={XCircle}
                            help={tip(c, 'kpi_ineffective')}
                            label={c.kpi_ineffective || ''}
                            value={effective.least ? name(effective.least) : undefined}
                            hint={effective.least ? effectiveHint(effective.least) : undefined}
                        />
                    </div>
                </div>
            </section>

            <section aria-labelledby="methods-list" className="@container space-y-3">
                <div className="space-y-2.5">
                    <h3 id="methods-list" className="text-sm font-bold text-[var(--color-text-main)]">{fill(c.list_title || '{n} ways to count the same votes', { n: METHODS.length.toLocaleString(language) })}</h3>
                    <div className="flex flex-col @xl:flex-row @xl:items-center gap-3">
                        <MethodSearchInput value={query} onChange={setQuery} placeholder={c.search_placeholder || ''} clearLabel={c.search_clear || ''} shownCount={shown.length} totalCount={results.length} />
                        <FamilyFilterBar family={family} onChange={setFamily} c={c} language={language} />
                    </div>
                </div>

                <div className="hidden lg:grid px-5 pt-3 gap-x-5 grid-cols-[minmax(0,1.8fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.6fr)_minmax(0,1.4fr)_minmax(0,0.75fr)_minmax(0,0.9fr)_16px] text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">
                    <span className="cursor-help" title={tip(c, 'col_method')}>{c.col_method || 'Method'}</span>
                    <span className="cursor-help" title={tip(c, 'col_result')}>{c.col_result || 'Result'}</span>
                    <span className="cursor-help" title={tip(c, 'col_support')}>{c.col_support || 'In favour'}</span>
                    <span className="cursor-help" title={tip(c, 'col_counted')}>{c.col_counted || 'Count'}</span>
                    <SortableHeaderButton
                        label={c.col_nakamoto || 'Control 50 %'}
                        title={tip(c, 'col_nakamoto')}
                        active={sort?.by === 'spread'}
                        dir={sort?.by === 'spread' ? sort.dir : undefined}
                        onClick={() => setSort(prev => nextSort(prev, 'spread'))}
                    />
                    <span className="cursor-help" title={tip(c, 'col_decisive')}>{c.col_decisive || 'Enough to decide'}</span>
                    <SortableHeaderButton
                        label={c.col_resistance || 'Resistance'}
                        title={tip(c, 'col_resistance')}
                        active={sort?.by === 'resistance'}
                        dir={sort?.by === 'resistance' ? sort.dir : undefined}
                        onClick={() => setSort(prev => nextSort(prev, 'resistance'))}
                    />
                    <span />
                </div>

                <GroupedMethodList
                    items={shown}
                    sorted={sortedShown}
                    sort={sort}
                    c={c}
                    renderRow={r => (
                        <MethodRow key={r.key} r={r} c={c} params={params} threshold={item.approvalThreshold} quorum={item.quorum} ageLoading={!ages.done} language={language} />
                    )}
                />
            </section>

            <ComparisonGlossary id="methods-glossary" c={c} />

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
