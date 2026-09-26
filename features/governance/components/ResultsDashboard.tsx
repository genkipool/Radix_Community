'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Activity, Target, ThumbsUp, Users, Hourglass, Info } from 'lucide-react';
import type { GovernanceSystem } from '../config/systems';
import type { GovernanceEntry } from '../types';
import { useGovernanceTally } from '../hooks/useGovernanceTally';
import { itemChoices, summarizeTally, uniqueVoters, votingPhase, votingProgress, type BallotChoice, type TallySummary } from '../lib/governanceVotes';
import { BallotResults, OutcomeBanner, TurnoutMeter, VotingWindow, fill, formatDate, formatPct, formatXrd, type Gv } from './VoteParts';
import { formatDuration } from '../lib/format';
import { shortenAddress } from '@/features/dashboard/explorador/components/SummaryCardKit';
import type { G } from './GovernanceBadges';

function Kpi({ icon: Icon, label, value, hint, accent }: { icon: typeof Activity; label: string; value: React.ReactNode; hint?: React.ReactNode; accent?: string }) {
    return (
        <div className="min-w-0 rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-4">
            <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">
                <Icon className="size-3.5 text-[var(--color-primary)]" />{label}
            </span>
            <span className={`block mt-2 text-2xl font-black font-mono leading-none truncate ${accent ?? 'text-[var(--color-text-main)]'}`}>{value}</span>
            {hint && <span className="block mt-1.5 text-[11px] text-[var(--color-text-muted)] truncate" suppressHydrationWarning>{hint}</span>}
        </div>
    );
}

const PAGE = 20;

/**
 * Every account with a counted vote, sorted by voting power, with a tab per
 * ballot choice to see who backed what.
 */
function VotersTable({ tally, voters, choices, g, language }: {
    tally: TallySummary;
    voters: { total: number; top: Array<{ account: string; vote: string; votePower: string }> };
    choices: BallotChoice[];
    g: G;
    language: string;
}) {
    const [filter, setFilter] = useState<string>('all');
    const [shown, setShown] = useState(PAGE);
    const choiceLabel = (key: string) => choices.find(c => c.key === key)?.label ?? key;
    const countFor = (key: string) => voters.top.filter(v => v.vote === key).length;
    const tabs = [
        { key: 'all', label: g.voters_all || 'All', count: voters.top.length },
        ...choices.map(c => ({ key: c.key, label: c.label, count: countFor(c.key) })).filter(t => t.count > 0),
    ];
    const rows = filter === 'all' ? voters.top : voters.top.filter(v => v.vote === filter);
    const visible = rows.slice(0, shown);
    const selectTab = (key: string) => { setFilter(key); setShown(PAGE); };

    return (
        <section aria-labelledby="voters-table" className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] overflow-hidden">
            <div className="px-5 pt-4 flex flex-wrap items-baseline justify-between gap-2">
                <h3 id="voters-table" className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-main)]">
                    <Users className="size-4 text-[var(--color-primary)]" />{g.voters_title || 'Voters'}
                </h3>
                <span className="text-xs text-[var(--color-text-muted)]">{fill(g.voters_total || '{n} accounts with a counted vote', { n: voters.total.toLocaleString(language) })}</span>
            </div>

            <div role="tablist" aria-label={g.voters_title || 'Voters'} className="mt-3 px-5 flex gap-5 overflow-x-auto border-b border-[var(--color-card-border)]">
                {tabs.map(t => {
                    const active = filter === t.key;
                    return (
                        <button
                            key={t.key}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => selectTab(t.key)}
                            className={`relative shrink-0 pb-2.5 text-xs font-bold transition-colors ${active ? 'text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                        >
                            {t.label}
                            <span className={`ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] ${active ? 'bg-[var(--color-primary)]/15 text-[var(--color-primary)]' : 'bg-[var(--color-surface)]'}`}>{t.count.toLocaleString(language)}</span>
                            {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--color-primary)]" />}
                        </button>
                    );
                })}
            </div>

            {rows.length === 0 ? (
                <p className="p-5 text-sm text-[var(--color-text-muted)]">{g.voters_empty}</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">
                                <th className="text-left font-bold px-5 py-2.5">#</th>
                                <th className="text-left font-bold px-3 py-2.5">{g.col_account || 'Account'}</th>
                                <th className="text-left font-bold px-3 py-2.5">{g.col_vote || 'Vote'}</th>
                                <th className="text-right font-bold px-5 py-2.5">{g.col_power || 'Voting power'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map((v, i) => {
                                const power = Number(v.votePower) || 0;
                                return (
                                    <tr key={`${v.account}-${v.vote}`} className="border-t border-[var(--color-card-border)]">
                                        <td className="px-5 py-2.5 font-mono text-xs text-[var(--color-text-muted)]">{i + 1}</td>
                                        <td className="px-3 py-2.5">
                                            <Link href={`/${language}/dashboard/account/${v.account}`} className="whitespace-nowrap font-mono text-xs text-[var(--color-text-main)] hover:text-[var(--color-primary)]" title={v.account}>
                                                {shortenAddress(v.account)}
                                            </Link>
                                        </td>
                                        <td className="px-3 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] whitespace-nowrap">{choiceLabel(v.vote)}</td>
                                        <td className="px-5 py-2.5 text-right font-mono text-xs whitespace-nowrap">
                                            <span className="font-bold text-[var(--color-text-main)]">{formatXrd(power, language)} XRD</span>
                                            <span className="ml-2 text-[var(--color-text-muted)]">{tally.turnout > 0 ? formatPct(power / tally.turnout, language) : ''}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {rows.length > 0 && (
                <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-card-border)]">
                    <span className="text-xs text-[var(--color-text-muted)]">
                        {fill(g.voters_showing || 'Showing {shown} of {total}', { shown: visible.length.toLocaleString(language), total: rows.length.toLocaleString(language) })}
                    </span>
                    {visible.length < rows.length && (
                        <button type="button" onClick={() => setShown(n => n + PAGE)} className="text-xs font-bold text-[var(--color-primary)] hover:underline">
                            {g.show_more || 'Show more'}
                        </button>
                    )}
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
    const tallyQuery = useGovernanceTally({ component: system.component, kind, itemId: id, top: 10_000 }, system.network);
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

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <Kpi icon={Activity} label={g.kpi_turnout || 'Turnout'} value={tally ? `${formatXrd(tally.turnout, language)}` : '—'} hint="XRD" />
                <Kpi
                    icon={Target}
                    label={g.kpi_quorum || 'Quorum'}
                    value={tally?.quorumRatio != null ? formatPct(tally.quorumRatio, language) : '—'}
                    hint={item.quorum ? `${formatXrd(item.quorum, language)} XRD` : undefined}
                    accent={tally?.quorumMet ? 'text-[var(--color-accent)]' : undefined}
                />
                <Kpi
                    icon={ThumbsUp}
                    label={g.kpi_support || 'In favour'}
                    value={tally?.approvalShare != null ? formatPct(tally.approvalShare, language) : '—'}
                    hint={item.approvalThreshold != null ? fill(gv.to_pass_value || '{pct} in favour', { pct: formatPct(item.approvalThreshold, language) }) : undefined}
                />
                <Kpi icon={Users} label={g.kpi_voters || 'Voters'} value={voters?.toLocaleString(language) ?? '—'} hint={item.revoteCount ? fill(gv.revote_hint || 'changed votes: {n}', { n: String(item.revoteCount) }) : undefined} />
                <div className="col-span-2 lg:col-span-1">
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

            {tally && (
                <div className="@container grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5">
                        <BallotResults choices={choices} tally={tally} gv={gv} locale={language} />
                    </div>
                    <div className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5 space-y-5">
                        <TurnoutMeter tally={tally} item={item} gv={gv} locale={language} />
                        <VotingWindow item={item} phase={phase} progress={votingProgress(item, now)} gv={gv} locale={language} now={now} />
                    </div>
                </div>
            )}
            {!tally && (
                <div className="@container rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5">
                    <VotingWindow item={item} phase={phase} progress={votingProgress(item, now)} gv={gv} locale={language} now={now} />
                </div>
            )}

            {tally && tallyQuery.data?.voters && (
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
