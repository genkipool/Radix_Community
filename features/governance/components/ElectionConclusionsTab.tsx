'use client';

import React from 'react';
import { Target, PieChart } from 'lucide-react';
import { computeElectionConclusions, type ElectionConsensusSummary, type MethodResult } from '../lib/votingMethods';
import { fill, formatPct, formatShare, formatXrd } from '../lib/format';
import { ConcentrationBar, type CompareDict } from './ComparisonParts';
import { ElectionCouncilStabilitySection, ElectionFamilyBreakdownSection } from './ElectionConclusionsSections';

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
                    <table className="w-full border-collapse text-xs">
                        <thead>
                            <tr>
                                <th scope="col" className="pb-1.5" />
                                <th
                                    scope="col"
                                    className="pb-1.5 pl-4 w-px whitespace-nowrap text-right text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]"
                                >
                                    {c.election_conclusions_col_current ?? ''}
                                </th>
                                <th
                                    scope="col"
                                    className="pb-1.5 pl-4 w-px whitespace-nowrap text-right text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)]"
                                >
                                    {fill(c.election_conclusions_col_weighted ?? '', { n: consensus.evaluatedMethods.toLocaleString(language) })}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-card-border)]/40">
                            {(() => {
                                const nStr = consensus.evaluatedMethods.toLocaleString(language);
                                const wCountedStr = wc.counted.toLocaleString(language, { maximumFractionDigits: 1 });
                                const wEffStr = wc.effective.toLocaleString(language, { maximumFractionDigits: 1 });
                                const curEffStr = current.concentration.effective.toLocaleString(language, { maximumFractionDigits: 1 });
                                const curTotalStr = current.counted.toLocaleString(language);
                                return [
                                    {
                                        label: fill(c.election_conclusions_row_decisive ?? '', { quantilePct }),
                                        labelTip: fill(c.election_conclusions_tip_decisive ?? '', { quantilePct }),
                                        curTip: curBlock ? fill(c.election_conclusions_tip_cur_decisive ?? '', {
                                            count: decisiveCount.toLocaleString(language),
                                            total: decisiveTotal.toLocaleString(language),
                                            pct: formatShare(curBlock.share, language),
                                            xrd: formatXrd(accPower, language),
                                            quantilePct,
                                        }) : undefined,
                                        wgtTip: wgtBlock ? fill(c.election_conclusions_tip_wgt_decisive ?? '', {
                                            n: nStr,
                                            count: wgtBlock.avgCount.toLocaleString(language, { maximumFractionDigits: 1 }),
                                            total: wCountedStr,
                                            pct: formatShare(wgtBlock.share, language),
                                            quantilePct,
                                            ratio: weightedDecisiveRatio ?? '1',
                                        }) : undefined,
                                        cur: `${decisiveCount.toLocaleString(language)}/${decisiveTotal.toLocaleString(language)}`,
                                        wgt: wc.decisiveQuantile != null
                                            ? `${wc.decisiveQuantile.toLocaleString(language, { maximumFractionDigits: 1 })}/${wCountedStr}`
                                            : '—',
                                        best: wc.decisiveQuantile == null || wc.decisiveQuantile === decisiveCount
                                            ? null
                                            : wc.decisiveQuantile > decisiveCount ? 'wgt' : 'cur',
                                    },
                                    {
                                        label: c.election_conclusions_row_nakamoto ?? '',
                                        labelTip: c.election_conclusions_tip_nakamoto ?? '',
                                        curTip: fill(c.election_conclusions_tip_cur_nakamoto ?? '', {
                                            n_val: current.concentration.nakamoto.toLocaleString(language),
                                            total: curTotalStr,
                                            pct: formatShare(current.concentration.nakamoto / Math.max(1, current.counted), language),
                                        }),
                                        wgtTip: wc.nakamoto != null ? fill(c.election_conclusions_tip_wgt_nakamoto ?? '', {
                                            n: nStr,
                                            n_val: wc.nakamoto.toLocaleString(language, { maximumFractionDigits: 1 }),
                                            total: wCountedStr,
                                            pct: wc.counted > 0 ? formatShare(wc.nakamoto / wc.counted, language) : '0 %',
                                        }) : undefined,
                                        cur: `${current.concentration.nakamoto.toLocaleString(language)}/${curTotalStr}`,
                                        wgt: wc.nakamoto != null
                                            ? `${wc.nakamoto.toLocaleString(language, { maximumFractionDigits: 1 })}/${wCountedStr}`
                                            : '—',
                                        best: wc.nakamoto == null || wc.nakamoto === current.concentration.nakamoto
                                            ? null
                                            : wc.nakamoto > current.concentration.nakamoto ? 'wgt' : 'cur',
                                    },
                                    {
                                        label: c.election_conclusions_top1_label ?? '',
                                        labelTip: c.election_conclusions_tip_top1 ?? '',
                                        curTip: fill(c.election_conclusions_tip_cur_top1 ?? '', {
                                            pct: formatPct(current.concentration.top1, language),
                                        }),
                                        wgtTip: fill(c.election_conclusions_tip_wgt_top1 ?? '', {
                                            n: nStr,
                                            curPct: formatPct(current.concentration.top1, language),
                                            pct: formatPct(wc.top1, language),
                                        }),
                                        cur: formatPct(current.concentration.top1, language),
                                        wgt: formatPct(wc.top1, language),
                                        best: wc.top1 === current.concentration.top1
                                            ? null
                                            : wc.top1 < current.concentration.top1 ? 'wgt' : 'cur',
                                    },
                                    {
                                        label: c.election_conclusions_top10_label ?? '',
                                        labelTip: c.election_conclusions_tip_top10 ?? '',
                                        curTip: fill(c.election_conclusions_tip_cur_top10 ?? '', {
                                            pct: formatPct(current.concentration.top10, language),
                                        }),
                                        wgtTip: fill(c.election_conclusions_tip_wgt_top10 ?? '', {
                                            n: nStr,
                                            curPct: formatPct(current.concentration.top10, language),
                                            pct: formatPct(wc.top10, language),
                                        }),
                                        cur: formatPct(current.concentration.top10, language),
                                        wgt: formatPct(wc.top10, language),
                                        best: wc.top10 === current.concentration.top10
                                            ? null
                                            : wc.top10 < current.concentration.top10 ? 'wgt' : 'cur',
                                    },
                                    {
                                        label: c.detail_spread ?? '',
                                        labelTip: c.election_conclusions_tip_spread ?? '',
                                        curTip: fill(c.election_conclusions_tip_cur_spread ?? '', {
                                            pct: formatPct(current.concentration.spread, language),
                                            eff: curEffStr,
                                            total: curTotalStr,
                                        }),
                                        wgtTip: wc.spread != null ? fill(c.election_conclusions_tip_wgt_spread ?? '', {
                                            n: nStr,
                                            curPct: formatPct(current.concentration.spread, language),
                                            pct: formatPct(wc.spread, language),
                                            eff: wEffStr,
                                            // Spread divides by every address that voted (1 XRD = 1 vote counts them all).
                                            total: curTotalStr,
                                        }) : undefined,
                                        cur: formatPct(current.concentration.spread, language),
                                        wgt: wc.spread != null ? formatPct(wc.spread, language) : '—',
                                        best: wc.spread == null || wc.spread === current.concentration.spread
                                            ? null
                                            : wc.spread > current.concentration.spread ? 'wgt' : 'cur',
                                    },
                                    {
                                        label: c.election_conclusions_row_effective ?? '',
                                        labelTip: c.election_conclusions_tip_effective ?? '',
                                        curTip: fill(c.election_conclusions_tip_cur_effective ?? '', {
                                            eff: curEffStr,
                                            total: curTotalStr,
                                        }),
                                        wgtTip: fill(c.election_conclusions_tip_wgt_effective ?? '', {
                                            n: nStr,
                                            eff: wEffStr,
                                            curEff: curEffStr,
                                        }),
                                        cur: curEffStr,
                                        wgt: wEffStr,
                                        best: wc.effective === current.concentration.effective
                                            ? null
                                            : wc.effective > current.concentration.effective ? 'wgt' : 'cur',
                                    },
                                ];
                            })().map(row => (
                                <tr key={row.label}>
                                    <th
                                        scope="row"
                                        title={row.labelTip}
                                        className="py-2 text-left text-[var(--color-text-secondary)] font-medium cursor-help align-middle"
                                    >
                                        {row.label}
                                    </th>
                                    <td
                                        title={row.curTip}
                                        className={`py-2 pl-4 w-px whitespace-nowrap font-mono text-right tabular-nums cursor-help align-middle ${
                                            row.best === 'cur'
                                                ? 'font-bold text-[var(--color-text-main)]'
                                                : 'font-normal text-[var(--color-text-muted)]'
                                        }`}
                                    >
                                        {row.cur}
                                    </td>
                                    <td
                                        title={row.wgtTip}
                                        className={`py-2 pl-4 w-px whitespace-nowrap font-mono text-right tabular-nums cursor-help align-middle ${
                                            row.best === 'wgt'
                                                ? 'font-bold text-[var(--color-text-main)]'
                                                : 'font-normal text-[var(--color-text-muted)]'
                                        }`}
                                    >
                                        {row.wgt}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="pt-2 space-y-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                            {c.detail_concentration ?? ''}
                        </p>
                        <div className="space-y-1.5">
                            <p className="text-[11px] font-bold text-[var(--color-text-muted)]">
                                {c.election_conclusions_col_current ?? ''}
                            </p>
                            <ConcentrationBar
                                top1={current.concentration.top1}
                                top10={current.concentration.top10}
                                c={c}
                                language={language}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-[11px] font-bold text-[var(--color-primary)]">
                                {fill(c.election_conclusions_col_weighted ?? '', { n: consensus.evaluatedMethods.toLocaleString(language) })}
                            </p>
                            <ConcentrationBar
                                top1={wc.top1}
                                top10={wc.top10}
                                c={c}
                                language={language}
                            />
                        </div>
                    </div>
                </section>
            )}

            {/* 3. Council stability & contested cutoff */}
            <ElectionCouncilStabilitySection
                consensus={consensus}
                concl={concl}
                c={c}
                language={language}
            />

            {/* 4. Breakdown by family & quorum */}
            <ElectionFamilyBreakdownSection
                concl={concl}
                quorum={quorum}
                c={c}
                language={language}
            />
        </div>
    );
}
