'use client';

import React from 'react';
import { Crown, Scale, ShieldCheck, Vote } from 'lucide-react';
import type { MajorityJudgmentElectionData } from '../types';
import type { GovernanceElectionSpec } from '../lib/governanceVotes';
import {
    MJ_GRADE_BAR_COLOR,
    MJ_GRADE_DOT_COLOR,
    MJ_GRADE_ORDER,
    bandHint,
    gradeLabel,
    isCandidateElected,
    parseQuantile,
} from '../lib/majorityJudgment';
import { fill, formatDate, formatPct, formatXrd } from '../lib/format';
import type { G } from './GovernanceBadges';

export { ElectionVoteSidebar } from './ElectionVoteSidebar';
export { ElectionCandidatesBallot } from './ElectionCandidatesBallot';
export {
    ElectionConsensusKpiGrid,
    ElectionConsensusCandidateCards,
    ElectionMethodCandidatesGrid,
} from './ElectionConsensusKpiGrid';

type MjDict = NonNullable<G['mj']>;

/** Stacked 5-grade distribution bar with a quantile tick mark (default 60%). */
export function GradeDistributionBar({
    histogram,
    totalPower,
    quantile = '3/5',
    mj,
    language,
    heightClass = 'h-2',
    showTooltips = false,
}: {
    histogram: Record<number, string | number> | readonly number[];
    totalPower: number;
    quantile?: string;
    mj: MjDict | undefined;
    language: string;
    heightClass?: string;
    showTooltips?: boolean;
}) {
    const tickPct = `${Math.round(parseQuantile(quantile) * 100)}%`;
    return (
        <div className={`relative ${heightClass} w-full rounded-full bg-[var(--color-card-border)] overflow-hidden flex`}>
            {MJ_GRADE_ORDER.map(gradeIdx => {
                const raw = Array.isArray(histogram)
                    ? histogram[gradeIdx]
                    : (histogram as Record<number, string | number>)[gradeIdx];
                const xrd = Number(raw) || 0;
                const pct = totalPower > 0 ? (xrd / totalPower) * 100 : 0;
                if (pct <= 0) return null;
                return (
                    <span
                        key={gradeIdx}
                        className={`h-full ${MJ_GRADE_BAR_COLOR[gradeIdx]}`}
                        style={{ width: `${pct}%` }}
                        title={showTooltips ? `${gradeLabel(mj, gradeIdx)}: ${formatXrd(xrd, language)} XRD (${pct.toFixed(1)}%)` : undefined}
                    />
                );
            })}
            <span
                className="pointer-events-none absolute inset-y-0 w-0.5 bg-[var(--color-text-main)]/80"
                style={{ left: tickPct }}
                aria-hidden="true"
            />
        </div>
    );
}

export function electionOutcomeBadge(outcome: string, mj: MjDict | undefined): { label: string; cls: string } {
    if (outcome === 'ELECTED') {
        return {
            label: mj?.outcome_elected ?? '',
            cls: 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/15 text-[var(--color-accent)]',
        };
    }
    if (outcome === 'RESERVE') {
        return {
            label: mj?.outcome_reserve ?? '',
            cls: 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/15 text-[var(--color-primary)]',
        };
    }
    if (outcome === 'TIED') {
        return {
            label: mj?.outcome_tied ?? '',
            cls: 'border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400',
        };
    }
    return {
        label: mj?.outcome_not_elected ?? '',
        cls: 'border-[var(--color-card-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)]',
    };
}

/**
 * Candidate-list approval (TC summary) + Election rules cards matching the
 * official Majority Judgment election view.
 */
export function ElectionOverviewCards({
    election,
    electionData,
    quorum,
    g,
    language,
}: {
    election: GovernanceElectionSpec;
    electionData: MajorityJudgmentElectionData | null;
    quorum: number | null;
    g: G;
    language: string;
}) {
    const mj = g.mj;
    const tc = electionData?.temperatureCheckResult ?? null;
    const quorumXrd = electionData ? Number(electionData.quorumXrd) : quorum;
    const minGrade = electionData?.minimumMedianGrade ?? election.minimumMedianGrade ?? 2;
    const quantile = electionData?.gradeQuantileApplied ?? '3/5';
    const reserveDays = electionData?.reserveListDays ?? null;

    return (
        <div className="space-y-4">
            {tc && (
                <section className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5 space-y-4">
                    <div className="space-y-1">
                        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-main)]">
                            <ShieldCheck className="size-4 text-[var(--color-primary)]" aria-hidden="true" />
                            <span>{mj?.tc_approval_title ?? ''}</span>
                        </h2>
                        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                            {mj?.tc_approval_hint ?? ''}
                        </p>
                    </div>
                    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                        <div>
                            <dt className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)]">
                                {mj?.tc_for_against ?? ''}
                            </dt>
                            <dd className="mt-1 font-mono font-bold text-[var(--color-text-main)] tabular-nums">
                                {formatXrd(Number(tc.forVotingPower) || 0, language)} / {formatXrd(Number(tc.againstVotingPower) || 0, language)} XRD
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)]">
                                {mj?.tc_fixed_quorum ?? ''}
                            </dt>
                            <dd className="mt-1 font-mono font-bold text-[var(--color-text-main)] tabular-nums">
                                {formatXrd(Number(tc.participationXrd) || 0, language)} / {formatXrd(Number(tc.quorumXrd) || 0, language)} XRD
                            </dd>
                            <dd className={`mt-0.5 text-[11px] font-semibold ${tc.quorumMet ? 'text-[var(--color-accent)]' : 'text-amber-500'}`}>
                                {tc.quorumMet ? (mj?.tc_quorum_met ?? '') : (mj?.tc_quorum_not_met ?? '')}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)]">
                                {mj?.tc_for_share ?? ''}
                            </dt>
                            <dd className="mt-1 font-mono font-bold text-[var(--color-text-main)] tabular-nums">
                                {formatPct(Number(tc.forShare) || 0, language)}
                            </dd>
                            <dd className={`mt-0.5 text-[11px] font-semibold ${tc.approvalMet ? 'text-[var(--color-accent)]' : 'text-amber-500'}`}>
                                {tc.approvalMet ? (mj?.tc_approval_met ?? '') : (mj?.tc_approval_not_met ?? '')}
                            </dd>
                        </div>
                    </dl>
                    {tc.recordedAt && (
                        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-accent)]" suppressHydrationWarning>
                            {fill(tc.passed ? (mj?.tc_passed_recorded ?? '') : (mj?.tc_failed_recorded ?? ''), {
                                date: formatDate(Date.parse(tc.recordedAt) / 1000, language),
                            })}
                        </p>
                    )}
                </section>
            )}

            <section className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5 space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-main)]">
                        <Scale className="size-4 text-[var(--color-primary)]" aria-hidden="true" />
                        <span>{mj?.rules_title ?? ''}</span>
                    </h2>
                    {electionData?.parameterSetId && (
                        <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
                            {electionData.parameterSetId}
                            {electionData.parameterSetVersion != null ? ` · v${electionData.parameterSetVersion}` : ''}
                        </span>
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <dl className="space-y-1.5">
                        <dt className="font-bold text-[var(--color-text-main)]">{mj?.rules_seats ?? ''}</dt>
                        {election.seatCount !== null && (
                            <dd className="text-[var(--color-text-secondary)]">
                                {fill(mj?.rules_seats_value ?? '', {
                                    seats: String(election.seatCount),
                                    role: election.roleId ?? '—',
                                })}
                            </dd>
                        )}
                        {reserveDays !== null && (
                            <dd className="text-[var(--color-text-secondary)]">
                                {fill(mj?.rules_reserve ?? '', { days: String(reserveDays) })}
                            </dd>
                        )}
                    </dl>
                    <dl className="space-y-1.5">
                        <dt className="font-bold text-[var(--color-text-main)]">{mj?.rules_method ?? ''}</dt>
                        {quorumXrd !== null && Number.isFinite(quorumXrd) && (
                            <dd className="text-[var(--color-text-secondary)]">
                                {fill(mj?.rules_quorum ?? '', { amount: formatXrd(quorumXrd, language) })}
                            </dd>
                        )}
                        <dd className="text-[var(--color-text-secondary)]">
                            {fill(mj?.rules_quantile ?? '', { quantile })}
                        </dd>
                        <dd className="text-[var(--color-text-secondary)]">
                            {fill(mj?.rules_min_grade ?? '', { grade: gradeLabel(mj, minGrade) })}
                        </dd>
                        <dd className="text-[var(--color-text-muted)] leading-relaxed">
                            {mj?.rules_tie_note ?? ''}
                        </dd>
                    </dl>
                </div>
            </section>
        </div>
    );
}

/**
 * 2-row × 7-column KPI strip of all candidates ordered by rank, sitting right
 * under the headline KPI cards in the Results & Comparison tabs.
 */
export function ElectionCandidatesKpiGrid({
    election,
    electionData,
    g,
    language,
}: {
    election: GovernanceElectionSpec;
    electionData: MajorityJudgmentElectionData;
    g: G;
    language: string;
}) {
    const mj = g.mj;
    const totalPower = Number(electionData.totalVotingPower) || 0;
    const resultById = new Map(electionData.candidateResults.map(r => [r.candidateId, r]));
    const ranked = [...election.candidates].sort(
        (a, b) => (resultById.get(a.id)?.rank ?? 999) - (resultById.get(b.id)?.rank ?? 999),
    );
    const seats = election.seatCount ?? 0;

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
            {ranked.map((candidate, idx) => {
                const res = resultById.get(candidate.id);
                if (!res) return null;
                const inSeats = seats > 0 && idx < seats;
                const qualifyingXrd = Number(res.histogram[res.qualifyingGrade]) || 0;

                return (
                    <div
                        key={candidate.id}
                        title={`${candidate.displayName} · #${res.rank} · ${gradeLabel(mj, res.qualifyingGrade)}`}
                        className={`min-w-0 flex flex-col justify-between gap-2 rounded-2xl border p-3 transition-colors ${
                            inSeats
                                ? 'border-[var(--color-primary)]/35 bg-[var(--color-card-bg)]'
                                : 'border-[var(--color-card-border)] bg-[var(--color-card-bg)]'
                        }`}
                    >
                        <div className="flex items-center justify-between gap-1.5 min-w-0">
                            <span className="truncate text-xs font-bold text-[var(--color-text-main)]">
                                {candidate.displayName}
                            </span>
                            <span className={`shrink-0 font-mono text-[10px] font-bold ${inSeats ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                                #{res.rank}
                            </span>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-1">
                                <span className={`block truncate text-sm font-black leading-none ${res.electable ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-main)]'}`}>
                                    {gradeLabel(mj, res.qualifyingGrade)}
                                </span>
                                {isCandidateElected(res, idx, seats) && (
                                    <span
                                        className="inline-flex shrink-0 cursor-help"
                                        title={fill(mj?.elected_crown_tip ?? mj?.outcome_elected ?? '', { seats: String(seats) })}
                                    >
                                        <Crown className="size-3.5 text-[var(--color-primary)]" aria-hidden="true" />
                                    </span>
                                )}
                            </div>
                            <GradeDistributionBar
                                histogram={res.histogram}
                                totalPower={totalPower}
                                quantile={electionData.gradeQuantileApplied}
                                mj={mj}
                                language={language}
                                heightClass="h-1.5"
                            />
                        </div>

                        <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-[var(--color-text-muted)] tabular-nums">
                            <span className="truncate">{formatXrd(qualifyingXrd, language)}</span>
                            <span
                                className="shrink-0 font-bold text-[var(--color-text-secondary)] cursor-help"
                                title={bandHint(mj, res.band)}
                            >
                                {res.band}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Compact Results card for Majority Judgment elections, sitting in the left
 * column of the Results tab alongside TurnoutMeter & VotingWindow.
 */
export function ElectionResultsSummaryCard({
    election,
    electionData,
    g,
    language,
}: {
    election: GovernanceElectionSpec;
    electionData: MajorityJudgmentElectionData;
    g: G;
    language: string;
}) {
    const mj = g.mj;
    const totalPower = Number(electionData.totalVotingPower) || 0;
    const resultById = new Map(electionData.candidateResults.map(r => [r.candidateId, r]));
    const ranked = [...election.candidates].sort(
        (a, b) => (resultById.get(a.id)?.rank ?? 999) - (resultById.get(b.id)?.rank ?? 999),
    );
    const seats = election.seatCount ?? 0;

    return (
        <section
            aria-labelledby="results-ballot"
            className="h-full flex flex-col gap-4 rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="results-ballot" className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-main)]">
                    <Vote className="size-4 text-[var(--color-primary)]" aria-hidden="true" />
                    <span>{g.vote?.results ?? ''}</span>
                </h3>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                    {seats > 0 && (
                        <span className="rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 px-2 py-0.5 text-[var(--color-primary)]">
                            {fill(mj?.rules_seats_value ?? '', { seats: String(seats), role: election.roleId ?? '—' })}
                        </span>
                    )}
                    <span className="rounded-full border border-[var(--color-card-border)] bg-[var(--color-surface)] px-2 py-0.5 font-mono text-[var(--color-text-muted)]">
                        {electionData.gradeQuantileApplied}
                    </span>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--color-text-muted)]">
                {MJ_GRADE_ORDER.map(gradeIdx => (
                    <span key={gradeIdx} className="inline-flex items-center gap-1">
                        <span className={`size-2 rounded-full ${MJ_GRADE_DOT_COLOR[gradeIdx]}`} aria-hidden="true" />
                        <span>{gradeLabel(mj, gradeIdx)}</span>
                    </span>
                ))}
            </div>

            <div className="space-y-2.5">
                {ranked.map((candidate, idx) => {
                    const res = resultById.get(candidate.id);
                    if (!res) return null;
                    const inSeatRange = seats > 0 && idx < seats;
                    const showTopHeader = seats > 0 && idx === 0;
                    const showRestHeader = seats > 0 && idx === seats && ranked.length > seats;
                    const badge = electionOutcomeBadge(res.outcome, mj);

                    return (
                        <React.Fragment key={candidate.id}>
                            {showTopHeader && (
                                <div className="flex items-center gap-2 pb-0.5">
                                    <span className="h-px flex-1 bg-[var(--color-primary)]/35" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
                                        1–{Math.min(seats, ranked.length)}
                                    </span>
                                    <span className="h-px flex-1 bg-[var(--color-primary)]/35" />
                                </div>
                            )}
                            {showRestHeader && (
                                <div className="flex items-center gap-2 py-1">
                                    <span className="h-px flex-1 bg-[var(--color-card-border)]" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                                        {seats + 1}–{ranked.length}
                                    </span>
                                    <span className="h-px flex-1 bg-[var(--color-card-border)]" />
                                </div>
                            )}
                            <div
                                className={`rounded-xl border px-3 py-2.5 space-y-1.5 transition-colors ${
                                    inSeatRange
                                        ? 'border-[var(--color-primary)]/25 bg-[var(--color-surface)]'
                                        : 'border-[var(--color-card-border)] bg-[var(--color-surface)]/50'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={`font-mono text-[11px] font-bold w-6 shrink-0 ${inSeatRange ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                                            #{res.rank}
                                        </span>
                                        <span className="font-bold text-[var(--color-text-main)] truncate">
                                            {candidate.displayName}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[11px] font-semibold text-[var(--color-text-secondary)]">
                                            {gradeLabel(mj, res.qualifyingGrade)}
                                        </span>
                                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badge.cls}`}>
                                            {badge.label}
                                        </span>
                                    </div>
                                </div>

                                <GradeDistributionBar
                                    histogram={res.histogram}
                                    totalPower={totalPower}
                                    quantile={electionData.gradeQuantileApplied}
                                    mj={mj}
                                    language={language}
                                    heightClass="h-2"
                                    showTooltips
                                />
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>
        </section>
    );
}
