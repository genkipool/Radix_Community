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

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Check, Copy, Info, Loader2, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SafeImage } from '@/components/ui/SafeImage';
import { truncateAddress } from '@/utils/formatters';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { entityKeys } from '@/features/dashboard/hooks/useEntityData';
import { ResourceInlinePanel } from './BalanceChangeRow';
import { getMetaValue } from '../utils/metadataUtils';
import type { TranslationsT, MetadataItem, GatewayEntityDetails } from '@/features/dashboard/types';

/* ─── Types ─── */

interface PoolReserve {
    resource_address: string;
    amount: string;
}

interface UnderlyingTokensTabProps {
    poolAddress: string;
    lpResourceAddress: string;
    lpName: string;
    userBalance: number;
    lpTotalSupply: number;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    network: 'mainnet' | 'stokenet';
    locale: string;
}

/* ─── Helpers ─── */

/**
 * Extracts pool reserves from the pool entity response.
 * The Gateway returns fungible_resources.items on the pool entity,
 * each with resource_address and amount at the Global aggregation level.
 */
function extractPoolReserves(poolData: GatewayEntityDetails): PoolReserve[] {
    const fungibles = poolData?.fungible_resources?.items ?? [];

    return fungibles.map((ft) => ({
        resource_address: ft.resource_address,
        amount: ft.amount ?? '0',
    }));
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

    // Extract reserves from the pool entity
    const reserves = extractPoolReserves(poolData as GatewayEntityDetails);

    // Calculate user share percentage
    const sharePercent = lpTotalSupply > 0 ? (userBalance / lpTotalSupply) * 100 : 0;

    return (
        <div className="space-y-5">
            {/* ── Position Summary Table ── */}
            <PositionSummaryTable
                lpName={lpName}
                userBalance={userBalance}
                lpTotalSupply={lpTotalSupply}
                sharePercent={sharePercent}
                reserves={reserves}
                accT={accT}
                network={network}
                locale={locale}
                poolAddress={resolvedPoolAddress}
                onCopy={onCopy}
                copiedAddress={copiedAddress}
            />

            {/* ── Underlying token expandable cards ── */}
            <div className="flex flex-col gap-2">
                {reserves.map((reserve) => {
                    const poolReserve = parseFloat(reserve.amount) || 0;
                    const contributed = lpTotalSupply > 0 ? (userBalance / lpTotalSupply) * poolReserve : 0;

                    return (
                        <UnderlyingTokenCard
                            key={reserve.resource_address}
                            address={reserve.resource_address}
                            contributed={contributed}
                            onCopy={onCopy}
                            copiedAddress={copiedAddress}
                            tt={tt}
                            network={network}
                            locale={locale}
                        />
                    );
                })}
            </div>

            {reserves.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)] italic text-center py-4">
                    No reserves found for this pool.
                </p>
            )}
        </div>
    );
}

/* ─── Position Summary Table ─── */

interface PositionSummaryTableProps {
    lpName: string;
    userBalance: number;
    lpTotalSupply: number;
    sharePercent: number;
    reserves: PoolReserve[];
    accT: TranslationsT['dashboard']['transactions']['account_summary'] | undefined;
    network: 'mainnet' | 'stokenet';
    locale: string;
    poolAddress?: string;
    onCopy: (text: string) => void;
    copiedAddress: string | null;
}

function PositionSummaryTable({
    lpName,
    userBalance,
    lpTotalSupply,
    sharePercent,
    reserves,
    accT,
    network,
    locale,
    poolAddress,
    onCopy,
    copiedAddress,
}: PositionSummaryTableProps) {
    return (
        <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] overflow-hidden">
            {/* Title */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-card-border)] bg-[var(--color-primary)]/5">
                <BarChart3 className="size-4 text-[var(--color-primary)] shrink-0" />
                <h4 className="text-xs font-bold text-[var(--color-text-main)] truncate">
                    {accT?.contributed_tokens_share || 'Your position in'} <span className="text-[var(--color-primary)]">{lpName}</span>
                </h4>
            </div>

            {/* Table Headers */}
            <div className="flex items-center justify-between px-4 py-2 bg-[var(--color-card-border)]/20 border-b border-[var(--color-card-border)]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    {accT?.contributed_tokens_concept || 'Concepto'}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] text-right">
                    {accT?.contributed_tokens_value || 'Valor'}
                </span>
            </div>

            {/* Table */}
            <div className="divide-y divide-[var(--color-card-border)]">
                {/* Pool Address */}
                {poolAddress && (
                    <SummaryRow
                        label={accT?.pool_address || 'Pool Address'}
                        value={
                            <div className="flex items-center gap-2 justify-end w-full max-w-[280px] sm:max-w-md select-all break-all text-right ml-auto">
                                <span className="font-mono text-[11px] leading-relaxed select-all">{poolAddress}</span>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onCopy(poolAddress); }}
                                    className={`p-0.5 rounded transition-colors shrink-0 ${copiedAddress === poolAddress ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                >
                                    {copiedAddress === poolAddress ? <Check className="size-3 text-[var(--color-accent)]" /> : <Copy className="size-3" />}
                                </button>
                            </div>
                        }
                    />
                )}

                {/* LP units owned */}
                <SummaryRow
                    label={accT?.contributed_tokens_lp_units || 'LP units you own'}
                    value={fmtAmount(userBalance, locale)}
                />

                {/* Total supply LP */}
                <SummaryRow
                    label={accT?.contributed_tokens_total_supply || 'Total supply LP'}
                    value={fmtAmount(lpTotalSupply, locale)}
                />

                {/* Participation percentage */}
                <SummaryRow
                    label={accT?.contributed_tokens_pool_share || 'Share'}
                    value={
                        <span className="font-black text-[var(--color-primary)]">
                            {sharePercent < 0.000001 ? '<0.000001' : fmtAmount(sharePercent, locale)}%
                        </span>
                    }
                />

                {/* One row per underlying reserve token */}
                {reserves.map((reserve) => (
                    <ReserveRow
                        key={reserve.resource_address}
                        address={reserve.resource_address}
                        poolReserve={parseFloat(reserve.amount) || 0}
                        userBalance={userBalance}
                        lpTotalSupply={lpTotalSupply}
                        network={network}
                        locale={locale}
                        accT={accT}
                    />
                ))}
            </div>
        </div>
    );
}

/* ─── Summary Row (key/value) ─── */

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-[11px] text-[var(--color-text-muted)] font-medium">{label}</span>
            <span className="text-xs font-mono font-bold text-[var(--color-text-main)]">{value}</span>
        </div>
    );
}

/* ─── Reserve Row (fetches token metadata for name/symbol) ─── */

function ReserveRow({
    address,
    poolReserve,
    userBalance,
    lpTotalSupply,
    network,
    locale,
    accT,
}: {
    address: string;
    poolReserve: number;
    userBalance: number;
    lpTotalSupply: number;
    network: 'mainnet' | 'stokenet';
    locale: string;
    accT: TranslationsT['dashboard']['transactions']['account_summary'] | undefined;
}) {
    const { data: entityData } = useQuery({
        queryKey: entityKeys.full(address, network),
        queryFn: () => apiFetchEntityDetails(address, network),
        staleTime: Infinity,
        gcTime: 10 * 60_000,
        retry: 1,
    });

    const metaItems: MetadataItem[] = (entityData as GatewayEntityDetails | null)?.metadata?.items ?? [];
    const symbol = getMetaValue(metaItems, 'symbol') || truncateAddress(address, 4, 4);

    const contributed = lpTotalSupply > 0 ? (userBalance / lpTotalSupply) * poolReserve : 0;
    const labelText = accT?.contributed_tokens_entitlement?.replace('{symbol}', symbol) || `${symbol} que te corresponde`;

    return (
        <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-[11px] text-[var(--color-text-muted)] font-medium">
                {labelText}
            </span>
            <span className="text-xs font-mono font-black text-[var(--color-accent)]">
                {fmtAmount(contributed, locale)} <span className="text-[10px] font-bold text-[var(--color-text-muted)]">{symbol}</span>
            </span>
        </div>
    );
}

/* ─── Individual Underlying Token Card (Expandable) ─── */

function UnderlyingTokenCard({
    address,
    contributed,
    onCopy,
    copiedAddress,
    tt,
    network,
    locale,
}: {
    address: string;
    contributed: number;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    network: 'mainnet' | 'stokenet';
    locale: string;
}) {
    const [expanded, setExpanded] = useState(false);

    const { data: entityData, isLoading } = useQuery({
        queryKey: entityKeys.full(address, network),
        queryFn: () => apiFetchEntityDetails(address, network),
        staleTime: Infinity,
        gcTime: 10 * 60_000,
        retry: 1,
    });

    const metaItems: MetadataItem[] = (entityData as GatewayEntityDetails | null)?.metadata?.items ?? [];
    const name = getMetaValue(metaItems, 'name') || truncateAddress(address, 6, 6);
    const symbol = getMetaValue(metaItems, 'symbol') || '';
    const iconUrl = getMetaValue(metaItems, 'icon_url') || '';

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.getSelection()?.toString()) return;
        setExpanded(v => !v);
    };

    return (
        <div className="flex flex-col bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-xl transition-all shadow-sm">
            <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-colors rounded-xl"
                onClick={handleToggle}
            >
                {/* Left: icon + name + address */}
                <div className="flex items-center gap-3 min-w-0 pr-4 flex-1">
                    <div className="size-8 rounded-full shrink-0 overflow-hidden bg-[var(--color-card-border)] flex items-center justify-center border border-[var(--color-card-border)]">
                        {iconUrl ? (
                            <SafeImage src={iconUrl} alt={name} fallbackName={symbol || name} className="w-full h-full object-cover" />
                        ) : (
                            <Info className="size-4 text-[var(--color-text-muted)]" />
                        )}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                            <span className="font-bold text-sm text-[var(--color-text-main)] truncate" title={name}>{name}</span>
                            {symbol && <span className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider truncate shrink-0">{symbol}</span>}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] font-mono text-[var(--color-text-muted)] truncate select-all">{truncateAddress(address, 6, 6)}</span>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onCopy(address); }}
                                className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors shrink-0"
                            >
                                {copiedAddress === address ? <Check className="size-2.5 text-[var(--color-accent)]" /> : <Copy className="size-2.5" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right: contributed amount + chevron */}
                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-mono font-black text-[var(--color-accent)] tracking-tight">
                            {fmtAmount(contributed, locale)}
                        </span>
                        <span className="text-[10px] font-bold text-[var(--color-text-muted)] text-right truncate max-w-[80px]" title={symbol || name}>
                            {symbol || name}
                        </span>
                    </div>
                    <ChevronDown className={`size-4 ml-1 text-[var(--color-text-muted)] transition-transform duration-200 ${expanded ? 'rotate-180 text-[var(--color-primary)]' : ''}`} />
                </div>
            </div>

            {/* Expandable content — full ResourceInlinePanel */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                    >
                        <ResourceInlinePanel
                            address={address}
                            details={entityData || null}
                            loading={isLoading}
                            onCopy={onCopy}
                            copiedAddress={copiedAddress}
                            tt={tt}
                            locale={locale || 'en-US'}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
