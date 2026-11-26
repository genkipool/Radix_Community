'use client';

import React from 'react';
import Link from 'next/link';
import { Wallet, CheckCircle2, Loader2, ExternalLink, AlertTriangle, Info, Lock, Clock } from 'lucide-react';
import type { GovernanceItem, VotingPhase } from '../lib/governanceVotes';
import type { CastVote } from '../hooks/useCastVote';
import { fill, formatDate, formatRelative } from '../lib/format';
import { shortenAddress } from '@/features/dashboard/explorador/components/SummaryCardKit';
import { AccountPicker } from './AccountPicker';
import type { G } from './GovernanceBadges';

export function Notice({ icon: Icon, tone = 'muted', children }: { icon: typeof Info; tone?: 'muted' | 'warn' | 'ok' | 'error'; children: React.ReactNode }) {
    const style = {
        muted: 'border-[var(--color-card-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]',
        warn: 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        ok: 'border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 text-[var(--color-text-main)]',
        error: 'border-red-500/35 bg-red-500/10 text-red-600 dark:text-red-400',
    }[tone];
    return (
        <div className={`flex gap-2.5 rounded-xl border p-3 text-[13px] leading-relaxed ${style}`}>
            <Icon className="size-4 shrink-0 mt-0.5" />
            <div className="min-w-0">{children}</div>
        </div>
    );
}

/**
 * Renders pre-vote access notices (closed, upcoming, disconnected wallet,
 * wrong network, empty wallet). Returns `null` when the user can vote.
 */
export function WalletVoteGate({
    phase,
    start,
    isConnected,
    isLoading,
    onNetwork,
    hasAccounts,
    onConnect,
    g,
    language,
    now,
    compact = false,
}: {
    phase: VotingPhase;
    start: number | null;
    isConnected: boolean;
    isLoading: boolean;
    onNetwork: boolean;
    hasAccounts: boolean;
    onConnect: () => void;
    g: G;
    language: string;
    now: number;
    compact?: boolean;
}) {
    if (phase === 'closed') return <Notice icon={Lock}>{g.vote_closed ?? ''}</Notice>;
    if (phase === 'upcoming' && start) {
        return (
            <Notice icon={Clock}>
                <span suppressHydrationWarning>{fill(g.vote_upcoming ?? '', { time: formatRelative(start, language, now) })}</span>
            </Notice>
        );
    }
    if (phase !== 'open') return null;

    const connectButton = (
        <button
            type="button"
            disabled={isLoading}
            onClick={onConnect}
            className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
        >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
            {g.connect_to_vote ?? ''}
        </button>
    );
    if (!isConnected && compact) return connectButton;
    if (!isConnected) {
        return (
            <div className="rounded-xl border border-dashed border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 p-4 text-center space-y-3">
                <p className="text-sm font-bold text-[var(--color-text-main)]">{g.connect_title ?? ''}</p>
                <p className="text-[13px] text-[var(--color-text-muted)]">{g.connect_subtitle}</p>
                {connectButton}
            </div>
        );
    }
    if (!onNetwork) {
        return (
            <Notice icon={AlertTriangle} tone="warn">
                <p>{g.wrong_network}</p>
                <button type="button" onClick={onConnect} className="mt-2 font-bold underline underline-offset-2">{g.switch_network ?? ''}</button>
            </Notice>
        );
    }
    if (!hasAccounts) return <Notice icon={AlertTriangle} tone="warn">{g.wallet_accounts_empty}</Notice>;
    return null;
}

/**
 * Shows the current vote status of each selected account (single notice for 1
 * account, compact status card for multiple accounts).
 */
export function AccountVoteStatusList({
    loading,
    items,
    g,
}: {
    loading: boolean;
    items: Array<{ account: string; label: string; voted: boolean; singleMessage?: string; statusText: string }>;
    g: G;
}) {
    if (loading) return <div className="h-11 rounded-xl bg-[var(--color-surface)] animate-pulse" aria-hidden />;
    if (items.length === 1) {
        const only = items[0];
        return only.voted
            ? <Notice icon={CheckCircle2} tone="ok">{only.singleMessage ?? only.statusText}</Notice>
            : <Notice icon={Info}>{g.no_vote_yet ?? ''}</Notice>;
    }
    if (items.length > 1) {
        return (
            <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] p-3 space-y-2">
                <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">{g.current_votes_title ?? ''}</p>
                <ul className="space-y-1.5">
                    {items.map(c => (
                        <li key={c.account} className="flex items-center justify-between gap-3 text-xs">
                            <span className="truncate font-semibold text-[var(--color-text-main)]" title={c.account}>{c.label}</span>
                            <span className={`shrink-0 font-semibold ${c.voted ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}>{c.statusText}</span>
                        </li>
                    ))}
                </ul>
                {g.multi_account_hint && <p className="text-[11px] leading-snug text-[var(--color-text-muted)]">{g.multi_account_hint}</p>}
            </div>
        );
    }
    return null;
}

/**
 * Everything around the ballot: why voting is not possible (closed, not
 * started, no wallet, wrong network), the account to vote with and its
 * current vote. Renders nothing a reader cannot act on.
 */
export function VoteAccess({ vote, item, g, language, now, compact = false }: {
    vote: CastVote;
    item: GovernanceItem;
    g: G;
    language: string;
    now: number;
    /** Only the connect button, no explanatory box (inside the results box). */
    compact?: boolean;
}) {
    const gate = WalletVoteGate({
        phase: vote.phase,
        start: item.start,
        isConnected: vote.isConnected,
        isLoading: vote.isLoading,
        onNetwork: vote.onNetwork,
        hasAccounts: vote.accounts.length > 0,
        onConnect: vote.connect,
        g,
        language,
        now,
        compact,
    });
    if (gate || vote.phase !== 'open') return gate;

    const labelOf = (address: string) => vote.accounts.find(a => a.address === address)?.label || shortenAddress(address);
    return (
        <div className="space-y-3">
            <AccountPicker
                accounts={vote.accounts}
                selected={vote.selectedAccounts}
                onToggle={vote.toggleAccount}
                onSetAll={vote.setAccounts}
                label={vote.accounts.length > 1 ? (g.accounts_label ?? '') : (g.account_label ?? '')}
                labels={{ all: g.accounts_all ?? '', count: g.accounts_count ?? '', none: g.accounts_none ?? '' }}
            />
            <AccountVoteStatusList
                loading={vote.currentLoading}
                g={g}
                items={vote.current.map(c => ({
                    account: c.account,
                    label: labelOf(c.account),
                    voted: Boolean(c.text),
                    singleMessage: c.text ? fill(g.current_vote ?? '', { choice: c.text }) : undefined,
                    statusText: c.text ?? (g.not_voted ?? ''),
                }))}
            />
        </div>
    );
}

/** Send button, and what happened once sent (transaction link or error). */
export function VoteSubmit({ vote, item, g, language }: { vote: CastVote; item: GovernanceItem; g: G; language: string }) {
    const { tx } = vote;
    const errorText = tx.error
        ? (/reject|cancel/i.test(tx.error) ? (g.error_rejected ?? '') : fill(g.error_generic ?? '', { code: tx.error }))
        : null;

    return (
        <div className="space-y-3">
            {vote.canVote && (
                <button
                    type="button"
                    onClick={vote.submit}
                    disabled={vote.picked.length === 0 || vote.selectedAccounts.length === 0 || tx.isSending}
                    className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                    {tx.isSending && <Loader2 className="size-4 animate-spin" />}
                    {tx.isSending
                        ? (g.sending ?? '')
                        : vote.selectedAccounts.length > 1
                            ? fill(g.submit_many ?? '', { n: String(vote.selectedAccounts.length) })
                            : vote.anyVoted ? (g.submit_change ?? '') : (g.submit ?? '')}
                </button>
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
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">{g.tally_delay}</p>
                </Notice>
            )}
            {errorText && <Notice icon={AlertTriangle} tone="error">{errorText}</Notice>}
            {item.start && vote.phase !== 'closed' && (
                <p className="flex gap-1.5 text-[11px] leading-snug text-[var(--color-text-muted)]">
                    <Info className="size-3 shrink-0 mt-0.5" />
                    <span suppressHydrationWarning>{fill(g.snapshot_note ?? '', { date: formatDate(item.start, language) })}</span>
                </p>
            )}
        </div>
    );
}
