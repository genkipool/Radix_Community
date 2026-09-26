'use client';

import React from 'react';
import { HoverPrefetchLink } from '@/components/ui/HoverPrefetchLink';
import { ArrowRight, Users, CalendarClock } from 'lucide-react';
import { systemByKey } from '../config/systems';
import { useGovernanceTally } from '../hooks/useGovernanceTally';
import { itemChoices, summarizeTally, uniqueVoters, votingPhase, type VotingPhase } from '../lib/governanceVotes';
import { governanceItemPath } from '../lib/paths';
import type { GovernanceEntry } from '../types';
import { fill, formatDate, formatPct, formatRelative, TONE } from './VoteParts';
import { KindPill, PhasePill, type G } from './GovernanceBadges';
import { useTranslatedText } from './BrowserTranslation';

/**
 * One proposal or temperature check in the list: what it is, whether it is
 * open, and at a glance how it is going (leading option and quorum). The
 * weighted tally loads per card, after the list is on screen.
 */
export function GovernanceCard({ entry, g, now, language }: { entry: GovernanceEntry; g: G; now: number; language: string }) {
    const { item, kind, id, systemKey, systemName } = entry;
    const system = systemByKey(systemKey);
    const phase: VotingPhase = votingPhase(item, now);
    const stances = (g.vote?.stances ?? {}) as Record<string, string>;
    const tallyQuery = useGovernanceTally({ component: system?.component ?? '', kind, itemId: id }, system?.network ?? 'mainnet', !!system);
    const tally = tallyQuery.data ? summarizeTally(itemChoices(kind, item, s => stances[s] || s), tallyQuery.data, item) : null;
    const leader = tally && tally.turnout > 0 ? [...tally.rows].sort((a, b) => b.power - a.power)[0] : null;
    const voters = uniqueVoters(item);
    const title = useTranslatedText(item.title);
    const shortDescription = useTranslatedText(item.shortDescription);

    const when = !item.deadline ? null
        : phase === 'open' ? fill(g.card_closes || 'Closes {time}', { time: formatRelative(item.deadline, language, now) })
            : phase === 'upcoming' && item.start ? fill(g.card_starts || 'Opens {time}', { time: formatRelative(item.start, language, now) })
                : fill(g.card_closed || 'Closed on {date}', { date: formatDate(item.deadline, language, undefined, 'date') });

    return (
        <HoverPrefetchLink
            href={`/${language}${governanceItemPath(systemKey, kind, id)}`}
            className="group flex flex-col h-full rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-5 transition-all hover:border-[var(--color-primary)]/50 hover:shadow-lg hover:shadow-[var(--color-primary)]/5 hover:-translate-y-0.5"
        >
            <div className="flex flex-wrap items-center gap-2">
                <KindPill kind={kind} g={g} />
                <PhasePill phase={phase} g={g} />
                <span className="ml-auto text-[11px] font-semibold text-[var(--color-text-muted)] truncate">{systemName} · #{id}</span>
            </div>

            <h3 className="mt-3 text-base md:text-lg font-bold leading-snug text-[var(--color-text-main)] line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors">
                {title || g.vote?.untitled || 'untitled'}
            </h3>
            {shortDescription && (
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)] line-clamp-3">{shortDescription}</p>
            )}

            <div className="mt-auto pt-4 space-y-3">
                {tallyQuery.isLoading ? (
                    <div className="space-y-2 animate-pulse" aria-hidden>
                        <div className="h-3 w-2/3 rounded bg-[var(--color-surface-hover)]" />
                        <div className="h-1.5 rounded bg-[var(--color-surface-hover)]" />
                    </div>
                ) : tally && (
                    <div className="space-y-2.5">
                        {leader && (
                            <div>
                                <div className="flex items-baseline justify-between gap-2 text-xs">
                                    <span className="text-[var(--color-text-muted)]">
                                        {g.card_leading || 'Leading'}: <span className={`font-bold ${TONE[leader.tone].text}`}>{leader.label}</span>
                                    </span>
                                    <span className="font-mono font-bold text-[var(--color-text-main)]">{formatPct(leader.share, language)}</span>
                                </div>
                                <div className="mt-1 h-1.5 rounded-full bg-[var(--color-card-border)] overflow-hidden">
                                    <div className={`h-full rounded-full ${TONE[leader.tone].bar}`} style={{ width: `${leader.share * 100}%` }} />
                                </div>
                            </div>
                        )}
                        {tally.quorumRatio !== null && (
                            <div>
                                <div className="flex items-baseline justify-between gap-2 text-xs">
                                    <span className="text-[var(--color-text-muted)]">{g.card_quorum || 'Quorum'}</span>
                                    <span className={`font-mono font-bold ${tally.quorumMet ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-main)]'}`}>
                                        {formatPct(Math.min(tally.quorumRatio, 9.99), language)}
                                    </span>
                                </div>
                                <div className="mt-1 h-1.5 rounded-full bg-[var(--color-card-border)] overflow-hidden">
                                    <div className={`h-full rounded-full ${tally.quorumMet ? 'bg-[var(--color-accent)]' : 'bg-amber-500'}`} style={{ width: `${Math.min(1, tally.quorumRatio) * 100}%` }} />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-[var(--color-card-border)] text-xs text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-3 min-w-0">
                        {voters !== null && (
                            <span className="flex items-center gap-1 shrink-0">
                                <Users className="size-3.5" />{fill(g.card_voters || '{n} voters', { n: voters.toLocaleString(language) })}
                            </span>
                        )}
                        {when && (
                            <span className="flex items-center gap-1 truncate" suppressHydrationWarning>
                                <CalendarClock className="size-3.5 shrink-0" />{when}
                            </span>
                        )}
                    </span>
                    <span className="flex items-center gap-1 font-bold text-[var(--color-primary)] shrink-0">
                        {phase === 'open' ? (g.card_open_cta || 'View and vote') : (g.card_view || 'View vote')}
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                </div>
            </div>
        </HoverPrefetchLink>
    );
}
