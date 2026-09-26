'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Activity, Target, ThumbsUp, Users, Hourglass, Info, ExternalLink } from 'lucide-react';
import type { GovernanceSystem } from '../config/systems';
import type { GovernanceEntry } from '../types';
import { useGovernanceTally } from '../hooks/useGovernanceTally';
import { itemChoices, summarizeTally, uniqueVoters, votingPhase, votingProgress, type BallotChoice, type TallySummary } from '../lib/governanceVotes';
import { OutcomeBanner, TurnoutMeter, VotingWindow, fill, formatDate, formatPct, formatXrd, type Gv } from './VoteParts';
import { formatDuration } from '../lib/format';
import { CopyButton, shortenAddress } from '@/features/dashboard/explorador/components/SummaryCardKit';
import { useCopy } from '../hooks/useCopy';
import { ResultsBallot } from './ResultsBallot';
import type { VoterRow } from '../types';
import type { G } from './GovernanceBadges';

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
        <div className="min-w-0 rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-4" title={title}>
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

type VoterSort = 'recent' | 'power';

/**
 * Every account with a counted vote: newest first by default or by voting
 * power, with a tab per ballot choice. The XRD total follows the filter.
 */
function VotersTable({ tally, voters, choices, g, language }: {
    tally: TallySummary | null;
    voters: VoterRow[];
    choices: BallotChoice[];
    g: G;
    language: string;
}) {
    const [filter, setFilter] = useState<string>('all');
    const [sort, setSort] = useState<VoterSort>('recent');
    const { copied, copy } = useCopy();
    const choiceLabel = (key: string) => choices.find(c => c.key === key)?.label ?? key;
    const power = (v: VoterRow) => Number(v.votePower) || 0;

    const tabs = [
        { key: 'all', label: g.voters_all || 'All', rows: voters },
        ...choices.map(c => ({ key: c.key, label: c.label, rows: voters.filter(v => v.choices.includes(c.key)) })).filter(t => t.rows.length > 0),
    ];
    const current = tabs.find(t => t.key === filter) ?? tabs[0];
    const rows = [...current.rows].sort(sort === 'recent' ? (a, b) => b.voteId - a.voteId : (a, b) => power(b) - power(a));
    const totalXrd = rows.reduce((sum, v) => sum + power(v), 0);

    return (
        <section aria-labelledby="voters-table" className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] overflow-hidden">
            <div className="px-5 pt-4 flex flex-wrap items-center justify-between gap-3">
                <h3 id="voters-table" className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-main)]">
                    <Users className="size-4 text-[var(--color-primary)]" />{g.voters_title || 'Voters'}
                </h3>
                <div role="group" aria-label={g.voters_sort || 'Sort'} className="inline-flex gap-1 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-surface)] p-0.5">
                    {([['recent', g.voters_recent || 'Most recent'], ['power', g.voters_top_xrd || 'Most XRD']] as const).map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            aria-pressed={sort === key}
                            onClick={() => setSort(key)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${sort === key ? 'bg-[var(--color-card-bg)] text-[var(--color-primary)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mt-3 px-5 flex items-end justify-between gap-4 border-b border-[var(--color-card-border)]">
                <div role="tablist" aria-label={g.voters_title || 'Voters'} className="no-scrollbar flex gap-5 overflow-x-auto">
                    {tabs.map(t => {
                        const active = current.key === t.key;
                        return (
                            <button
                                key={t.key}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setFilter(t.key)}
                                className={`relative shrink-0 pb-2.5 text-xs font-bold transition-colors ${active ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                            >
                                {t.label}
                                <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] ${active ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]' : 'bg-[var(--color-surface)]'}`}>{t.rows.length.toLocaleString(language)}</span>
                                {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--color-primary)]" />}
                            </button>
                        );
                    })}
                </div>
                <span className="shrink-0 pb-2.5 text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                    {g.voters_total_xrd || 'Total'}: <span className="font-mono font-bold text-[var(--color-text-main)]">{formatXrd(totalXrd, language)} XRD</span>
                    {tally && tally.turnout > 0 && current.key !== 'all' && <span className="ml-1">({formatPct(totalXrd / tally.turnout, language)})</span>}
                </span>
            </div>

            {rows.length === 0 ? (
                <p className="p-5 text-sm text-[var(--color-text-muted)]">{g.voters_empty}</p>
            ) : (
                <div className="no-scrollbar max-h-[520px] overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-[var(--color-card-bg)] shadow-[0_1px_0_var(--color-card-border)]">
                            <tr className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                                <th className="text-left font-bold px-5 py-2.5">#</th>
                                <th className="text-left font-bold px-3 py-2.5">{g.col_account || 'Account'}</th>
                                <th className="text-left font-bold px-3 py-2.5">{g.col_vote || 'Vote'}</th>
                                <th className="text-right font-bold px-3 py-2.5">{g.col_power || 'Voting power'}</th>
                                <th className="text-left font-bold px-3 py-2.5">{g.col_date || 'Date'}</th>
                                <th className="text-left font-bold px-5 py-2.5">{g.col_txid || 'Transaction'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((v, i) => {
                                const p = power(v);
                                return (
                                    <tr key={v.account} className="border-t border-[var(--color-card-border)] hover:bg-[var(--color-surface)] transition-colors">
                                        <td className="px-5 py-2.5 font-mono text-xs text-[var(--color-text-muted)]">{i + 1}</td>
                                        <td className="px-3 py-2.5">
                                            <span className="inline-flex items-center gap-1 whitespace-nowrap">
                                                <Link href={`/${language}/dashboard/account/${v.account}`} prefetch={false} className="font-mono text-xs text-[var(--color-text-main)] hover:text-[var(--color-primary)]" title={v.account}>
                                                    {shortenAddress(v.account)}
                                                </Link>
                                                <CopyButton value={v.account} copiedAddress={copied} onCopy={copy} title={g.copy || 'Copy'} />
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] whitespace-nowrap">
                                            {v.choices.map(choiceLabel).join(', ')}
                                            {v.changes > 0 && <span className="ml-1.5 text-[10px] font-normal text-[var(--color-text-muted)]" title={g.vote?.changed_vote}>↻</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-mono text-xs whitespace-nowrap">
                                            {v.votePower === null ? <span className="text-[var(--color-text-muted)]">—</span> : (
                                                <>
                                                    <span className="font-bold text-[var(--color-text-main)]">{formatXrd(p, language)} XRD</span>
                                                    {tally && tally.turnout > 0 && <span className="ml-2 text-[var(--color-text-muted)]">{formatPct(p / tally.turnout, language)}</span>}
                                                </>
                                            )}
                                        </td>
                                        <td className="px-3 py-2.5 text-xs text-[var(--color-text-muted)] whitespace-nowrap" suppressHydrationWarning>
                                            {formatDate(Date.parse(v.time) / 1000, language)}
                                        </td>
                                        <td className="px-5 py-2.5 whitespace-nowrap">
                                            <Link href={`/${language}/dashboard/tx/${v.txid}`} prefetch={false} className="inline-flex items-center gap-1 font-mono text-xs text-[var(--color-primary)] hover:underline" title={v.txid}>
                                                {shortenAddress(v.txid)}<ExternalLink className="size-3" />
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

/**
 * Result tab: headline figures, verdict, how the vote splits, turnout against
 * the quorum, the voting window and the largest voters.
 */
export function ResultsDashboard({ entry, system, g, language, now }: {
    entry: GovernanceEntry;
    system: GovernanceSystem;
    g: G;
    language: string;
    now: number;
}) {
    const { item, kind, id } = entry;
    const gv: Gv = g.vote ?? {};
    const stances = (gv.stances ?? {}) as Record<string, string>;
    const choices = itemChoices(kind, item, s => stances[s] || s);
    const tallyQuery = useGovernanceTally({ component: system.component, kind, itemId: id, voters: true }, system.network);
    const tally = tallyQuery.data ? summarizeTally(choices, tallyQuery.data, item) : null;
    const phase = votingPhase(item, now);
    const voters = uniqueVoters(item);

    const time = phase === 'open' && item.deadline
        ? { value: formatDuration(item.deadline - now, language), hint: g.kpi_until_close || 'until it closes' }
        : phase === 'upcoming' && item.start
            ? { value: formatDuration(item.start - now, language), hint: g.kpi_until_open || 'until it opens' }
            : { value: g.kpi_ended || 'Ended', hint: item.deadline ? fill(g.kpi_closed_on || 'Closed on {date}', { date: formatDate(item.deadline, language, undefined, 'date') }) : undefined };

    return (
        <div className="space-y-6">
            <h2 className="sr-only">{g.results_heading}</h2>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                <Kpi icon={Activity} label={g.kpi_turnout || 'Turnout'} value={tally ? `${formatXrd(tally.turnout, language)}` : '—'} hint={g.kpi_turnout_hint || 'XRD of voting power'} />
                <Kpi
                    icon={Target}
                    label={g.kpi_quorum || 'Quorum reached'}
                    value={tally?.quorumRatio != null ? formatPct(tally.quorumRatio, language) : '—'}
                    meter={tally?.quorumRatio != null ? { ratio: tally.quorumRatio, ok: !!tally.quorumMet } : undefined}
                    hint={item.quorum ? fill(g.kpi_quorum_hint || 'of the {amount} XRD minimum', { amount: formatXrd(item.quorum, language) }) : undefined}
                />
                <Kpi
                    icon={ThumbsUp}
                    label={g.kpi_support || 'In favour'}
                    title={g.kpi_support_note}
                    value={tally?.approvalShare != null ? formatPct(tally.approvalShare, language) : '—'}
                    meter={tally?.approvalShare != null && item.approvalThreshold != null
                        ? { ratio: tally.approvalShare, mark: item.approvalThreshold, ok: tally.approvalShare >= item.approvalThreshold }
                        : undefined}
                    hint={tally?.approvalShare != null && item.approvalThreshold != null
                        ? fill(tally.approvalShare >= item.approvalThreshold ? (g.kpi_support_ok || 'Above the {pct} needed') : (g.kpi_support_ko || 'Needs at least {pct}'), { pct: formatPct(item.approvalThreshold, language) })
                        : undefined}
                />
                <Kpi icon={Users} label={g.kpi_voters || 'Voters'} value={voters?.toLocaleString(language) ?? '—'} hint={item.revoteCount ? fill(gv.revote_hint || 'changed votes: {n}', { n: String(item.revoteCount) }) : undefined} />
                <div className="col-span-2 md:col-span-1">
                    <Kpi icon={Hourglass} label={g.kpi_time || 'Time'} value={<span suppressHydrationWarning>{time.value}</span>} hint={time.hint} />
                </div>
            </div>

            {tallyQuery.isLoading && <div className="h-24 rounded-2xl bg-[var(--color-surface)] animate-pulse" aria-hidden />}
            {!tallyQuery.isLoading && !tally && (
                <p className="flex items-center gap-2 rounded-2xl border border-dashed border-[var(--color-card-border)] p-5 text-sm text-[var(--color-text-muted)]">
                    <Info className="size-4 shrink-0" />{g.results_unavailable}
                </p>
            )}

            {tally?.outcome && (
                <OutcomeBanner outcome={tally.outcome} tally={tally} item={item} final={phase === 'closed'} gv={gv} locale={language} />
            )}

            {/* The results box is also the ballot: vote from here while voting is open. */}
            <div className="@container grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                <ResultsBallot entry={entry} system={system} choices={choices} tally={tally} g={g} language={language} now={now} />
                <div className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5 space-y-5">
                    {tally && <TurnoutMeter tally={tally} item={item} gv={gv} locale={language} />}
                    <VotingWindow item={item} phase={phase} progress={votingProgress(item, now)} gv={gv} locale={language} now={now} />
                </div>
            </div>

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
                        {fill(gv.source_note || 'Weights published by {source}.', { source: tallyQuery.data.source })}
                    </p>
                )}
            </div>
        </div>
    );
}
