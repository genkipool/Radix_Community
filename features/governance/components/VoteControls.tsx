'use client';

import React from 'react';
import Link from 'next/link';
import { Wallet, CheckCircle2, Loader2, ExternalLink, AlertTriangle, Info, Lock, Clock } from 'lucide-react';
import type { GovernanceItem } from '../lib/governanceVotes';
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
 * Everything around the ballot: why voting is not possible (closed, not
 * started, no wallet, wrong network), the account to vote with and its
 * current vote. Renders nothing a reader cannot act on.
 */
export function VoteAccess({ vote, item, g, language, now }: { vote: CastVote; item: GovernanceItem; g: G; language: string; now: number }) {
    if (vote.phase === 'closed') return <Notice icon={Lock}>{g.vote_closed || 'Voting is closed.'}</Notice>;
    if (vote.phase === 'upcoming' && item.start) {
        return (
            <Notice icon={Clock}>
                <span suppressHydrationWarning>{fill(g.vote_upcoming || 'Voting opens {time}.', { time: formatRelative(item.start, language, now) })}</span>
            </Notice>
        );
    }
    if (vote.phase !== 'open') return null;

    if (!vote.isConnected) {
        return (
            <div className="rounded-xl border border-dashed border-[var(--color-primary)]/40 bg-[var(--color-primary)]/5 p-4 text-center space-y-3">
                <p className="text-sm font-bold text-[var(--color-text-main)]">{g.connect_title || 'Connect your wallet to vote'}</p>
                <p className="text-[13px] text-[var(--color-text-muted)]">{g.connect_subtitle}</p>
                <button
                    type="button"
                    disabled={vote.isLoading}
                    onClick={vote.connect}
                    className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                    {vote.isLoading ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
                    {g.connect_mainnet || 'Connect wallet'}
                </button>
            </div>
        );
    }
    if (!vote.onNetwork) {
        return (
            <Notice icon={AlertTriangle} tone="warn">
                <p>{g.wrong_network}</p>
                <button type="button" onClick={vote.connect} className="mt-2 font-bold underline underline-offset-2">{g.switch_network || 'Switch to Mainnet'}</button>
            </Notice>
        );
    }
    if (!vote.account) return <Notice icon={AlertTriangle} tone="warn">{g.wallet_accounts_empty}</Notice>;

    return (
        <div className="space-y-3">
            <AccountPicker accounts={vote.accounts} value={vote.account} onChange={vote.selectAccount} label={g.account_label || 'Account you vote with'} />
            {vote.currentLoading ? (
                <div className="h-11 rounded-xl bg-[var(--color-surface)] animate-pulse" aria-hidden />
            ) : vote.currentText ? (
                <Notice icon={CheckCircle2} tone="ok">{fill(g.current_vote || 'This account already voted: {choice}.', { choice: vote.currentText })}</Notice>
            ) : (
                <Notice icon={Info}>{g.no_vote_yet || 'This account has not voted here yet.'}</Notice>
            )}
        </div>
    );
}

/** Send button, and what happened once sent (transaction link or error). */
export function VoteSubmit({ vote, item, g, language }: { vote: CastVote; item: GovernanceItem; g: G; language: string }) {
    const { tx } = vote;
    const errorText = tx.error
        ? (/reject|cancel/i.test(tx.error) ? (g.error_rejected || 'You cancelled the signature in the wallet.') : fill(g.error_generic || 'The vote could not be recorded ({code}).', { code: tx.error }))
        : null;

    return (
        <div className="space-y-3">
            {vote.canVote && (
                <button
                    type="button"
                    onClick={vote.submit}
                    disabled={vote.picked.length === 0 || tx.isSending}
                    className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                    {tx.isSending && <Loader2 className="size-4 animate-spin" />}
                    {tx.isSending ? (g.sending || 'Confirm the vote in your wallet…') : vote.current ? (g.submit_change || 'Change my vote') : (g.submit || 'Vote')}
                </button>
            )}
            {tx.result && (
                <Notice icon={CheckCircle2} tone="ok">
                    <p className="font-bold">{g.success || 'Vote recorded on the ledger!'}</p>
                    <Link href={`/${language}/dashboard/tx/${tx.result.transactionIntentHash}`} className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs text-[var(--color-primary)] hover:underline break-all">
                        <ExternalLink className="size-3.5 shrink-0" />
                        {g.view_tx || 'View the transaction'}: {shortenAddress(tx.result.transactionIntentHash)}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">{g.tally_delay}</p>
                </Notice>
            )}
            {errorText && <Notice icon={AlertTriangle} tone="error">{errorText}</Notice>}
            {item.start && vote.phase !== 'closed' && (
                <p className="flex gap-1.5 text-[11px] leading-snug text-[var(--color-text-muted)]">
                    <Info className="size-3 shrink-0 mt-0.5" />
                    <span suppressHydrationWarning>{fill(g.snapshot_note || 'Your voting power is taken from the balances held when voting opened ({date}).', { date: formatDate(item.start, language) })}</span>
                </p>
            )}
        </div>
    );
}
