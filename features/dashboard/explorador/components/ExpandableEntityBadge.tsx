'use client';

/**
 * ExpandableEntityBadge.tsx
 *
 * Wraps the existing EntityBadge visual with expand/collapse behaviour.
 * When expanded, shows tabbed detail panels (Summary, Metadata,
 * Configuration, Raw) for the entity, fetched lazily from the Gateway.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Check, Copy, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
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
    PanelTabBar,
    PanelLoadingState,
    PanelMetadataTab,
    PanelConfigurationTab,
    PanelRawTab,
} from './EntityPanelShared';
import { AccountSummaryTab } from './AccountSummaryTab';
import {
    AccountRewardsCsvModal
} from './AccountRewardsCsvModal';
import { usePrefetchRewards } from '@/features/dashboard/hooks/usePrefetchRewards';
import { AccountTokensTab, AccountNftsTab, AccountPoolUnitsTab } from './AccountAssetsTabs';
import { AccountTransactionsTab } from './AccountTransactionsTab';
import type {
    MetadataItem,
    MarketData,
    TranslationsT,
    Network,
    GatewayEntityDetails
} from '@/features/dashboard/types';
import { formatNumber } from '@/utils/formatters';
import type { AccountRewardsCsvModalDict } from '../types/components.types';

/* ─── Types ─────────────────────────────────────────── */
type EntityTab = 'summary' | 'tokens' | 'nfts' | 'pool_units' | 'transactions' | 'metadata' | 'configuration' | 'raw';

interface ExpandableEntityBadgeProps {
    address: string;
    tt: TranslationsT['dashboard']['transactions'] & { account_summary?: AccountRewardsCsvModalDict };
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    network: Network;
    locale?: string;
    marketData?: MarketData | null;
}

/* ─── Helpers ───────────────────────────────────────── */

/** Determines which tabs to show based on entity prefix */
function getTabsForEntity(
    prefix: string,
    tt: TranslationsT['dashboard']['transactions'] & { account_summary?: AccountRewardsCsvModalDict },
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
}: ExpandableEntityBadgeProps) {
    const [expanded, setExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<EntityTab>('summary');
    const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
    const { prefetchAccountRewards } = usePrefetchRewards();

    const isAccountAddr = address.startsWith('account_');

    const clean = sanitizeText(address);
    const { label, color, bg } = getEntityType(clean, tt);
    const meta = useEntityData(clean, network);
    const entityName = meta?.name;
    const iconUrl = meta?.iconUrl;
    const short = clean.length > 20 ? `${clean.slice(0, 12)}...${clean.slice(-6)}` : clean;

    const wellKnownKey = getWellKnownKey(clean, network);
    const genericKey = !wellKnownKey ? getGenericTooltipKey(clean) : null;
    const wellKnownTip = wellKnownKey
        ? tt.well_known_tooltips?.[wellKnownKey as keyof typeof tt.well_known_tooltips]
        : genericKey
            ? tt.type_tooltips?.[genericKey as keyof typeof tt.type_tooltips]
            : null;

    // Lazy fetch — only when expanded (eager for pools)
    const { data: entityData, isLoading } = useQuery<GatewayEntityDetails | null>({
        queryKey: entityKeys.full(clean, network),
        queryFn: () => apiFetchEntityDetails(clean, network as 'mainnet' | 'stokenet'),
        enabled: expanded || clean.startsWith('pool_'),
        staleTime: Infinity,
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

    /* ── Click handler (prevents text selection from collapsing) ── */
    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.getSelection()?.toString()) return;
        setExpanded((v) => !v);
    };

    return (
        <div className={`rounded-xl border ${bg} overflow-hidden transition-shadow ${expanded ? 'shadow-lg shadow-black/10' : ''}`}>
            {/* ── Clickable header ─────────────────────── */}
            <div
                className="flex items-center justify-between gap-2 p-2.5 cursor-pointer hover:bg-white/5 transition-colors group/entity"
                onClick={handleToggle}
            >
                <div className="flex items-center gap-2 min-w-0">
                    {iconUrl && (
                        <SafeImage
                            src={iconUrl}
                            alt={entityName || 'Token'}
                            fallbackName={entityName || 'Token'}
                            className="w-6 h-6 rounded-full bg-white/10 shadow-sm border border-[var(--color-card-border)] shrink-0"
                        />
                    )}
                    <span
                        className={`text-[9px] uppercase font-black tracking-wider px-1.5 pt-[2px] pb-[1px] leading-none rounded ${bg} ${color} shrink-0 ${wellKnownTip ? 'cursor-help' : ''}`}
                        title={wellKnownTip ?? undefined}
                    >
                        {label}
                    </span>
                    <div className="min-w-0 flex-1 flex flex-col">
                        {clean.startsWith('pool_') && blueprintName ? (
                            <span className={`text-[11px] font-semibold truncate ${color}`}>
                                {blueprintName}
                            </span>
                        ) : entityName ? (
                            <span className={`text-[11px] font-semibold truncate ${color}`}>
                                {entityName}
                            </span>
                        ) : null}
                        <span
                            className={`font-mono text-xs truncate ${(entityName || (clean.startsWith('pool_') && blueprintName)) ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-main)]'}`}
                            title={wellKnownTip || clean}
                        >
                            {short}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {isAccountAddr && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setIsCsvModalOpen(true); }}
                            onPointerEnter={() => prefetchAccountRewards(clean)}
                            className="p-1 rounded transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                            title={tt.account_summary?.download_rewards_tooltip || tt.account_summary?.download_account_rewards}
                        >
                            <Download className="w-3 h-3" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onCopy(clean); }}
                        className={`p-1 rounded transition-colors ${copiedAddress === clean
                            ? 'text-green-500'
                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-primary)]'
                            }`}
                        title="Copy address"
                    >
                        {copiedAddress === clean
                            ? <Check className="w-3 h-3" />
                            : <Copy className="w-3 h-3" />}
                    </button>
                    <ChevronDown
                        className={`w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform duration-200 ${expanded ? 'rotate-180 text-[var(--color-primary)]' : ''}`}
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
                    tt={tt.account_summary}
                    marketData={marketData}
                />
            )}

            {/* ── Expandable panel ────────────────────── */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                    >
                        <div
                            className="border-t border-[var(--color-card-border)] bg-[var(--color-surface)]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <PanelTabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

                            <div className="px-4 py-3">
                                {isLoading ? (
                                    <PanelLoadingState tt={tt} />
                                ) : (
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
                                                    marketData={marketData}
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
                                                />
                                            )
                                        )}

                                        {/* ── TOKENS ── */}
                                        {activeTab === 'tokens' && (
                                            <AccountTokensTab
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
                                            <PanelMetadataTab metadataItems={metadataItems} tt={tt} />
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
                                )}
                            </div>
                        </div>
                    </motion.div>
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
}: {
    address: string;
    entityData: GatewayEntityDetails | null;
    entityName: string | null | undefined;
    iconUrl: string | null | undefined;
    metadataItems: MetadataItem[];
    getMeta: (key: string) => string;
    tt: TranslationsT['dashboard']['transactions'];
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    locale: string;
}) {
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
            {!address.startsWith('pool_') && (
                <>
                    <div className="flex items-center gap-3 mb-3">
                        {iconUrl && (
                            <div className="w-9 h-9 rounded-xl overflow-hidden border border-[var(--color-card-border)] shrink-0 bg-[var(--color-surface)]">
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
                            {entityData?.details?.blueprint_name && (
                                <div className="inline-block bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] text-[10px] font-semibold px-2 py-0.5 rounded mt-1 mb-0.5 select-none">
                                    {entityData.details.blueprint_name}
                                </div>
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
                                    onClick={(e) => { e.stopPropagation(); onCopy(address); }}
                                    className={`p-0.5 rounded transition-colors ${copiedAddress === address ? 'text-green-500' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                >
                                    {copiedAddress === address ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-[var(--color-card-border)] mb-3" />
                </>
            )}
            {/* Description */}
            {!address.startsWith('pool_') && description && (
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-3 italic border-l-2 border-[var(--color-primary)]/30 pl-3">
                    {description}
                </p>
            )}

            {/* Detail rows */}
            <dl className="space-y-2.5">
                {/* Type */}
                <SummaryRow
                    label={tt?.resource_panel_type || 'Type'}
                    value={entityType.replace(/_/g, ' ')}
                />

                {/* Parent Package */}
                {packageAddress && (
                    <div className="flex items-start justify-between gap-4">
                        <dt className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] shrink-0 pt-0.5">
                            Parent Package
                        </dt>
                        <dd className="flex items-center gap-1">
                            <span className="text-xs font-mono font-semibold text-[var(--color-text-main)] break-all text-right" title={packageAddress}>
                                {packageAddress}
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); onCopy(packageAddress); }}
                                className={`p-0.5 rounded transition-colors ${copiedAddress === packageAddress ? 'text-green-500' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                            >
                                {copiedAddress === packageAddress ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                            </button>
                        </dd>
                    </div>
                )}

                {/* Blueprint Name */}
                {blueprintName && (
                    <SummaryRow label="Blueprint Name" value={blueprintName} />
                )}

                {/* Blueprint Version */}
                {blueprintVersion && (
                    <SummaryRow label="Blueprint Version" value={blueprintVersion} />
                )}

                {/* Pool Unit */}
                {poolUnit && (
                    <div className="flex items-start justify-between gap-4">
                        <dt className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] shrink-0 pt-0.5">
                            Pool Unit
                        </dt>
                        <dd className="flex items-center gap-1">
                            <span className="text-xs font-mono font-semibold text-[var(--color-text-main)] break-all text-right" title={poolUnit}>
                                {poolUnit}
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); onCopy(poolUnit); }}
                                className={`p-0.5 rounded transition-colors ${copiedAddress === poolUnit ? 'text-green-500' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                            >
                                {copiedAddress === poolUnit ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                            </button>
                        </dd>
                    </div>
                )}

                {/* Pool Resources */}
                {poolResourcesItems && poolResourcesItems.length > 0 ? (
                    <div className="flex items-start justify-between gap-4">
                        <dt className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] shrink-0 pt-0.5">
                            Pool Resources
                        </dt>
                        <dd className="flex flex-col items-end gap-2 flex-1">
                            {poolResourcesItems.map((item) => {
                                const resName = item.explicit_metadata?.items?.find((m) => m.key === 'name')?.value?.typed?.value || 'Unknown';
                                const resIcon = item.explicit_metadata?.items?.find((m) => m.key === 'icon_url')?.value?.typed?.value;
                                const resAddr = item.resource_address;
                                return (
                                    <div key={resAddr} className="flex flex-col items-end gap-1 mb-2 last:mb-0 w-full min-w-0">
                                        <div className="flex items-center justify-end gap-2 w-full">
                                            {resIcon && (
                                                <SafeImage src={resIcon} alt={resName} fallbackName={resName} className="w-6 h-6 rounded-lg object-cover bg-white/10 shrink-0" />
                                            )}
                                            <span className="font-bold text-xs text-[var(--color-text-main)]">{resName}</span>
                                        </div>
                                        <div className="flex items-center justify-end gap-1 w-full">
                                            <span className="text-[10px] font-mono text-[var(--color-text-muted)] break-all text-right flex-1" title={resAddr}>
                                                {resAddr}
                                            </span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onCopy(resAddr); }}
                                                className={`p-0.5 rounded transition-colors shrink-0 ${copiedAddress === resAddr ? 'text-green-500' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                            >
                                                {copiedAddress === resAddr ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </dd>
                    </div>
                ) : poolResourcesBackup.length > 0 ? (
                    <div className="flex items-start justify-between gap-4">
                        <dt className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] shrink-0 pt-0.5">
                            Pool Resources
                        </dt>
                        <dd className="flex flex-col items-end gap-1 flex-1">
                            {poolResourcesBackup.map((resAddr) => (
                                <div key={resAddr} className="flex items-center gap-1">
                                    <span className="text-xs font-mono font-semibold text-[var(--color-text-main)] break-all text-right" title={resAddr}>
                                        {resAddr}
                                    </span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onCopy(resAddr); }}
                                        className={`p-0.5 rounded transition-colors ${copiedAddress === resAddr ? 'text-green-500' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                    >
                                        {copiedAddress === resAddr ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                                    </button>
                                </div>
                            ))}
                        </dd>
                    </div>
                ) : null}

                {/* Pool Vault Number */}
                {poolVaultNumber && (
                    <div className="flex items-start justify-between gap-4">
                        <dt className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] shrink-0 pt-0.5">
                            Pool Vault Number
                        </dt>
                        <dd className="text-xs font-semibold text-[var(--color-text-main)]">
                            {poolVaultNumber}
                        </dd>
                    </div>
                )}

                {/* Resource-only fields */}
                {divisibility !== undefined && divisibility !== null && (
                    <SummaryRow
                        label={tt?.resource_panel_divisibility || 'Divisibility'}
                        value={String(divisibility)}
                    />
                )}
                {totalSupply !== undefined && totalSupply !== null && (
                    <SummaryRow
                        label={tt?.resource_panel_total_supply || 'Total Supply'}
                        value={formatNumber(Number(totalSupply), 2, locale)}
                        mono
                    />
                )}
                {totalMinted !== undefined && totalMinted !== null && Number(totalMinted) > 0 && (
                    <SummaryRow
                        label={tt?.resource_panel_total_minted || 'Total Minted'}
                        value={formatNumber(Number(totalMinted), 2, locale)}
                        mono
                    />
                )}
                {totalBurned !== undefined && totalBurned !== null && Number(totalBurned) > 0 && (
                    <SummaryRow
                        label={tt?.resource_panel_total_burned || 'Total Burned'}
                        value={formatNumber(Number(totalBurned), 2, locale)}
                        mono
                    />
                )}

                {/* Info URL */}
                {infoUrl && (
                    <div className="flex items-start justify-between gap-4">
                        <dt className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] shrink-0">
                            {tt?.meta_key_info_url || 'Website'}
                        </dt>
                        <dd className="text-xs text-right">
                            <a
                                href={infoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--color-primary)] hover:underline"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {infoUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                            </a>
                        </dd>
                    </div>
                )}

                {/* Underlying Tokens (Pool only) */}
                {address.startsWith('pool_') && entityData?.fungible_resources?.items && entityData.fungible_resources.items.length > 0 && (
                    <div className="flex items-start justify-between gap-4">
                        <dt className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] shrink-0 pt-0.5">
                            {tt?.account_summary?.contributed_tokens || 'Underlying Tokens'}
                        </dt>
                        <dd className="flex flex-col items-end gap-1 flex-1">
                            {entityData.fungible_resources.items.map((ft: { resource_address: string }) => (
                                <div key={ft.resource_address} className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[10px] font-mono text-[var(--color-text-muted)] truncate max-w-[120px] sm:max-w-[200px]" title={ft.resource_address}>
                                        {ft.resource_address.slice(0, 10)}...{ft.resource_address.slice(-6)}
                                    </span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onCopy(ft.resource_address); }}
                                        className={`p-0.5 rounded transition-colors ${copiedAddress === ft.resource_address ? 'text-green-500' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                    >
                                        {copiedAddress === ft.resource_address ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                                    </button>
                                </div>
                            ))}
                        </dd>
                    </div>
                )}

                {/* Tags */}
                {tags.length > 0 && (
                    <div className="flex items-start justify-between gap-4">
                        <dt className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] shrink-0">
                            {tt?.resource_panel_tags || 'Tags'}
                        </dt>
                        <dd className="flex flex-wrap gap-1 justify-end">
                            {tags.map((tag, i) => (
                                <Pill key={i}>{tag}</Pill>
                            ))}
                        </dd>
                    </div>
                )}
            </dl>
        </div>
    );
}

/* ─── Small helper row ──────────────────────────── */
function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <dt className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] shrink-0">
                {label}
            </dt>
            <dd className={`text-xs font-semibold text-[var(--color-text-main)] capitalize ${mono ? 'font-mono' : ''}`}>
                {value}
            </dd>
        </div>
    );
}
