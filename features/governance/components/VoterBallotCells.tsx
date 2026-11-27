'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, ExternalLink } from 'lucide-react';
import type { VoteHistoryEntry, VoterRow } from '../types';
import { MJ_GRADE_ABBR_COLOR } from '../lib/majorityJudgment';
import { shortenAddress } from '@/features/dashboard/explorador/components/SummaryCardKit';
import type { G } from './GovernanceBadges';

/** Renders a voter's ballot choices (or Majority Judgment grade grid with change diffs). */
export function VoterVoteCell({
    voter,
    visibleChoices,
    history,
    isElection,
    onlyChanged,
    choiceLabel,
    g,
}: {
    voter: VoterRow;
    visibleChoices: string[];
    history: VoteHistoryEntry[] | null;
    isElection: boolean;
    onlyChanged: boolean;
    choiceLabel: (key: string) => string;
    g: G;
}) {
    const original = history ? history[0] : null;

    if (visibleChoices.length > 3 || isElection) {
        return (
            <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                {visibleChoices.map((c, idx) => {
                    const label = choiceLabel(c);
                    const gradeIdx = voter.grades?.[c];
                    const origGradeIdx = original?.grades?.[c];
                    const gradeChanged = origGradeIdx !== undefined && gradeIdx !== undefined && origGradeIdx !== gradeIdx;
                    const gradeAbbr = gradeIdx !== undefined ? g.mj?.grade_abbrs?.[gradeIdx] : undefined;
                    const origGradeAbbr = origGradeIdx !== undefined ? g.mj?.grade_abbrs?.[origGradeIdx] : undefined;
                    const gradeFull = gradeIdx !== undefined ? g.mj?.grades?.[gradeIdx] : undefined;
                    const origGradeFull = origGradeIdx !== undefined ? g.mj?.grades?.[origGradeIdx] : undefined;
                    return (
                        <span
                            key={`${c}-${idx}`}
                            title={gradeChanged
                                ? `${label} — ${origGradeFull ?? origGradeIdx} → ${gradeFull ?? gradeIdx}`
                                : gradeFull ? `${label} — ${gradeFull}` : label}
                            className={`whitespace-nowrap text-xs ${
                                gradeChanged
                                    ? 'font-bold text-[var(--color-text-main)]'
                                    : onlyChanged && history
                                        ? 'font-medium text-[var(--color-text-muted)]'
                                        : 'font-semibold text-[var(--color-text-secondary)]'
                            }`}
                        >
                            {label}
                            {gradeChanged ? (
                                <span className="ml-1 inline-flex items-center gap-0.5 font-mono text-[10px] leading-none font-bold align-baseline">
                                    <span className={`text-box-cap leading-none ${MJ_GRADE_ABBR_COLOR[origGradeIdx] ?? 'text-[var(--color-text-muted)]'}`}>
                                        {origGradeAbbr ?? origGradeIdx}
                                    </span>
                                    <ArrowRight className="size-2.5 shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
                                    <span className={`text-box-cap leading-none ${MJ_GRADE_ABBR_COLOR[gradeIdx] ?? ''}`}>
                                        {gradeAbbr ?? gradeIdx}
                                    </span>
                                </span>
                            ) : gradeAbbr ? (
                                <span className={`ml-0.5 font-mono text-[10px] font-bold ${MJ_GRADE_ABBR_COLOR[gradeIdx!] ?? ''}`}>
                                    ({gradeAbbr})
                                </span>
                            ) : null}
                        </span>
                    );
                })}
                {voter.changes > 0 && !history && (
                    <span className="text-[10px] font-normal text-[var(--color-text-muted)] self-center" title={g.vote?.changed_vote}>↻</span>
                )}
            </div>
        );
    }

    if (history && original) {
        return (
            <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-semibold text-[var(--color-text-muted)]">
                    {original.choices.map(choiceLabel).join(', ')}
                </span>
                <ArrowRight className="size-3 shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
                <span className="font-bold text-[var(--color-text-main)]">
                    {visibleChoices.map(choiceLabel).join(', ')}
                </span>
            </span>
        );
    }

    return (
        <span className="whitespace-nowrap">
            {visibleChoices.map((c, idx) => {
                const label = choiceLabel(c);
                const gradeIdx = voter.grades?.[c];
                const gradeAbbr = gradeIdx !== undefined ? g.mj?.grade_abbrs?.[gradeIdx] : undefined;
                const gradeFull = gradeIdx !== undefined ? g.mj?.grades?.[gradeIdx] : undefined;
                return (
                    <React.Fragment key={`${c}-${idx}`}>
                        {idx > 0 && ', '}
                        <span title={gradeFull ? `${label} — ${gradeFull}` : label}>
                            {label}
                            {gradeAbbr && (
                                <span className={`ml-1 font-mono text-[10px] font-bold ${MJ_GRADE_ABBR_COLOR[gradeIdx!] ?? ''}`}>
                                    ({gradeAbbr})
                                </span>
                            )}
                        </span>
                    </React.Fragment>
                );
            })}
            {voter.changes > 0 && (
                <span className="ml-1.5 text-[10px] font-normal text-[var(--color-text-muted)]" title={g.vote?.changed_vote}>↻</span>
            )}
        </span>
    );
}

/** Renders the voter's transaction link(s), including original -> current history when changed. */
export function VoterTxHistoryCell({
    txid,
    history,
    language,
    g,
}: {
    txid: string;
    history: VoteHistoryEntry[] | null;
    language: string;
    g: G;
}) {
    if (!history) {
        return (
            <Link
                href={`/${language}/dashboard/tx/${txid}`}
                prefetch={false}
                className="inline-flex items-center justify-end gap-1.5 font-mono text-xs text-[var(--color-primary)] hover:underline"
                title={txid}
            >
                <span>{shortenAddress(txid)}</span>
                <ExternalLink className="size-3 shrink-0" />
            </Link>
        );
    }

    return (
        <div className="inline-flex flex-col items-end gap-1">
            {history.map((entry, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === history.length - 1;
                const tag = isFirst
                    ? (g.voters_vote_original ?? '')
                    : isLast
                        ? (g.voters_vote_current ?? '')
                        : `#${idx + 1}`;
                return (
                    <div key={`${entry.txid}-${idx}`} className="inline-flex items-center justify-end gap-1.5">
                        <span className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            isLast
                                ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]'
                                : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'
                        }`}>
                            {tag}
                        </span>
                        <Link
                            href={`/${language}/dashboard/tx/${entry.txid}`}
                            prefetch={false}
                            className={`inline-flex items-center gap-1 font-mono text-xs hover:underline ${
                                isLast ? 'text-[var(--color-primary)] font-semibold' : 'text-[var(--color-text-muted)] hover:text-[var(--color-primary)]'
                            }`}
                            title={entry.txid}
                        >
                            <span>{shortenAddress(entry.txid)}</span>
                            <ExternalLink className="size-3 shrink-0" />
                        </Link>
                    </div>
                );
            })}
        </div>
    );
}
