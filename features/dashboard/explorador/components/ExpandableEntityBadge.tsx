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
import { AccountTokensTab, AccountNftsTab } from './AccountAssetsTabs';
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
type EntityTab = 'summary' | 'tokens' | 'nfts' | 'metadata' | 'configuration' | 'raw';

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
    tt: TranslationsT['dashboard']['transactions'],
): { key: EntityTab; label: string }[] {
    const base: { key: EntityTab; label: string }[] = [
        { key: 'summary', label: tt?.resource_panel_summary || 'Summary' },
    ];

    if (prefix.startsWith('account_')) {
        base.push({ key: 'tokens', label: tt?.account_summary?.tokens_tab || 'Tokens' });
        base.push({ key: 'nfts', label: tt?.account_summary?.nfts_tab || 'NFTs' });
    }

    base.push({ key: 'metadata', label: tt?.resource_panel_metadata || 'Metadata' });

    // Packages and identities don't have role_assignments typically
    const hasConfig = !prefix.startsWith('package_') && !prefix.startsWith('identity_');

    if (hasConfig) {
        base.push({ key: 'configuration', label: tt?.resource_panel_configuration || 'Configuration' });
    }

    base.push({ key: 'raw', label: tt?.resource_panel_raw || 'Raw' });
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

    // Lazy fetch — only when expanded
    const { data: entityData, isLoading } = useQuery<GatewayEntityDetails | null>({
        queryKey: entityKeys.full(clean, network),
        queryFn: () => apiFetchEntityDetails(clean, network as 'mainnet' | 'stokenet'),
        enabled: expanded,
        staleTime: Infinity,
        gcTime: 10 * 60_000,
        retry: 1,
        retryOnMount: false,
    });

    const metadataItems: MetadataItem[] = entityData?.metadata?.items ?? [];
    const getMeta = (key: string) => getMetaValue(metadataItems, key) ?? '';
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
                        className={`text-[9px] uppercase font-black tracking-wider px-1.5 pt-[2px] pb-[1px] leading-none rounded border ${bg} ${color} shrink-0`}
                    >
                        {label}
                    </span>
                    <div className="min-w-0 flex-1 flex flex-col">
                        {entityName && (
                            <span className={`text-[11px] font-semibold truncate ${color}`}>
                                {entityName}
                            </span>
                        )}
                        <span
                            className={`font-mono text-xs truncate ${entityName ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-main)]'}`}
                            title={clean}
                        >
                            {short}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
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
                    {isAccountAddr && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setIsCsvModalOpen(true); }}
                            onPointerEnter={() => prefetchAccountRewards(clean)}
                            className="p-1 rounded transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                            title={tt.account_summary?.download_account_rewards}
                        >
                            <Download className="w-3 h-3" />
                        </button>
                    )}
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
                                        {activeTab === 'tokens' && address.startsWith('account_') && (
                                            <AccountTokensTab
                                                entityData={entityData ?? null}
                                                tt={tt}
                                                onCopy={onCopy}
                                                copiedAddress={copiedAddress}
                                                network={network as 'mainnet' | 'stokenet'}
                                                locale={locale}
                                            />
                                        )}

                                        {/* ── NFTS ── */}
                                        {activeTab === 'nfts' && address.startsWith('account_') && (
                                            <AccountNftsTab
                                                entityData={entityData ?? null}
                                                tt={tt}
                                                onCopy={onCopy}
                                                copiedAddress={copiedAddress}
                                                network={network as 'mainnet' | 'stokenet'}
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
                                        {activeTab === 'raw' && <PanelRawTab data={entityData} />}
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
                    <div className="flex items-center gap-1 mt-0.5">
                        <span
                            className={`text-[10px] font-mono text-[var(--color-text-muted)] truncate max-w-[200px] ${isClickable ? 'cursor-pointer hover:text-[var(--color-primary)] transition-colors' : ''}`}
                            title={address}
                            onClick={() => isClickable && onResourceClick?.(address)}
                        >
                            {address.slice(0, 14)}...{address.slice(-6)}
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

            {/* Description */}
            {description && (
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-3 italic border-l-2 border-[var(--color-primary)]/30 pl-3">
                    {description}
                </p>
            )}

            <div className="border-t border-[var(--color-card-border)] mb-3" />

            {/* Detail rows */}
            <dl className="space-y-2.5">
                {/* Type */}
                <SummaryRow
                    label={tt?.resource_panel_type || 'Type'}
                    value={entityType.replace(/_/g, ' ')}
                />

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
