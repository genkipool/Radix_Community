'use client';

import React from 'react';
import { Scale } from 'lucide-react';
import type { ElectionConsensusSummary } from '../lib/votingMethods';
import { gradeLabel } from '../lib/majorityJudgment';
import { fill, formatPct } from '../lib/format';
import type { G } from './GovernanceBadges';
import type { CompareDict } from '../lib/comparisonUtils';
import { MethodGuideTrigger } from './MethodGuideModal';

/**
 * 2-row × 7-column consensus KPI strip across all 50 voting methods
 * (family-balanced + effectiveness-weighted), mirroring `ElectionCandidatesKpiGrid`.
 */
export function ElectionConsensusKpiGrid({
    consensus,
    c,
    g,
    language,
    onOpenGuide,
}: {
    consensus: ElectionConsensusSummary;
    c: CompareDict;
    g: G;
    language: string;
    onOpenGuide?: () => void;
}) {
    const mj = g.mj;
    return (
        <section aria-labelledby="election-consensus-heading" className="space-y-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 id="election-consensus-heading" className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-main)]">
                    <Scale className="size-4 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
                    <span>{fill(c.election_consensus_title ?? '', { n: consensus.evaluatedMethods.toLocaleString(language) })}</span>
                    {onOpenGuide && (
                        <MethodGuideTrigger onClick={onOpenGuide} label={c.election_consensus_guide_open ?? ''} />
                    )}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                    {c.election_consensus_hint ?? ''}
                </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
                {consensus.candidates.map(cand => {
                    const pct = Math.min(100, Math.max(0, cand.consensusShare * 100));
                    const avgRankStr = cand.avgRank.toLocaleString(language, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                    const tooltip = fill(c.election_consensus_card_tip ?? '', {
                        name: cand.label,
                        rank: String(cand.consensusRank),
                        pct: formatPct(cand.consensusShare, language),
                        elected: cand.electedCount.toLocaleString(language),
                        total: cand.evaluatedMethods.toLocaleString(language),
                        avgRank: avgRankStr,
                        grade: gradeLabel(mj, cand.modalGrade),
                        current: cand.currentRank != null ? `#${cand.currentRank}` : '—',
                    });
                    const entered = cand.changedFromCurrent && cand.inSeats;
                    const dropped = cand.changedFromCurrent && !cand.inSeats;
                    return (
                        <div
                            key={cand.id}
                            title={tooltip}
                            className={`min-w-0 flex flex-col justify-between gap-2 rounded-2xl border p-3 transition-colors ${
                                entered
                                    ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10'
                                    : dropped
                                        ? 'border-amber-500/50 bg-amber-500/10'
                                        : cand.inSeats
                                            ? 'border-[var(--color-primary)]/35 bg-[var(--color-card-bg)]'
                                            : 'border-[var(--color-card-border)] bg-[var(--color-card-bg)]'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-1.5 min-w-0">
                                <span className="truncate text-xs font-bold text-[var(--color-text-main)]">
                                    {cand.label}
                                </span>
                                <span className={`shrink-0 font-mono text-[10px] font-bold ${
                                    entered
                                        ? 'text-[var(--color-accent)]'
                                        : dropped
                                            ? 'text-amber-600 dark:text-amber-400'
                                            : cand.inSeats
                                                ? 'text-[var(--color-primary)]'
                                                : 'text-[var(--color-text-muted)]'
                                }`}>
                                    #{cand.consensusRank}
                                </span>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-baseline justify-between gap-1">
                                    <span className={`text-sm font-black font-mono leading-none tabular-nums ${
                                        dropped
                                            ? 'text-amber-600 dark:text-amber-400'
                                            : cand.inSeats
                                                ? 'text-[var(--color-accent)]'
                                                : 'text-[var(--color-text-main)]'
                                    }`}>
                                        {formatPct(cand.consensusShare, language)}
                                    </span>
                                    <span className="text-[10px] font-semibold text-[var(--color-text-muted)] truncate">
                                        {gradeLabel(mj, cand.modalGrade)}
                                    </span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-[var(--color-card-border)] overflow-hidden">
                                    <span
                                        className={`block h-full rounded-full transition-all ${
                                            dropped
                                                ? 'bg-amber-500/80'
                                                : cand.inSeats
                                                    ? 'bg-[var(--color-accent)]'
                                                    : 'bg-[var(--color-primary)]/60'
                                        }`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-[var(--color-text-muted)] tabular-nums">
                                <span className="truncate">
                                    {cand.electedCount}/{cand.evaluatedMethods}
                                </span>
                                <span className="shrink-0 font-bold text-[var(--color-text-secondary)]">
                                    Ø #{avgRankStr}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
