'use client';

import React from 'react';
import { Activity, Crown, Target, ThumbsUp, Users, Hourglass, Info } from 'lucide-react';
import type { GovernanceSystem } from '../config/systems';
import type { GovernanceEntry } from '../types';
import { useGovernanceTally } from '../hooks/useGovernanceTally';
import { itemChoices, resolveLiveVoterCounts, summarizeTally, votingPhase, votingProgress } from '../lib/governanceVotes';
import { OutcomeBanner, TurnoutMeter, VotingWindow, fill, formatDate, formatPct, formatXrd, type Gv } from './VoteParts';
import { formatDuration } from '../lib/format';
import { ResultsBallot } from './ResultsBallot';
import { stanceResolver, type G } from './GovernanceBadges';
import { useRegisterTabExport, type RegisterTabExport } from './JsonExportPill';
import { ElectionCandidatesBallot, ElectionCandidatesKpiGrid, ElectionResultsSummaryCard } from './ElectionSection';
import { VotersTable } from './VotersTable';

function Kpi({ icon: Icon, label, value, hint, accent, meter, title }: {
    icon: typeof Activity;
    label: string;
    value: React.ReactNode;
    hint?: React.ReactNode;
    accent?: string;
    /** Progress bar under the figure; `mark` draws the pass line (0..1). */
    meter?: { ratio: number; mark?: number; ok: boolean };
    title?: string;
}) {
    return (
        <div className="h-full min-w-0 flex flex-col rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-4" title={title}>
            <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)] whitespace-nowrap">
                <Icon className="size-3.5 text-[var(--color-primary)] shrink-0" />{label}
            </span>
            <span className={`block mt-2 text-2xl font-black font-mono leading-none truncate ${accent ?? 'text-[var(--color-text-main)]'}`}>{value}</span>
            {meter && (
                <span className="relative block mt-2.5 h-1.5 rounded-full bg-[var(--color-card-border)]">
                    <span className={`absolute inset-y-0 left-0 rounded-full ${meter.ok ? 'bg-[var(--color-accent)]' : 'bg-amber-500'}`} style={{ width: `${Math.min(1, Math.max(0, meter.ratio)) * 100}%` }} />
                    {meter.mark !== undefined && (
                        <span className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-[var(--color-text-main)]" style={{ left: `calc(${Math.min(1, meter.mark) * 100}% - 1px)` }} aria-hidden />
                    )}
                </span>
            )}
            {hint && <span className={`block mt-1.5 text-[11px] leading-snug ${meter ? (meter.ok ? 'text-[var(--color-accent)] font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold') : 'text-[var(--color-text-muted)]'}`} suppressHydrationWarning>{hint}</span>}
        </div>
    );
}

/**
 * Result tab: headline figures, verdict, how the vote splits, turnout against
 * the quorum, the voting window and the largest voters.
 */
export function ResultsDashboard({ entry, system, g, language, now, onRegisterExport }: {
    entry: GovernanceEntry;
    system: GovernanceSystem;
    g: G;
    language: string;
    now: number;
    onRegisterExport?: RegisterTabExport;
}) {
    const { item, kind, id } = entry;
    const gv: Gv = g.vote ?? {};
    const choices = itemChoices(kind, item, stanceResolver(g));
    const tallyQuery = useGovernanceTally({ component: system.component, kind, itemId: id, voters: true }, system.network);
    const tally = tallyQuery.data ? summarizeTally(choices, tallyQuery.data, item) : null;
    const phase = votingPhase(item, now);
    const { voters, revotes } = resolveLiveVoterCounts(item, tallyQuery.data?.voters);

    useRegisterTabExport(onRegisterExport, () => ({
        tab: 'results',
        exportedAt: new Date().toISOString(),
        system: {
            key: system.key,
            name: system.name,
            network: system.network,
            component: system.component,
        },
        vote: {
            kind,
            id,
            title: item.title,
            phase,
            start: item.start,
            deadline: item.deadline,
            quorum: item.quorum,
            approvalThreshold: item.approvalThreshold,
            uniqueVoters: voters,
            revoteCount: revotes,
        },
        choices,
        tally,
        changedVoters: (tallyQuery.data?.voters ?? [])
            .filter(v => v.changes > 0)
            .map(v => ({
                account: v.account,
                votePower: v.votePower,
                changes: v.changes,
                originalVote: v.history?.[0] ?? null,
                currentVote: {
                    choices: v.choices,
                    voteId: v.voteId,
                    txid: v.txid,
                    time: v.time,
                    ...(v.grades ? { grades: v.grades } : {}),
                },
                history: v.history ?? [],
            })),
        rawTally: tallyQuery.data ?? null,
    }));

    const time = phase === 'open' && item.deadline
        ? { value: formatDuration(item.deadline - now, language), hint: g.kpi_until_close ?? '' }
        : phase === 'upcoming' && item.start
            ? { value: formatDuration(item.start - now, language), hint: g.kpi_until_open ?? '' }
            : { value: g.kpi_ended ?? '', hint: item.deadline ? fill(g.kpi_closed_on ?? '', { date: formatDate(item.deadline, language, undefined, 'date') }) : undefined };

    return (
        <div className="space-y-6">
            <h2 className="sr-only">{g.results_heading}</h2>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                <Kpi icon={Activity} label={g.kpi_turnout ?? ''} value={tally ? `${formatXrd(tally.turnout, language)}` : '—'} hint={g.kpi_turnout_hint ?? ''} />
                <Kpi
                    icon={Target}
                    label={g.kpi_quorum ?? ''}
                    value={tally?.quorumRatio != null ? formatPct(tally.quorumRatio, language) : '—'}
                    meter={tally?.quorumRatio != null ? { ratio: tally.quorumRatio, ok: !!tally.quorumMet } : undefined}
                    hint={item.quorum ? fill(g.kpi_quorum_hint ?? '', { amount: formatXrd(item.quorum, language) }) : undefined}
                />
                {kind === 'election' && item.election ? (
                    <Kpi
                        icon={Crown}
                        label={g.compare?.fact_seats ?? g.mj?.rules_seats ?? ''}
                        title={((g.compare?.tips ?? {}) as Record<string, string>).fact_seats}
                        value={item.election.seatCount !== null ? item.election.seatCount.toLocaleString(language) : '—'}
                        hint={item.election.candidates.length > 0
                            ? `${item.election.candidates.length.toLocaleString(language)} ${(g.candidates_title ?? '').toLowerCase()}`
                            : undefined}
                    />
                ) : (
                    <Kpi
                        icon={ThumbsUp}
                        label={g.kpi_support ?? ''}
                        title={g.kpi_support_note}
                        value={tally?.approvalShare != null ? formatPct(tally.approvalShare, language) : '—'}
                        meter={tally?.approvalShare != null && item.approvalThreshold != null
                            ? { ratio: tally.approvalShare, mark: item.approvalThreshold, ok: tally.approvalShare >= item.approvalThreshold }
                            : undefined}
                        hint={tally?.approvalShare != null && item.approvalThreshold != null
                            ? fill(tally.approvalShare >= item.approvalThreshold ? (g.kpi_support_ok ?? '') : (g.kpi_support_ko ?? ''), { pct: formatPct(item.approvalThreshold, language) })
                            : undefined}
                    />
                )}
                <Kpi icon={Users} label={g.kpi_voters ?? ''} value={voters?.toLocaleString(language) ?? '—'} hint={revotes ? fill(gv.revote_hint ?? '', { n: revotes.toLocaleString(language) }) : undefined} />
                <div className="col-span-2 md:col-span-1">
                    <Kpi icon={Hourglass} label={g.kpi_time ?? ''} value={<span suppressHydrationWarning>{time.value}</span>} hint={time.hint} />
                </div>
            </div>

            {kind === 'election' && item.election && (
                tallyQuery.data?.electionData ? (
                    <ElectionCandidatesKpiGrid
                        election={item.election}
                        electionData={tallyQuery.data.electionData}
                        g={g}
                        language={language}
                    />
                ) : tallyQuery.isLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2.5" aria-hidden>
                        {item.election.candidates.map(c => (
                            <div key={c.id} className="h-[88px] rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-surface)] animate-pulse" />
                        ))}
                    </div>
                ) : null
            )}

            {tallyQuery.isLoading && !(kind === 'election' && item.election) && (
                <div className="h-24 rounded-2xl bg-[var(--color-surface)] animate-pulse" aria-hidden />
            )}
            {!tallyQuery.isLoading && !tally && (
                <p className="flex items-center gap-2 rounded-2xl border border-dashed border-[var(--color-card-border)] p-5 text-sm text-[var(--color-text-muted)]">
                    <Info className="size-4 shrink-0" />{g.results_unavailable}
                </p>
            )}

            {tally?.outcome && (
                <OutcomeBanner outcome={tally.outcome} tally={tally} item={item} final={phase === 'closed'} gv={gv} locale={language} />
            )}

            {/* The results box is also the ballot: vote from here while voting is open. */}
            {kind === 'election' && item.election ? (
                <div className="space-y-6">
                    <div className="@container grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                        {tallyQuery.data?.electionData ? (
                            <ElectionResultsSummaryCard
                                election={item.election}
                                electionData={tallyQuery.data.electionData}
                                g={g}
                                language={language}
                            />
                        ) : (
                            <div className="h-[420px] rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-surface)] animate-pulse" aria-hidden />
                        )}
                        <div className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5 space-y-5 xl:sticky xl:top-24">
                            {tally && <TurnoutMeter tally={tally} item={item} gv={gv} locale={language} />}
                            <VotingWindow item={item} phase={phase} progress={votingProgress(item, now)} gv={gv} locale={language} now={now} />
                        </div>
                    </div>
                    {tallyQuery.data?.electionData && (
                        <ElectionCandidatesBallot
                            election={item.election}
                            electionData={tallyQuery.data.electionData}
                            voters={tallyQuery.data.voters}
                            canGrade={false}
                            g={g}
                            language={language}
                            sortByRank
                        />
                    )}
                </div>
            ) : (
                <div className="@container grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <ResultsBallot entry={entry} system={system} choices={choices} tally={tally} g={g} language={language} now={now} />
                    <div className="h-full rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5 space-y-5">
                        {tally && <TurnoutMeter tally={tally} item={item} gv={gv} locale={language} />}
                        <VotingWindow item={item} phase={phase} progress={votingProgress(item, now)} gv={gv} locale={language} now={now} />
                    </div>
                </div>
            )}

            {tallyQuery.data?.voters && (
                <VotersTable tally={tally} voters={tallyQuery.data.voters} choices={choices} g={g} language={language} />
            )}

            <div className="space-y-1.5">
                {tally?.outcome && (
                    <p className="flex items-start gap-1.5 text-[11px] leading-snug text-[var(--color-text-muted)]">
                        <Info className="size-3 mt-0.5 shrink-0" />{gv.outcome_note}
                    </p>
                )}
                {tallyQuery.data?.source && (
                    <p className="flex items-start gap-1.5 text-[11px] leading-snug text-[var(--color-text-muted)]">
                        <Info className="size-3 mt-0.5 shrink-0" />
                        {fill(gv.source_note ?? '', { source: tallyQuery.data.source })}
                    </p>
                )}
            </div>
        </div>
    );
}
