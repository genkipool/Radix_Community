'use client';

/**
 * ExpandableEntityBadge.tsx
 *
 * Wraps the existing EntityBadge visual with expand/collapse behaviour.
 * When expanded, shows tabbed detail panels (Summary, Metadata,
 * Configuration, Raw) for the entity, fetched lazily from the Gateway.
 */

import React, { useState, useId } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { ChevronDown, Check, Copy, Download } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sanitizeText } from '@/utils/sanitize';
import { SafeImage } from '@/components/ui/SafeImage';
import { Pill } from '@/components/ui/Pill';
import {
    useEntityData,
    getEntityType,
    entityKeys,
} from '@/features/dashboard/hooks/useEntityData';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { getMetaValue } from '../utils/metadataUtils';
import { getConfigEntries } from '../../utils/resourceUtils';
import { parseTags } from '../../utils/resourceUtils';
import { getWellKnownKey, getGenericTooltipKey } from '@/features/dashboard/explorador/constants/wellKnownAddresses';
import {
    SummaryInlineRow,
    PanelTabBar,
    PanelMetadataTab,
    PanelConfigurationTab,
    PanelRawTab,
} from './EntityPanelShared';
import { ValidatorSummaryMetrics } from './ValidatorSummaryMetrics';
import { formatNumber } from '@/utils/formatters';
import { AccountSummaryTab } from './AccountSummaryTab';
import {
    AccountRewardsCsvModal
} from './AccountRewardsCsvModal';
import { usePrefetchRewards } from '@/features/dashboard/hooks/usePrefetchRewards';
import { AccountTokensTab, AccountNftsTab, AccountPoolUnitsTab } from './AccountAssetsTabs';
const AccountStakingTab = React.lazy(() =>
    import('./AccountStakingTab').then(m => ({ default: m.AccountStakingTab }))
);
import { AccountTransactionsTab } from './AccountTransactionsTab';
import { useAccountStats } from '../hooks/useAccountStats';
import type {
    MetadataItem,
    MarketData,
    TranslationsT,
    DashboardDict,
    Network,
    GatewayEntityDetails
} from '@/features/dashboard/types';
import type { AccountRewardsCsvModalDict } from '../types/components.types';

/* ─── Types ─────────────────────────────────────────── */
type EntityTab = 'summary' | 'staking' | 'tokens' | 'nfts' | 'pool_units' | 'transactions' | 'metadata' | 'configuration' | 'raw';

interface ExpandableEntityBadgeProps {
    address: string;
    tt?: Partial<TranslationsT['dashboard']['transactions']> & { account_summary?: AccountRewardsCsvModalDict };
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    network: Network;
    locale?: string;
    marketData?: MarketData | null;
    dt?: Partial<DashboardDict>;
    stakeAmount?: number;
    unstakeAmount?: number;
    claimAmount?: number;
    unstakes?: { amount: number; epoch: number }[];
    currentEpoch?: number;
    accountAddress?: string;
    variant?: 'default' | 'resource-card';
}

/* ─── Helpers ───────────────────────────────────────── */

/** Determines which tabs to show based on entity prefix */
function getTabsForEntity(
    prefix: string,
    tt?: Partial<TranslationsT['dashboard']['transactions']> & { account_summary?: AccountRewardsCsvModalDict },
): { key: EntityTab; label: string; tooltip?: string }[] {
    const isAccountAddr = prefix.startsWith('account_');
    const accT = tt?.account_summary;

    const base: { key: EntityTab; label: string; tooltip?: string }[] = [
        {
            key: 'summary',
            label: tt?.resource_panel_summary || 'Summary',
            tooltip: tt?.tab_summary_tooltip
        },
    ];

    if (isAccountAddr) {
        base.push({
            key: 'staking',
            label: accT?.staking_tab || 'Staking',
            tooltip: tt?.tab_staking_tooltip
        });
        base.push({
            key: 'tokens',
            label: accT?.tokens_tab || 'Tokens',
            tooltip: tt?.tab_tokens_tooltip
        });
        base.push({
            key: 'nfts',
            label: accT?.nfts_tab || 'NFTs',
            tooltip: tt?.tab_nfts_tooltip
        });
        base.push({
            key: 'pool_units',
            label: accT?.pool_units || 'Pool Units',
            tooltip: tt?.tab_pool_units_tooltip
        });
        base.push({
            key: 'transactions',
            label: accT?.transactions_tab || 'Transactions',
            tooltip: tt?.tab_transactions_tooltip
        });
    }

    base.push({
        key: 'metadata',
        label: tt?.resource_panel_metadata || 'Metadata',
        tooltip: tt?.tab_metadata_tooltip
    });

    // Packages and identities don't have role_assignments typically
    const hasConfig = !prefix.startsWith('package_') && !prefix.startsWith('identity_');

    if (hasConfig) {
        base.push({
            key: 'configuration',
            label: tt?.resource_panel_configuration || 'Configuration',
            tooltip: tt?.tab_configuration_tooltip
        });
    }

    base.push({
        key: 'raw',
        label: tt?.resource_panel_raw || 'Raw',
        tooltip: tt?.tab_raw_tooltip
    });
    return base;
}

/** Human-readable entity type for the summary */
function getEntityDetailType(
    details: GatewayEntityDetails | null,
    address: string,
): string {
    if (details?.details?.type) return details.details.type;

    if (address.startsWith('account_')) return 'Account';
    if (address.startsWith('resource_')) return 'Resource';
    if (address.startsWith('component_')) return 'Component';
    if (address.startsWith('validator_')) return 'Validator';
    if (address.startsWith('package_')) return 'Package';
    if (address.startsWith('identity_')) return 'Identity';
    return 'Entity';
}

/* ─── Component ──────────────────────────────────── */
export function ExpandableEntityBadge({
    address,
    tt,
    onCopy,
    copiedAddress,
    onResourceClick,
    network,
    locale = 'en',
    marketData,
    dt,
    stakeAmount,
    unstakeAmount,
    claimAmount,
    unstakes,
    currentEpoch,
    variant = 'default',
}: ExpandableEntityBadgeProps) {
    const [expanded, setExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<EntityTab>('summary');
    const instanceId = useId();
    const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
    const { prefetchAccountRewards } = usePrefetchRewards();

    const isAccountAddr = address.startsWith('account_');

    const clean = sanitizeText(address);
    const { label, color, bg } = getEntityType(clean, tt);
    const meta = useEntityData(clean, network);
    const entityName = meta?.name;
    const iconUrl = meta?.iconUrl;
    const isResourceCard = variant === 'resource-card';
    const short = clean.length > 20
        ? (isResourceCard ? `${clean.slice(0, 10)}...${clean.slice(-6)}` : `${clean.slice(0, 12)}...${clean.slice(-6)}`)
        : clean;

    const wellKnownKey = getWellKnownKey(clean, network);
    const genericKey = !wellKnownKey ? getGenericTooltipKey(clean) : null;
    const wellKnownTip = wellKnownKey
        ? tt?.well_known_tooltips?.[wellKnownKey as keyof typeof tt.well_known_tooltips]
        : genericKey
            ? tt?.type_tooltips?.[genericKey as keyof typeof tt.type_tooltips]
            : null;

    // Lazy fetch — only when expanded (eager for pools)
    const { data: entityData } = useQuery<GatewayEntityDetails | null>({
        queryKey: entityKeys.full(clean, network),
        queryFn: () => apiFetchEntityDetails(clean, network as 'mainnet' | 'stokenet'),
        enabled: expanded || clean.startsWith('pool_'),
        gcTime: 10 * 60_000,
        retry: 1,
        retryOnMount: false,
    });

    const metadataItems: MetadataItem[] = entityData?.metadata?.items ?? [];
    const getMeta = (key: string) => getMetaValue(metadataItems, key) ?? '';
    const blueprintName = entityData?.details?.blueprint_name;
    const tabs = getTabsForEntity(clean, tt);
    const ra = (entityData?.details as Record<string, unknown>)?.role_assignments;
    const configEntries = getConfigEntries(ra, tt);

    const { stakingRows } = useAccountStats(clean, network as 'mainnet' | 'stokenet', isAccountAddr ? (entityData ?? null) : null);

    /* ── Click handler (prevents text selection from collapsing) ── */
    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.getSelection()?.toString()) return;
        setExpanded((v) => !v);
    };

    return (
        <div className={`flex flex-col ${isResourceCard ? `bg-[var(--color-surface)] border border-[var(--color-card-border)] transition-all duration-300 overflow-hidden ${expanded ? 'ring-2 ring-[var(--color-primary)] shadow-md' : 'shadow-md hover:shadow-lg'}` : `border ${bg} overflow-hidden transition-all ${expanded ? 'shadow-lg shadow-black/10' : ''}`} rounded-xl`}>
            {/* ── Clickable header ─────────────────────── */}
            <div
                className={`flex-1 flex items-center justify-between ${isResourceCard ? 'gap-3 p-3' : 'gap-2 p-2.5 hover:bg-white/5'} min-h-[52px] cursor-pointer transition-colors group/entity`}
                onClick={handleToggle}
            >
                <div className="flex items-center gap-2 min-w-0">
                    {(stakeAmount !== undefined || unstakeAmount !== undefined || claimAmount !== undefined || isResourceCard) ? null : (
                        <span
                            className={`text-[9px] uppercase font-black tracking-wider px-1.5 pt-[2px] pb-[1px] leading-none rounded ${bg} ${color} shrink-0 ${wellKnownTip ? 'cursor-help' : ''}`}
                            title={wellKnownTip ?? undefined}
                        >
                            {label}
                        </span>
                    )}
                    {iconUrl && (
                        <div className={`${isResourceCard ? 'size-8' : 'size-6'} rounded-full shrink-0 overflow-hidden bg-[var(--color-card-border)] flex items-center justify-center border border-[var(--color-card-border)] shadow-sm`}>
                            <SafeImage
                                src={iconUrl}
                                alt={entityName || 'Token'}
                                fallbackName={entityName || 'Token'}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    )}
                    <div className="min-w-0 flex-1 flex flex-col">
                        {clean.startsWith('pool_') && blueprintName ? (
                            <span className={`${isResourceCard ? 'text-sm font-bold group-hover:text-[var(--color-secondary)] transition-colors' : 'text-[11px] font-semibold'} truncate ${color}`}>
                                {blueprintName}
                            </span>
                        ) : entityName ? (
                            <span className={`${isResourceCard ? 'text-sm font-bold group-hover:text-[var(--color-secondary)] transition-colors' : 'text-[11px] font-semibold'} truncate ${color}`}>
                                {entityName}
                            </span>
                        ) : null}
                        <div className="flex items-center gap-1 mt-0.5">
                            <span
                                className={`font-mono ${isResourceCard ? 'text-[10px]' : 'text-xs'} truncate ${(entityName || (clean.startsWith('pool_') && blueprintName)) ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-main)]'}`}
                                title={wellKnownTip || clean}
                            >
                                {short}
                            </span>
                            {isResourceCard && (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onCopy(clean); }}
                                    className={`p-0.5 rounded transition-colors ${copiedAddress === clean
                                        ? 'text-[var(--color-accent)]'
                                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                                        }`}
                                    title="Copy address"
                                >
                                    {copiedAddress === clean
                                        ? <Check className="size-2.5" />
                                        : <Copy className="size-2.5" />}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {(stakeAmount !== undefined || unstakeAmount !== undefined || claimAmount !== undefined) && (
                        <div className="flex items-center gap-4 mr-3">
                            {stakeAmount !== undefined && (
                                <div className="flex flex-col items-end">
                                    <span className={`${isResourceCard ? 'text-[9px] tracking-wider' : 'text-[8px] tracking-tighter'} text-[var(--color-text-muted)] uppercase font-black leading-none opacity-60`}>
                                        {tt?.stake_history?.stake || tt?.account_summary?.stake_xrd || 'Stake'}
                                    </span>
                                    <div className={`flex items-baseline gap-1 ${isResourceCard ? 'mt-1' : 'mt-0.5'}`}>
                                        <span className={`${isResourceCard ? 'text-xs' : 'text-[11px]'} font-mono font-black text-[var(--color-text-main)] leading-none tracking-tight`}>
                                            {formatNumber(stakeAmount, 2, locale)}
                                        </span>
                                        {isResourceCard && <span className="text-[9px] font-bold text-[var(--color-text-muted)]">XRD</span>}
                                    </div>
                                </div>
                            )}
                            {unstakeAmount !== undefined && (
                                <div className={`flex flex-col items-end border-l ${isResourceCard ? 'border-[var(--color-card-border)]' : 'border-white/10'} pl-3`}>
                                    <span className={`${isResourceCard ? 'text-[9px] tracking-wider' : 'text-[8px] tracking-tighter'} text-[var(--color-text-muted)] uppercase font-black leading-none opacity-60`}>
                                        {tt?.stake_history?.unstake || tt?.account_summary?.unstake_xrd || 'Unstake'}
                                    </span>
                                    <div className={`flex items-baseline gap-1 ${isResourceCard ? 'mt-1' : 'mt-0.5'}`}>
                                        <span className={`${isResourceCard ? 'text-xs' : 'text-[11px]'} font-mono font-black text-[var(--color-warning)] leading-none tracking-tight`}>
                                            {formatNumber(unstakeAmount, 2, locale)}
                                        </span>
                                        {isResourceCard && <span className="text-[9px] font-bold text-[var(--color-text-muted)]">XRD</span>}
                                    </div>
                                </div>
                            )}
                            {claimAmount !== undefined && (
                                <div className={`flex flex-col items-end border-l ${isResourceCard ? 'border-[var(--color-card-border)]' : 'border-white/10'} pl-3`}>
                                    <span className={`${isResourceCard ? 'text-[9px] tracking-wider' : 'text-[8px] tracking-tighter'} text-[var(--color-text-muted)] uppercase font-black leading-none opacity-60`}>
                                        {tt?.stake_history?.claim || tt?.account_summary?.claim_xrd || 'Claim'}
                                    </span>
                                    <div className={`flex items-baseline gap-1 ${isResourceCard ? 'mt-1' : 'mt-0.5'}`}>
                                        <span className={`${isResourceCard ? 'text-xs' : 'text-[11px]'} font-mono font-black text-[var(--color-success)] leading-none tracking-tight`}>
                                            {formatNumber(claimAmount, 2, locale)}
                                        </span>
                                        {isResourceCard && <span className="text-[9px] font-bold text-[var(--color-text-muted)]">XRD</span>}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {!isResourceCard && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onCopy(clean); }}
                            className={`p-1 rounded transition-colors ${copiedAddress === clean
                                ? 'text-[var(--color-accent)]'
                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-primary)]'
                                }`}
                            title="Copy address"
                        >
                            {copiedAddress === clean
                                ? <Check className="size-3" />
                                : <Copy className="size-3" />}
                        </button>
                    )}
                    {isAccountAddr && network === 'mainnet' && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setIsCsvModalOpen(true); }}
                            onPointerEnter={() => prefetchAccountRewards(clean)}
                            className="p-1 rounded transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                            title={tt?.account_summary?.download_rewards_tooltip || tt?.account_summary?.download_account_rewards}
                        >
                            <Download className="size-3" />
                        </button>
                    )}
                    <ChevronDown
                        className={`${isResourceCard ? 'size-4' : 'size-3.5'} text-[var(--color-text-muted)] transition-transform duration-200 ${expanded ? 'rotate-180 text-[var(--color-primary)]' : ''}`}
                    />
                </div>
            </div>

            {/* CSV Modal rendering outside of list interactions for clarity */}
            {isCsvModalOpen && (
                <AccountRewardsCsvModal
                    accountAddress={clean}
                    isOpen={isCsvModalOpen}
                    onClose={() => setIsCsvModalOpen(false)}
                    locale={locale}
                    tt={tt?.account_summary}
                    marketData={marketData ?? undefined}
                />
            )}

            {/* ── Expandable panel ────────────────────── */}
            <AnimatePresence initial={false}>
                {expanded && (
                    <m.div
                        key="expanded-panel"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden bg-[var(--color-bg)]"
                    >
                        <div
                            className="border-t border-[var(--color-card-border)] bg-[var(--color-surface)]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <PanelTabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} layoutId={`entityTabs-${instanceId}`} />

                            <div className="px-4 py-3 min-h-[200px]">
                                    <>
                                        {/* ── SUMMARY ── */}
                                        {activeTab === 'summary' && (
                                            address.startsWith('account_') ? (
                                                <AccountSummaryTab
                                                    address={clean}
                                                    entityData={entityData ?? null}
                                                    entityName={entityName}
                                                    iconUrl={iconUrl}
                                                    getMeta={getMeta}
                                                    tt={tt}
                                                    onCopy={onCopy}
                                                    copiedAddress={copiedAddress}
                                                    network={network}
                                                    marketData={marketData ?? undefined}
                                                    locale={locale}
                                                    isBadge={true}
                                                />
                                            ) : (
                                                <EntitySummaryTab
                                                    address={clean}
                                                    entityData={entityData ?? null}
                                                    entityName={entityName}
                                                    iconUrl={iconUrl}
                                                    metadataItems={metadataItems}
                                                    getMeta={getMeta}
                                                    tt={tt}
                                                    onCopy={onCopy}
                                                    copiedAddress={copiedAddress}
                                                    onResourceClick={onResourceClick}
                                                    locale={locale}
                                                    network={network}
                                                    marketData={marketData ?? undefined}
                                                    dt={dt as DashboardDict | undefined}
                                                    stakeAmount={stakeAmount}
                                                    unstakeAmount={unstakeAmount}
                                                    claimAmount={claimAmount}
                                                    unstakes={unstakes}
                                                    currentEpoch={currentEpoch}
                                                />
                                            )
                                        )}

                                        {/* ── STAKING ── */}
                                        {activeTab === 'staking' && (
                                            <React.Suspense fallback={null}>
                                                <AccountStakingTab
                                                    stakingRows={stakingRows}
                                                    tt={tt}
                                                    network={network}
                                                    locale={locale}
                                                    marketData={marketData ?? undefined}
                                                    dt={dt as DashboardDict | undefined}
                                                />
                                            </React.Suspense>
                                        )}

                                        {/* ── TOKENS ── */}
                                        {activeTab === 'tokens' && (
                                            <AccountTokensTab
                                                address={address}
                                                entityData={entityData ?? null}
                                                tt={tt}
                                                network={network as 'mainnet' | 'stokenet'}
                                                locale={locale}
                                                onCopy={onCopy}
                                                copiedAddress={copiedAddress}
                                            />
                                        )}

                                        {/* ── NFTS ── */}
                                        {activeTab === 'nfts' && (
                                            <AccountNftsTab
                                                address={address}
                                                entityData={entityData ?? null}
                                                tt={tt}
                                                network={network as 'mainnet' | 'stokenet'}
                                                locale={locale}
                                                onCopy={onCopy}
                                                copiedAddress={copiedAddress}
                                            />
                                        )}

                                        {/* ── POOL UNITS ── */}
                                        {activeTab === 'pool_units' && (
                                            <AccountPoolUnitsTab
                                                address={address}
                                                entityData={entityData ?? null}
                                                tt={tt}
                                                network={network as 'mainnet' | 'stokenet'}
                                                locale={locale}
                                                onCopy={onCopy}
                                                copiedAddress={copiedAddress}
                                            />
                                        )}

                                        {/* ── TRANSACTIONS ── */}
                                        {activeTab === 'transactions' && (
                                            <AccountTransactionsTab
                                                accountAddress={clean}
                                                network={network as 'mainnet' | 'stokenet'}
                                                tt={tt}
                                                locale={locale}
                                            />
                                        )}

                                        {/* ── METADATA ── */}
                                        {activeTab === 'metadata' && (
                                            <PanelMetadataTab
                                                metadataItems={(() => {
                                                    // For validators, the pool unit resource address is in details.state
                                                    const details = entityData?.details as { state?: { pool_unit_resource_address?: string } } | undefined;
                                                    const poolResourceAddr = address.startsWith('validator_') ? details?.state?.pool_unit_resource_address : undefined;

                                                    if (poolResourceAddr) {
                                                        return [
                                                            ...metadataItems,
                                                            {
                                                                key: 'pool_resources',
                                                                value: {
                                                                    typed: {
                                                                        type: 'String',
                                                                        value: poolResourceAddr
                                                                    }
                                                                }
                                                            } as MetadataItem
                                                        ];
                                                    }
                                                    return metadataItems;
                                                })()}
                                                tt={tt}
                                                onCopy={onCopy}
                                                copiedAddress={copiedAddress}
                                            />
                                        )}

                                        {/* ── CONFIGURATION ── */}
                                        {activeTab === 'configuration' && (
                                            <PanelConfigurationTab
                                                configEntries={configEntries}
                                                tt={tt}
                                                onCopy={onCopy}
                                                copiedAddress={copiedAddress}
                                            />
                                        )}

                                        {/* ── RAW ── */}
                                        {activeTab === 'raw' && (
                                            <PanelRawTab
                                                data={entityData}
                                                tt={tt}
                                                onCopy={onCopy}
                                                copiedAddress={copiedAddress}
                                            />
                                        )}
                                    </>
                            </div>
                        </div>
                    </m.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ─── Summary Sub-Component ─────────────────────── */

function EntitySummaryTab({
    address,
    entityData,
    entityName,
    iconUrl,
    metadataItems,
    getMeta,
    tt,
    onCopy,
    copiedAddress,
    onResourceClick,
    locale,
    network,
    dt,
    stakeAmount: _stakeAmount,
    unstakeAmount: _unstakeAmount,
    claimAmount: _claimAmount,
}: {
    address: string;
    entityData: GatewayEntityDetails | null;
    entityName: string | null | undefined;
    iconUrl: string | null | undefined;
    metadataItems: MetadataItem[];
    getMeta: (key: string) => string;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    locale: string;
    network: Network;
    marketData?: MarketData | null;
    dt?: Partial<DashboardDict>;
    stakeAmount?: number;
    unstakeAmount?: number;
    claimAmount?: number;
    unstakes?: { amount: number; epoch: number }[];
    currentEpoch?: number;
}) {
    const qc = useQueryClient();
    const entityType = getEntityDetailType(entityData, address);
    const description = getMeta('description');
    const infoUrl = getMeta('info_url');
    const symbol = getMeta('symbol');
    const tagsMeta = metadataItems.find((m) => m.key === 'tags');
    const tags = tagsMeta ? parseTags(tagsMeta) : [];

    const poolUnit = metadataItems.find((m) => m.key === 'pool_unit')?.value?.typed?.value || (entityData?.details?.state as Record<string, unknown> | undefined)?.pool_unit_resource_address as string | undefined;
    const poolVaultNumber = metadataItems.find((m) => m.key === 'pool_vault_number')?.value?.typed?.value;
    const poolResourcesItems = entityData?.fungible_resources?.items;
    const poolResourcesMeta = metadataItems.find((m) => m.key === 'pool_resources')?.value?.typed;
    const poolResourcesBackup: string[] = poolResourcesMeta?.values || (poolResourcesMeta?.value ? [poolResourcesMeta.value] : []);

    const blueprintName = entityData?.details?.blueprint_name;
    const blueprintVersion = entityData?.details?.blueprint_version;
    const packageAddress = entityData?.details?.package_address;

    // Resource-specific fields
    const divisibility = entityData?.details?.divisibility;
    const totalSupply = entityData?.details?.total_supply;
    const totalMinted = entityData?.details?.total_minted;
    const totalBurned = entityData?.details?.total_burned;

    // Clickable resource address
    const isClickable = !!onResourceClick && (
        address.startsWith('resource_') ||
        address.startsWith('account_') ||
        address.startsWith('component_') ||
        address.startsWith('package_')
    );

    return (
        <div>
            {/* Header with icon + name */}
            {!address.startsWith('pool_') && !address.startsWith('validator_') && (
                <>
                    <div className="flex items-center gap-3 mb-3">
                        {iconUrl && (
                            <div className="size-9 rounded-xl overflow-hidden border border-[var(--color-card-border)] shrink-0 bg-[var(--color-surface)]">
                                <SafeImage
                                    src={iconUrl}
                                    alt={entityName || address}
                                    fallbackName={entityName || address}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        )}
                        <div className="min-w-0">
                            {entityName && (
                                <p className="font-bold text-sm text-[var(--color-text-main)] truncate">
                                    {entityName}
                                    {symbol && (
                                        <span className="ml-1.5 text-[var(--color-text-muted)] font-mono text-xs">
                                            ({symbol})
                                        </span>
                                    )}
                                </p>
                            )}
                            {!entityName && entityData?.details?.blueprint_name && (
                                <p className="text-[10px] font-semibold text-[var(--color-primary)] mt-1 mb-0.5">
                                    {entityData.details.blueprint_name}
                                </p>
                            )}
                            <div className="flex items-center gap-1 mt-0.5">
                                <span
                                    className={`text-[10px] font-mono text-[var(--color-text-muted)] ${address.startsWith('pool_') ? 'break-all' : 'truncate max-w-[200px]'} ${isClickable ? 'cursor-pointer hover:text-[var(--color-primary)] transition-colors' : ''}`}
                                    title={address}
                                    onClick={() => isClickable && onResourceClick?.(address)}
                                >
                                    {address.startsWith('pool_') ? address : `${address.slice(0, 14)}...${address.slice(-6)}`}
                                </span>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onCopy(address); }}
                                    className={`p-0.5 rounded transition-colors ${copiedAddress === address ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                >
                                    {copiedAddress === address ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-[var(--color-card-border)] mb-3" />
                </>
            )}
            {/* Description */}
            {!address.startsWith('pool_') && !address.startsWith('validator_') && description && (
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-3 italic border-l-2 border-[var(--color-primary)]/30 pl-3">
                    {description}
                </p>
            )}

            {/* Detail rows */}
            <dl className="space-y-2.5">
                {/* Type */}
                {!address.startsWith('validator_') && (
                    <SummaryInlineRow
                        label={tt?.resource_panel_type || 'Type'}
                        value={entityType.replace(/_/g, ' ')}
                    />
                )}

                {/* Parent Package */}
                {packageAddress && !address.startsWith('validator_') && (
                    <SummaryInlineRow label={tt?.resource_panel_package || 'Parent Package'}>
                        <div className="flex items-center gap-1">
                            <span className="text-xs font-mono text-[var(--color-text-main)] truncate max-w-[120px] sm:max-w-none" title={packageAddress}>
                                {packageAddress.length > 20 ? `${packageAddress.slice(0, 12)}...${packageAddress.slice(-6)}` : packageAddress}
                            </span>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onCopy(packageAddress); }}
                                className={`p-0.5 rounded transition-colors ${copiedAddress === packageAddress ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                            >
                                {copiedAddress === packageAddress ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
                            </button>
                        </div>
                    </SummaryInlineRow>
                )}

                {/* Blueprint Name */}
                {blueprintName && !address.startsWith('validator_') && (
                    <SummaryInlineRow
                        label={tt?.resource_panel_blueprint || 'Blueprint'}
                        value={blueprintName}
                    />
                )}

                {/* Blueprint Version */}
                {blueprintVersion && !address.startsWith('validator_') && (
                    <SummaryInlineRow
                        label={tt?.resource_panel_blueprint_version || 'Blueprint Version'}
                        value={blueprintVersion}
                    />
                )}

                {/* Validator Metrics & Technical Info */}
                {(() => {
                    if (!address.startsWith('validator_')) return null;
                    const validatorsData = qc.getQueryData<{ validators: import('@/types/radix').Validator[] }>(['validators', network]);
                    const validator = validatorsData?.validators?.find((v) => v.address === address);
                    if (!validator) return null;


                    return (
                        <ValidatorSummaryMetrics
                            validator={validator}
                            address={address}
                            onCopy={onCopy}
                            copiedAddress={copiedAddress}
                            locale={locale}
                            dt={dt as DashboardDict | undefined}
                            isModal={true}
                        />
                    );
                })()}

                {/* Pool Unit */}
                {poolUnit && !address.startsWith('validator_') && (
                    <SummaryInlineRow label="Pool Unit">
                        <div className="flex items-center gap-1">
                            <span className="text-xs font-mono text-[var(--color-text-main)] truncate max-w-[120px] sm:max-w-none" title={poolUnit}>
                                {poolUnit.length > 20 ? `${poolUnit.slice(0, 12)}...${poolUnit.slice(-6)}` : poolUnit}
                            </span>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onCopy(poolUnit); }}
                                className={`p-0.5 rounded transition-colors ${copiedAddress === poolUnit ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                            >
                                {copiedAddress === poolUnit ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
                            </button>
                        </div>
                    </SummaryInlineRow>
                )}

                {/* Pool Vault Number */}
                {poolVaultNumber && (
                    <SummaryInlineRow label="Pool Vault Number" value={String(poolVaultNumber)} />
                )}

                {/* Resource-only fields */}
                {divisibility !== undefined && divisibility !== null && (
                    <SummaryInlineRow
                        label={tt?.resource_panel_divisibility || 'Divisibility'}
                        value={String(divisibility)}
                    />
                )}
                {totalSupply !== undefined && totalSupply !== null && (
                    <SummaryInlineRow
                        label={tt?.resource_panel_total_supply || 'Total Supply'}
                        value={formatNumber(Number(totalSupply), 2, locale)}
                        mono
                    />
                )}
                {totalMinted !== undefined && totalMinted !== null && Number(totalMinted) > 0 && (
                    <SummaryInlineRow
                        label={tt?.resource_panel_total_minted || 'Total Minted'}
                        value={formatNumber(Number(totalMinted), 2, locale)}
                        mono
                    />
                )}
                {totalBurned !== undefined && totalBurned !== null && Number(totalBurned) > 0 && (
                    <SummaryInlineRow
                        label={tt?.resource_panel_total_burned || 'Total Burned'}
                        value={formatNumber(Number(totalBurned), 2, locale)}
                        mono
                    />
                )}

                {/* Info URL */}
                {infoUrl && !address.startsWith('validator_') && (
                    <SummaryInlineRow label={tt?.meta_key_info_url || 'Website'}>
                        <a
                            href={infoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--color-primary)] hover:underline"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {infoUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </a>
                    </SummaryInlineRow>
                )}

                {/* Multi-item fields (Vertical format) */}

                {/* Pool Resources */}
                {poolResourcesItems && poolResourcesItems.length > 0 && !address.startsWith('validator_') ? (
                    <div className="flex flex-col gap-1">
                        <dt className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-1">
                            Pool Resources
                        </dt>
                        <dd className="grid grid-cols-3 gap-x-2 gap-y-3 flex-1 pl-4 pt-1">
                            {poolResourcesItems.map((item) => {
                                const resName = item.explicit_metadata?.items?.find((m) => m.key === 'name')?.value?.typed?.value || 'Unknown';
                                const resIcon = item.explicit_metadata?.items?.find((m) => m.key === 'icon_url')?.value?.typed?.value;
                                const resAddr = item.resource_address;
                                return (
                                    <div key={resAddr} className="flex flex-col gap-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            {resIcon && (
                                                <SafeImage src={resIcon} alt={resName} fallbackName={resName} className="size-5 rounded-lg object-cover bg-white/10 shrink-0" />
                                            )}
                                            <span className="text-[10px] text-[var(--color-text-main)] truncate" title={resName}>{resName}</span>
                                        </div>
                                        <div className="flex items-center gap-1 pl-4 pt-0.5 min-w-0 overflow-hidden">
                                            <span className="text-[9px] font-mono text-[var(--color-text-muted)] truncate" title={resAddr}>
                                                {resAddr.length > 16 ? `${resAddr.slice(0, 16)}...${resAddr.slice(-4)}` : resAddr}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); onCopy(resAddr); }}
                                                className={`p-0.5 rounded transition-colors shrink-0 ${copiedAddress === resAddr ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                            >
                                                {copiedAddress === resAddr ? <Check className="size-2" /> : <Copy className="size-2" />}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </dd>
                    </div>
                ) : poolResourcesBackup.length > 0 && !address.startsWith('validator_') ? (
                    <div className="flex flex-col gap-1">
                        <dt className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
                            Pool Resources
                        </dt>
                        <dd className="grid grid-cols-3 gap-x-2 gap-y-1 flex-1 pl-4 pt-1">
                            {poolResourcesBackup.map((resAddr) => (
                                <div key={resAddr} className="flex items-center gap-1">
                                    <span className="text-[10px] font-mono text-[var(--color-text-main)]" title={resAddr}>
                                        {resAddr.length > 16 ? `${resAddr.slice(0, 8)}...${resAddr.slice(-4)}` : resAddr}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onCopy(resAddr); }}
                                        className={`p-0.5 rounded transition-colors ${copiedAddress === resAddr ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                    >
                                        {copiedAddress === resAddr ? <Check className="size-2" /> : <Copy className="size-2" />}
                                    </button>
                                </div>
                            ))}
                        </dd>
                    </div>
                ) : null}

                {/* Tags */}
                {tags.length > 0 && !address.startsWith('validator_') && (
                    <div className="flex flex-col gap-1">
                        <dt className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)]">
                            {tt?.resource_panel_tags || 'Tags'}
                        </dt>
                        <dd className="flex flex-wrap gap-1 pl-4 pt-1">
                            {tags.map((tag) => (
                                <Pill key={tag}>{tag}</Pill>
                            ))}
                        </dd>
                    </div>
                )}
            </dl>
        </div>
    );
}





/**
 * Helper row for metadata summary
 */
// SummaryInlineRow removed - now imported from EntityPanelShared
