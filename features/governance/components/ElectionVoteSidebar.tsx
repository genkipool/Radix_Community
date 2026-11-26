'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import {
    AlertTriangle,
    CheckCircle2,
    ExternalLink,
    Info,
    Loader2,
    Wallet,
} from 'lucide-react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { useConsoleTransaction } from '@/features/console/hooks/useConsoleTransaction';
import type { GovernanceSystem } from '../config/systems';
import type { GovernanceEntry, MajorityJudgmentElectionData, VoterRow } from '../types';
import { votingPhase } from '../lib/governanceVotes';
import { buildElectionVoteManifest } from '../lib/voteManifest';
import { fill, formatDate } from '../lib/format';
import { shortenAddress } from '@/features/dashboard/explorador/components/SummaryCardKit';
import { CollapsibleCard } from './CollapsibleCard';
import { AccountPicker } from './AccountPicker';
import { AccountVoteStatusList, Notice, WalletVoteGate } from './VoteControls';
import type { G } from './GovernanceBadges';

/**
 * Right-column voting sidebar for Majority Judgment elections.
 * Allows selecting one or more Radix Wallet accounts, shows per-account vote
 * status, tracks grading progress, and submits the ballot on-chain.
 */
export function ElectionVoteSidebar({
    entry,
    system,
    electionData,
    voters,
    votersLoading = false,
    grades,
    g,
    language,
    now,
}: {
    entry: GovernanceEntry;
    system: GovernanceSystem;
    electionData: MajorityJudgmentElectionData | null;
    voters?: VoterRow[] | null;
    votersLoading?: boolean;
    grades: Record<number, number>;
    g: G;
    language: string;
    now: number;
}) {
    const queryClient = useQueryClient();
    const wallet = useRadixWallet();
    const tx = useConsoleTransaction();
    const [chosen, setChosen] = useState<string[] | null>(null);

    const { item, id } = entry;
    const candidates = item.election?.candidates ?? [];
    const total = candidates.length;
    const graded = candidates.filter(c => grades[c.id] !== undefined).length;
    const allGraded = total > 0 && graded === total;

    const phase = votingPhase(item, now);
    const available = wallet.accounts.map(a => a.address);
    const selectedAccounts = (chosen ?? available.slice(0, 1)).filter(a => available.includes(a));
    const onNetwork = wallet.activeNetwork === system.network;
    const canVote = phase === 'open' && wallet.isConnected && onNetwork && available.length > 0;
    const mj = g.mj;

    const votedSet = new Set((voters ?? []).map(v => v.account));
    const currentStatus = selectedAccounts.map(account => ({
        account,
        voted: votedSet.has(account),
    }));
    const anyVoted = currentStatus.some(c => c.voted);
    const labelOf = (address: string) => wallet.accounts.find(a => a.address === address)?.label || shortenAddress(address);

    const setAccounts = (next: string[]) => {
        if (tx.isSending) return;
        setChosen(next);
        tx.reset();
    };
    const toggleAccount = (address: string) =>
        setAccounts(selectedAccounts.includes(address) ? selectedAccounts.filter(a => a !== address) : [...selectedAccounts, address]);

    const submit = async () => {
        if (!allGraded || selectedAccounts.length === 0) return;
        const manifest = buildElectionVoteManifest({
            component: system.component,
            electionId: id,
            round: electionData?.round ?? item.election?.round ?? 'RoundOne',
            accounts: selectedAccounts,
            grades: candidates.map(c => ({ candidateId: c.id, grade: grades[c.id] })),
        });
        const result = await tx.sendTransaction(manifest);
        if (result) {
            await queryClient.invalidateQueries({ queryKey: ['governance-tally', system.component, 'election', id] });
        }
    };

    return (
        <CollapsibleCard
            id="vote-panel-title"
            icon={Wallet}
            title={g.vote_title ?? ''}
            headerClassName="bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-secondary)]/10"
        >
            <div className="space-y-4">
                <WalletVoteGate
                    phase={phase}
                    start={item.start}
                    isConnected={wallet.isConnected}
                    isLoading={wallet.isLoading}
                    onNetwork={onNetwork}
                    hasAccounts={available.length > 0}
                    onConnect={() => wallet.connect(RadixNetworkId.Mainnet)}
                    g={g}
                    language={language}
                    now={now}
                />

                {canVote && (
                    <>
                        <AccountPicker
                            accounts={wallet.accounts}
                            selected={selectedAccounts}
                            onToggle={toggleAccount}
                            onSetAll={setAccounts}
                            label={wallet.accounts.length > 1 ? (g.accounts_label ?? '') : (g.account_label ?? '')}
                            labels={{
                                all: g.accounts_all ?? '',
                                count: g.accounts_count ?? '',
                                none: g.accounts_none ?? '',
                            }}
                        />

                        <AccountVoteStatusList
                            loading={votersLoading}
                            g={g}
                            items={currentStatus.map(c => ({
                                account: c.account,
                                label: labelOf(c.account),
                                voted: c.voted,
                                singleMessage: c.voted ? (mj?.already_voted ?? '') : undefined,
                                statusText: c.voted ? (mj?.voted_badge ?? '') : (g.not_voted ?? ''),
                            }))}
                        />

                        <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] p-3 space-y-2">
                            <div className="flex items-center justify-between text-xs font-semibold">
                                <span className="text-[var(--color-text-main)]">
                                    {fill(mj?.ballot_progress ?? '', { graded: String(graded), total: String(total) })}
                                </span>
                                <span className="font-mono text-[var(--color-primary)] tabular-nums">
                                    {total > 0 ? `${Math.round((graded / total) * 100)}%` : '0%'}
                                </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[var(--color-card-border)] overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all ${allGraded ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-primary)]'}`}
                                    style={{ width: `${total > 0 ? (graded / total) * 100 : 0}%` }}
                                />
                            </div>
                            <p className="text-[11px] text-[var(--color-text-muted)] leading-snug">
                                {fill(allGraded ? (mj?.ballot_ready ?? '') : (mj?.ballot_incomplete ?? ''), { total: String(total) })}
                            </p>
                        </div>

                        <button
                            type="button"
                            disabled={!allGraded || selectedAccounts.length === 0 || tx.isSending}
                            onClick={() => void submit()}
                            className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer"
                        >
                            {tx.isSending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                            <span>
                                {tx.isSending
                                    ? (g.sending ?? '')
                                    : selectedAccounts.length > 1
                                        ? fill(g.submit_many ?? '', { n: String(selectedAccounts.length) })
                                        : anyVoted
                                            ? (g.submit_change ?? '')
                                            : (mj?.submit_ballot ?? '')}
                            </span>
                        </button>
                        {item.start && g.snapshot_note && (
                            <p className="flex gap-1.5 text-[11px] leading-snug text-[var(--color-text-muted)]">
                                <Info className="size-3 shrink-0 mt-0.5" />
                                <span suppressHydrationWarning>
                                    {fill(g.snapshot_note, { date: formatDate(item.start, language) })}
                                </span>
                            </p>
                        )}
                    </>
                )}

                {tx.error && (
                    <Notice icon={AlertTriangle} tone="error">
                        {/reject|cancel/i.test(tx.error)
                            ? (g.error_rejected ?? '')
                            : fill(g.error_generic ?? '', { code: tx.error })}
                    </Notice>
                )}
                {tx.result && (
                    <Notice icon={CheckCircle2} tone="ok">
                        <p className="font-bold">{g.success ?? ''}</p>
                        <Link
                            href={`/${language}/dashboard/tx/${tx.result.transactionIntentHash}`}
                            title={tx.result.transactionIntentHash}
                            className="mt-1 flex items-center gap-1.5 min-w-0 max-w-full font-mono text-xs text-[var(--color-primary)] hover:underline whitespace-nowrap"
                        >
                            <span className="truncate">{shortenAddress(tx.result.transactionIntentHash)}</span>
                            <ExternalLink className="size-3.5 shrink-0" />
                        </Link>
                        {g.tally_delay && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{g.tally_delay}</p>}
                    </Notice>
                )}
            </div>
        </CollapsibleCard>
    );
}
