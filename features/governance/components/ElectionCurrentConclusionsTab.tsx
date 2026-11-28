'use client';

import React from 'react';
import { Target, PieChart, ShieldCheck, Crown } from 'lucide-react';
import {
    computeElectionConclusions,
    type ElectionConsensusSummary,
    type MethodResult,
} from '../lib/votingMethods';
import { fill, formatPct, formatShare, formatXrd } from '../lib/format';
import { ConcentrationBar, type CompareDict } from './ComparisonParts';

/**
 * Editorial "Conclusions" tab inside `MethodGuideModal` for the Current Method
 * (1 XRD = 1 vote), matching the exact layout and styling of `ElectionConclusionsTab`.
 */
export function ElectionCurrentConclusionsTab({
    consensus,
    current,
    methods,
    voterPowers,
    quorum,
    gradeQuantile,
    c,
    language,
}: {
    consensus: ElectionConsensusSummary;
    current: MethodResult;
    methods: MethodResult[];
    voterPowers: number[];
    quorum: number | null;
    gradeQuantile?: string | null;
    c: CompareDict;
    language: string;
}) {
    const concl = computeElectionConclusions(consensus, methods, voterPowers, quorum, gradeQuantile);
    const quantilePct = formatPct(concl.quantileValue, language);
    const curBlock = concl.currentDecisiveBlock;
    const totalVoters = curBlock?.total ?? current.counted;
    const decCount = curBlock?.count ?? 0;
    const accPower = curBlock?.xrd ?? 0;

    const currentSeats = current.electionSummary?.elected ?? [];
    const seatCount = current.electionSummary?.seatCount ?? consensus.seatCount;
    const { sameAsCurrentCount: sameCount, alternativeMethodsCount: othersCount, sameAsCurrentShare } = concl.councilStability;
    const consensusById = new Map(consensus.candidates.map(cand => [cand.id, cand]));

    const curNak = current.concentration.nakamoto;
    const curSpread = current.concentration.spread;
    const curEff = current.concentration.effective;
    const curTop1 = current.concentration.top1;
    const curTop10 = current.concentration.top10;
    const curEffStr = curEff.toLocaleString(language, { maximumFractionDigits: 1 });
    const curTotalStr = totalVoters.toLocaleString(language);

    return (
        <div className="space-y-8">
            {/* 1. Decisive block at applied quantile */}
            {curBlock && (
                <section className="border-l-2 border-[var(--color-primary)] pl-4 space-y-2">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
                        <Target className="size-3.5 shrink-0" aria-hidden="true" />
                        <span>{fill(c.election_conclusions_decisive_title ?? '', { quantilePct })}</span>
                    </h3>
                    <p className="text-[13.5px] leading-relaxed font-medium text-[var(--color-text-main)]">
                        {fill(c.election_current_conclusions_decisive_text ?? '', {
                            count: decCount.toLocaleString(language),
                            total: curTotalStr,
                            pct: formatShare(curBlock.share, language),
                            xrd: formatXrd(accPower, language),
                            quantilePct,
                        })}
                    </p>
                </section>
            )}

            {/* 2. Decentralisation metrics + Who holds the voting weight */}
            {curNak !== null && curSpread !== null && (
                <section className="space-y-3">
                    <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-[var(--color-text-main)] border-b border-[var(--color-card-border)] pb-2">
                        <PieChart className="size-4 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                        <span>{c.election_current_conclusions_metrics_title ?? ''}</span>
                    </h3>
                    <table className="w-full border-collapse text-xs">
                        <thead>
                            <tr>
                                <th scope="col" className="pb-1.5" />
                                <th
                                    scope="col"
                                    className="pb-1.5 pl-4 w-px whitespace-nowrap text-right text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)]"
                                >
                                    {c.election_conclusions_col_current ?? ''}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-card-border)]/40">
                            {[
                                {
                                    label: fill(c.election_conclusions_row_decisive ?? '', { quantilePct }),
                                    labelTip: fill(c.election_conclusions_tip_decisive ?? '', { quantilePct }),
                                    curTip: curBlock ? fill(c.election_conclusions_tip_cur_decisive ?? '', {
                                        count: decCount.toLocaleString(language),
                                        total: curTotalStr,
                                        pct: formatShare(curBlock.share, language),
                                        xrd: formatXrd(accPower, language),
                                        quantilePct,
                                    }) : undefined,
                                    cur: `${decCount.toLocaleString(language)}/${curTotalStr}`,
                                },
                                {
                                    label: c.election_conclusions_row_nakamoto ?? '',
                                    labelTip: c.election_conclusions_tip_nakamoto ?? '',
                                    curTip: fill(c.election_conclusions_tip_cur_nakamoto ?? '', {
                                        n_val: curNak.toLocaleString(language),
                                        total: curTotalStr,
                                        pct: formatShare(curNak / Math.max(1, totalVoters), language),
                                    }),
                                    cur: `${curNak.toLocaleString(language)}/${curTotalStr}`,
                                },
                                {
                                    label: c.election_conclusions_top1_label ?? '',
                                    labelTip: c.election_conclusions_tip_top1 ?? '',
                                    curTip: fill(c.election_conclusions_tip_cur_top1 ?? '', {
                                        pct: formatPct(curTop1, language),
                                    }),
                                    cur: formatPct(curTop1, language),
                                },
                                {
                                    label: c.election_conclusions_top10_label ?? '',
                                    labelTip: c.election_conclusions_tip_top10 ?? '',
                                    curTip: fill(c.election_conclusions_tip_cur_top10 ?? '', {
                                        pct: formatPct(curTop10, language),
                                    }),
                                    cur: formatPct(curTop10, language),
                                },
                                {
                                    label: c.detail_spread ?? '',
                                    labelTip: c.election_conclusions_tip_spread ?? '',
                                    curTip: fill(c.election_conclusions_tip_cur_spread ?? '', {
                                        pct: formatPct(curSpread, language),
                                        eff: curEffStr,
                                        total: curTotalStr,
                                    }),
                                    cur: formatPct(curSpread, language),
                                },
                                {
                                    label: c.election_conclusions_row_effective ?? '',
                                    labelTip: c.election_conclusions_tip_effective ?? '',
                                    curTip: fill(c.election_conclusions_tip_cur_effective ?? '', {
                                        eff: curEffStr,
                                        total: curTotalStr,
                                    }),
                                    cur: curEffStr,
                                },
                            ].map(row => (
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
                                        className="py-2 pl-4 w-px whitespace-nowrap font-mono text-right tabular-nums font-bold text-[var(--color-text-main)] cursor-help align-middle"
                                    >
                                        {row.cur}
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
                            <p className="text-[11px] font-bold text-[var(--color-primary)]">
                                {c.election_conclusions_col_current ?? ''}
                            </p>
                            <ConcentrationBar
                                top1={curTop1}
                                top10={curTop10}
                                c={c}
                                language={language}
                            />
                        </div>
                    </div>
                </section>
            )}

            {/* 3. Elected council & agreement with alternative methods */}
            <section className="space-y-4">
                <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-[var(--color-text-main)] border-b border-[var(--color-card-border)] pb-2">
                    <Crown className="size-4 shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
                    <span>{fill(c.election_current_conclusions_council_title ?? '', { seats: seatCount.toLocaleString(language) })}</span>
                </h3>
                <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                    {fill(c.election_conclusions_stability_text ?? '', {
                        same: sameCount.toLocaleString(language),
                        others: othersCount.toLocaleString(language),
                        pct: formatShare(sameAsCurrentShare, language),
                        seats: seatCount.toLocaleString(language),
                    })}
                </p>

                {currentSeats.length > 0 && (
                    <ul className="divide-y divide-[var(--color-card-border)]/40">
                        {currentSeats.map(cand => {
                            const cons = consensusById.get(cand.id);
                            const pctStr = cons ? formatPct(cons.consensusShare, language) : null;
                            const totalStr = consensus.evaluatedMethods.toLocaleString(language);
                            return (
                                <li
                                    key={cand.id}
                                    className="grid grid-cols-[2rem_minmax(0,1fr)_3.75rem_4.25rem] items-center gap-2 py-1.5 text-[13px]"
                                >
                                    <span className="font-mono text-[11px] font-bold text-[var(--color-primary)] tabular-nums">
                                        #{cand.rank}
                                    </span>
                                    <span className="font-semibold text-[var(--color-text-main)] truncate">
                                        {cand.label}
                                    </span>
                                    {cons && pctStr ? (
                                        <>
                                            <span
                                                title={fill(c.election_conclusions_tip_seat_methods ?? '', {
                                                    elected: cons.electedCount.toLocaleString(language),
                                                    total: totalStr,
                                                })}
                                                className="font-mono text-[11px] text-[var(--color-text-muted)] tabular-nums text-right whitespace-nowrap cursor-help"
                                            >
                                                {cons.electedCount}/{cons.evaluatedMethods}
                                            </span>
                                            <span
                                                title={fill(c.election_conclusions_tip_seat_share ?? '', {
                                                    name: cand.label,
                                                    pct: pctStr,
                                                    total: totalStr,
                                                })}
                                                className={`font-mono text-xs font-bold tabular-nums text-right whitespace-nowrap cursor-help ${
                                                    cons.inSeats ? 'text-[var(--color-accent)]' : 'text-amber-600 dark:text-amber-400'
                                                }`}
                                            >
                                                {pctStr}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span />
                                            <span />
                                        </>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            {/* 4. Quorum */}
            {quorum != null && quorum > 0 && (
                <section className="space-y-2">
                    <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-[var(--color-text-main)] border-b border-[var(--color-card-border)] pb-2">
                        <ShieldCheck className={`size-4 shrink-0 ${current.quorumMet ? 'text-[var(--color-accent)]' : 'text-amber-500'}`} aria-hidden="true" />
                        <span>{c.detail_quorum ?? ''}</span>
                    </h3>
                    <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                        {fill(c.election_current_conclusions_quorum_text ?? '', {
                            eligible: formatXrd(current.quorumXrd, language),
                            quorum: formatXrd(quorum, language),
                            pct: formatPct(current.quorumXrd / quorum, language),
                        })}
                    </p>
                </section>
            )}
        </div>
    );
}
