'use client';

import React, { useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, BarChart3, Coins } from 'lucide-react';
import type { GovernanceElectionSpec } from '../lib/governanceVotes';
import type { MajorityJudgmentElectionData, VoterRow } from '../types';
import { MJ_GRADE_DOT_COLOR, MJ_GRADE_ORDER } from '../lib/majorityJudgment';
import { formatXrd } from '../lib/format';
import type { G } from './GovernanceBadges';

interface CandidateGradeRow {
    id: number;
    name: string;
    rank: number | null;
    values: [number, number, number, number, number];
}

type SortState = { grade: number; dir: 'desc' | 'asc' } | null;

function GradeMatrixCard({
    id,
    title,
    icon: Icon,
    rows,
    mode,
    g,
    language,
}: {
    id: string;
    title: string;
    icon: typeof BarChart3;
    rows: CandidateGradeRow[];
    mode: 'votes' | 'power';
    g: G;
    language: string;
}) {
    const [sort, setSort] = useState<SortState>(null);

    const handleGradeSort = (grade: number) => {
        setSort(prev => {
            if (!prev || prev.grade !== grade) return { grade, dir: 'desc' };
            return prev.dir === 'desc' ? { grade, dir: 'asc' } : null;
        });
    };

    const sortedRows = [...rows].sort((a, b) => {
        if (sort) {
            const diff = sort.dir === 'desc'
                ? b.values[sort.grade] - a.values[sort.grade]
                : a.values[sort.grade] - b.values[sort.grade];
            if (Math.abs(diff) > 1e-12) return diff;
        }
        if (a.rank !== null && b.rank !== null && a.rank !== b.rank) return a.rank - b.rank;
        return a.id - b.id;
    });

    return (
        <section
            aria-labelledby={id}
            className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] overflow-hidden"
        >
            <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-card-border)]">
                <h3 id={id} className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-main)]">
                    <Icon className="size-4 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
                    {title}
                </h3>
                {g.mj?.grade_table_sort_hint && (
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                        {g.mj.grade_table_sort_hint}
                    </span>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-[var(--color-card-border)] bg-[var(--color-surface)] text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                            <th className="py-3 px-4 font-semibold whitespace-nowrap min-w-[180px]">
                                <button
                                    type="button"
                                    onClick={() => setSort(null)}
                                    className={`inline-flex items-center gap-1 uppercase tracking-wider font-semibold transition-colors cursor-pointer ${
                                        sort === null ? 'text-[var(--color-text-main)]' : 'hover:text-[var(--color-text-main)]'
                                    }`}
                                >
                                    {g.mj?.col_candidate ?? g.candidates_title ?? ''}
                                </button>
                            </th>
                            {MJ_GRADE_ORDER.map(grade => {
                                const isActive = sort?.grade === grade;
                                const label = g.mj?.grades?.[grade] ?? String(grade);
                                const ariaSort = isActive
                                    ? (sort.dir === 'desc' ? 'descending' : 'ascending')
                                    : 'none';
                                return (
                                    <th
                                        key={grade}
                                        aria-sort={ariaSort}
                                        className="py-3 px-4 font-semibold whitespace-nowrap text-right"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleGradeSort(grade)}
                                            className={`group inline-flex items-center justify-end gap-1.5 uppercase tracking-wider font-semibold transition-colors cursor-pointer ${
                                                isActive
                                                    ? 'text-[var(--color-primary)]'
                                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                                            }`}
                                        >
                                            <span className={`size-2 rounded-full shrink-0 ${MJ_GRADE_DOT_COLOR[grade]}`} aria-hidden="true" />
                                            <span>{label}</span>
                                            {isActive ? (
                                                sort.dir === 'desc'
                                                    ? <ArrowDown className="size-3 shrink-0" aria-hidden="true" />
                                                    : <ArrowUp className="size-3 shrink-0" aria-hidden="true" />
                                            ) : (
                                                <ArrowUpDown className="size-3 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
                                            )}
                                        </button>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-card-border)] text-sm">
                        {sortedRows.map(row => (
                            <tr
                                key={row.id}
                                className="hover:bg-white/[0.03] transition-colors"
                            >
                                <td className="py-3 px-4 font-semibold text-[var(--color-text-main)] whitespace-nowrap">
                                    <span className="inline-flex items-center gap-2">
                                        {row.rank !== null && (
                                            <span className="text-[11px] font-mono text-[var(--color-text-muted)] w-6 shrink-0">
                                                #{row.rank}
                                            </span>
                                        )}
                                        <span>{row.name}</span>
                                    </span>
                                </td>
                                {MJ_GRADE_ORDER.map(grade => {
                                    const val = row.values[grade];
                                    const isSortedCol = sort?.grade === grade;
                                    const formatted = mode === 'votes'
                                        ? val.toLocaleString(language)
                                        : val > 0
                                            ? `${formatXrd(val, language)} XRD`
                                            : '0';
                                    const exactTitle = mode === 'power' && val > 0
                                        ? `${val.toLocaleString(language, { maximumFractionDigits: 2 })} XRD`
                                        : undefined;
                                    return (
                                        <td
                                            key={grade}
                                            title={exactTitle}
                                            className={`py-3 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap ${
                                                isSortedCol ? 'bg-[var(--color-primary)]/[0.04]' : ''
                                            } ${
                                                val > 0
                                                    ? isSortedCol
                                                        ? 'font-bold text-[var(--color-primary)]'
                                                        : 'font-semibold text-[var(--color-text-main)]'
                                                    : 'text-[var(--color-text-muted)]/60'
                                            }`}
                                        >
                                            {formatted}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

/**
 * Two breakdown tables for Majority Judgment elections placed below the Voters
 * table: (1) number of votes per candidate & grade, and (2) voting power (XRD)
 * per candidate & grade. Clicking any grade header sorts candidates by that grade.
 */
export function ElectionGradesMatrix({
    election,
    electionData,
    voters,
    g,
    language,
}: {
    election: GovernanceElectionSpec;
    electionData?: MajorityJudgmentElectionData | null;
    voters: VoterRow[];
    g: G;
    language: string;
}) {
    const resultByCandidate = new Map(
        (electionData?.candidateResults ?? []).map(r => [r.candidateId, r]),
    );

    const voteRows: CandidateGradeRow[] = [];
    const powerRows: CandidateGradeRow[] = [];

    for (const candidate of election.candidates) {
        const key = String(candidate.id);
        const res = resultByCandidate.get(candidate.id);
        const voteCounts: [number, number, number, number, number] = [0, 0, 0, 0, 0];
        const voterPowerSums: [number, number, number, number, number] = [0, 0, 0, 0, 0];

        for (const v of voters) {
            const grade = v.grades?.[key];
            if (grade !== undefined && grade >= 0 && grade <= 4) {
                voteCounts[grade] += 1;
                voterPowerSums[grade] += Number(v.votePower) || 0;
            }
        }

        const powerValues: [number, number, number, number, number] = res
            ? [
                Number(res.histogram[0]) || 0,
                Number(res.histogram[1]) || 0,
                Number(res.histogram[2]) || 0,
                Number(res.histogram[3]) || 0,
                Number(res.histogram[4]) || 0,
            ]
            : voterPowerSums;

        const rank = res?.rank ?? null;
        voteRows.push({ id: candidate.id, name: candidate.displayName, rank, values: voteCounts });
        powerRows.push({ id: candidate.id, name: candidate.displayName, rank, values: powerValues });
    }

    if (voteRows.length === 0) return null;

    return (
        <div className="space-y-6">
            <GradeMatrixCard
                id="election-grades-votes-table"
                title={g.mj?.grade_votes_table_title ?? ''}
                icon={BarChart3}
                rows={voteRows}
                mode="votes"
                g={g}
                language={language}
            />
            <GradeMatrixCard
                id="election-grades-power-table"
                title={g.mj?.grade_power_table_title ?? ''}
                icon={Coins}
                rows={powerRows}
                mode="power"
                g={g}
                language={language}
            />
        </div>
    );
}
