'use client';

import React from 'react';
import {
    Vote, ThumbsUp, ThumbsDown, CircleDot, CheckCircle2, Circle, UserRound, Users, Target,
    PenLine, ExternalLink, ArrowUpRight, CalendarClock, AlertCircle, RefreshCw,
} from 'lucide-react';
import type { Network, TranslationsT } from '@/features/dashboard/types';
import { useGovernanceItem } from '../hooks/useGovernanceItem';
import {
    selectedLabels, toneOf, votingPhase, votingProgress,
    type GovernanceItem, type GovernanceVote, type VoteTone, type VotingPhase,
} from '../utils/governanceVoteUtils';
import {
    SummaryCard, SummaryHero, SummaryBody, PlainSummary, SectionLabel, FactTile, FactGrid, AddressChip, shortenAddress,
} from './SummaryCardKit';

type Tt = Partial<TranslationsT['dashboard']['transactions']>;
type Gv = Partial<NonNullable<TranslationsT['dashboard']['transactions']['governance_vote']>>;

interface GovernanceVoteCardProps {
    vote: GovernanceVote;
    tt?: Tt;
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    network: Network;
    locale?: string;
    timezone?: string;
}

/* ── Tone styling (theme tokens; red marks a vote against) ── */

const TONE: Record<VoteTone, { text: string; soft: string; icon: typeof ThumbsUp }> = {
    positive: { text: 'text-[var(--color-accent)]', soft: 'border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10', icon: ThumbsUp },
    negative: { text: 'text-red-500', soft: 'border-red-500/35 bg-red-500/10', icon: ThumbsDown },
    neutral: { text: 'text-[var(--color-text-secondary)]', soft: 'border-[var(--color-card-border)] bg-[var(--color-surface)]', icon: CircleDot },
};

const PHASE_STYLE: Record<VotingPhase, string> = {
    open: 'text-[var(--color-accent)] border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10',
    upcoming: 'text-[var(--color-secondary)] border-[var(--color-secondary)]/30 bg-[var(--color-secondary)]/10',
    closed: 'text-[var(--color-text-muted)] border-[var(--color-card-border)] bg-[var(--color-surface)]',
    unknown: '',
};

const STANCES = ['For', 'Against'];

/* ── Formatting ── */

function formatDate(sec: number, locale?: string, timeZone?: string) {
    const opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };
    try {
        return new Intl.DateTimeFormat(locale, { ...opts, timeZone }).format(sec * 1000);
    } catch {
        return new Intl.DateTimeFormat(locale, opts).format(sec * 1000);
    }
}

function formatRelative(sec: number, locale?: string) {
    const diff = sec - Date.now() / 1000;
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const abs = Math.abs(diff);
    if (abs >= 86_400) return rtf.format(Math.round(diff / 86_400), 'day');
    if (abs >= 3_600) return rtf.format(Math.round(diff / 3_600), 'hour');
    return rtf.format(Math.round(diff / 60), 'minute');
}

const fill = (tpl: string, values: Record<string, string>) =>
    Object.entries(values).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), tpl);

/** Every choice the ballot offered, with the one(s) this vote picked marked. */
function buildChoices(vote: GovernanceVote, item: GovernanceItem | null, stanceLabel: (s: string) => string) {
    if (vote.selection.type === 'stance') {
        const picked = vote.selection.stance;
        const keys = STANCES.includes(picked) || !picked ? STANCES : [...STANCES, picked];
        return keys.map(key => ({ key, label: stanceLabel(key), selected: key === picked, tone: toneOf(key) }));
    }
    const chosen = new Set(vote.selection.optionIds);
    const options = item?.options.length
        ? item.options
        : vote.selection.optionIds.map(id => ({ id, label: `#${id}` }));
    return options.map(o => ({ key: String(o.id), label: o.label, selected: chosen.has(o.id), tone: toneOf(o.label) }));
}

/**
 * GovernanceVoteCard
 * Explains a vote on a Radix governance proposal or temperature check: what
 * was voted, on which question, and where that vote stands now.
 */
export function GovernanceVoteCard({ vote, tt, onCopy, copiedAddress, network, locale, timezone }: GovernanceVoteCardProps) {
    const gv: Gv = tt?.governance_vote ?? {};
    const { data, isLoading, isError } = useGovernanceItem(vote, network);
    const item = data?.item ?? null;
    const copyTitle = tt?.copy_raw || 'Copy';
    const isProposal = vote.kind === 'proposal';

    const stances = (gv.stances ?? {}) as Record<string, string>;
    const stanceLabel = (s: string) => stances[s] || s;
    const rawChoice = selectedLabels(vote.selection, item);
    const choiceText = (vote.selection.type === 'stance' ? rawChoice.map(stanceLabel) : rawChoice).join(', ') || '—';
    const tone = rawChoice.length === 1 ? toneOf(rawChoice[0]) : 'neutral';
    const ToneIcon = TONE[tone].icon;
    const choices = buildChoices(vote, item, stanceLabel);

    const phase = votingPhase(item);
    const progress = votingProgress(item);
    const title = item?.title || gv.untitled || 'untitled';
    const kindShort = isProposal ? (gv.short_proposal || 'Proposal') : (gv.short_temperature_check || 'Temperature check');

    const summary = fill(
        (isProposal ? gv.summary_proposal : gv.summary_temperature_check)
            || 'The account {account} voted "{choice}" on "{title}".',
        { account: vote.account ? shortenAddress(vote.account) : '—', choice: choiceText, title },
    ) + (vote.replacingVoteId ? fill(gv.summary_replacing || ' This vote replaces its previous vote (no. {id}).', { id: vote.replacingVoteId }) : '');

    const phaseText = !item?.deadline ? null
        : phase === 'open' ? fill(gv.ends_rel || 'Closes {time}', { time: formatRelative(item.deadline, locale) })
            : phase === 'upcoming' && item.start ? fill(gv.starts_rel || 'Starts {time}', { time: formatRelative(item.start, locale) })
                : fill(gv.closed_rel || 'Closed {time}', { time: formatRelative(item.deadline, locale) });

    const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });

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
                            {data?.componentName && <><span aria-hidden>·</span><span className="truncate">{data.componentName}</span></>}
                            {item?.parameterLabel && (
                                <span className="px-1.5 py-0.5 rounded-md border border-[var(--color-card-border)] bg-[var(--color-card-bg)] text-[10px]">{item.parameterLabel}</span>
                            )}
                        </div>
                        {isLoading ? (
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
            </SummaryHero>

            <SummaryBody>
                <PlainSummary>{summary}</PlainSummary>

                {isError && (
                    <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                        <AlertCircle className="size-3.5" />{gv.load_error || 'The vote details could not be loaded.'}
                    </p>
                )}

                {/* ── Ballot ── */}
                <div>
                    <SectionLabel>{gv.options || 'Ballot options'}</SectionLabel>
                    <ul className="grid grid-cols-1 @md:grid-cols-2 @3xl:grid-cols-3 gap-2">
                        {choices.map(c => (
                            <li
                                key={c.key}
                                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-[13px] ${c.selected
                                    ? `${TONE[c.tone].soft} ${TONE[c.tone].text} font-bold`
                                    : 'border-[var(--color-card-border)] bg-[var(--color-card-bg)] text-[var(--color-text-muted)]'}`}
                            >
                                <span className="flex items-center gap-2 min-w-0">
                                    {c.selected ? <CheckCircle2 className="size-4 shrink-0" /> : <Circle className="size-4 shrink-0 opacity-50" />}
                                    <span className="break-words">{c.label}</span>
                                </span>
                                {c.selected && <span className="text-[10px] uppercase tracking-wider shrink-0">{gv.selected || 'Chosen'}</span>}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* ── Key facts ── */}
                <FactGrid>
                    {vote.account && (
                        <FactTile icon={UserRound} label={gv.voter || 'Voter'} hint={vote.voteId ? fill(gv.vote_number || 'Vote no. {id}', { id: vote.voteId }) : undefined}>
                            <AddressChip address={vote.account} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={copyTitle} />
                        </FactTile>
                    )}
                    <FactTile icon={Users} label={gv.vote_count || 'Votes cast'} hint={gv.vote_count_hint || 'In total, so far'}>
                        <span className="text-xl font-black font-mono">{item?.voteCount != null ? item.voteCount.toLocaleString(locale) : '—'}</span>
                    </FactTile>
                    <FactTile
                        icon={Target}
                        label={gv.to_pass || 'To pass'}
                        hint={item?.quorum ? fill(gv.quorum_hint || 'Minimum turnout: {amount} XRD of voting power', { amount: compact.format(item.quorum) }) : undefined}
                    >
                        {item?.approvalThreshold != null
                            ? fill(gv.to_pass_value || '{pct} of the votes', { pct: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(item.approvalThreshold) })
                            : '—'}
                    </FactTile>
                    {item?.author && (
                        <FactTile icon={PenLine} label={isProposal ? (gv.author_proposal || 'Proposed by') : (gv.author_temperature_check || 'Raised by')}>
                            <AddressChip address={item.author} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={copyTitle} />
                        </FactTile>
                    )}
                </FactGrid>

                {/* ── Voting window ── */}
                {item?.start && item.deadline && (
                    <div>
                        <SectionLabel>{gv.period || 'Voting period'}</SectionLabel>
                        <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] p-3 @md:p-4 space-y-3">
                            <div className="flex flex-col @md:flex-row @md:items-end justify-between gap-2 text-xs">
                                <span className="flex flex-col">
                                    <span className="text-[9px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">{gv.starts || 'Opens'}</span>
                                    <span className="font-semibold text-[var(--color-text-main)]">{formatDate(item.start, locale, timezone)}</span>
                                </span>
                                <span className="flex flex-col @md:items-end">
                                    <span className="text-[9px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">{gv.ends || 'Closes'}</span>
                                    <span className="font-semibold text-[var(--color-text-main)]">{formatDate(item.deadline, locale, timezone)}</span>
                                </span>
                            </div>
                            <div
                                className="h-2 rounded-full bg-[var(--color-card-border)] overflow-hidden"
                                role="progressbar"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={Math.round((progress ?? 0) * 100)}
                            >
                                <div
                                    className={`h-full rounded-full ${phase === 'closed' ? 'bg-[var(--color-text-muted)]' : 'bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)]'}`}
                                    style={{ width: `${(progress ?? 0) * 100}%` }}
                                />
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                {phaseText && (
                                    <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                                        <CalendarClock className="size-3.5 text-[var(--color-primary)]" />{phaseText}
                                    </p>
                                )}
                                {item.elevatedProposalId && (
                                    <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                                        <ArrowUpRight className="size-3.5" />
                                        {fill(gv.elevated || 'Moved on to formal proposal #{id}', { id: item.elevatedProposalId })}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Where to read more ── */}
                {item && item.links.length > 0 && (
                    <div>
                        <SectionLabel>{gv.links || 'Learn more'}</SectionLabel>
                        <div className="flex flex-wrap gap-2">
                            {item.links.map(link => {
                                let label = link;
                                try { const u = new URL(link); label = u.hostname.replace(/^www\./, '') + (u.pathname.length > 1 ? u.pathname : ''); } catch { /* keep raw */ }
                                return (
                                    <a
                                        key={link}
                                        href={link}
                                        target="_blank"
                                        rel="noopener noreferrer nofollow"
                                        className="max-w-full flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-card-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/40 transition-colors"
                                        title={link}
                                    >
                                        <ExternalLink className="size-3 shrink-0" />
                                        <span className="truncate">{label}</span>
                                    </a>
                                );
                            })}
                        </div>
                    </div>
                )}
            </SummaryBody>
        </SummaryCard>
    );
}
