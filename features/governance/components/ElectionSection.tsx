'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    ExternalLink,
    Loader2,
    Lock,
    Scale,
    ShieldCheck,
    Users,
    Vote,
    Wallet,
} from 'lucide-react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { useConsoleTransaction } from '@/features/console/hooks/useConsoleTransaction';
import type { GovernanceSystem } from '../config/systems';
import type { GovernanceEntry, MajorityJudgmentCandidateResult, MajorityJudgmentElectionData } from '../types';
import { votingPhase, type GovernanceCandidate, type GovernanceElectionSpec } from '../lib/governanceVotes';
import { buildElectionVoteManifest } from '../lib/voteManifest';
import { fill, formatDate, formatPct, formatRelative, formatXrd } from '../lib/format';
import { shortenAddress } from '@/features/dashboard/explorador/components/SummaryCardKit';
import { CollapsibleCard } from './CollapsibleCard';
import { AccountPicker } from './AccountPicker';
import { Notice } from './VoteControls';
import { useTranslatedList } from './BrowserTranslation';
import type { G } from './GovernanceBadges';

type MjDict = NonNullable<G['mj']>;

const GRADE_ORDER = [4, 3, 2, 1, 0] as const;

const GRADE_BAR_COLOR: Record<number, string> = {
    4: 'bg-emerald-500',
    3: 'bg-teal-400',
    2: 'bg-[var(--color-primary)]',
    1: 'bg-amber-400',
    0: 'bg-rose-500',
};

const GRADE_DOT_COLOR: Record<number, string> = {
    4: 'bg-emerald-500',
    3: 'bg-teal-400',
    2: 'bg-[var(--color-primary)]',
    1: 'bg-amber-400',
    0: 'bg-rose-500',
};

function gradeLabel(mj: MjDict | undefined, grade: number): string {
    return mj?.grades?.[grade] ?? String(grade);
}

function bandHint(mj: MjDict | undefined, band: string): string | undefined {
    if (band === 'A') return mj?.band_hint_A;
    if (band === 'B') return mj?.band_hint_B;
    if (band === 'C') return mj?.band_hint_C;
    return undefined;
}

function outcomeBadge(outcome: string, mj: MjDict | undefined): { label: string; cls: string } {
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

function CandidateMetricsBlock({
    result,
    totalVotingPower,
    minGrade,
    quantile,
    mj,
    language,
}: {
    result: MajorityJudgmentCandidateResult;
    totalVotingPower: number;
    minGrade: number;
    quantile: string;
    mj: MjDict | undefined;
    language: string;
}) {
    return (
        <div className="space-y-3.5 border-t border-[var(--color-card-border)] pt-4">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                    <dt className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)]">
                        {fill(mj?.qualifying_grade ?? '', { quantile })}
                    </dt>
                    <dd className="mt-0.5 font-semibold text-[var(--color-text-main)]">
                        {gradeLabel(mj, result.qualifyingGrade)}
                    </dd>
                </div>
                <div>
                    <dt className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)]">
                        {mj?.min_qualifying_grade ?? ''}
                    </dt>
                    <dd className="mt-0.5 font-semibold text-[var(--color-text-main)]">
                        {gradeLabel(mj, minGrade)} ·{' '}
                        <span className={result.electable ? 'text-[var(--color-accent)]' : 'text-amber-500'}>
                            {result.electable ? (mj?.meets_floor ?? '') : (mj?.below_floor ?? '')}
                        </span>
                    </dd>
                </div>
                <div>
                    <dt className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)]">
                        {mj?.majority_gauge ?? ''}
                    </dt>
                    <dd
                        className="mt-0.5 font-mono text-[11px] font-medium text-[var(--color-text-main)] tabular-nums break-all cursor-help"
                        title={bandHint(mj, result.band)}
                    >
                        {fill(mj?.gauge_value ?? '', {
                            band: result.band,
                            p: Number(result.p).toFixed(4),
                            q: Number(result.q).toFixed(4),
                        })}
                    </dd>
                </div>
                <div>
                    <dt className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)]">
                        {mj?.published_standing ?? ''}
                    </dt>
                    <dd className="mt-0.5 font-semibold text-[var(--color-text-main)]">
                        {fill(mj?.standing_value ?? '', {
                            rank: String(result.rank),
                            group: String(result.tieGroupId),
                        })}
                    </dd>
                </div>
                <div className="sm:col-span-2">
                    <dt className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)]">
                        {mj?.exact_gauge_power ?? ''}
                    </dt>
                    <dd className="mt-0.5 font-mono text-[11px] text-[var(--color-text-secondary)] break-all">
                        {fill(mj?.exact_gauge_value ?? '', {
                            above: formatXrd(Number(result.powerAbove) || 0, language),
                            below: formatXrd(Number(result.powerBelow) || 0, language),
                        })}
                    </dd>
                </div>
            </dl>

            <div className="space-y-1.5">
                {GRADE_ORDER.map((gradeIdx) => {
                    const xrd = Number(result.histogram[gradeIdx]) || 0;
                    const pct = totalVotingPower > 0 ? Math.min(100, (xrd / totalVotingPower) * 100) : 0;
                    const isQualifying = result.qualifyingGrade === gradeIdx;
                    return (
                        <div key={gradeIdx} className="flex items-center gap-2.5 text-[11px]">
                            <span className={`w-24 shrink-0 truncate ${isQualifying ? 'font-bold text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)]'}`}>
                                {gradeLabel(mj, gradeIdx)}
                            </span>
                            <span className="h-1.5 flex-1 rounded-full bg-[var(--color-card-border)] overflow-hidden">
                                <span
                                    className={`block h-full rounded-full transition-all ${isQualifying ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-primary)]/70'}`}
                                    style={{ width: `${pct}%` }}
                                />
                            </span>
                            <span className="w-24 shrink-0 text-right font-mono tabular-nums text-[var(--color-text-muted)]">
                                {formatXrd(xrd, language)} XRD
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * 2-row × 7-column KPI strip of all candidates ordered by rank, sitting right
 * under the headline KPI cards in the Results tab.
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
                            <span className={`block truncate text-sm font-black leading-none ${res.electable ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-main)]'}`}>
                                {gradeLabel(mj, res.qualifyingGrade)}
                            </span>
                            <div className="relative h-1.5 w-full rounded-full bg-[var(--color-card-border)] overflow-hidden flex">
                                {GRADE_ORDER.map(gradeIdx => {
                                    const xrd = Number(res.histogram[gradeIdx]) || 0;
                                    const pct = totalPower > 0 ? (xrd / totalPower) * 100 : 0;
                                    if (pct <= 0) return null;
                                    return (
                                        <span
                                            key={gradeIdx}
                                            className={`h-full ${GRADE_BAR_COLOR[gradeIdx]}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    );
                                })}
                                <span
                                    className="pointer-events-none absolute inset-y-0 w-0.5 bg-[var(--color-text-main)]/80"
                                    style={{ left: '60%' }}
                                    aria-hidden="true"
                                />
                            </div>
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
 * Displays a 5-grade color legend, ranked candidates with stacked grade bars,
 * a 60% quantile tick, and a visual seat cutoff line after `seatCount`.
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
                {GRADE_ORDER.map(gradeIdx => (
                    <span key={gradeIdx} className="inline-flex items-center gap-1">
                        <span className={`size-2 rounded-full ${GRADE_DOT_COLOR[gradeIdx]}`} aria-hidden="true" />
                        <span>{gradeLabel(mj, gradeIdx)}</span>
                    </span>
                ))}
            </div>

            <div className="space-y-2.5">
                {ranked.map((candidate, idx) => {
                    const res = resultById.get(candidate.id);
                    if (!res) return null;
                    const inSeatRange = seats > 0 && idx < seats;
                    const showCutoff = seats > 0 && idx === seats;
                    const badge = outcomeBadge(res.outcome, mj);

                    return (
                        <React.Fragment key={candidate.id}>
                            {showCutoff && (
                                <div className="flex items-center gap-2 py-1">
                                    <span className="h-px flex-1 bg-[var(--color-primary)]/35" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
                                        1–{seats}
                                    </span>
                                    <span className="h-px flex-1 bg-[var(--color-primary)]/35" />
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

                                <div className="relative h-2 w-full rounded-full bg-[var(--color-card-border)] overflow-hidden flex">
                                    {GRADE_ORDER.map(gradeIdx => {
                                        const xrd = Number(res.histogram[gradeIdx]) || 0;
                                        const pct = totalPower > 0 ? (xrd / totalPower) * 100 : 0;
                                        if (pct <= 0) return null;
                                        return (
                                            <span
                                                key={gradeIdx}
                                                className={`h-full ${GRADE_BAR_COLOR[gradeIdx]}`}
                                                style={{ width: `${pct}%` }}
                                                title={`${gradeLabel(mj, gradeIdx)}: ${formatXrd(xrd, language)} XRD (${pct.toFixed(1)}%)`}
                                            />
                                        );
                                    })}
                                    <span
                                        className="pointer-events-none absolute inset-y-0 w-0.5 bg-[var(--color-text-main)]/80"
                                        style={{ left: '60%' }}
                                        aria-hidden="true"
                                    />
                                </div>
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>
        </section>
    );
}

/**
 * Interactive Majority Judgment candidates ballot + live per-candidate metrics.
 */
export function ElectionCandidatesBallot({
    election,
    electionData,
    grades,
    onGrade,
    canGrade,
    g,
    language,
    sortByRank = false,
}: {
    election: GovernanceElectionSpec;
    electionData: MajorityJudgmentElectionData | null;
    grades?: Record<number, number>;
    onGrade?: (candidateId: number, grade: number) => void;
    canGrade: boolean;
    g: G;
    language: string;
    sortByRank?: boolean;
}) {
    const mj = g.mj;
    const resultById = new Map((electionData?.candidateResults ?? []).map(r => [r.candidateId, r]));
    const ordered: GovernanceCandidate[] = sortByRank
        ? [...election.candidates].sort((a, b) => (resultById.get(a.id)?.rank ?? 999) - (resultById.get(b.id)?.rank ?? 999))
        : election.candidates;
    const descriptions = useTranslatedList(ordered.map(c => c.description ?? ''));
    const totalPower = Number(electionData?.totalVotingPower) || 0;
    const minGrade = electionData?.minimumMedianGrade ?? election.minimumMedianGrade ?? 2;
    const quantile = electionData?.gradeQuantileApplied ?? '3/5';

    return (
        <section className="pt-6 border-t border-[var(--color-card-border)] space-y-4">
            <div className="space-y-1">
                <h2 className="flex items-center gap-2 text-base font-bold text-[var(--color-text-main)]">
                    <Users className="size-4 text-[var(--color-primary)]" aria-hidden="true" />
                    <span>
                        {sortByRank ? (mj?.ranked_results_title ?? '') : `${g.candidates_title ?? ''} (${ordered.length})`}
                    </span>
                </h2>
                <p className="text-xs sm:text-sm text-[var(--color-text-muted)] leading-relaxed">
                    {sortByRank ? (mj?.ranked_results_hint ?? '') : (mj?.candidates_hint ?? '')}
                </p>
            </div>

            <div className={sortByRank ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'space-y-4'}>
                {ordered.map((candidate, idx) => {
                    const desc = descriptions[idx] ?? candidate.description;
                    const res = resultById.get(candidate.id);
                    const badge = res ? outcomeBadge(res.outcome, mj) : null;
                    const pickedGrade = grades?.[candidate.id];
                    const displayNum = String(idx + 1).padStart(2, '0');

                    return (
                        <div
                            key={`${candidate.id}-${candidate.displayName}`}
                            className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5 space-y-4"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-baseline gap-3 min-w-0">
                                    <span className="shrink-0 font-mono text-xs font-bold text-[var(--color-text-muted)]">
                                        {displayNum}
                                    </span>
                                    <div className="min-w-0">
                                        <h3 className="text-base font-bold text-[var(--color-text-main)] leading-tight">
                                            {candidate.displayName}
                                        </h3>
                                        {candidate.reference && (
                                            <p className="mt-0.5 font-mono text-[11px] text-[var(--color-text-muted)] break-all">
                                                {candidate.reference}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {badge && (
                                    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badge.cls}`}>
                                        {badge.label}
                                    </span>
                                )}
                            </div>

                            {desc && (
                                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
                                    {desc.trim()}
                                </p>
                            )}

                            {candidate.links.length > 0 && (
                                <div className="flex flex-wrap gap-3">
                                    {candidate.links.map((href, linkIdx) => (
                                        <a
                                            key={href}
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline"
                                        >
                                            <span>
                                                {g.candidate_profile ?? ''}
                                                {candidate.links.length > 1 ? ` #${linkIdx + 1}` : ''}
                                            </span>
                                            <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                                        </a>
                                    ))}
                                </div>
                            )}

                            {canGrade && onGrade && (
                                <fieldset className="border-t border-[var(--color-card-border)] pt-4">
                                    <legend className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                                        {mj?.your_grade ?? ''}
                                    </legend>
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                        {GRADE_ORDER.map((gradeVal) => {
                                            const selected = pickedGrade === gradeVal;
                                            return (
                                                <button
                                                    key={gradeVal}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={selected}
                                                    onClick={() => onGrade(candidate.id, gradeVal)}
                                                    className={`rounded-xl border px-2.5 py-2 text-center text-xs font-semibold transition-colors cursor-pointer ${
                                                        selected
                                                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-sm'
                                                            : 'border-[var(--color-card-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]/50 hover:text-[var(--color-text-main)]'
                                                    }`}
                                                >
                                                    {gradeLabel(mj, gradeVal)}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </fieldset>
                            )}

                            {res && (
                                <CandidateMetricsBlock
                                    result={res}
                                    totalVotingPower={totalPower}
                                    minGrade={minGrade}
                                    quantile={quantile}
                                    mj={mj}
                                    language={language}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

/**
 * Sticky sidebar panel to cast a Majority Judgment election ballot directly
 * from our web app using the Radix Wallet.
 */
export function ElectionVoteSidebar({
    entry,
    system,
    electionData,
    grades,
    g,
    language,
    now,
}: {
    entry: GovernanceEntry;
    system: GovernanceSystem;
    electionData: MajorityJudgmentElectionData | null;
    grades: Record<number, number>;
    g: G;
    language: string;
    now: number;
}) {
    const queryClient = useQueryClient();
    const wallet = useRadixWallet();
    const tx = useConsoleTransaction();
    const [chosen, setChosen] = useState<string[] | null>(null);

    const { item, id } = entry;
    const candidates = item.election?.candidates ?? [];
    const total = candidates.length;
    const graded = candidates.filter(c => grades[c.id] !== undefined).length;
    const allGraded = total > 0 && graded === total;

    const phase = votingPhase(item, now);
    const available = wallet.accounts.map(a => a.address);
    const selectedAccounts = (chosen ?? available.slice(0, 1)).filter(a => available.includes(a));
    const onNetwork = wallet.activeNetwork === system.network;
    const canVote = phase === 'open' && wallet.isConnected && onNetwork && available.length > 0;
    const mj = g.mj;

    const setAccounts = (next: string[]) => {
        if (tx.isSending) return;
        setChosen(next);
        tx.reset();
    };
    const toggleAccount = (address: string) =>
        setAccounts(selectedAccounts.includes(address) ? selectedAccounts.filter(a => a !== address) : [...selectedAccounts, address]);

    const submit = async () => {
        if (!allGraded || selectedAccounts.length === 0) return;
        const manifest = buildElectionVoteManifest({
            component: system.component,
            electionId: id,
            round: electionData?.round ?? item.election?.round ?? 'RoundOne',
            accounts: selectedAccounts,
            grades: candidates.map(c => ({ candidateId: c.id, grade: grades[c.id] })),
        });
        const result = await tx.sendTransaction(manifest);
        if (result) {
            await queryClient.invalidateQueries({ queryKey: ['governance-tally', system.component, 'election', id] });
        }
    };

    return (
        <CollapsibleCard
            id="vote-panel-title"
            icon={Wallet}
            title={g.vote_title ?? ''}
            headerClassName="bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-secondary)]/10"
        >
            <div className="space-y-4">
                {phase === 'closed' && <Notice icon={Lock}>{g.vote_closed ?? ''}</Notice>}
                {phase === 'upcoming' && item.start && (
                    <Notice icon={Clock}>
                        <span suppressHydrationWarning>
                            {fill(g.vote_upcoming ?? '', { time: formatRelative(item.start, language, now) })}
                        </span>
                    </Notice>
                )}

                {phase === 'open' && !wallet.isConnected && (
                    <div className="rounded-xl border border-dashed border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 p-4 text-center space-y-3">
                        <p className="text-sm font-bold text-[var(--color-text-main)]">{g.connect_title ?? ''}</p>
                        <p className="text-[13px] text-[var(--color-text-muted)]">{g.connect_subtitle ?? ''}</p>
                        <button
                            type="button"
                            disabled={wallet.isLoading}
                            onClick={() => wallet.connect(RadixNetworkId.Mainnet)}
                            className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
                        >
                            {wallet.isLoading ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
                            {g.connect_to_vote ?? ''}
                        </button>
                    </div>
                )}

                {phase === 'open' && wallet.isConnected && !onNetwork && (
                    <Notice icon={AlertTriangle} tone="warn">
                        <p>{g.wrong_network ?? ''}</p>
                        <button type="button" onClick={() => wallet.connect(RadixNetworkId.Mainnet)} className="mt-2 font-bold underline underline-offset-2">
                            {g.switch_network ?? ''}
                        </button>
                    </Notice>
                )}

                {phase === 'open' && wallet.isConnected && onNetwork && available.length === 0 && (
                    <Notice icon={AlertTriangle} tone="warn">{g.wallet_accounts_empty ?? ''}</Notice>
                )}

                {canVote && (
                    <>
                        <AccountPicker
                            accounts={wallet.accounts}
                            selected={selectedAccounts}
                            onToggle={toggleAccount}
                            onSetAll={setAccounts}
                            label={wallet.accounts.length > 1 ? (g.accounts_label ?? '') : (g.account_label ?? '')}
                            labels={{
                                all: g.accounts_all ?? '',
                                count: g.accounts_count ?? '',
                                none: g.accounts_none ?? '',
                            }}
                        />

                        <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] p-3 space-y-2">
                            <div className="flex items-center justify-between text-xs font-semibold">
                                <span className="text-[var(--color-text-main)]">
                                    {fill(mj?.ballot_progress ?? '', { graded: String(graded), total: String(total) })}
                                </span>
                                <span className="font-mono text-[var(--color-primary)] tabular-nums">
                                    {total > 0 ? `${Math.round((graded / total) * 100)}%` : '0%'}
                                </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[var(--color-card-border)] overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${allGraded ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-primary)]'}`}
                                    style={{ width: `${total > 0 ? (graded / total) * 100 : 0}%` }}
                                />
                            </div>
                            <p className="text-[11px] text-[var(--color-text-muted)] leading-snug">
                                {fill(allGraded ? (mj?.ballot_ready ?? '') : (mj?.ballot_incomplete ?? ''), { total: String(total) })}
                            </p>
                        </div>

                        <button
                            type="button"
                            disabled={!allGraded || selectedAccounts.length === 0 || tx.isSending}
                            onClick={() => void submit()}
                            className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer"
                        >
                            {tx.isSending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                            <span>{tx.isSending ? (g.sending ?? '') : (mj?.submit_ballot ?? '')}</span>
                        </button>
                    </>
                )}

                {tx.error && (
                    <Notice icon={AlertTriangle} tone="error">
                        {/reject|cancel/i.test(tx.error)
                            ? (g.error_rejected ?? '')
                            : fill(g.error_generic ?? '', { code: tx.error })}
                    </Notice>
                )}
                {tx.result && (
                    <Notice icon={CheckCircle2} tone="ok">
                        <p className="font-bold">{g.success ?? ''}</p>
                        <Link
                            href={`/${language}/dashboard/tx/${tx.result.transactionIntentHash}`}
                            title={tx.result.transactionIntentHash}
                            className="mt-1 flex items-center gap-1.5 min-w-0 max-w-full font-mono text-xs text-[var(--color-primary)] hover:underline whitespace-nowrap"
                        >
                            <span className="truncate">{shortenAddress(tx.result.transactionIntentHash)}</span>
                            <ExternalLink className="size-3.5 shrink-0" />
                        </Link>
                        {g.tally_delay && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{g.tally_delay}</p>}
                    </Notice>
                )}
            </div>
        </CollapsibleCard>
    );
}
