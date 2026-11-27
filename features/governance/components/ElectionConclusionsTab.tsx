'use client';

import React from 'react';
import { Target, PieChart, ShieldCheck, Layers } from 'lucide-react';
import { computeElectionConclusions, type ElectionConsensusSummary, type MethodResult } from '../lib/votingMethods';
import { fill, formatPct, formatShare, formatXrd } from '../lib/format';
import { FAMILY_ICON, type CompareDict } from './ComparisonParts';

export interface ElectionConclusionsTabProps {
    consensus: ElectionConsensusSummary;
    current: MethodResult;
    methods: MethodResult[];
    voterPowers: number[];
    quorum: number | null;
    gradeQuantile?: string | null;
    c: CompareDict;
    language: string;
}

/**
 * Editorial "Conclusions" tab inside `MethodGuideModal` for the 50-method
 * weighted election consensus: decisive block, weighted vs 1 XRD = 1 vote
 * decentralisation comparison, council stability, and family breakdown.
 */
export function ElectionConclusionsTab({
    consensus,
    current,
    methods,
    voterPowers,
    quorum,
    gradeQuantile,
    c,
    language,
}: ElectionConclusionsTabProps) {
    const concl = computeElectionConclusions(consensus, methods, voterPowers, quorum, gradeQuantile);
    const quantilePct = formatPct(concl.quantileValue, language);
    const curBlock = concl.currentDecisiveBlock;
    const wgtBlock = concl.weightedDecisiveBlock;
    const decisiveCount = curBlock?.count ?? 0;
    const decisiveTotal = curBlock?.total ?? 0;
    const accPower = curBlock?.xrd ?? 0;
    const {
        sameAsCurrentCount: sameCount,
        alternativeMethodsCount: othersCount,
        solidSeats: solidCandidates,
        enteredSeats: enteredCandidates,
        droppedSeats: droppedCandidates,
    } = concl.councilStability;
    const quorumMetCount = concl.quorum.metCount;
    const familyNames = (c.families ?? {}) as Record<string, string>;
    const wc = consensus.weightedConcentration;
    const weightedDecisiveRatio = wgtBlock?.ratioVsCurrent != null
        ? wgtBlock.ratioVsCurrent.toLocaleString(language, { maximumFractionDigits: 1 })
        : null;

    return (
        <div className="space-y-8">
            {/* 1. Decisive block at applied quantile — weighted consensus first, compared with 1 XRD = 1 vote */}
            {curBlock && (
                <section className="border-l-2 border-[var(--color-primary)] pl-4 space-y-2">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
                        <Target className="size-3.5 shrink-0" aria-hidden="true" />
                        <span>{fill(c.election_conclusions_decisive_title ?? '', { quantilePct })}</span>
                    </h3>
                    {wgtBlock && weightedDecisiveRatio != null && (
                        <p className="text-[13.5px] leading-relaxed font-medium text-[var(--color-text-main)]">
                            {fill(c.election_conclusions_decisive_weighted ?? '', {
                                n: consensus.evaluatedMethods.toLocaleString(language),
                                weightedCount: wgtBlock.avgCount.toLocaleString(language, { maximumFractionDigits: 1 }),
                                weightedTotal: wgtBlock.avgTotal.toLocaleString(language, { maximumFractionDigits: 1 }),
                                weightedPct: formatShare(wgtBlock.share, language),
                                quantilePct,
                                ratio: weightedDecisiveRatio,
                            })}
                        </p>
                    )}
                    <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                        {fill(c.election_conclusions_decisive_text ?? '', {
                            count: decisiveCount.toLocaleString(language),
                            total: decisiveTotal.toLocaleString(language),
                            pct: formatShare(curBlock.share, language),
                            xrd: formatXrd(accPower, language),
                            quantilePct,
                        })}
                    </p>
                </section>
            )}

            {/* 2. Weighted 50-method vs 1 XRD = 1 vote decentralisation comparison */}
            {current.concentration.nakamoto !== null && current.concentration.spread !== null && (
                <section className="space-y-3">
                    <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-[var(--color-text-main)] border-b border-[var(--color-card-border)] pb-2">
                        <PieChart className="size-4 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                        <span>{c.election_conclusions_conc_title ?? ''}</span>
                    </h3>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-4 pb-1 text-[10px] font-bold uppercase tracking-wider">
                        <span />
                        <span className="text-right text-[var(--color-text-muted)]">
                            {c.election_conclusions_col_current ?? ''}
                        </span>
                        <span className="text-right text-[var(--color-primary)]">
                            {fill(c.election_conclusions_col_weighted ?? '', { n: consensus.evaluatedMethods.toLocaleString(language) })}
                        </span>
                    </div>
                    <dl className="divide-y divide-[var(--color-card-border)]/40 text-xs">
                        {[
                            {
                                label: fill(c.election_conclusions_row_decisive ?? '', { quantilePct }),
                                tip: fill(c.election_conclusions_tip_decisive ?? '', {
                                    quantilePct,
                                    n: consensus.evaluatedMethods.toLocaleString(language),
                                }),
                                cur: `${decisiveCount.toLocaleString(language)}/${decisiveTotal.toLocaleString(language)}`,
                                wgt: wc.decisiveQuantile != null
                                    ? `${wc.decisiveQuantile.toLocaleString(language, { maximumFractionDigits: 1 })}/${wc.counted.toLocaleString(language, { maximumFractionDigits: 1 })}`
                                    : '—',
                                best: wc.decisiveQuantile == null || wc.decisiveQuantile === decisiveCount
                                    ? null
                                    : wc.decisiveQuantile > decisiveCount ? 'wgt' : 'cur',
                            },
                            {
                                label: c.election_conclusions_row_nakamoto ?? '',
                                tip: fill(c.election_conclusions_tip_nakamoto ?? '', {
                                    n: consensus.evaluatedMethods.toLocaleString(language),
                                }),
                                cur: `${current.concentration.nakamoto.toLocaleString(language)}/${current.counted.toLocaleString(language)}`,
                                wgt: wc.nakamoto != null
                                    ? `${wc.nakamoto.toLocaleString(language, { maximumFractionDigits: 1 })}/${wc.counted.toLocaleString(language, { maximumFractionDigits: 1 })}`
                                    : '—',
                                best: wc.nakamoto == null || wc.nakamoto === current.concentration.nakamoto
                                    ? null
                                    : wc.nakamoto > current.concentration.nakamoto ? 'wgt' : 'cur',
                            },
                            {
                                label: c.election_conclusions_top1_label ?? '',
                                tip: fill(c.election_conclusions_tip_top1 ?? '', {
                                    n: consensus.evaluatedMethods.toLocaleString(language),
                                }),
                                cur: formatPct(current.concentration.top1, language),
                                wgt: formatPct(wc.top1, language),
                                best: wc.top1 === current.concentration.top1
                                    ? null
                                    : wc.top1 < current.concentration.top1 ? 'wgt' : 'cur',
                            },
                            {
                                label: c.election_conclusions_top10_label ?? '',
                                tip: fill(c.election_conclusions_tip_top10 ?? '', {
                                    n: consensus.evaluatedMethods.toLocaleString(language),
                                }),
                                cur: formatPct(current.concentration.top10, language),
                                wgt: formatPct(wc.top10, language),
                                best: wc.top10 === current.concentration.top10
                                    ? null
                                    : wc.top10 < current.concentration.top10 ? 'wgt' : 'cur',
                            },
                            {
                                label: c.detail_spread ?? '',
                                tip: fill(c.election_conclusions_tip_spread ?? '', {
                                    n: consensus.evaluatedMethods.toLocaleString(language),
                                }),
                                cur: formatPct(current.concentration.spread, language),
                                wgt: wc.spread != null ? formatPct(wc.spread, language) : '—',
                                best: wc.spread == null || wc.spread === current.concentration.spread
                                    ? null
                                    : wc.spread > current.concentration.spread ? 'wgt' : 'cur',
                            },
                            {
                                label: c.election_conclusions_row_effective ?? '',
                                tip: fill(c.election_conclusions_tip_effective ?? '', {
                                    n: consensus.evaluatedMethods.toLocaleString(language),
                                }),
                                cur: current.concentration.effective.toLocaleString(language, { maximumFractionDigits: 1 }),
                                wgt: wc.effective.toLocaleString(language, { maximumFractionDigits: 1 }),
                                best: wc.effective === current.concentration.effective
                                    ? null
                                    : wc.effective > current.concentration.effective ? 'wgt' : 'cur',
                            },
                        ].map(row => (
                            <div
                                key={row.label}
                                title={row.tip}
                                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-4 py-2 cursor-help"
                            >
                                <dt className="min-w-0 text-[var(--color-text-secondary)] font-medium">
                                    {row.label}
                                </dt>
                                <dd className={`font-mono text-right tabular-nums ${
                                    row.best === 'cur'
                                        ? 'font-bold text-[var(--color-text-main)]'
                                        : 'font-normal text-[var(--color-text-muted)]'
                                }`}>
                                    {row.cur}
                                </dd>
                                <dd className={`font-mono text-right tabular-nums min-w-[4.5rem] ${
                                    row.best === 'wgt'
                                        ? 'font-bold text-[var(--color-text-main)]'
                                        : 'font-normal text-[var(--color-text-muted)]'
                                }`}>
                                    {row.wgt}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </section>
            )}

            {/* 3. Council stability & contested cutoff */}
            <section className="space-y-4">
                <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-[var(--color-text-main)] border-b border-[var(--color-card-border)] pb-2">
                    <ShieldCheck className="size-4 shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
                    <span>{fill(c.election_conclusions_stability_title ?? '', { n: consensus.evaluatedMethods.toLocaleString(language) })}</span>
                </h3>
                <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                    {fill(c.election_conclusions_stability_text ?? '', {
                        same: sameCount.toLocaleString(language),
                        others: othersCount.toLocaleString(language),
                        pct: formatShare(concl.councilStability.sameAsCurrentShare, language),
                        seats: consensus.seatCount.toLocaleString(language),
                    })}
                </p>

                {solidCandidates.length > 0 && (
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                            {c.election_conclusions_solid_label ?? ''}
                        </p>
                        <ul className="divide-y divide-[var(--color-card-border)]/40">
                            {solidCandidates.map(cand => (
                                <li key={cand.id} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-mono text-[11px] font-bold text-[var(--color-text-muted)] w-6 shrink-0">
                                            #{cand.consensusRank}
                                        </span>
                                        <span className="font-semibold text-[var(--color-text-main)] truncate">
                                            {cand.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2.5 shrink-0 font-mono tabular-nums">
                                        <span className="text-[11px] text-[var(--color-text-muted)]">
                                            {cand.electedCount}/{cand.evaluatedMethods}
                                        </span>
                                        <span className="text-xs font-bold text-[var(--color-accent)] w-12 text-right">
                                            {formatPct(cand.consensusShare, language)}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                        {c.election_conclusions_contested_label ?? ''}
                    </p>
                    {enteredCandidates.length === 0 && droppedCandidates.length === 0 ? (
                        <p className="text-[13px] text-[var(--color-text-muted)]">
                            {fill(c.election_conclusions_no_changes ?? '', { seats: consensus.seatCount.toLocaleString(language) })}
                        </p>
                    ) : (
                        <ul className="divide-y divide-[var(--color-card-border)]/40">
                            {enteredCandidates.map(cand => (
                                <li key={`in-${cand.id}`} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-mono text-[11px] font-bold text-[var(--color-accent)] w-6 shrink-0">
                                            #{cand.consensusRank}
                                        </span>
                                        <span className="font-semibold text-[var(--color-text-main)] truncate">
                                            {cand.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2.5 shrink-0">
                                        <span className="text-[11px] font-bold text-[var(--color-accent)]">
                                            {c.election_entered_badge ?? ''}
                                        </span>
                                        <span className="font-mono text-xs font-bold text-[var(--color-accent)] tabular-nums w-12 text-right">
                                            {formatPct(cand.consensusShare, language)}
                                        </span>
                                    </div>
                                </li>
                            ))}
                            {droppedCandidates.map(cand => (
                                <li key={`out-${cand.id}`} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400 w-6 shrink-0">
                                            #{cand.consensusRank}
                                        </span>
                                        <span className="font-semibold text-[var(--color-text-main)] truncate">
                                            {cand.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2.5 shrink-0">
                                        <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                            {c.election_left_badge ?? ''}
                                        </span>
                                        <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums w-12 text-right">
                                            {formatPct(cand.consensusShare, language)}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>

            {/* 4. Breakdown by family & quorum */}
            <section className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-[var(--color-text-main)] border-b border-[var(--color-card-border)] pb-2">
                    <Layers className="size-4 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                    <span>{c.election_conclusions_families_title ?? ''}</span>
                </h3>
                {quorum !== null && (
                    <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                        {fill(c.election_conclusions_quorum_text ?? '', {
                            valid: quorumMetCount.toLocaleString(language),
                            total: concl.quorum.totalMethods.toLocaleString(language),
                            quorum: formatXrd(quorum, language),
                        })}
                    </p>
                )}
                <ul className="divide-y divide-[var(--color-card-border)]/50">
                    {concl.byFamily.map(famRow => {
                        const FamIcon = FAMILY_ICON[famRow.family];
                        return (
                            <li key={famRow.family} className="flex items-start gap-2.5 py-2.5 first:pt-1 last:pb-0 text-xs">
                                <FamIcon className="size-3.5 mt-0.5 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                                <div className="min-w-0">
                                    <span className="font-bold text-[var(--color-text-main)]">{familyNames[famRow.family] || famRow.family}</span>
                                    <p className="text-[11.5px] text-[var(--color-text-muted)]">
                                        {fill(c.election_conclusions_family_row ?? '', {
                                            count: famRow.methodCount.toLocaleString(language),
                                            spread: formatPct(famRow.avgSpread, language),
                                            same: famRow.sameAsCurrentCount.toLocaleString(language),
                                        })}
                                    </p>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </section>
        </div>
    );
}
