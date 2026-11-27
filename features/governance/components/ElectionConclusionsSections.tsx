'use client';

import React from 'react';
import { ShieldCheck, Layers } from 'lucide-react';
import type { ElectionConsensusConclusions, ElectionConsensusSummary } from '../lib/votingMethods';
import { fill, formatPct, formatShare, formatXrd } from '../lib/format';
import { FAMILY_ICON, type CompareDict } from './ComparisonParts';

/** Council stability, solid seats, and contested seat changes vs 1 XRD = 1 vote. */
export function ElectionCouncilStabilitySection({
    consensus,
    concl,
    c,
    language,
}: {
    consensus: ElectionConsensusSummary;
    concl: ElectionConsensusConclusions;
    c: CompareDict;
    language: string;
}) {
    const {
        sameAsCurrentCount: sameCount,
        alternativeMethodsCount: othersCount,
        solidSeats: solidCandidates,
        enteredSeats: enteredCandidates,
        droppedSeats: droppedCandidates,
    } = concl.councilStability;
    const totalStr = consensus.evaluatedMethods.toLocaleString(language);
    const seatsStr = consensus.seatCount.toLocaleString(language);

    return (
        <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-[var(--color-text-main)] border-b border-[var(--color-card-border)] pb-2">
                <ShieldCheck className="size-4 shrink-0 text-[var(--color-accent)]" aria-hidden="true" />
                <span>{fill(c.election_conclusions_stability_title ?? '', { n: totalStr })}</span>
            </h3>
            <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                {fill(c.election_conclusions_stability_text ?? '', {
                    same: sameCount.toLocaleString(language),
                    others: othersCount.toLocaleString(language),
                    pct: formatShare(concl.councilStability.sameAsCurrentShare, language),
                    seats: seatsStr,
                })}
            </p>

            {solidCandidates.length > 0 && (
                <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                        {c.election_conclusions_solid_label ?? ''}
                    </p>
                    <ul className="divide-y divide-[var(--color-card-border)]/40">
                        {solidCandidates.map(cand => {
                            const rankStr = String(cand.consensusRank);
                            const electedStr = cand.electedCount.toLocaleString(language);
                            const candTotalStr = cand.evaluatedMethods.toLocaleString(language);
                            const pctStr = formatPct(cand.consensusShare, language);
                            return (
                                <li key={cand.id} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span
                                            title={fill(c.election_conclusions_tip_seat_rank ?? '', { rank: rankStr, total: candTotalStr })}
                                            className="font-mono text-[11px] font-bold text-[var(--color-text-muted)] w-6 shrink-0 cursor-help"
                                        >
                                            #{cand.consensusRank}
                                        </span>
                                        <span
                                            title={fill(c.election_conclusions_tip_solid_name ?? '', {
                                                name: cand.label,
                                                rank: rankStr,
                                                elected: electedStr,
                                                total: candTotalStr,
                                            })}
                                            className="font-semibold text-[var(--color-text-main)] truncate cursor-help"
                                        >
                                            {cand.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2.5 shrink-0 font-mono tabular-nums">
                                        <span
                                            title={fill(c.election_conclusions_tip_seat_methods ?? '', {
                                                elected: electedStr,
                                                total: candTotalStr,
                                            })}
                                            className="text-[11px] text-[var(--color-text-muted)] cursor-help"
                                        >
                                            {cand.electedCount}/{cand.evaluatedMethods}
                                        </span>
                                        <span
                                            title={fill(c.election_conclusions_tip_seat_share ?? '', {
                                                name: cand.label,
                                                pct: pctStr,
                                                total: candTotalStr,
                                            })}
                                            className="text-xs font-bold text-[var(--color-accent)] w-12 text-right cursor-help"
                                        >
                                            {pctStr}
                                        </span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}

            <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    {c.election_conclusions_contested_label ?? ''}
                </p>
                {enteredCandidates.length === 0 && droppedCandidates.length === 0 ? (
                    <p className="text-[13px] text-[var(--color-text-muted)]">
                        {fill(c.election_conclusions_no_changes ?? '', { seats: seatsStr })}
                    </p>
                ) : (
                    <ul className="divide-y divide-[var(--color-card-border)]/40">
                        {enteredCandidates.map(cand => {
                            const rankStr = String(cand.consensusRank);
                            const curStr = cand.currentRank != null ? String(cand.currentRank) : '—';
                            const pctStr = formatPct(cand.consensusShare, language);
                            return (
                                <li key={`in-${cand.id}`} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span
                                            title={cand.currentRank != null
                                                ? fill(c.election_conclusions_tip_seat_rank_change ?? '', { rank: rankStr, current: curStr })
                                                : fill(c.election_conclusions_tip_seat_rank ?? '', { rank: rankStr, total: totalStr })}
                                            className="font-mono text-[11px] font-bold text-[var(--color-accent)] w-6 shrink-0 cursor-help"
                                        >
                                            #{cand.consensusRank}
                                        </span>
                                        <span
                                            title={fill(c.election_conclusions_tip_entered_name ?? '', {
                                                name: cand.label,
                                                seats: seatsStr,
                                                current: curStr,
                                                rank: rankStr,
                                            })}
                                            className="font-semibold text-[var(--color-text-main)] truncate cursor-help"
                                        >
                                            {cand.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2.5 shrink-0">
                                        <span
                                            title={fill(c.election_conclusions_tip_entered_badge ?? '', {
                                                current: curStr,
                                                rank: rankStr,
                                                total: totalStr,
                                            })}
                                            className="text-[11px] font-bold text-[var(--color-accent)] cursor-help"
                                        >
                                            {c.election_entered_badge ?? ''}
                                        </span>
                                        <span
                                            title={fill(c.election_conclusions_tip_seat_share ?? '', {
                                                name: cand.label,
                                                pct: pctStr,
                                                total: totalStr,
                                            })}
                                            className="font-mono text-xs font-bold text-[var(--color-accent)] tabular-nums w-12 text-right cursor-help"
                                        >
                                            {pctStr}
                                        </span>
                                    </div>
                                </li>
                            );
                        })}
                        {droppedCandidates.map(cand => {
                            const rankStr = String(cand.consensusRank);
                            const curStr = cand.currentRank != null ? String(cand.currentRank) : '—';
                            const pctStr = formatPct(cand.consensusShare, language);
                            return (
                                <li key={`out-${cand.id}`} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span
                                            title={cand.currentRank != null
                                                ? fill(c.election_conclusions_tip_seat_rank_change ?? '', { rank: rankStr, current: curStr })
                                                : fill(c.election_conclusions_tip_seat_rank ?? '', { rank: rankStr, total: totalStr })}
                                            className="font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400 w-6 shrink-0 cursor-help"
                                        >
                                            #{cand.consensusRank}
                                        </span>
                                        <span
                                            title={fill(c.election_conclusions_tip_dropped_name ?? '', {
                                                name: cand.label,
                                                seats: seatsStr,
                                                current: curStr,
                                                rank: rankStr,
                                            })}
                                            className="font-semibold text-[var(--color-text-main)] truncate cursor-help"
                                        >
                                            {cand.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2.5 shrink-0">
                                        <span
                                            title={fill(c.election_conclusions_tip_dropped_badge ?? '', {
                                                current: curStr,
                                                rank: rankStr,
                                                total: totalStr,
                                            })}
                                            className="text-[11px] font-bold text-amber-600 dark:text-amber-400 cursor-help"
                                        >
                                            {c.election_left_badge ?? ''}
                                        </span>
                                        <span
                                            title={fill(c.election_conclusions_tip_seat_share ?? '', {
                                                name: cand.label,
                                                pct: pctStr,
                                                total: totalStr,
                                            })}
                                            className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums w-12 text-right cursor-help"
                                        >
                                            {pctStr}
                                        </span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </section>
    );
}

/** Family breakdown and quorum attainment summary across all evaluated methods. */
export function ElectionFamilyBreakdownSection({
    concl,
    quorum,
    c,
    language,
}: {
    concl: ElectionConsensusConclusions;
    quorum: number | null;
    c: CompareDict;
    language: string;
}) {
    const familyNames = (c.families ?? {}) as Record<string, string>;

    return (
        <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-[var(--color-text-main)] border-b border-[var(--color-card-border)] pb-2">
                <Layers className="size-4 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                <span>{c.election_conclusions_families_title ?? ''}</span>
            </h3>
            {quorum !== null && (
                <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                    {fill(c.election_conclusions_quorum_text ?? '', {
                        valid: concl.quorum.metCount.toLocaleString(language),
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
    );
}
