'use client';

import React from 'react';
import Link from 'next/link';
import { Vote, UserRound, Users, Target, PenLine, AlertCircle, RefreshCw, Info, ArrowRight, Scale } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { systemByComponent } from '@/features/governance/config/systems';
import { governanceItemPath } from '@/features/governance/lib/paths';
import type { Network, TranslationsT } from '@/features/dashboard/types';
import { useGovernanceItem } from '@/features/governance/hooks/useGovernanceItem';
import { useGovernanceTally } from '@/features/governance/hooks/useGovernanceTally';
import {
    ballotChoices, selectedLabels, summarizeTally, toneOf, uniqueVoters, votingPhase, votingProgress,
    type GovernanceVote, type VotingPhase,
} from '@/features/governance/lib/governanceVotes';
import { formatShare } from '@/features/governance/lib/format';
import {
    SummaryCard, SummaryHero, SummaryBody, PlainSummary, FactTile, AddressChip, shortenAddress,
} from './SummaryCardKit';
import {
    TONE, fill, formatPct, formatXrd, OutcomeBanner, BallotResults, TurnoutMeter, VotingWindow, LinkList, type Gv,
} from '@/features/governance/components/VoteParts';

type Tt = Partial<TranslationsT['dashboard']['transactions']>;

interface GovernanceVoteCardProps {
    vote: GovernanceVote;
    tt?: Tt;
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    network: Network;
    locale?: string;
    timezone?: string;
}

const PHASE_STYLE: Record<VotingPhase, string> = {
    open: 'text-[var(--color-accent)] border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10',
    upcoming: 'text-[var(--color-secondary)] border-[var(--color-secondary)]/30 bg-[var(--color-secondary)]/10',
    closed: 'text-[var(--color-text-muted)] border-[var(--color-card-border)] bg-[var(--color-surface)]',
    unknown: '',
};

/**
 * GovernanceVoteCard
 * Explains a vote on a Radix governance proposal or temperature check: what
 * was voted and on which question, how the vote is going or how it ended
 * (weighted by voting power, against its quorum and approval threshold), and
 * when it closes.
 */
export function GovernanceVoteCard({ vote, tt, onCopy, copiedAddress, network, locale, timezone }: GovernanceVoteCardProps) {
    const { t, language } = useLanguage();
    const gv: Gv = t.governance?.vote ?? {};
    const system = systemByComponent(vote.component);
    const itemQuery = useGovernanceItem(vote, network);
    const tallyQuery = useGovernanceTally({ component: vote.component, kind: vote.kind, itemId: vote.itemId, account: vote.account }, network);
    const item = itemQuery.data?.item ?? null;
    const copyTitle = tt?.copy_raw || 'Copy';
    const isProposal = vote.kind === 'proposal';

    const stances = (gv.stances ?? {}) as Record<string, string>;
    const stanceLabel = (s: string) => stances[s] || s;
    const rawChoice = selectedLabels(vote.selection, item);
    const choiceText = (vote.selection.type === 'stance' ? rawChoice.map(stanceLabel) : rawChoice).join(', ') || '—';
    const tone = rawChoice.length === 1 ? toneOf(rawChoice[0]) : 'neutral';
    const ToneIcon = TONE[tone].icon;

    const choices = ballotChoices(vote, item, stanceLabel);
    const tally = tallyQuery.data && item ? summarizeTally(choices, tallyQuery.data, item) : null;
    const phase = votingPhase(item);
    const title = item?.title || gv.untitled || 'untitled';
    const kindShort = isProposal ? (gv.short_proposal || 'Proposal') : (gv.short_temperature_check || 'Temperature check');
    const exactAccountPower = tally?.accountPower != null
        ? new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(tally.accountPower)
        : null;
    const accountShareText = tally?.accountShare != null
        ? fill(gv.voting_power_share ?? '', { share: formatShare(tally.accountShare, locale) })
        : null;
    const voterPowerHint = tally?.accountPower != null
        ? fill(gv.voter_power || 'Voting power: {amount} XRD ({share} of the total)', {
            amount: formatXrd(tally.accountPower, locale),
            share: formatShare(tally.accountShare ?? 0, locale),
        })
        : null;

    const summary = fill(
        (isProposal ? gv.summary_proposal : gv.summary_temperature_check) || 'The account {account} voted "{choice}" on "{title}".',
        { account: vote.account ? shortenAddress(vote.account) : '—', choice: choiceText, title },
    ) + (vote.replacingVoteId ? fill(gv.summary_replacing || ' This vote replaces its previous vote (no. {id}).', { id: vote.replacingVoteId }) : '');

    return (
        <SummaryCard
            icon={Vote}
            title={gv.title || 'Governance vote'}
            aside={
                <>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                        {isProposal ? (gv.kind_proposal || 'Formal proposal') : (gv.kind_temperature_check || 'Temperature check')}
                    </span>
                    {phase !== 'unknown' && (
                        <span className={`hidden @sm:inline text-[10px] font-semibold px-2 py-0.5 rounded-full border ${PHASE_STYLE[phase]}`}>
                            {{ open: gv.phase_open || 'Voting open', closed: gv.phase_closed || 'Voting closed', upcoming: gv.phase_upcoming || 'Not started' }[phase]}
                        </span>
                    )}
                </>
            }
        >
            {/* ── The vote and the question ── */}
            <SummaryHero>
                <div className="flex flex-col @xl:flex-row @xl:items-center gap-4">
                    <div className={`shrink-0 rounded-2xl border p-4 flex items-center gap-3 @xl:min-w-[200px] ${TONE[tone].soft}`}>
                        <span className={`grid place-items-center size-11 rounded-xl bg-[var(--color-card-bg)] border border-current/20 ${TONE[tone].text}`}>
                            <ToneIcon className="size-5" />
                        </span>
                        <span className="min-w-0 flex flex-col">
                            <span className="text-[9px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">{gv.your_vote || 'Vote cast'}</span>
                            <span className={`text-xl font-black leading-tight break-words ${TONE[tone].text}`}>{choiceText}</span>
                            {vote.replacingVoteId && (
                                <span className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-[var(--color-text-muted)]">
                                    <RefreshCw className="size-3" />{gv.changed_vote || 'Vote changed'}
                                </span>
                            )}
                        </span>
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
                            <span>{kindShort} #{vote.itemId}</span>
                            {itemQuery.data?.componentName && <><span aria-hidden>·</span><span className="truncate">{itemQuery.data.componentName}</span></>}
                            {item?.parameterLabel && (
                                <span className="px-1.5 py-0.5 rounded-md border border-[var(--color-card-border)] bg-[var(--color-card-bg)] text-[10px]">{item.parameterLabel}</span>
                            )}
                        </div>
                        {itemQuery.isLoading ? (
                            <div className="mt-2 space-y-2 animate-pulse">
                                <div className="h-5 w-3/4 rounded bg-[var(--color-surface-hover)]" />
                                <div className="h-3 w-full rounded bg-[var(--color-surface-hover)]" />
                            </div>
                        ) : (
                            <>
                                <p className="mt-1 text-base @md:text-lg font-bold leading-snug text-[var(--color-text-main)] break-words">{title}</p>
                                {item?.shortDescription && (
                                    <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-text-secondary)] line-clamp-3">{item.shortDescription}</p>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* ── Voter Account & Voting Power highlight strip ── */}
                {vote.account && (
                    <div className="mt-4 pt-3.5 border-t border-[var(--color-card-border)]/60 grid grid-cols-1 @md:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)]/85 px-3.5 py-2.5 flex items-center justify-between gap-3 min-w-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <span className="grid place-items-center size-9 rounded-lg bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] shrink-0">
                                    <UserRound className="size-4" />
                                </span>
                                <div className="min-w-0 flex flex-col">
                                    <span className="text-[9px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">
                                        {gv.voter}
                                    </span>
                                    <AddressChip address={vote.account} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={copyTitle} />
                                </div>
                            </div>
                            {vote.voteId && (
                                <span className="shrink-0 text-[10px] font-mono font-semibold px-2.5 py-1 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]">
                                    {fill(gv.vote_number ?? '', { id: vote.voteId })}
                                </span>
                            )}
                        </div>

                        <div className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-card-bg)]/85 px-3.5 py-2.5 flex items-center justify-between gap-3 min-w-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <span className="grid place-items-center size-9 rounded-lg bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 text-[var(--color-primary)] shrink-0">
                                    <Scale className="size-4" />
                                </span>
                                <div className="min-w-0 flex flex-col">
                                    <span className="text-[9px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">
                                        {gv.voting_power}
                                    </span>
                                    {tally?.accountPower != null ? (
                                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
                                            <span className="text-base @md:text-lg font-black font-mono text-[var(--color-primary)] leading-tight tabular-nums">
                                                {formatXrd(tally.accountPower, locale)} XRD
                                            </span>
                                            {tally.accountPower >= 1000 && exactAccountPower && (
                                                <span className="text-[11px] font-mono text-[var(--color-text-muted)] tabular-nums truncate">
                                                    ({exactAccountPower} XRD)
                                                </span>
                                            )}
                                        </div>
                                    ) : tallyQuery.isLoading && network === 'mainnet' ? (
                                        <span className="text-xs font-semibold text-[var(--color-text-muted)] animate-pulse">
                                            {gv.voting_power_counting}
                                        </span>
                                    ) : (
                                        <span className="text-sm font-mono font-semibold text-[var(--color-text-muted)]">—</span>
                                    )}
                                </div>
                            </div>
                            {accountShareText && (
                                <span className="shrink-0 text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 text-[var(--color-primary)] tabular-nums">
                                    {accountShareText}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </SummaryHero>

            <SummaryBody>
                <PlainSummary>{summary}</PlainSummary>

                {itemQuery.isError && (
                    <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                        <AlertCircle className="size-3.5" />{gv.load_error || 'The vote details could not be loaded.'}
                    </p>
                )}

                {/* ── How it ended (or is going) ── */}
                {tally?.outcome && (
                    <OutcomeBanner outcome={tally.outcome} tally={tally} item={item} final={phase === 'closed'} gv={gv} locale={locale} />
                )}
                {tallyQuery.isLoading && network === 'mainnet' && (
                    <div className="h-20 rounded-xl bg-[var(--color-surface)] animate-pulse" aria-hidden />
                )}

                <BallotResults choices={choices} tally={tally} gv={gv} locale={locale} />
                {tally && <TurnoutMeter tally={tally} item={item} gv={gv} locale={locale} />}

                {/* ── Key facts ── */}
                <div className="space-y-3">
                    {vote.account && (
                        <div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
                            <FactTile
                                icon={UserRound}
                                label={gv.voter || 'Voter'}
                                hint={[
                                    vote.voteId ? fill(gv.vote_number || 'Vote no. {id}', { id: vote.voteId }) : null,
                                    voterPowerHint,
                                ].filter(Boolean).join(' · ') || undefined}
                            >
                                <AddressChip address={vote.account} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={copyTitle} />
                            </FactTile>

                            <FactTile
                                icon={Scale}
                                label={gv.voting_power ?? ''}
                                hint={tally?.accountPower != null
                                    ? [
                                        tally.accountPower >= 1000 && exactAccountPower ? `${exactAccountPower} XRD` : null,
                                        accountShareText,
                                    ].filter(Boolean).join(' · ') || undefined
                                    : undefined}
                            >
                                {tally?.accountPower != null ? (
                                    <span className="text-xl font-black font-mono text-[var(--color-primary)] tabular-nums">
                                        {formatXrd(tally.accountPower, locale)} XRD
                                    </span>
                                ) : tallyQuery.isLoading && network === 'mainnet' ? (
                                    <span className="text-sm font-semibold text-[var(--color-text-muted)] animate-pulse">
                                        {gv.voting_power_counting}
                                    </span>
                                ) : (
                                    <span className="text-xl font-black font-mono text-[var(--color-text-muted)]">—</span>
                                )}
                            </FactTile>
                        </div>
                    )}

                    <div className={`grid grid-cols-1 ${item?.author ? '@md:grid-cols-3' : '@md:grid-cols-2'} gap-3`}>
                        <FactTile
                            icon={Users}
                            label={gv.vote_count || 'Votes cast'}
                            hint={item?.revoteCount
                                ? fill(gv.revote_hint || 'Distinct accounts · changed votes: {n}', { n: item.revoteCount.toLocaleString(locale) })
                                : (gv.vote_count_hint || 'Distinct accounts that voted')}
                        >
                            <span className="text-xl font-black font-mono">{uniqueVoters(item)?.toLocaleString(locale) ?? '—'}</span>
                        </FactTile>
                        <FactTile
                            icon={Target}
                            label={gv.to_pass || 'To pass'}
                            hint={item?.quorum ? fill(gv.quorum_hint || 'Minimum turnout: {amount} XRD of voting power', { amount: formatXrd(item.quorum, locale) }) : undefined}
                        >
                            {item?.approvalThreshold != null
                                ? fill(gv.to_pass_value || '{pct} in favour', { pct: formatPct(item.approvalThreshold, locale) })
                                : '—'}
                        </FactTile>
                        {item?.author && (
                            <FactTile icon={PenLine} label={isProposal ? (gv.author_proposal || 'Proposed by') : (gv.author_temperature_check || 'Raised by')}>
                                <AddressChip address={item.author} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={copyTitle} />
                            </FactTile>
                        )}
                    </div>
                </div>

                {item && <VotingWindow item={item} phase={phase} progress={votingProgress(item)} gv={gv} locale={locale} timezone={timezone} />}
                {item && <LinkList links={item.links} title={gv.links || 'Learn more'} />}

                {tally?.outcome && (
                    <p className="flex items-start gap-1.5 text-[11px] leading-snug text-[var(--color-text-muted)]">
                        <Info className="size-3 mt-0.5 shrink-0" />
                        {gv.outcome_note || 'Indicative result, computed with the quorum and threshold stored on the ledger.'}
                    </p>
                )}
                {tallyQuery.data?.source && (
                    <p className="flex items-start gap-1.5 text-[11px] leading-snug text-[var(--color-text-muted)]">
                        <Info className="size-3 mt-0.5 shrink-0" />
                        {fill(gv.source_note || 'The ledger records each vote; its weight in XRD is computed and published by {source}, the dApp that runs this vote.', { source: tallyQuery.data.source })}
                    </p>
                )}
                {system && (
                    <Link
                        href={`/${language}${governanceItemPath(system.key, vote.kind, vote.itemId)}`}
                        className="flex items-center justify-center gap-2 w-full rounded-xl px-4 py-3 text-sm font-bold text-white bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] hover:opacity-90 transition-opacity"
                    >
                        {phase === 'open'
                            ? (gv.open_in_governance || 'See the full vote and cast yours')
                            : (gv.view_in_governance ?? gv.open_in_governance)}
                        <ArrowRight className="size-4" />
                    </Link>
                )}
            </SummaryBody>
        </SummaryCard>
    );
}
