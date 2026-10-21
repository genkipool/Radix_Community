'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CopyButton } from '@/components/ui/CopyButton';
import { formatPercent, formatXRD, truncateAddress } from '@/utils/formatters';
import { EntityCard } from '../explorador/components/entityCards';
import type { AccountUnlockData } from '../services/apiClient';
import type { Network, TranslationsT } from '../types';
import type { Validator } from '@/types/radix';
import type { MarketData } from '@/services/marketData';

interface UnlockAccountsTableProps {
    accounts: AccountUnlockData[];
    /** XRD of the wave whose account is not known, and the whole wave, for the shares. */
    unattributedXrd: number;
    total: number;
    network: Network;
    locale: string;
    t?: Partial<TranslationsT>;
    dt?: Partial<TranslationsT['dashboard']>;
    /** Names the validators the unstakes came from, when the list is at hand. */
    validators?: Validator[];
    marketData?: MarketData | null;
    onCopy: (address: string) => void;
    copiedAddress: string | null;
}

const FIRST_ROWS = 10;
const MORE_ROWS = 25;

/**
 * Who the wave belongs to: one row per account with XRD still unlocking, the
 * biggest first. A row opens into the account's own card — the same one the
 * explorer shows for an address, with all its tabs — so the table adds no
 * second way of reading an account, and nothing about it is fetched until its
 * row is opened.
 */
export function UnlockAccountsTable({
    accounts, unattributedXrd, total, network, locale, t, dt, validators, marketData, onCopy, copiedAddress,
}: UnlockAccountsTableProps) {
    const i = dt?.insights;
    const [open, setOpen] = useState<string | null>(null);
    const [shown, setShown] = useState(FIRST_ROWS);
    const names = new Map((validators ?? []).map(v => [v.address, v.name]));
    const validatorName = (address: string) => names.get(address) ?? truncateAddress(address, 10, 6);
    const date = (ms: number) => new Date(ms).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

    if (accounts.length === 0) return null;

    return (
        <div className="mt-8">
            <h3 className="text-sm font-black uppercase tracking-wider text-[var(--color-text-main)]">{i?.accounts_title ?? 'Who is unlocking'}</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 mb-3">{i?.accounts_subtitle}</p>

            <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                    <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
                            <th className="w-10 py-2 pr-2 font-bold">#</th>
                            <th className="py-2 pr-4 font-bold">{i?.accounts_account ?? 'Account'}</th>
                            <th className="py-2 pr-4 font-bold text-right">{i?.accounts_xrd ?? 'XRD unlocking'}</th>
                            <th className="py-2 pr-4 font-bold w-44">{i?.accounts_share ?? 'Of the wave'}</th>
                            <th className="py-2 pr-4 font-bold text-right">{i?.accounts_unstakes ?? 'Unstakes'}</th>
                            <th className="py-2 pr-4 font-bold">{i?.accounts_validators ?? 'Validator'}</th>
                            <th className="hidden md:table-cell py-2 pr-4 font-bold">{i?.accounts_next ?? 'First unlock'}</th>
                            <th className="w-8 py-2" aria-hidden="true" />
                        </tr>
                    </thead>
                    <tbody>
                        {accounts.slice(0, shown).map((account, index) => {
                            const isOpen = open === account.address;
                            const share = total > 0 ? (account.xrd / total) * 100 : 0;
                            const names = account.validators.map(validatorName);
                            return (
                                <React.Fragment key={account.address}>
                                    <tr
                                        className={`border-t border-[var(--color-card-border)] cursor-pointer transition-colors hover:bg-[var(--color-surface-hover)] ${isOpen ? 'bg-[var(--color-surface-hover)]' : ''}`}
                                        onClick={() => setOpen(isOpen ? null : account.address)}
                                    >
                                        <td className="py-2.5 pr-2 tabular-nums text-[var(--color-text-muted)]">{index + 1}</td>
                                        <td className="py-2.5 pr-4">
                                            <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-[var(--color-text-main)]" title={account.address}>
                                                {truncateAddress(account.address, 14, 8)}
                                                <span onClick={e => e.stopPropagation()}>
                                                    <CopyButton value={account.address} variant="card-inline" size="sm" forceCopied={copiedAddress === account.address} onClick={() => onCopy(account.address)} />
                                                </span>
                                            </span>
                                        </td>
                                        <td className="py-2.5 pr-4 text-right font-bold tabular-nums text-[var(--color-text-main)]" title={`${Math.round(account.xrd).toLocaleString(locale)} XRD`}>
                                            {formatXRD(account.xrd, locale)} XRD
                                        </td>
                                        <td className="py-2.5 pr-4">
                                            <div className="flex items-center gap-2">
                                                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-card-border)]/60" aria-hidden="true">
                                                    <span className="block h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${Math.min(100, share)}%` }} />
                                                </span>
                                                <span className="w-12 text-right text-xs tabular-nums text-[var(--color-text-muted)]">{formatPercent(share, share < 10 ? 1 : 0, locale)}</span>
                                            </div>
                                        </td>
                                        <td className="py-2.5 pr-4 text-right tabular-nums text-[var(--color-text-muted)]">{account.unstakes}</td>
                                        <td className="py-2.5 pr-4 max-w-[240px]" title={names.join(', ')}>
                                            <span className="block truncate font-semibold text-[var(--color-text-main)]">
                                                {names[0]}
                                                {names.length > 1 && <span className="ml-1 font-bold text-[var(--color-text-muted)]">+{names.length - 1}</span>}
                                            </span>
                                        </td>
                                        <td className="hidden md:table-cell py-2.5 pr-4 text-xs text-[var(--color-text-muted)] whitespace-nowrap">{date(account.nextUnlock)}</td>
                                        <td className="py-2.5">
                                            <button
                                                type="button"
                                                aria-expanded={isOpen}
                                                aria-label={account.address}
                                                onClick={e => { e.stopPropagation(); setOpen(isOpen ? null : account.address); }}
                                                className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                                            >
                                                <ChevronDown className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                            </button>
                                        </td>
                                    </tr>
                                    {isOpen && (
                                        <tr>
                                            <td colSpan={8} className="pb-4 pt-1">
                                                {/* The account's own card, open, with all its tabs. */}
                                                <div className="grid grid-cols-1">
                                                    <EntityCard
                                                        address={account.address}
                                                        columns={1}
                                                        isExpanded
                                                        // The row already names the account: the card starts at its tabs.
                                                        headless
                                                        onCopy={onCopy}
                                                        copiedAddress={copiedAddress}
                                                        t={t}
                                                        network={network}
                                                        locale={locale}
                                                        marketData={marketData}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
                <span>
                    {unattributedXrd > 0 && `${i?.accounts_unattributed ?? 'Account not identified'}: ${formatXRD(unattributedXrd, locale)} XRD`}
                </span>
                {shown < accounts.length && (
                    <button
                        type="button"
                        onClick={() => setShown(n => Math.min(accounts.length, n + MORE_ROWS))}
                        className="rounded-full border border-[var(--color-card-border)] bg-[var(--color-surface)] px-3 py-1.5 font-bold hover:border-[var(--color-primary)]/40 transition-colors"
                    >
                        {i?.accounts_more ?? 'Show more'} ({accounts.length - shown})
                    </button>
                )}
            </div>
        </div>
    );
}
