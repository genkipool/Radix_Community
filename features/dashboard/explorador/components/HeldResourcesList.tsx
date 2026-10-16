'use client';
import React from 'react';

import { useQueries } from '@tanstack/react-query';

import { SafeImage } from '@/components/ui/SafeImage';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import type { GatewayEntityDetails, MetadataItem, Network } from '@/features/dashboard/types';
import { formatNumber } from '@/utils/formatters';
import { AddressChip } from './SummaryCardKit';

/** A fungible item as the Gateway returns it; `amount` is absent with vault aggregation. */
export type FungibleItem = Omit<NonNullable<GatewayEntityDetails['fungible_resources']>['items'][number], 'amount'> & { amount?: string };

const meta = (items: MetadataItem[] | undefined, key: string) =>
    String(items?.find((m) => m.key === key)?.value?.typed?.value ?? '');

/**
 * The amount of a fungible item, whether the Gateway aggregated it globally or
 * per vault; null when it is not known (only the address came from metadata).
 */
function amountOf(item: FungibleItem): number | null {
    if (item.amount !== undefined) return Number(item.amount);
    const vaults = (item as { vaults?: { items?: { amount?: string }[] } }).vaults?.items;
    return vaults ? vaults.reduce((sum, vault) => sum + Number(vault.amount ?? 0), 0) : null;
}

/**
 * The fungible resources an entity holds, one readable row each: icon, name
 * (symbol beside it), amount, and the address shortened with a copy button.
 * A pool's are its reserves; any other component's, its treasury.
 */
export function HeldResourcesList({
    title,
    items,
    locale,
    copiedAddress,
    onCopy,
    copyTitle,
    detail,
    network,
    fill = false,
}: {
    title?: string;
    items: FungibleItem[];
    locale: string;
    copiedAddress: string | null;
    onCopy: (value: string) => void;
    copyTitle: string;
    /** A second fact per resource, shown beside its address (e.g. what one pool unit redeems). */
    detail?: (resource: string, symbol: string) => React.ReactNode;
    /** The ledger the resources live on, to look up those that come without metadata. */
    network: Network;
    /** Stretch to the height of a neighbouring column, sharing it between the rows. */
    fill?: boolean;
}) {
    // Rows built from elsewhere (a locker's history, a share of a pool) carry
    // no metadata: each resource's own details give its name, symbol and icon.
    // Its own key: other explorer caches keep reshaped entities under theirs.
    const bare = items.filter((item) => !item.explicit_metadata?.items?.length).map((item) => item.resource_address);
    const looked = useQueries({
        queries: bare.map((address) => ({
            queryKey: ['explorer-resource-metadata', network, address],
            queryFn: async (): Promise<MetadataItem[]> => {
                const details = await apiFetchEntityDetails(address, network);
                return [...(details.explicit_metadata?.items ?? []), ...(details.metadata?.items ?? [])];
            },
            staleTime: 10 * 60_000,
            gcTime: 10 * 60_000,
        })),
    });
    const metadataOf = (item: FungibleItem): MetadataItem[] | undefined =>
        item.explicit_metadata?.items?.length ? item.explicit_metadata.items : looked[bare.indexOf(item.resource_address)]?.data;

    return (
        <div className={`flex flex-col gap-1 ${fill ? 'h-full' : ''}`}>
            {title && <h4 className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)]">{title}</h4>}
            <div className={fill ? 'flex-1' : ''}>
                <ul className={`divide-y divide-[var(--color-card-border)] ${fill ? 'flex h-full flex-col [&>li]:flex-1' : ''}`}>
                    {items.map((item) => {
                        const metadata = metadataOf(item);
                        const symbol = meta(metadata, 'symbol');
                        const name = meta(metadata, 'name') || symbol || '?';
                        const icon = meta(metadata, 'icon_url');
                        const amount = amountOf(item);
                        return (
                            <li key={item.resource_address} className="flex items-center gap-3 py-2.5">
                                {icon ? (
                                    <SafeImage src={icon} alt={name} fallbackName={name} className="size-7 rounded-full object-cover shrink-0" />
                                ) : (
                                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--color-primary)]/10 text-[10px] font-black text-[var(--color-primary)]">
                                        {(symbol || name).slice(0, 2).toUpperCase()}
                                    </span>
                                )}
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-[var(--color-text-main)]" title={name}>
                                        {name}
                                    </span>
                                    <AddressChip address={item.resource_address} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={copyTitle} />
                                </span>
                                <span className="shrink-0 text-right">
                                    {amount !== null && (
                                        <span className="block font-mono text-sm font-bold tabular-nums text-[var(--color-text-main)]">
                                            {formatNumber(amount, 6, locale)}
                                            {symbol && <span className="ml-1 text-xs font-semibold text-[var(--color-text-muted)]">{symbol}</span>}
                                        </span>
                                    )}
                                    {detail && <span className="block text-[11px] text-[var(--color-text-muted)]">{detail(item.resource_address, symbol)}</span>}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
