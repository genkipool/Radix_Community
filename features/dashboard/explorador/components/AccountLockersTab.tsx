'use client';
import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ChevronDown, Inbox } from 'lucide-react';

import { useResourceLabels } from '@/features/console/hooks/useResourceLabels';
import { useAccountLockerList } from '@/features/console/hooks/useAccountLockerList';
import { fetchLockerClaims, type LockerClaim } from '@/features/console/lib/locker-lookup';
import type { GatewayPost } from '@/features/console/lib/resource-holders';
import { dashboardRoutes } from '@/features/dashboard/lib/routes';
import type { Network, TranslationsT } from '@/features/dashboard/types';
import { gatewayPost } from '@/services/gateway/bases';
import { truncateAddress } from '@/utils/formatters';
import { waitingLine } from '../utils/lockerClaims';
import { PanelMetadataTab } from './EntityPanelShared';
import { entityMeta, useExplorerEntity } from './ExplorerEntityCard';
import { LockerDetails } from './LockerDetails';
import { AddressChip, CopyButton, PlainSummary } from './SummaryCardKit';


interface AccountLocker {
    address: string;
    name: string;
    waiting: LockerClaim[];
}

/**
 * The Account Lockers an account has dealt with: those that stored something
 * for it (a store names the recipients among the affected entities) and those
 * it created or used, each with what is still waiting for it.
 *
 * The Gateway cannot list the lockers holding something for an account, so
 * they are found in its recent transactions, as the console's pickers do.
 */
export function useAccountLockers(address: string, network: Network) {
    const found = useAccountLockerList(address, network);
    const lockers = found.data ?? [];
    const claims = useQuery({
        queryKey: ['explorer-account-locker-claims', network, address, lockers.map((l) => l.address).join(',')],
        enabled: found.isSuccess,
        staleTime: 60_000,
        retry: false,
        queryFn: async (): Promise<AccountLocker[]> => {
            const post: GatewayPost = (path, body) => gatewayPost(network, path, body);
            return Promise.all(
                lockers.map(async (locker) => ({ ...locker, waiting: await fetchLockerClaims(post, locker.address, address).catch(() => []) })),
            );
        },
    });
    return { data: claims.data, isLoading: found.isLoading || claims.isLoading, isError: found.isError || claims.isError };
}


/** The account card's Lockers tab: every locker found, what waits in each, and a way to claim it. */
export function AccountLockersTab({
    address,
    network,
    locale,
    copiedAddress,
    onCopy,
    tt,
}: {
    address: string;
    network: Network;
    locale: string;
    copiedAddress: string | null;
    onCopy: (value: string) => void;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
}) {
    const l = tt?.account_summary?.lockers;

    const { data: lockers, isLoading, isError } = useAccountLockers(address, network);

    if (isLoading) return <Message>{l?.searching}</Message>;
    if (isError) return <Message>{l?.error}</Message>;
    if (!lockers?.length) return <Message>{l?.none}</Message>;

    // Lockers with something to claim first.
    const sorted = [...lockers].sort((a, b) => b.waiting.length - a.waiting.length);

    return (
        <div className="space-y-2">
            {sorted.map((locker) => (
                <LockerRow
                    key={locker.address}
                    locker={locker}
                    account={address}
                    network={network}
                    locale={locale}
                    copiedAddress={copiedAddress}
                    onCopy={onCopy}
                    tt={tt}
                />
            ))}
            <p className="pt-1 text-[11px] text-[var(--color-text-muted)]">{l?.note}</p>
        </div>
    );
}

/**
 * One locker of the account, folded like its token rows: name and what waits
 * there; unfolded, the pending claims with a way to claim them, then the
 * locker in detail.
 */
function LockerRow({
    locker,
    account,
    network,
    locale,
    copiedAddress,
    onCopy,
    tt,
}: {
    locker: AccountLocker;
    account: string;
    network: Network;
    locale: string;
    copiedAddress: string | null;
    onCopy: (value: string) => void;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
}) {
    const l = tt?.account_summary?.lockers;
    const [open, setOpen] = useState(false);
    const names = useResourceLabels(locker.waiting.map((claim) => claim.resource), network);
    const { data: entity } = useExplorerEntity(locker.address, network);
    const { metadataItems } = entityMeta(entity);
    const copyTitle = l?.copy ?? 'Copy';

    return (
        <div className="flex flex-col bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-xl">
            {/* Not a <button>: it holds the address's copy button. */}
            <div
                role="button"
                tabIndex={0}
                aria-expanded={open}
                onClick={(e) => {
                    e.stopPropagation();
                    if (window.getSelection()?.toString()) return;
                    setOpen((v) => !v);
                }}
                onKeyDown={(e) => {
                    if (e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    setOpen((v) => !v);
                }}
                className="flex items-center justify-between gap-3 p-3 hover:bg-white/5 transition-colors rounded-xl w-full text-left cursor-pointer"
            >
                <span className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="size-8 rounded-full shrink-0 grid place-items-center bg-[var(--color-card-border)]">
                        <Inbox className="size-4 text-[var(--color-text-muted)]" />
                    </span>
                    <span className="flex flex-col min-w-0">
                        <span className="font-bold text-sm text-[var(--color-text-main)] truncate">{locker.name || (l?.unnamed ?? 'Account Locker')}</span>
                        <span className="flex items-center gap-0.5 min-w-0">
                            <span className="text-[10px] font-mono text-[var(--color-text-muted)] truncate" title={locker.address}>{truncateAddress(locker.address, 10, 6)}</span>
                            <CopyButton value={locker.address} copiedAddress={copiedAddress} onCopy={onCopy} title={copyTitle} />
                        </span>
                    </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs text-right ${locker.waiting.length ? 'font-bold text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)]'}`}>
                        {locker.waiting.length ? waitingLine(locker.waiting, names, locale) : l?.nothing_waiting ?? 'Nothing to claim'}
                    </span>
                    <ChevronDown className={`size-4 text-[var(--color-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
                </span>
            </div>

            {open && (
                <div className="border-t border-[var(--color-card-border)] px-4 py-4 space-y-5 cursor-auto" onClick={(e) => e.stopPropagation()} role="presentation">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <AddressChip address={locker.address} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={copyTitle} />
                        <Link href={dashboardRoutes.entity(locale, locker.address, { network })} className="text-xs font-bold text-[var(--color-primary)] hover:underline">
                            {l?.open_locker ?? 'Open the locker card'} →
                        </Link>
                    </div>
                    <LockerDetails address={locker.address} account={account} network={network} locale={locale} copiedAddress={copiedAddress} onCopy={onCopy} />
                    {metadataItems.length > 0 && (
                        <div>
                            <h4 className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)]">{tt?.resource_panel_metadata ?? 'Metadata'}</h4>
                            <PanelMetadataTab metadataItems={metadataItems} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function Message({ children }: { children: ReactNode }) {
    return (
        <div className="py-4">
            <PlainSummary>{children}</PlainSummary>
        </div>
    );
}

/**
 * The lockers in the account's summary, laid out like its tokens and NFTs:
 * one small card per locker with what is waiting there. Nothing is drawn
 * until they are found, and nothing at all for an account without lockers.
 */
export function AccountLockersSummary({
    address,
    network,
    locale,
    copiedAddress,
    onCopy,
    tt,
}: {
    address: string;
    network: Network;
    locale: string;
    copiedAddress: string | null;
    onCopy: (value: string) => void;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
}) {
    const l = tt?.account_summary?.lockers;
    const { data: lockers } = useAccountLockers(address, network);
    const resources = (lockers ?? []).flatMap((locker) => locker.waiting.map((claim) => claim.resource));
    const names = useResourceLabels(resources, network);

    if (!lockers?.length) return null;
    const sorted = [...lockers].sort((a, b) => b.waiting.length - a.waiting.length);

    return (
        <div>
            <h4 className="text-xs font-black uppercase text-[var(--color-text-muted)] tracking-wider mb-3">
                {l?.label ?? 'Lockers'} ({lockers.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-stretch">
                {sorted.map((locker) => (
                    <div
                        key={locker.address}
                        className="flex flex-col bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-xl p-3 hover:border-[var(--color-primary)] transition-colors h-full"
                    >
                        <Link href={dashboardRoutes.entity(locale, locker.address, { network })} className="flex items-center gap-2 mb-2 min-w-0">
                            <span className="size-6 rounded-full shrink-0 bg-[var(--color-card-border)] grid place-items-center">
                                <Inbox className="size-3 text-[var(--color-text-muted)]" />
                            </span>
                            <span className="font-bold text-xs text-[var(--color-text-main)] truncate">{locker.name || (l?.unnamed ?? 'Account Locker')}</span>
                        </Link>
                        <p className={`text-[11px] leading-snug ${locker.waiting.length ? 'font-semibold text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)]'}`}>
                            {locker.waiting.length
                                ? `${l?.waiting ?? 'To claim'}: ${waitingLine(locker.waiting, names, locale)}`
                                : l?.nothing_waiting ?? 'Nothing to claim'}
                        </p>
                        <div className="mt-auto pt-2 border-t border-[var(--color-card-border)]">
                            <AddressChip address={locker.address} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={l?.copy ?? 'Copy'} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
