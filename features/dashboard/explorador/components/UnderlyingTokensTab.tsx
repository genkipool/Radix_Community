'use client';


/**
 * UnderlyingTokensTab.tsx
 *
 * Calculates and displays the underlying (contributed) tokens for a Pool Unit.
 * Formula: ContributedTokens = (UserLPBalance / TotalSupplyLP) * PoolReserve
 *
 * Resolution chain:
 * 1. If poolAddress starts with "pool_", fetch directly for reserves.
 * 2. If poolAddress starts with "component_", fetch the component first to
 *    resolve the actual pool address from metadata/state/fields, then fetch
 *    the pool for reserves.
 */
import Link from 'next/link';
import { dashboardRoutes } from '@/features/dashboard/lib/routes';
import { useResourceLabels } from '@/features/console/hooks/useResourceLabels';
import { parsePoolState } from '@/features/console/lib/pool-lookup';
import { usePoolContributions } from '@/features/console/hooks/usePoolContributions';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { truncateAddress } from '@/utils/formatters';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { entityKeys } from '@/features/dashboard/hooks/useEntityData';
import type { TranslationsT, GatewayEntityDetails } from '@/features/dashboard/types';
import { SummaryInlineRow } from './EntityPanelShared';
import { HeldResourcesList } from './HeldResourcesList';
import { CopyButton } from './SummaryCardKit';
import type { ResourceInlinePanelProps } from '../types/components.types';

/* ─── Types ─── */

interface PoolReserve {
    resource_address: string;
    amount: string;
}

interface UnderlyingTokensTabProps {
    poolAddress: string;
    lpResourceAddress: string;
    /** The account holding the units: its contributions and a redeem link are shown. */
    holder?: string;
    lpName: string;
    userBalance: number;
    lpTotalSupply: number;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    network: 'mainnet' | 'stokenet';
    locale: string;
    ResourceInlinePanel?: (props: ResourceInlinePanelProps) => React.ReactNode;
}

/* ─── Helpers ─── */

/**
 * The pool's reserves. A native pool is read by the same parser as the pool
 * card and the console (it copes with both Gateway aggregation levels); any
 * other entity falls back to its fungible vaults, summed per resource.
 */
function extractPoolReserves(poolData: GatewayEntityDetails): PoolReserve[] {
    const pool = parsePoolState(poolData);
    if (pool) return pool.resources.map((resource) => ({ resource_address: resource, amount: pool.reserves[resource] ?? '0' }));

    return (poolData?.fungible_resources?.items ?? []).map((ft) => {
        const vaults = (ft as { vaults?: { items?: { amount?: string }[] } }).vaults?.items ?? [];
        const amount = ft.amount ?? String(vaults.reduce((sum, vault) => sum + Number(vault.amount ?? 0), 0));
        return { resource_address: ft.resource_address, amount };
    });
}

/**
 * Searches an entity (component or pool) for a pool_ address in its
 * metadata, state, or state.fields.
 */
function findPoolAddressInEntity(entity: GatewayEntityDetails): string | undefined {
    // 1. Check metadata keys
    const meta = entity.metadata?.items ?? [];
    const metaByKey = new Map(meta.map((m) => [m.key, m] as const));
    for (const key of ['pool', 'pool_address', 'liquidity_pool']) {
        const item = metaByKey.get(key);
        const val = item?.value?.typed?.value;
        if (typeof val === 'string' && val.startsWith('pool_')) return val;
    }

    // 2. Check dapp_definitions / dapp_definition for pool_ addresses
    const dappDefs = metaByKey.get('dapp_definitions');
    if (dappDefs?.value?.typed?.values) {
        const poolAddr = dappDefs.value.typed.values.find(
            (v: string) => v.startsWith('pool_')
        );
        if (poolAddr) return poolAddr;
    }
    const dappDef = meta.find((m) => m.key === 'dapp_definition');
    if (dappDef?.value?.typed?.value?.startsWith('pool_')) {
        return dappDef.value.typed.value;
    }

    // 3. Check details.state for direct pool references
    const state = entity.details?.state as Record<string, unknown> | undefined;
    if (state) {
        for (const key of ['liquidity_pool', 'pool', 'pool_address', 'pool_component']) {
            const val = state[key];
            if (typeof val === 'string' && val.startsWith('pool_')) return val;
        }

        // 4. Check state.fields (Scrypto component state — array of typed fields)
        const fields = state.fields as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(fields)) {
            for (const field of fields) {
                const fVal = field.value as string | undefined;
                if (typeof fVal === 'string' && fVal.startsWith('pool_')) return fVal;

                // Nested fields (structs)
                const nestedFields = field.fields as Array<Record<string, unknown>> | undefined;
                if (Array.isArray(nestedFields)) {
                    for (const nf of nestedFields) {
                        const nfVal = nf.value as string | undefined;
                        if (typeof nfVal === 'string' && nfVal.startsWith('pool_')) return nfVal;
                    }
                }

                // Elements array (e.g., Tuple fields)
                const elements = field.elements as Array<Record<string, unknown>> | undefined;
                if (Array.isArray(elements)) {
                    for (const el of elements) {
                        const elVal = el.value as string | undefined;
                        if (typeof elVal === 'string' && elVal.startsWith('pool_')) return elVal;
                    }
                }
            }
        }
    }

    // 5. Check fungible_resources — if the entity IS a pool, it will have reserves directly
    if ((entity.fungible_resources?.items?.length ?? 0) > 0 && entity.address?.startsWith('pool_')) {
        return entity.address;
    }

    return undefined;
}

/** Formats a number with locale-aware thousands separators without rounding (up to 18 decimals) */
function fmtAmount(value: number, locale: string, maxDecimals = 18): string {
    return value.toLocaleString(locale || 'en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: maxDecimals,
    });
}

/* ─── Main Component ─── */

export function UnderlyingTokensTab({
    poolAddress,
    lpResourceAddress: _lpResourceAddress,
    holder,
    lpName,
    userBalance,
    lpTotalSupply,
    tt,
    onCopy,
    copiedAddress,
    network,
    locale,
}: UnderlyingTokensTabProps) {
    const accT = tt?.account_summary;

    const isDirectPool = poolAddress.startsWith('pool_');

    // Step 1: If address is component_, fetch the component to resolve the pool_ address
    const { data: intermediateData, isLoading: intermediateLoading } = useQuery({
        queryKey: entityKeys.full(poolAddress, network),
        queryFn: () => apiFetchEntityDetails(poolAddress, network),
        staleTime: 5 * 60_000,
        gcTime: 10 * 60_000,
        retry: 2,
        enabled: !isDirectPool,
    });

    // Resolve the actual pool_ address
    const resolvedPoolAddress = isDirectPool
        ? poolAddress
        : findPoolAddressInEntity(intermediateData as GatewayEntityDetails) ?? undefined;

    // Step 2: Fetch the pool entity for reserves
    const { data: poolData, isLoading: poolLoading, isError: poolError } = useQuery({
        queryKey: entityKeys.full(resolvedPoolAddress ?? '', network),
        queryFn: () => apiFetchEntityDetails(resolvedPoolAddress!, network),
        staleTime: 5 * 60_000,
        gcTime: 10 * 60_000,
        retry: 2,
        enabled: !!resolvedPoolAddress,
    });

    const poolState = poolData ? parsePoolState(poolData) : null;
    const { data: contributions } = usePoolContributions(holder ? poolState : null, network);
    const names = useResourceLabels(poolState?.resources ?? [], network);

    const isLoading = intermediateLoading || poolLoading;

    if (isLoading) {
        return (
            <div className="flex items-center gap-2 py-8 justify-center text-[var(--color-text-muted)]">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-xs">{accT?.contributed_tokens_loading || 'Calculating contributed tokens...'}</span>
            </div>
        );
    }

    if (poolError || !poolData || !resolvedPoolAddress) {
        return (
            <p className="text-xs text-red-400 italic text-center py-8">
                {accT?.contributed_tokens_error || 'Could not calculate contributed tokens.'}
            </p>
        );
    }

    const reserves = extractPoolReserves(poolData as GatewayEntityDetails);
    // What this account has put in and taken out, from the pool's history.
    const flows = holder ? contributions?.byAccount[holder] : undefined;
    const flowLine = (side: 'putIn' | 'takenOut') =>
        contributions
            ? reserves
                  .map((r) => `${fmtAmount(Number(flows?.[side][r.resource_address] ?? 0), locale, 6)} ${names[r.resource_address] ?? '?'}`)
                  .join(' · ')
            : '…';
    const share = lpTotalSupply > 0 ? userBalance / lpTotalSupply : 0;
    const poolName = (poolData as GatewayEntityDetails).metadata?.items?.find((m) => m.key === 'name')?.value?.typed?.value;
    const copyTitle = tt?.copy_address || 'Copy address';

    return (
        // Your position on the left, what it is worth on the right, both
        // columns the same height.
        <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch gap-x-10 gap-y-4">
            <div className="flex h-full flex-col gap-1">
                <h4 className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
                    {accT?.contributed_tokens_position || 'Your position'}
                </h4>
                <dl className="flex flex-1 flex-col [&>div]:flex-1">
                    <SummaryInlineRow label={accT?.pool_tab || 'Pool'}>
                        <Link
                            href={dashboardRoutes.entity(locale, resolvedPoolAddress, { network })}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-semibold text-[var(--color-primary)] hover:underline truncate"
                            title={accT?.open_pool || 'Open the pool card'}
                        >
                            {poolName || truncateAddress(resolvedPoolAddress, 10, 6)}
                        </Link>
                        <CopyButton value={resolvedPoolAddress} copiedAddress={copiedAddress} onCopy={onCopy} title={copyTitle} />
                    </SummaryInlineRow>
                    <SummaryInlineRow label={accT?.contributed_tokens_lp_units || 'Your units'} value={`${fmtAmount(userBalance, locale, 6)} ${lpName}`} mono />
                    <SummaryInlineRow label={accT?.contributed_tokens_total_supply || 'Units in circulation'} value={fmtAmount(lpTotalSupply, locale, 6)} mono />
                    <SummaryInlineRow label={accT?.contributed_tokens_pool_share || 'Share'}>
                        <span className="flex items-center gap-2">
                            <span className="h-1.5 w-20 rounded-full bg-[var(--color-card-border)] overflow-hidden" aria-hidden>
                                <span className="block h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${Math.min(share * 100, 100)}%` }} />
                            </span>
                            <span className="text-xs font-bold text-[var(--color-primary)] tabular-nums">
                                {share > 0 && share < 0.00000001 ? '<0.000001' : fmtAmount(share * 100, locale, 4)} %
                            </span>
                        </span>
                    </SummaryInlineRow>
                    {holder && (
                        <>
                            <SummaryInlineRow label={accT?.contributed_tokens_put_in || 'Put in'} value={flowLine('putIn')} mono />
                            <SummaryInlineRow label={accT?.contributed_tokens_taken_out || 'Taken out'} value={flowLine('takenOut')} mono />
                        </>
                    )}
                </dl>
                {holder && (
                    // A full page load: the console reads its query when it opens.
                    <a
                        href={`/${locale}/console/pool-redeem?pool=${resolvedPoolAddress}&account=${holder}`}
                        className="self-start pt-2 text-xs font-bold text-[var(--color-primary)] hover:underline"
                    >
                        {accT?.contributed_tokens_redeem || 'Redeem in the console'} →
                    </a>
                )}
            </div>
            {reserves.length > 0 ? (
                <HeldResourcesList
                    fill
                    title={accT?.contributed_tokens_yours || 'What you are entitled to'}
                    items={reserves.map((reserve) => ({
                        resource_address: reserve.resource_address,
                        amount: String(share * (parseFloat(reserve.amount) || 0)),
                    }))}
                    network={network}
                    locale={locale}
                    copiedAddress={copiedAddress}
                    onCopy={onCopy}
                    copyTitle={copyTitle}
                    detail={(resource, symbol) => {
                        const inPool = parseFloat(reserves.find((r) => r.resource_address === resource)?.amount ?? '0') || 0;
                        return (accT?.contributed_tokens_of_pool || 'of {amount} in the pool').replace('{amount}', `${fmtAmount(inPool, locale, 6)} ${symbol}`.trim());
                    }}
                />
            ) : (
                <p className="text-xs text-[var(--color-text-muted)] py-2.5">{accT?.contributed_tokens_no_reserves || 'This pool holds nothing.'}</p>
            )}
        </div>
    );
}
