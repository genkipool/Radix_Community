'use client';

import React from 'react';
import Link from 'next/link';
import {
    Target, PieChart, Crown, ShieldCheck, Scale, ArrowLeftRight, ExternalLink,
} from 'lucide-react';
import {
    balanceScore, effectiveScore, type MethodResult,
} from '../lib/votingMethods';
import type { HistoricalMethodRow } from '../lib/historicalMethods';
import { gradeLabel, parseQuantile } from '../lib/majorityJudgment';
import { governanceItemPath } from '../lib/paths';
import { fill, formatPct, formatShare, formatXrd } from '../lib/format';
import { TONE } from './VoteParts';
import type { G } from './GovernanceBadges';
import { ConcentrationBar, tip, type CompareDict, type HistoricalDict } from './ComparisonParts';

interface MetricRow {
    label: string;
    labelTip?: string;
    cur: string;
    curTip?: string;
    alt?: string;
    altTip?: string;
    best?: 'cur' | 'alt' | null;
}

/** Two-column (1 XRD = 1 vote vs this method) or single-column decentralisation comparison block. */
function DecentralisationCompareSection({
    title,
    isCurrent,
    currentLabel,
    methodLabel,
    rows,
    curConcentration,
    altConcentration,
    c,
    language,
}: {
    title: string;
    isCurrent: boolean;
    currentLabel: string;
    methodLabel: string;
    rows: MetricRow[];
    curConcentration: { top1: number; top10: number } | null;
    altConcentration: { top1: number; top10: number };
    c: CompareDict;
    language: string;
}) {
    return (
        <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-[var(--color-text-main)] border-b border-[var(--color-card-border)] pb-2">
                <PieChart className="size-4 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                <span>{title}</span>
            </h3>
            <table className="w-full border-collapse text-xs">
                <thead>
                    <tr>
                        <th scope="col" className="pb-1.5" />
                        {isCurrent ? (
                            <th
                                scope="col"
                                className="pb-1.5 pl-4 w-px whitespace-nowrap text-right text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)]"
                            >
                                {currentLabel}
                            </th>
                        ) : (
                            <>
                                <th
                                    scope="col"
                                    className="pb-1.5 pl-4 w-px whitespace-nowrap text-right text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]"
                                >
                                    {currentLabel}
                                </th>
                                <th
                                    scope="col"
                                    title={methodLabel}
                                    className="pb-1.5 pl-4 w-px whitespace-nowrap text-right text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)] cursor-help"
                                >
                                    {c.method_conc_col_this_method ?? ''}
                                </th>
                            </>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-card-border)]/40">
                    {rows.map(row => (
                        <tr key={row.label}>
                            <th
                                scope="row"
                                title={row.labelTip}
                                className={`py-2 text-left font-medium text-[var(--color-text-secondary)] align-middle ${row.labelTip ? 'cursor-help' : ''}`}
                            >
                                {row.label}
                            </th>
                            {isCurrent ? (
                                <td
                                    title={row.curTip}
                                    className={`py-2 pl-4 w-px whitespace-nowrap font-mono text-right tabular-nums font-bold text-[var(--color-text-main)] align-middle ${row.curTip ? 'cursor-help' : ''}`}
                                >
                                    {row.cur}
                                </td>
                            ) : (
                                <>
                                    <td
                                        title={row.curTip}
                                        className={`py-2 pl-4 w-px whitespace-nowrap font-mono text-right tabular-nums align-middle ${row.curTip ? 'cursor-help' : ''} ${
                                            row.best === 'cur' ? 'font-bold text-[var(--color-text-main)]' : 'font-normal text-[var(--color-text-muted)]'
                                        }`}
                                    >
                                        {row.cur}
                                    </td>
                                    <td
                                        title={row.altTip}
                                        className={`py-2 pl-4 w-px whitespace-nowrap font-mono text-right tabular-nums align-middle ${row.altTip ? 'cursor-help' : ''} ${
                                            row.best === 'alt' ? 'font-bold text-[var(--color-text-main)]' : 'font-normal text-[var(--color-text-muted)]'
                                        }`}
                                    >
                                        {row.alt ?? '—'}
                                    </td>
                                </>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="pt-2 space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    {c.detail_concentration ?? ''}
                </p>
                {!isCurrent && curConcentration && (
                    <div className="space-y-1.5">
                        <p className="text-[11px] font-bold text-[var(--color-text-muted)]">{currentLabel}</p>
                        <ConcentrationBar
                            top1={curConcentration.top1}
                            top10={curConcentration.top10}
                            c={c}
                            language={language}
                        />
                    </div>
                )}
                <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-[var(--color-primary)]">
                        {isCurrent ? currentLabel : methodLabel}
                    </p>
                    <ConcentrationBar
                        top1={altConcentration.top1}
                        top10={altConcentration.top10}
                        c={c}
                        language={language}
                    />
                </div>
            </div>
        </section>
    );
}

/** Shared balance & effectiveness summary footer block. */
function CompositeScoresFooter({
    quorumNode,
    balancePct,
    balanceRank,
    effectivePct,
    effectiveRank,
    totalRanked,
    c,
    language,
}: {
    quorumNode?: React.ReactNode;
    balancePct: string;
    balanceRank: number;
    effectivePct: string;
    effectiveRank: number;
    totalRanked: number;
    c: CompareDict;
    language: string;
}) {
    return (
        <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-[var(--color-text-main)] border-b border-[var(--color-card-border)] pb-2">
                <ShieldCheck className="size-4 shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
                <span>{c.method_conc_indices_title ?? ''}</span>
            </h3>
            {quorumNode}
            <table className="w-full border-collapse text-xs">
                <tbody className="divide-y divide-[var(--color-card-border)]/40">
                    <tr>
                        <th scope="row" className="py-2 pr-3 text-left font-medium text-[var(--color-text-secondary)] align-middle">
                            {c.method_conc_balance_label ?? ''}
                        </th>
                        <td className="py-2 pl-3 w-px whitespace-nowrap font-mono font-bold text-right text-[var(--color-text-main)] tabular-nums align-middle">
                            {balancePct}
                        </td>
                        <td className="py-2 pl-2 w-px whitespace-nowrap font-mono font-normal text-right text-[var(--color-text-muted)] tabular-nums align-middle">
                            (#{balanceRank.toLocaleString(language)}/{totalRanked.toLocaleString(language)})
                        </td>
                    </tr>
                    <tr>
                        <th scope="row" className="py-2 pr-3 text-left font-medium text-[var(--color-text-secondary)] align-middle">
                            {c.method_conc_effective_label ?? ''}
                        </th>
                        <td className="py-2 pl-3 w-px whitespace-nowrap font-mono font-bold text-right text-[var(--color-text-main)] tabular-nums align-middle">
                            {effectivePct}
                        </td>
                        <td className="py-2 pl-2 w-px whitespace-nowrap font-mono font-normal text-right text-[var(--color-text-muted)] tabular-nums align-middle">
                            (#{effectiveRank.toLocaleString(language)}/{totalRanked.toLocaleString(language)})
                        </td>
                    </tr>
                </tbody>
            </table>
        </section>
    );
}

function outcomeLabelOf(outcome: MethodResult['outcome'], winnerLabel: string | null, counted: number, c: CompareDict): string {
    if (counted === 0) return c.outcome_none ?? '';
    if (outcome === 'approved') return c.outcome_approved ?? '';
    if (outcome === 'rejected') return c.outcome_rejected ?? '';
    if (outcome === 'no_quorum') return c.outcome_no_quorum ?? '';
    return winnerLabel ? fill(c.outcome_winner ?? '{label}', { label: winnerLabel }) : (c.outcome_none ?? '');
}

/** Editorial "Conclusions" tab inside `MethodGuideModal` for any of the 50 methods on a single vote. */
export function MethodSingleConclusionsTab({
    method,
    methodName,
    current,
    allMethods,
    quorum,
    threshold,
    gradeQuantile,
    c,
    g,
    language,
}: {
    method: MethodResult;
    methodName: string;
    current: MethodResult;
    allMethods: MethodResult[];
    quorum: number | null;
    threshold: number | null;
    gradeQuantile?: string | null;
    c: CompareDict;
    g: G;
    language: string;
}) {
    if (method.counted === 0) {
        return (
            <div className="space-y-6">
                <section className="border-l-2 border-amber-500 pl-4 space-y-2">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        <Target className="size-3.5 shrink-0" aria-hidden="true" />
                        <span>{c.outcome_none ?? ''}</span>
                    </h3>
                    <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                        {fill(c.method_conc_nobody_detail ?? '', {
                            excluded: (method.counted + method.excluded).toLocaleString(language),
                        })}
                    </p>
                </section>
                {quorum !== null && quorum > 0 && (
                    <section className="space-y-2">
                        <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-[var(--color-text-main)] border-b border-[var(--color-card-border)] pb-2">
                            <ShieldCheck className="size-4 shrink-0 text-amber-500" aria-hidden="true" />
                            <span>{c.detail_quorum ?? ''}</span>
                        </h3>
                        <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                            {fill(c.method_conc_quorum_text ?? '', {
                                eligible: formatXrd(0, language),
                                quorum: formatXrd(quorum, language),
                                pct: formatPct(0, language),
                            })}
                        </p>
                    </section>
                )}
            </div>
        );
    }

    const ready = allMethods.filter(m => m.counted > 0);
    const methodBal = balanceScore(method);
    const methodEff = effectiveScore(method);
    const balanceRank = ready.filter(m => balanceScore(m) > methodBal).length + 1;
    const effectiveRank = ready.filter(m => effectiveScore(m) > methodEff).length + 1;
    const curTotal = current.counted;
    const altTotal = method.counted;
    const curEffStr = current.concentration.effective.toLocaleString(language, { maximumFractionDigits: 1 });
    const altEffStr = method.concentration.effective.toLocaleString(language, { maximumFractionDigits: 1 });
    const isElection = Boolean(method.electionSummary && current.electionSummary);

    const buildBaseMetricRows = (): MetricRow[] => [
        {
            label: c.election_conclusions_row_nakamoto ?? '',
            labelTip: c.election_conclusions_tip_nakamoto ?? '',
            cur: current.concentration.nakamoto != null ? `${current.concentration.nakamoto.toLocaleString(language)}/${curTotal.toLocaleString(language)}` : '—',
            curTip: current.concentration.nakamoto != null ? fill(c.election_conclusions_tip_cur_nakamoto ?? '', {
                n_val: current.concentration.nakamoto.toLocaleString(language),
                total: curTotal.toLocaleString(language),
                pct: formatShare(current.concentration.nakamoto / Math.max(1, curTotal), language),
            }) : undefined,
            alt: method.concentration.nakamoto != null ? `${method.concentration.nakamoto.toLocaleString(language)}/${altTotal.toLocaleString(language)}` : '—',
            best: current.concentration.nakamoto == null || method.concentration.nakamoto == null || method.concentration.nakamoto === current.concentration.nakamoto
                ? null
                : method.concentration.nakamoto > current.concentration.nakamoto ? 'alt' : 'cur',
        },
        {
            label: c.election_conclusions_top1_label ?? '',
            labelTip: c.election_conclusions_tip_top1 ?? '',
            cur: formatPct(current.concentration.top1, language),
            curTip: fill(c.election_conclusions_tip_cur_top1 ?? '', { pct: formatPct(current.concentration.top1, language) }),
            alt: formatPct(method.concentration.top1, language),
            best: method.concentration.top1 === current.concentration.top1
                ? null
                : method.concentration.top1 < current.concentration.top1 ? 'alt' : 'cur',
        },
        {
            label: c.election_conclusions_top10_label ?? '',
            labelTip: c.election_conclusions_tip_top10 ?? '',
            cur: formatPct(current.concentration.top10, language),
            curTip: fill(c.election_conclusions_tip_cur_top10 ?? '', { pct: formatPct(current.concentration.top10, language) }),
            alt: formatPct(method.concentration.top10, language),
            best: method.concentration.top10 === current.concentration.top10
                ? null
                : method.concentration.top10 < current.concentration.top10 ? 'alt' : 'cur',
        },
        {
            label: c.detail_spread ?? '',
            labelTip: c.election_conclusions_tip_spread ?? '',
            cur: current.concentration.spread != null ? formatPct(current.concentration.spread, language) : '—',
            curTip: current.concentration.spread != null ? fill(c.election_conclusions_tip_cur_spread ?? '', {
                pct: formatPct(current.concentration.spread, language),
                eff: curEffStr,
                total: curTotal.toLocaleString(language),
            }) : undefined,
            alt: method.concentration.spread != null ? formatPct(method.concentration.spread, language) : '—',
            best: current.concentration.spread == null || method.concentration.spread == null || method.concentration.spread === current.concentration.spread
                ? null
                : method.concentration.spread > current.concentration.spread ? 'alt' : 'cur',
        },
        {
            label: c.election_conclusions_row_effective ?? '',
            labelTip: c.election_conclusions_tip_effective ?? '',
            cur: curEffStr,
            curTip: fill(c.election_conclusions_tip_cur_effective ?? '', { eff: curEffStr, total: curTotal.toLocaleString(language) }),
            alt: altEffStr,
            best: method.concentration.effective === current.concentration.effective
                ? null
                : method.concentration.effective > current.concentration.effective ? 'alt' : 'cur',
        },
        {
            label: c.detail_counted ?? '',
            labelTip: tip(c, 'detail_counted'),
            cur: `${curTotal.toLocaleString(language)}/${(current.counted + current.excluded).toLocaleString(language)}`,
            alt: `${altTotal.toLocaleString(language)}/${(method.counted + method.excluded).toLocaleString(language)}`,
            best: null,
        },
    ];

    const quorumNode = quorum != null && quorum > 0 ? (
        <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
            {fill(c.method_conc_quorum_text ?? '', {
                eligible: formatXrd(method.eligibleXrd, language),
                quorum: formatXrd(quorum, language),
                pct: formatPct(method.eligibleXrd / quorum, language),
            })}
        </p>
    ) : undefined;

    if (isElection && method.electionSummary && current.electionSummary) {
        const es = method.electionSummary;
        const curEs = current.electionSummary;
        const quantilePct = formatPct(parseQuantile(gradeQuantile), language);
        const decCount = es.decisiveQuantileCount ?? 0;
        const decXrd = es.decisiveQuantileXrd ?? 0;
        const curDecCount = curEs.decisiveQuantileCount ?? 0;
        const decRow: MetricRow = {
            label: fill(c.election_conclusions_row_decisive ?? '', { quantilePct }),
            labelTip: fill(c.election_conclusions_tip_decisive ?? '', { quantilePct }),
            cur: `${curDecCount.toLocaleString(language)}/${curTotal.toLocaleString(language)}`,
            alt: `${decCount.toLocaleString(language)}/${altTotal.toLocaleString(language)}`,
            best: curDecCount === decCount ? null : decCount > curDecCount ? 'alt' : 'cur',
        };
        const entered = es.enteredDetails ?? [];
        const left = es.leftDetails ?? [];

        return (
            <div className="space-y-8">
                <section className="border-l-2 border-[var(--color-primary)] pl-4 space-y-2">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
                        <Target className="size-3.5 shrink-0" aria-hidden="true" />
                        <span>{fill(c.election_conclusions_decisive_title ?? '', { quantilePct })}</span>
                    </h3>
                    <p className="text-[13.5px] leading-relaxed font-medium text-[var(--color-text-main)]">
                        {fill(method.current ? (c.election_current_conclusions_decisive_text ?? '') : (c.method_conc_election_decisive ?? ''), {
                            count: decCount.toLocaleString(language),
                            total: altTotal.toLocaleString(language),
                            pct: formatShare(altTotal > 0 ? decCount / altTotal : 0, language),
                            xrd: formatXrd(decXrd, language),
                            quantilePct,
                            curCount: curDecCount.toLocaleString(language),
                            curTotal: curTotal.toLocaleString(language),
                        })}
                    </p>
                </section>

                <DecentralisationCompareSection
                    title={c.method_conc_decentralisation_title ?? ''}
                    isCurrent={method.current}
                    currentLabel={c.election_conclusions_col_current ?? ''}
                    methodLabel={methodName}
                    rows={[decRow, ...buildBaseMetricRows()]}
                    curConcentration={current.concentration}
                    altConcentration={method.concentration}
                    c={c}
                    language={language}
                />

                <section className="space-y-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-[var(--color-text-main)] border-b border-[var(--color-card-border)] pb-2">
                        <Crown className="size-4 shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
                        <span>{fill(c.election_detail_council ?? '', { n: es.elected.length.toLocaleString(language), total: es.seatCount.toLocaleString(language) })}</span>
                    </h3>
                    {!method.current && (
                        <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                            {(es.seatsChanged ?? 0) === 0 && es.tiedAtCutoff.length === 0
                                ? fill(c.election_conclusions_no_changes ?? '', { seats: es.seatCount.toLocaleString(language) })
                                : fill(c.method_conc_election_changes_summary ?? '', {
                                    changed: (es.seatsChanged ?? 0).toLocaleString(language),
                                    seats: es.seatCount.toLocaleString(language),
                                })}
                        </p>
                    )}
                    {es.elected.length > 0 && (
                        <ul className="divide-y divide-[var(--color-card-border)]/40">
                            {es.elected.map(cand => (
                                <li
                                    key={cand.id}
                                    className="grid grid-cols-[2rem_minmax(0,1fr)_5.5rem_4.5rem] items-center gap-2 py-1.5 text-[13px]"
                                >
                                    <span className="font-mono text-[11px] font-bold text-[var(--color-primary)] tabular-nums">
                                        #{cand.rank}
                                    </span>
                                    <span className="font-semibold text-[var(--color-text-main)] truncate">
                                        {cand.label}
                                    </span>
                                    <span className="text-xs font-semibold text-[var(--color-accent)] text-right whitespace-nowrap">
                                        {gradeLabel(g.mj, cand.qualifyingGrade)}
                                    </span>
                                    <span className="font-mono text-[11px] text-[var(--color-text-muted)] tabular-nums text-right whitespace-nowrap">
                                        {fill(g.mj?.band_short ?? '', { band: cand.band })}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                    {(entered.length > 0 || left.length > 0) && (
                        <div className="space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                                {c.election_changes_table_title ?? ''}
                            </p>
                            <ul className="divide-y divide-[var(--color-card-border)]/40">
                                {entered.map(ch => (
                                    <li
                                        key={`in-${ch.id}`}
                                        className="grid grid-cols-[2rem_minmax(0,1fr)_4.75rem_5rem] items-center gap-2 py-1.5 text-[13px]"
                                    >
                                        <span className="font-mono text-[11px] font-bold text-[var(--color-accent)] tabular-nums">
                                            #{ch.methodRank}
                                        </span>
                                        <span className="font-semibold text-[var(--color-text-main)] truncate">
                                            {ch.label}
                                        </span>
                                        <span className="font-mono text-[11px] text-[var(--color-text-muted)] tabular-nums text-right whitespace-nowrap">
                                            #{ch.currentRank} → #{ch.methodRank}
                                        </span>
                                        <span className="font-sans text-[11px] font-bold text-[var(--color-accent)] text-right whitespace-nowrap">
                                            {c.election_entered_badge ?? ''}
                                        </span>
                                    </li>
                                ))}
                                {left.map(ch => (
                                    <li
                                        key={`out-${ch.id}`}
                                        className="grid grid-cols-[2rem_minmax(0,1fr)_4.75rem_5rem] items-center gap-2 py-1.5 text-[13px]"
                                    >
                                        <span className="font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                                            #{ch.methodRank}
                                        </span>
                                        <span className="font-semibold text-[var(--color-text-main)] truncate">
                                            {ch.label}
                                        </span>
                                        <span className="font-mono text-[11px] text-[var(--color-text-muted)] tabular-nums text-right whitespace-nowrap">
                                            #{ch.currentRank} → #{ch.methodRank}
                                        </span>
                                        <span className="font-sans text-[11px] font-bold text-amber-600 dark:text-amber-400 text-right whitespace-nowrap">
                                            {c.election_left_badge ?? ''}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </section>

                <CompositeScoresFooter
                    quorumNode={quorumNode}
                    balancePct={formatPct(balanceScore(method), language)}
                    balanceRank={balanceRank}
                    effectivePct={formatPct(effectiveScore(method), language)}
                    effectiveRank={effectiveRank}
                    totalRanked={ready.length}
                    c={c}
                    language={language}
                />
            </div>
        );
    }

    // Standard proposal or temperature check
    const curDec = current.decisive;
    const altDec = method.decisive;
    const outcomeText = outcomeLabelOf(method.outcome, method.winner?.label ?? null, method.counted, c);
    const curOutcomeText = outcomeLabelOf(current.outcome, current.winner?.label ?? null, current.counted, c);
    const decRow: MetricRow | null = altDec || curDec ? {
        label: c.col_decisive ?? '',
        labelTip: tip(c, 'col_decisive'),
        cur: curDec ? `${curDec.count.toLocaleString(language)}/${curDec.of.toLocaleString(language)}` : '—',
        alt: altDec ? `${altDec.count.toLocaleString(language)}/${altDec.of.toLocaleString(language)}` : '—',
        best: !curDec || !altDec || altDec.count === curDec.count ? null : altDec.count > curDec.count ? 'alt' : 'cur',
    } : null;

    const currentRowsByKey = new Map(current.rows.map(r => [r.key, r]));
    const visibleOptionRows = method.rows.filter(x => x.power > 0 || x.tone !== 'neutral');
    const showPrevCol = !method.current && visibleOptionRows.some(x => currentRowsByKey.has(x.key));

    return (
        <div className="space-y-8">
            <section className="border-l-2 border-[var(--color-primary)] pl-4 space-y-2">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
                    <Target className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>{outcomeText}</span>
                </h3>
                <p className="text-[13.5px] leading-relaxed font-medium text-[var(--color-text-main)]">
                    {altDec
                        ? fill(c.method_conc_standard_decisive ?? '', {
                            count: altDec.count.toLocaleString(language),
                            of: altDec.of.toLocaleString(language),
                            pct: formatShare(altDec.of > 0 ? altDec.count / altDec.of : 0, language),
                            xrd: formatXrd(altDec.xrd, language),
                        })
                        : method.quorumMet === false
                            ? (c.detail_no_quorum ?? '')
                            : outcomeText}
                </p>
                {!method.current && (
                    <p className="text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">
                        {method.sameAsCurrent === false
                            ? fill(c.method_conc_standard_diff ?? '', { currentOutcome: curOutcomeText, methodOutcome: outcomeText })
                            : fill(c.method_conc_standard_same ?? '', { outcome: outcomeText })}
                        {method.headcountShare !== null && (
                            <> {fill(c.detail_headcount ?? '', { pct: formatPct(method.headcountShare, language) })}</>
                        )}
                    </p>
                )}
            </section>

            <DecentralisationCompareSection
                title={c.method_conc_decentralisation_title ?? ''}
                isCurrent={method.current}
                currentLabel={c.election_conclusions_col_current ?? ''}
                methodLabel={methodName}
                rows={[...(decRow ? [decRow] : []), ...buildBaseMetricRows()]}
                curConcentration={current.concentration}
                altConcentration={method.concentration}
                c={c}
                language={language}
            />

            {visibleOptionRows.length > 0 && (
                <section className="space-y-3">
                    <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-[var(--color-text-main)] border-b border-[var(--color-card-border)] pb-2">
                        <Scale className="size-4 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                        <span>{c.detail_split ?? ''}</span>
                    </h3>
                    <table className="w-full border-collapse text-xs">
                        <tbody className="divide-y divide-[var(--color-card-border)]/40">
                            {visibleOptionRows.map(x => {
                                const curRow = currentRowsByKey.get(x.key);
                                return (
                                    <tr key={x.key}>
                                        <th scope="row" className={`py-2 pr-3 text-left font-semibold align-middle ${TONE[x.tone].text}`}>
                                            {x.label}
                                        </th>
                                        {showPrevCol && (
                                            <td className="py-2 pl-3 w-px whitespace-nowrap font-mono text-[11px] text-right text-[var(--color-text-muted)] tabular-nums align-middle">
                                                {curRow ? `${formatPct(curRow.share, language)} →` : ''}
                                            </td>
                                        )}
                                        <td className="py-2 pl-3 w-px whitespace-nowrap font-mono font-bold text-right text-[var(--color-text-main)] tabular-nums align-middle">
                                            {formatPct(x.share, language)}
                                        </td>
                                        <td className="py-2 pl-3 w-px whitespace-nowrap font-sans text-[11px] text-right text-[var(--color-text-muted)] tabular-nums align-middle">
                                            ({(method.addressesByChoice[x.key] ?? 0).toLocaleString(language)})
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {threshold !== null && method.approvalShare !== null && (
                        <p className="text-[12px] text-[var(--color-text-muted)]">
                            {tip(c, 'support', {
                                pct: formatPct(method.approvalShare, language),
                                threshold: formatPct(threshold, language),
                            })}
                        </p>
                    )}
                </section>
            )}

            <CompositeScoresFooter
                quorumNode={quorumNode}
                balancePct={formatPct(balanceScore(method), language)}
                balanceRank={balanceRank}
                effectivePct={formatPct(effectiveScore(method), language)}
                effectiveRank={effectiveRank}
                totalRanked={ready.length}
                c={c}
                language={language}
            />
        </div>
    );
}

/** Editorial "Conclusions" tab inside `MethodGuideModal` for any of the 50 methods in Historical Comparison. */
export function MethodHistoricalConclusionsTab({
    row,
    methodName,
    currentRow,
    allRows,
    totalVotes,
    totalBallots,
    c,
    h,
    language,
}: {
    row: HistoricalMethodRow;
    methodName: string;
    currentRow: HistoricalMethodRow | null;
    allRows: HistoricalMethodRow[];
    totalVotes: number;
    totalBallots: number;
    c: CompareDict;
    h: HistoricalDict;
    language: string;
}) {
    if (row.votesEvaluated === 0) {
        return (
            <div className="space-y-6">
                <section className="border-l-2 border-amber-500 pl-4 space-y-2">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        <Target className="size-3.5 shrink-0" aria-hidden="true" />
                        <span>{c.outcome_none ?? ''}</span>
                    </h3>
                    <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                        {fill(c.method_conc_nobody_hist ?? '', { total: totalVotes.toLocaleString(language) })}
                    </p>
                </section>
            </div>
        );
    }

    const ready = allRows.filter(r => r.votesEvaluated > 0);
    const balanceRank = ready.filter(r => r.balanceScore > row.balanceScore).length + 1;
    const effectiveRank = ready.filter(r => r.effectiveScore > row.effectiveScore).length + 1;
    const base = currentRow ?? row;
    const avgCounted = row.votesEvaluated > 0 ? row.totalBallotsCounted / row.votesEvaluated : 0;
    const baseAvgCounted = base.votesEvaluated > 0 ? base.totalBallotsCounted / base.votesEvaluated : 0;
    const totalDecided = row.changedCount + row.sameCount;

    const metricRows: MetricRow[] = [
        {
            label: c.election_conclusions_row_nakamoto ?? '',
            labelTip: c.election_conclusions_tip_nakamoto ?? '',
            cur: base.avgNakamoto != null ? `${base.avgNakamoto.toLocaleString(language, { maximumFractionDigits: 1 })}/${baseAvgCounted.toLocaleString(language, { maximumFractionDigits: 1 })}` : '—',
            alt: row.avgNakamoto != null ? `${row.avgNakamoto.toLocaleString(language, { maximumFractionDigits: 1 })}/${avgCounted.toLocaleString(language, { maximumFractionDigits: 1 })}` : '—',
            best: base.avgNakamoto == null || row.avgNakamoto == null || row.avgNakamoto === base.avgNakamoto
                ? null
                : row.avgNakamoto > base.avgNakamoto ? 'alt' : 'cur',
        },
        {
            label: c.election_conclusions_top1_label ?? '',
            labelTip: c.election_conclusions_tip_top1 ?? '',
            cur: formatPct(base.avgTop1, language),
            alt: formatPct(row.avgTop1, language),
            best: row.avgTop1 === base.avgTop1 ? null : row.avgTop1 < base.avgTop1 ? 'alt' : 'cur',
        },
        {
            label: c.election_conclusions_top10_label ?? '',
            labelTip: c.election_conclusions_tip_top10 ?? '',
            cur: formatPct(base.avgTop10, language),
            alt: formatPct(row.avgTop10, language),
            best: row.avgTop10 === base.avgTop10 ? null : row.avgTop10 < base.avgTop10 ? 'alt' : 'cur',
        },
        {
            label: h.col_spread ?? c.detail_spread ?? '',
            labelTip: c.election_conclusions_tip_spread ?? '',
            cur: base.avgSpread != null ? formatPct(base.avgSpread, language) : '—',
            alt: row.avgSpread != null ? formatPct(row.avgSpread, language) : '—',
            best: base.avgSpread == null || row.avgSpread == null || row.avgSpread === base.avgSpread
                ? null
                : row.avgSpread > base.avgSpread ? 'alt' : 'cur',
        },
        {
            label: h.detail_effective ?? '',
            labelTip: c.election_conclusions_tip_effective ?? '',
            cur: base.avgEffective.toLocaleString(language, { maximumFractionDigits: 1 }),
            alt: row.avgEffective.toLocaleString(language, { maximumFractionDigits: 1 }),
            best: row.avgEffective === base.avgEffective ? null : row.avgEffective > base.avgEffective ? 'alt' : 'cur',
        },
        {
            label: h.col_ballots ?? '',
            labelTip: h.tip_col_ballots ?? '',
            cur: `${base.totalBallotsCounted.toLocaleString(language)}/${totalBallots.toLocaleString(language)}`,
            alt: `${row.totalBallotsCounted.toLocaleString(language)}/${totalBallots.toLocaleString(language)}`,
            best: null,
        },
        {
            label: c.detail_quorum ?? '',
            cur: `${base.validVotesCount.toLocaleString(language)}/${totalVotes.toLocaleString(language)}`,
            alt: `${row.validVotesCount.toLocaleString(language)}/${totalVotes.toLocaleString(language)}`,
            best: row.validVotesCount === base.validVotesCount ? null : row.validVotesCount > base.validVotesCount ? 'alt' : 'cur',
        },
    ];

    const altMethods = allRows.filter(r => !r.current && r.votesEvaluated > 0);
    const methodsWithFlips = altMethods.filter(r => r.changedCount > 0).length;

    const changedNode = row.current ? (
        <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-[var(--color-text-main)] border-b border-[var(--color-card-border)] pb-2">
                <ArrowLeftRight className="size-4 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                <span>{c.method_conc_hist_ref_title ?? ''}</span>
            </h3>
            <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                {fill(c.method_conc_hist_ref_text ?? '', {
                    flips: methodsWithFlips.toLocaleString(language),
                    altTotal: altMethods.length.toLocaleString(language),
                    votes: totalVotes.toLocaleString(language),
                })}
            </p>
        </section>
    ) : (
        <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-[var(--color-text-main)] border-b border-[var(--color-card-border)] pb-2">
                <ArrowLeftRight className="size-4 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                <span>{fill(h.changed_list_title ?? '', { n: row.changedEntries.length.toLocaleString(language) })}</span>
            </h3>
            {row.changedEntries.length === 0 ? (
                <p className="text-[13px] text-[var(--color-text-muted)]">
                    {fill(h.tip_changes_zero ?? '', { total: totalDecided.toLocaleString(language) })}
                </p>
            ) : (
                <ul className="divide-y divide-[var(--color-card-border)]/40 text-xs">
                    {row.changedEntries.map(ch => {
                        const isElectionFlip = ch.currentSeats != null && ch.methodSeats != null;
                        return (
                            <li
                                key={`${ch.entry.systemKey}-${ch.entry.kind}-${ch.entry.id}`}
                                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2"
                            >
                                <Link
                                    href={`/${language}${governanceItemPath(ch.entry.systemKey, ch.entry.kind, ch.entry.id)}?tab=compare`}
                                    className="inline-flex items-center gap-1.5 min-w-0 font-semibold text-[var(--color-text-main)] hover:text-[var(--color-primary)] transition-colors"
                                >
                                    <span className="truncate">{ch.entry.item.title || `#${ch.entry.id}`}</span>
                                    <ExternalLink className="size-3 shrink-0 opacity-60" aria-hidden="true" />
                                </Link>
                                <span className="font-mono text-[11px] tabular-nums text-right whitespace-nowrap text-[var(--color-text-muted)]">
                                    {isElectionFlip
                                        ? fill(c.method_conc_hist_seat_diff ?? '', { n: (ch.seatsChanged ?? 0).toLocaleString(language) })
                                        : `${outcomeLabelOf(ch.currentOutcome, ch.currentWinner, 1, c)} → ${outcomeLabelOf(ch.methodOutcome, ch.methodWinner, ch.methodCounted, c)}`}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );

    const avgXrdPerVote = row.votesEvaluated > 0 ? row.totalEligibleXrd / row.votesEvaluated : 0;
    const quorumNode = (
        <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
            {fill(c.method_conc_hist_quorum_text ?? '', {
                valid: row.validVotesCount.toLocaleString(language),
                total: totalVotes.toLocaleString(language),
                pct: formatPct(totalVotes > 0 ? row.validVotesCount / totalVotes : 0, language),
                xrd: formatXrd(avgXrdPerVote, language),
            })}
        </p>
    );

    return (
        <div className="space-y-8">
            <section className="border-l-2 border-[var(--color-primary)] pl-4 space-y-2">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
                    <Target className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>{c.method_conc_hist_title ?? ''}</span>
                </h3>
                <p className="text-[13.5px] leading-relaxed font-medium text-[var(--color-text-main)]">
                    {row.current
                        ? fill(h.guide_step2_reference ?? '', { totalVotes: totalVotes.toLocaleString(language) })
                        : row.changedCount > 0
                            ? fill(h.tip_changes ?? '', {
                                n: row.changedCount.toLocaleString(language),
                                total: totalDecided.toLocaleString(language),
                                pct: totalDecided > 0 ? formatShare(row.changedCount / totalDecided, language) : '—',
                            })
                            : fill(h.tip_changes_zero ?? '', { total: totalDecided.toLocaleString(language) })}
                </p>
                {row.avgDecisiveCount !== null && row.avgDecisiveOf !== null && row.avgDecisiveXrd !== null && (
                    <p className="text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">
                        {fill(h.detail_decisive ?? '', {
                            votes: row.decisiveVotesCount.toLocaleString(language),
                            count: row.avgDecisiveCount.toLocaleString(language, { maximumFractionDigits: 1 }),
                            pct: formatShare(row.avgDecisiveOf > 0 ? row.avgDecisiveCount / row.avgDecisiveOf : 0, language),
                            of: row.avgDecisiveOf.toLocaleString(language, { maximumFractionDigits: 1 }),
                            xrd: formatXrd(row.avgDecisiveXrd, language),
                            totalXrd: formatXrd(row.totalDecisiveXrd, language),
                        })}
                    </p>
                )}
            </section>

            <DecentralisationCompareSection
                title={c.method_conc_hist_metrics_title ?? ''}
                isCurrent={row.current}
                currentLabel={c.election_conclusions_col_current ?? ''}
                methodLabel={methodName}
                rows={metricRows}
                curConcentration={currentRow ? { top1: currentRow.avgTop1, top10: currentRow.avgTop10 } : null}
                altConcentration={{ top1: row.avgTop1, top10: row.avgTop10 }}
                c={c}
                language={language}
            />

            {changedNode}

            <CompositeScoresFooter
                quorumNode={quorumNode}
                balancePct={formatPct(row.balanceScore, language)}
                balanceRank={balanceRank}
                effectivePct={formatPct(row.effectiveScore, language)}
                effectiveRank={effectiveRank}
                totalRanked={ready.length}
                c={c}
                language={language}
            />
        </div>
    );
}
