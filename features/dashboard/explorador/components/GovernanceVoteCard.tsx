'use client';

import React from 'react';
import Link from 'next/link';
import { Vote, UserRound, Users, Target, PenLine, AlertCircle, RefreshCw, Info, ArrowRight, Scale, ExternalLink } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { systemByComponent } from '@/features/governance/config/systems';
import { governanceItemPath } from '@/features/governance/lib/paths';
import type { Network, TranslationsT } from '@/features/dashboard/types';
import type { VoteHistoryEntry, VoterRow } from '@/features/governance/types';
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
import { ElectionCandidatesKpiGrid } from '@/features/governance/components/ElectionSection';
import { MJ_GRADE_DOT_COLOR, MJ_GRADE_ORDER, MJ_GRADE_PILL_COLOR } from '@/features/governance/lib/majorityJudgment';

type Tt = Partial<TranslationsT['dashboard']['transactions']>;

interface GovernanceVoteCardProps {
    vote: GovernanceVote;
    /** All votes on this same governance item inside the transaction (defaults to `[vote]`). */
    votes?: GovernanceVote[];
    tt?: Tt;
    onCopy: (addr: string) => void;
    copiedAddress: string | null;
    network: Network;
    locale?: string;
    timezone?: string;
}

function gradesSignature(grades: Record<string, number> | undefined): string {
    if (!grades) return '';
    return Object.entries(grades).sort(([a], [b]) => Number(a) - Number(b)).map(([k, v]) => `${k}:${v}`).join(',');
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
export function GovernanceVoteCard({ vote, votes, tt, onCopy, copiedAddress, network, locale, timezone }: GovernanceVoteCardProps) {
    const { t, language } = useLanguage();
    const g = t.governance ?? {};
    const gv: Gv = g.vote ?? {};
    const mj = g.mj;
    const group = votes && votes.length > 0 ? votes : [vote];
    const isMultiAccount = group.length > 1;
    const isElection = vote.kind === 'election';
    const anyReplacing = group.some(v => v.replacingVoteId != null);
    const system = systemByComponent(vote.component);
    const itemQuery = useGovernanceItem(vote, network);
    const tallyQuery = useGovernanceTally(
        {
            component: vote.component,
            kind: vote.kind,
            itemId: vote.itemId,
            account: isMultiAccount ? undefined : vote.account,
            voters: isMultiAccount || isElection || anyReplacing,
        },
        network,
    );
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
    const kindShort = isProposal
        ? (gv.short_proposal || 'Proposal')
        : isElection
            ? (gv.short_election ?? '')
            : (gv.short_temperature_check || 'Temperature check');

    // Per-account voting power & history (supports both single-account tally and multi-account voters list).
    const powerByAccount = new Map<string, number>();
    const voterByAccount = new Map<string, VoterRow>();
    for (const row of tallyQuery.data?.voters ?? []) {
        voterByAccount.set(row.account, row);
        if (row.votePower !== null && Number.isFinite(Number(row.votePower))) {
            powerByAccount.set(row.account, Number(row.votePower));
        }
    }
    const replacedEntryOf = (v: GovernanceVote): VoteHistoryEntry | null => {
        if (!v.account || !v.replacingVoteId) return null;
        const history = voterByAccount.get(v.account)?.history;
        if (!history || history.length < 2) return null;
        const targetId = Number(v.replacingVoteId);
        const exact = history.find(h => h.voteId === targetId);
        if (exact) return exact;
        const idx = v.voteId != null ? history.findIndex(h => h.voteId === Number(v.voteId)) : -1;
        return idx > 0 ? history[idx - 1] : history[0];
    };
    const primaryReplaced = replacedEntryOf(vote);
    const primaryReplacedChoiceText = primaryReplaced && !isElection
        ? primaryReplaced.choices.map(k => choices.find(c => c.key === k)?.label ?? stanceLabel(k)).join(', ')
        : null;
    const accountPowerOf = (account: string | null): number | null => {
        if (!account) return null;
        if (powerByAccount.has(account)) return powerByAccount.get(account)!;
        if (!isMultiAccount && tally?.accountPower != null) return tally.accountPower;
        return null;
    };
    const knownPowers = group.map(v => accountPowerOf(v.account)).filter((p): p is number => p !== null);
    const combinedPower = knownPowers.length > 0 ? knownPowers.reduce((s, p) => s + p, 0) : null;
    const combinedShare = combinedPower != null && tally && tally.turnout > 0 ? combinedPower / tally.turnout : null;

    const exactAccountPower = combinedPower != null
        ? new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(combinedPower)
        : null;
    const accountShareText = combinedShare != null
        ? fill(gv.voting_power_share ?? '', { share: formatShare(combinedShare, locale) })
        : null;
    const voterPowerHint = combinedPower != null
        ? fill(gv.voter_power || 'Voting power: {amount} XRD ({share} of the total)', {
            amount: formatXrd(combinedPower, locale),
            share: formatShare(combinedShare ?? 0, locale),
        })
        : null;

    // Election ballot breakdown: resolve candidate names & grade counts.
    const candidateNameById = new Map<string, string>();
    for (const c of item?.election?.candidates ?? []) candidateNameById.set(String(c.id), c.displayName);
    for (const o of item?.options ?? []) if (!candidateNameById.has(String(o.id))) candidateNameById.set(String(o.id), o.label);

    const primaryGrades = vote.grades ?? {};
    const gradedCount = Object.keys(primaryGrades).length;
    const gradeCounts = MJ_GRADE_ORDER.map(gIdx => ({
        gIdx,
        count: Object.values(primaryGrades).filter(v => v === gIdx).length,
    })).filter(x => x.count > 0);
    const allSameGrades = isElection && group.every(v => gradesSignature(v.grades) === gradesSignature(primaryGrades));
    const ballotsToRender = isElection ? (allSameGrades ? [vote] : group) : [];

    const replacingSuffix = vote.replacingVoteId
        ? fill(gv.summary_replacing || ' This vote replaces its previous vote (no. {id}).', { id: vote.replacingVoteId })
        : '';
    const summary = (isElection
        ? fill(
            isMultiAccount ? (gv.summary_election_multi ?? '') : (gv.summary_election ?? ''),
            {
                account: vote.account ? shortenAddress(vote.account) : '—',
                accounts: group.length.toLocaleString(locale),
                count: gradedCount.toLocaleString(locale),
                title,
            },
        )
        : fill(
            (isProposal ? gv.summary_proposal : gv.summary_temperature_check) || 'The account {account} voted "{choice}" on "{title}".',
            { account: vote.account ? shortenAddress(vote.account) : '—', choice: choiceText, title },
        )) + replacingSuffix;

    return (
        <SummaryCard
            icon={Vote}
            title={gv.title || 'Governance vote'}
            aside={
                <>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                        {isProposal
                            ? (gv.kind_proposal || 'Formal proposal')
                            : isElection
                                ? (gv.kind_election ?? '')
                                : (gv.kind_temperature_check || 'Temperature check')}
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
                    <div className={`shrink-0 rounded-2xl border p-4 flex items-center gap-3 @xl:min-w-[220px] ${TONE[tone].soft}`}>
                        <span className={`grid place-items-center size-11 rounded-xl bg-[var(--color-card-bg)] border border-current/20 ${TONE[tone].text}`}>
                            <ToneIcon className="size-5" />
                        </span>
                        <span className="min-w-0 flex flex-col">
                            <span className="text-[9px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">{gv.your_vote || 'Vote cast'}</span>
                            {isElection ? (
                                <>
                                    <span className="text-lg font-black leading-tight text-[var(--color-primary)]">
                                        {fill(gv.election_candidates_graded ?? '', { n: gradedCount.toLocaleString(locale) })}
                                    </span>
                                    {gradeCounts.length > 0 && (
                                        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-mono font-bold text-[var(--color-text-secondary)]">
                                            {gradeCounts.map(({ gIdx, count }) => (
                                                <span key={gIdx} className="inline-flex items-center gap-1" title={mj?.grades?.[gIdx]}>
                                                    <span className={`size-1.5 rounded-full ${MJ_GRADE_DOT_COLOR[gIdx]}`} aria-hidden="true" />
                                                    <span>{count}{mj?.grade_abbrs?.[gIdx] ? ` ${mj.grade_abbrs[gIdx]}` : ''}</span>
                                                </span>
                                            ))}
                                        </span>
                                    )}
                                </>
                            ) : primaryReplacedChoiceText ? (
                                <span className="inline-flex flex-wrap items-center gap-1.5 leading-tight">
                                    <span className="text-sm font-bold text-[var(--color-text-muted)] break-words">
                                        {primaryReplacedChoiceText}
                                    </span>
                                    <ArrowRight className="size-3.5 shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
                                    <span className={`text-xl font-black break-words ${TONE[tone].text}`}>{choiceText}</span>
                                </span>
                            ) : (
                                <span className={`text-xl font-black leading-tight break-words ${TONE[tone].text}`}>{choiceText}</span>
                            )}
                            {vote.replacingVoteId && (
                                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-[var(--color-text-muted)]">
                                    <span className="inline-flex items-center gap-1">
                                        <RefreshCw className="size-3" />{gv.changed_vote || 'Vote changed'}
                                    </span>
                                    {primaryReplaced?.txid && (
                                        <Link
                                            href={`/${language}/dashboard/tx/${primaryReplaced.txid}`}
                                            prefetch={false}
                                            className="inline-flex items-center gap-0.5 font-mono text-[var(--color-primary)] hover:underline"
                                            title={primaryReplaced.txid}
                                        >
                                            <span>{shortenAddress(primaryReplaced.txid)}</span>
                                            <ExternalLink className="size-2.5 shrink-0" aria-hidden="true" />
                                        </Link>
                                    )}
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

                {/* ── Voter Account(s) & Voting Power highlight strip ── */}
                {group.some(v => v.account) && (
                    <div className="mt-4 pt-3.5 border-t border-[var(--color-card-border)]/60 grid grid-cols-1 @md:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)]/85 px-3.5 py-2.5 flex flex-col justify-center gap-2 min-w-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <span className="grid place-items-center size-8 rounded-lg bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] shrink-0">
                                    {isMultiAccount ? <Users className="size-4" /> : <UserRound className="size-4" />}
                                </span>
                                <span className="text-[9px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">
                                    {isMultiAccount
                                        ? fill(gv.voters_in_tx ?? '', { n: group.length.toLocaleString(locale) })
                                        : gv.voter}
                                </span>
                            </div>
                            <ul className="space-y-1.5">
                                {group.map((v, idx) => {
                                    const p = accountPowerOf(v.account);
                                    return (
                                        <li key={`${v.account ?? 'anon'}-${v.voteId ?? idx}`} className="flex items-center justify-between gap-2 min-w-0">
                                            {v.account ? (
                                                <AddressChip address={v.account} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={copyTitle} />
                                            ) : <span className="text-xs text-[var(--color-text-muted)]">—</span>}
                                            <span className="flex items-center gap-1.5 shrink-0">
                                                {isMultiAccount && p != null && (
                                                    <span className="font-mono text-[10px] font-bold text-[var(--color-primary)] tabular-nums">
                                                        {formatXrd(p, locale)} XRD
                                                    </span>
                                                )}
                                                {v.voteId && (
                                                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border border-[var(--color-card-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]">
                                                        {fill(gv.vote_number ?? '', { id: v.voteId })}
                                                    </span>
                                                )}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>

                        <div className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-card-bg)]/85 px-3.5 py-2.5 flex items-center justify-between gap-3 min-w-0">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <span className="grid place-items-center size-9 rounded-lg bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/25 text-[var(--color-primary)] shrink-0">
                                    <Scale className="size-4" />
                                </span>
                                <div className="min-w-0 flex flex-col">
                                    <span className="text-[9px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">
                                        {isMultiAccount ? (gv.combined_voting_power ?? gv.voting_power) : gv.voting_power}
                                    </span>
                                    {combinedPower != null ? (
                                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
                                            <span className="text-base @md:text-lg font-black font-mono text-[var(--color-primary)] leading-tight tabular-nums">
                                                {formatXrd(combinedPower, locale)} XRD
                                            </span>
                                            {combinedPower >= 1000 && exactAccountPower && (
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

                {/* ── Election ballot cast (per-candidate grades) ── */}
                {isElection && ballotsToRender.length > 0 && gradedCount > 0 && (
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="text-[11px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">
                                {gv.election_ballot_cast ?? ''}
                            </h4>
                            {isMultiAccount && allSameGrades && (
                                <span className="text-[11px] text-[var(--color-text-muted)]">
                                    {fill(gv.election_ballot_shared_note ?? '', { n: group.length.toLocaleString(locale) })}
                                </span>
                            )}
                        </div>
                        {ballotsToRender.map((b, bIdx) => {
                            const prevBallot = replacedEntryOf(b);
                            const entries = Object.entries(b.grades ?? {}).sort(([idA, gA], [idB, gB]) => gB - gA || Number(idA) - Number(idB));
                            return (
                                <div key={`${b.account ?? bIdx}-${b.voteId ?? bIdx}`} className="space-y-2">
                                    {!allSameGrades && b.account && (
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <AddressChip address={b.account} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={copyTitle} />
                                            {prevBallot?.txid && (
                                                <Link
                                                    href={`/${language}/dashboard/tx/${prevBallot.txid}`}
                                                    prefetch={false}
                                                    className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-[var(--color-primary)] hover:underline"
                                                    title={prevBallot.txid}
                                                >
                                                    <RefreshCw className="size-2.5 shrink-0" aria-hidden="true" />
                                                    <span>{shortenAddress(prevBallot.txid)}</span>
                                                    <ExternalLink className="size-2.5 shrink-0" aria-hidden="true" />
                                                </Link>
                                            )}
                                        </div>
                                    )}
                                    <div className="grid grid-cols-1 @sm:grid-cols-2 @xl:grid-cols-3 gap-2">
                                        {entries.map(([candId, gradeIdx]) => {
                                            const candName = candidateNameById.get(candId) ?? `#${candId}`;
                                            const gradeLabel = mj?.grades?.[gradeIdx] ?? String(gradeIdx);
                                            const prevGradeIdx = prevBallot?.grades?.[candId];
                                            const prevGradeLabel = prevGradeIdx !== undefined ? (mj?.grades?.[prevGradeIdx] ?? String(prevGradeIdx)) : null;
                                            const gradeChanged = prevGradeIdx !== undefined && prevGradeIdx !== gradeIdx;
                                            return (
                                                <div
                                                    key={candId}
                                                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
                                                        gradeChanged
                                                            ? 'border-amber-500/40 bg-amber-500/5'
                                                            : 'border-[var(--color-card-border)] bg-[var(--color-surface)]/60'
                                                    }`}
                                                >
                                                    <span className="font-semibold text-[var(--color-text-main)] truncate" title={candName}>
                                                        {candName}
                                                    </span>
                                                    {gradeChanged && prevGradeLabel ? (
                                                        <span className="shrink-0 inline-flex items-center gap-1">
                                                            <span className={`inline-flex items-center justify-center h-5 rounded-full border px-2 text-[10px] font-bold leading-none opacity-80 ${MJ_GRADE_PILL_COLOR[prevGradeIdx] ?? ''}`}>
                                                                <span className="text-box-cap leading-none">{prevGradeLabel}</span>
                                                            </span>
                                                            <ArrowRight className="size-3 shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
                                                            <span className={`inline-flex items-center justify-center h-5 rounded-full border px-2 text-[10px] font-bold leading-none ${MJ_GRADE_PILL_COLOR[gradeIdx] ?? ''}`}>
                                                                <span className="text-box-cap leading-none">{gradeLabel}</span>
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        <span className={`shrink-0 inline-flex items-center justify-center h-5 rounded-full border px-2 text-[10px] font-bold leading-none ${MJ_GRADE_PILL_COLOR[gradeIdx] ?? ''}`}>
                                                            <span className="text-box-cap leading-none">{gradeLabel}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── How it ended (or is going) ── */}
                {tally?.outcome && !isElection && (
                    <OutcomeBanner outcome={tally.outcome} tally={tally} item={item} final={phase === 'closed'} gv={gv} locale={locale} />
                )}
                {tallyQuery.isLoading && network === 'mainnet' && (
                    <div className="h-20 rounded-xl bg-[var(--color-surface)] animate-pulse" aria-hidden />
                )}

                {isElection && item?.election && tallyQuery.data?.electionData ? (
                    <ElectionCandidatesKpiGrid
                        election={item.election}
                        electionData={tallyQuery.data.electionData}
                        g={g}
                        language={language}
                    />
                ) : !isElection ? (
                    <BallotResults choices={choices} tally={tally} gv={gv} locale={locale} />
                ) : null}
                {tally && <TurnoutMeter tally={tally} item={item} gv={gv} locale={locale} />}

                {/* ── Key facts ── */}
                <div className="space-y-3">
                    {!isElection && !isMultiAccount && vote.account && (
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
                                hint={combinedPower != null
                                    ? [
                                        combinedPower >= 1000 && exactAccountPower ? `${exactAccountPower} XRD` : null,
                                        accountShareText,
                                    ].filter(Boolean).join(' · ') || undefined
                                    : undefined}
                            >
                                {combinedPower != null ? (
                                    <span className="text-xl font-black font-mono text-[var(--color-primary)] tabular-nums">
                                        {formatXrd(combinedPower, locale)} XRD
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
                            {isElection && item?.election
                                ? fill(gv.election_rules_value ?? '', {
                                    seats: String(item.election.seatCount ?? 0),
                                    grade: mj?.grades?.[item.election.minimumMedianGrade ?? 2] ?? '',
                                    quantile: tallyQuery.data?.electionData?.gradeQuantileApplied ?? '3/5',
                                })
                                : item?.approvalThreshold != null
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
