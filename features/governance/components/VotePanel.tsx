'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Wallet, CheckCircle2, Circle, Loader2, ExternalLink, AlertTriangle, Info, Lock, Clock, Square, CheckSquare } from 'lucide-react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { useConsoleTransaction } from '@/features/console/hooks/useConsoleTransaction';
import type { GovernanceSystem } from '../config/systems';
import type { GovernanceEntry } from '../types';
import { itemChoices, selectedLabels, votingPhase, type VoteSelection } from '../lib/governanceVotes';
import { buildVoteManifest } from '../lib/voteManifest';
import { useAccountVote, accountVoteKey } from '../hooks/useAccountVote';
import { fill, formatDate, formatRelative, TONE, type Gv } from './VoteParts';
import { shortenAddress } from '@/features/dashboard/explorador/components/SummaryCardKit';
import type { G } from './GovernanceBadges';

function Notice({ icon: Icon, tone = 'muted', children }: { icon: typeof Info; tone?: 'muted' | 'warn' | 'ok' | 'error'; children: React.ReactNode }) {
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
 * Casting a vote: pick the account, the option(s), sign in the Radix Wallet.
 * The account's current vote is read from the ledger, so changing it is as
 * clear as casting it. Once committed, the transaction id links to this
 * site's explorer.
 */
export function VotePanel({ entry, system, g, language, now }: {
    entry: GovernanceEntry;
    system: GovernanceSystem;
    g: G;
    language: string;
    now: number;
}) {
    const { item, kind, id } = entry;
    const gv: Gv = g.vote ?? {};
    const stances = (gv.stances ?? {}) as Record<string, string>;
    const stanceLabel = (s: string) => stances[s] || s;
    const phase = votingPhase(item, now);
    const queryClient = useQueryClient();

    const { isConnected, isLoading, accounts, activeNetwork, connect } = useRadixWallet();
    const [chosenAccount, setChosenAccount] = useState<string | null>(null);
    const account = accounts.some(a => a.address === chosenAccount) ? chosenAccount : accounts[0]?.address ?? null;
    const currentVote = useAccountVote(item.votersStore, kind, account, system.network);
    const [picked, setPicked] = useState<string[]>([]);
    const tx = useConsoleTransaction();

    const choices = itemChoices(kind, item, stanceLabel);
    const maxPick = kind === 'temperature_check' ? 1 : Math.max(1, item.maxSelections);
    const onMainnet = activeNetwork === system.network;
    const current = currentVote.data ?? null;
    const currentText = current
        ? (current.type === 'stance' ? selectedLabels(current, item).map(stanceLabel) : selectedLabels(current, item)).join(', ')
        : null;

    const toggle = (key: string) => {
        tx.reset();
        setPicked(prev => {
            if (maxPick === 1) return [key];
            if (prev.includes(key)) return prev.filter(k => k !== key);
            return prev.length < maxPick ? [...prev, key] : prev;
        });
    };

    const submit = async () => {
        if (!account || picked.length === 0) return;
        const selection: VoteSelection = kind === 'temperature_check'
            ? { type: 'stance', stance: picked[0] }
            : { type: 'options', optionIds: picked.map(Number) };
        const manifest = buildVoteManifest({ component: system.component, kind, itemId: id, account, selection });
        const result = await tx.sendTransaction(manifest);
        if (result) {
            setPicked([]);
            await queryClient.invalidateQueries({ queryKey: accountVoteKey(item.votersStore, account) });
            await queryClient.invalidateQueries({ queryKey: ['governance-tally', system.component, kind, id] });
        }
    };

    const errorText = tx.error
        ? (/reject|cancel/i.test(tx.error) ? (g.error_rejected || 'You cancelled the signature in the wallet.') : fill(g.error_generic || 'The vote could not be recorded ({code}).', { code: tx.error }))
        : null;

    return (
        <section aria-labelledby="vote-panel-title" className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] overflow-hidden">
            <h2 id="vote-panel-title" className="px-5 py-4 flex items-center gap-2 text-sm font-bold text-[var(--color-text-main)] border-b border-[var(--color-card-border)] bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-secondary)]/10">
                <Wallet className="size-4 text-[var(--color-primary)]" />
                {g.vote_title || 'Your vote'}
            </h2>

            <div className="p-5 space-y-4">
                {phase === 'closed' && <Notice icon={Lock}>{g.vote_closed || 'Voting is closed.'}</Notice>}
                {phase === 'upcoming' && item.start && (
                    <Notice icon={Clock}>
                        <span suppressHydrationWarning>{fill(g.vote_upcoming || 'Voting opens {time}.', { time: formatRelative(item.start, language, now) })}</span>
                    </Notice>
                )}

                {phase === 'open' && !isConnected && (
                    <div className="text-center space-y-3 py-2">
                        <p className="text-sm font-bold text-[var(--color-text-main)]">{g.connect_title || 'Connect your wallet to vote'}</p>
                        <p className="text-[13px] text-[var(--color-text-muted)]">{g.connect_subtitle}</p>
                        <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => connect(RadixNetworkId.Mainnet)}
                            className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
                            {g.connect_mainnet || 'Connect wallet'}
                        </button>
                    </div>
                )}

                {phase === 'open' && isConnected && !onMainnet && (
                    <Notice icon={AlertTriangle} tone="warn">
                        <p>{g.wrong_network}</p>
                        <button type="button" onClick={() => connect(RadixNetworkId.Mainnet)} className="mt-2 font-bold underline underline-offset-2">
                            {g.switch_network || 'Switch to Mainnet'}
                        </button>
                    </Notice>
                )}

                {phase === 'open' && isConnected && onMainnet && accounts.length === 0 && (
                    <Notice icon={AlertTriangle} tone="warn">{g.wallet_accounts_empty}</Notice>
                )}

                {phase === 'open' && isConnected && onMainnet && account && (
                    <>
                        <label className="block">
                            <span className="block mb-1.5 text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">{g.account_label || 'Account you vote with'}</span>
                            <select
                                value={account}
                                onChange={e => { setChosenAccount(e.target.value); setPicked([]); tx.reset(); }}
                                className="w-full h-10 px-3 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-primary)]"
                            >
                                {accounts.map(a => (
                                    <option key={a.address} value={a.address}>{a.label ? `${a.label} · ${shortenAddress(a.address)}` : shortenAddress(a.address)}</option>
                                ))}
                            </select>
                        </label>

                        {currentVote.isLoading ? (
                            <div className="h-11 rounded-xl bg-[var(--color-surface)] animate-pulse" aria-hidden />
                        ) : currentText ? (
                            <Notice icon={CheckCircle2} tone="ok">{fill(g.current_vote || 'This account already voted: {choice}.', { choice: currentText })}</Notice>
                        ) : (
                            <Notice icon={Info}>{g.no_vote_yet || 'This account has not voted here yet.'}</Notice>
                        )}

                        <fieldset>
                            <legend className="mb-2 text-[10px] uppercase font-bold tracking-widest text-[var(--color-text-muted)]">
                                {maxPick === 1 ? (g.choose_one || 'Pick one option') : fill(g.choose_up_to || 'Pick up to {n} options', { n: String(maxPick) })}
                            </legend>
                            <div className="space-y-2">
                                {choices.map(c => {
                                    const on = picked.includes(c.key);
                                    const Icon = maxPick === 1 ? (on ? CheckCircle2 : Circle) : (on ? CheckSquare : Square);
                                    return (
                                        <button
                                            key={c.key}
                                            type="button"
                                            role={maxPick === 1 ? 'radio' : 'checkbox'}
                                            aria-checked={on}
                                            onClick={() => toggle(c.key)}
                                            className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${on
                                                ? `${TONE[c.tone].soft} ${TONE[c.tone].text}`
                                                : 'border-[var(--color-card-border)] bg-[var(--color-surface)] text-[var(--color-text-main)] hover:border-[var(--color-primary)]/40'}`}
                                        >
                                            <Icon className="size-5 shrink-0" />
                                            <span className="break-words">{c.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </fieldset>

                        <button
                            type="button"
                            onClick={submit}
                            disabled={picked.length === 0 || tx.isSending}
                            className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] hover:opacity-90 disabled:opacity-40 transition-opacity"
                        >
                            {tx.isSending && <Loader2 className="size-4 animate-spin" />}
                            {tx.isSending ? (g.sending || 'Confirm the vote in your wallet…') : current ? (g.submit_change || 'Change my vote') : (g.submit || 'Vote')}
                        </button>
                    </>
                )}

                {tx.result && (
                    <Notice icon={CheckCircle2} tone="ok">
                        <p className="font-bold">{g.success || 'Vote recorded on the ledger!'}</p>
                        <Link
                            href={`/${language}/dashboard/tx/${tx.result.transactionIntentHash}`}
                            className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs text-[var(--color-primary)] hover:underline break-all"
                        >
                            <ExternalLink className="size-3.5 shrink-0" />
                            {g.view_tx || 'View the transaction'}: {shortenAddress(tx.result.transactionIntentHash)}
                        </Link>
                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{g.tally_delay}</p>
                    </Notice>
                )}
                {errorText && <Notice icon={AlertTriangle} tone="error">{errorText}</Notice>}

                {item.start && phase !== 'closed' && (
                    <p className="flex gap-1.5 text-[11px] leading-snug text-[var(--color-text-muted)]">
                        <Info className="size-3 shrink-0 mt-0.5" />
                        <span suppressHydrationWarning>{fill(g.snapshot_note || 'Your voting power is taken from the balances held when voting opened ({date}).', { date: formatDate(item.start, language) })}</span>
                    </p>
                )}
            </div>
        </section>
    );
}
