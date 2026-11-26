'use client';

import React from 'react';
import { ExternalLink, Users } from 'lucide-react';
import type { MajorityJudgmentCandidateResult, MajorityJudgmentElectionData, VoterRow } from '../types';
import type { GovernanceCandidate, GovernanceElectionSpec } from '../lib/governanceVotes';
import { MJ_GRADE_ORDER, bandHint, gradeLabel } from '../lib/majorityJudgment';
import { isCountedVoter } from '../lib/comparisonUtils';
import { fill, formatXrd } from '../lib/format';
import { useTranslatedList } from './BrowserTranslation';
import type { G } from './GovernanceBadges';
import { electionOutcomeBadge } from './ElectionSection';

type MjDict = NonNullable<G['mj']>;

function formatVoteCount(count: number, mj: MjDict | undefined, language: string): string {
    if (count === 1) return mj?.vote_count_one ?? '';
    return fill(mj?.vote_count_other ?? '', { n: new Intl.NumberFormat(language).format(count) });
}

function CandidateMetricsBlock({
    result,
    voters,
    totalVotingPower,
    minGrade,
    quantile,
    mj,
    language,
}: {
    result: MajorityJudgmentCandidateResult;
    voters?: VoterRow[] | null;
    totalVotingPower: number;
    minGrade: number;
    quantile: string;
    mj: MjDict | undefined;
    language: string;
}) {
    let aboveVotes: number | null = null;
    let belowVotes: number | null = null;
    let gradeVoteCounts: [number, number, number, number, number] | null = null;
    if (voters) {
        const key = String(result.candidateId);
        let above = 0;
        let below = 0;
        const counts: [number, number, number, number, number] = [0, 0, 0, 0, 0];
        for (const v of voters) {
            if (!isCountedVoter(v)) continue;
            const grade = v.grades?.[key];
            if (grade === undefined || grade < 0 || grade > 4) continue;
            counts[grade] += 1;
            if (grade > result.qualifyingGrade) above += 1;
            else if (grade < result.qualifyingGrade) below += 1;
        }
        aboveVotes = above;
        belowVotes = below;
        gradeVoteCounts = counts;
    }

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
                        {aboveVotes !== null && belowVotes !== null
                            ? fill(mj?.exact_gauge_value_with_votes ?? '', {
                                above: formatXrd(Number(result.powerAbove) || 0, language),
                                aboveVotes: formatVoteCount(aboveVotes, mj, language),
                                below: formatXrd(Number(result.powerBelow) || 0, language),
                                belowVotes: formatVoteCount(belowVotes, mj, language),
                            })
                            : fill(mj?.exact_gauge_value ?? '', {
                                above: formatXrd(Number(result.powerAbove) || 0, language),
                                below: formatXrd(Number(result.powerBelow) || 0, language),
                            })}
                        {' · '}
                        <strong className="font-bold text-[var(--color-text-main)]">
                            {fill(mj?.ranking_badge ?? '', { rank: String(result.rank) })}
                        </strong>
                    </dd>
                </div>
            </dl>

            <div className="space-y-1.5">
                {MJ_GRADE_ORDER.map((gradeIdx) => {
                    const xrd = Number(result.histogram[gradeIdx]) || 0;
                    const pct = totalVotingPower > 0 ? Math.min(100, (xrd / totalVotingPower) * 100) : 0;
                    const isQualifying = result.qualifyingGrade === gradeIdx;
                    return (
                        <div key={gradeIdx} className="flex items-center gap-2.5 text-[11px]">
                            <span className={`w-20 sm:w-24 shrink-0 truncate ${isQualifying ? 'font-bold text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)]'}`}>
                                {gradeLabel(mj, gradeIdx)}
                            </span>
                            <span className="h-1.5 flex-1 rounded-full bg-[var(--color-card-border)] overflow-hidden">
                                <span
                                    className={`block h-full rounded-full transition-all ${isQualifying ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-primary)]/70'}`}
                                    style={{ width: `${pct}%` }}
                                />
                            </span>
                            <span className={`${gradeVoteCounts ? 'w-40 sm:w-44' : 'w-24'} shrink-0 whitespace-nowrap text-right font-mono tabular-nums text-[var(--color-text-muted)]`}>
                                {formatXrd(xrd, language)} XRD
                                {gradeVoteCounts && (
                                    <span className="opacity-80">
                                        {' '}({formatVoteCount(gradeVoteCounts[gradeIdx], mj, language)})
                                    </span>
                                )}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Interactive Majority Judgment candidates ballot + live per-candidate metrics.
 */
export function ElectionCandidatesBallot({
    election,
    electionData,
    voters,
    grades,
    onGrade,
    canGrade,
    g,
    language,
    sortByRank = false,
}: {
    election: GovernanceElectionSpec;
    electionData: MajorityJudgmentElectionData | null;
    voters?: VoterRow[] | null;
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
                    const badge = res ? electionOutcomeBadge(res.outcome, mj) : null;
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
                                        {MJ_GRADE_ORDER.map((gradeVal) => {
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
                                    voters={voters}
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
