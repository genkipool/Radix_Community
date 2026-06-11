'use client';
import React, { useState, useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { entityKeys } from '@/features/dashboard/utils/entityCache';
import { Copy, Check, Package, Info, ShieldAlert } from 'lucide-react';
import { SafeImage } from '@/components/ui/SafeImage';
import type { AccountCardProps } from '../types/components.types';
import { m } from 'motion/react';
import { EntitySummaryTab, getTabsForEntity } from './ExpandableEntityBadge';
import {
    PanelTabBar,
    PanelMetadataTab,
    PanelConfigurationTab,
    PanelRawTab,
} from './EntityPanelShared';
import { getConfigEntries } from '../../utils/resourceUtils';

export function PackageCard({
    address,
    columns: _columns,
    isExpanded,
    onExpand,
    onCopy,
    copiedAddress,
    t,
    network,
    locale,
    marketData: _marketData,
    readingMode: _readingMode,
    isModal
}: AccountCardProps) {
    const tt = t?.dashboard?.transactions;
    const instanceId = useId();

    const { data: entityData, isLoading } = useQuery({
        queryKey: entityKeys.detail(address, network),
        queryFn: () => apiFetchEntityDetails(address, network as 'mainnet' | 'stokenet'),
        enabled: true,
        staleTime: Infinity,
        gcTime: 10 * 60_000,
    });

    const metadataItems = entityData?.metadata?.items ?? [];
    const getMeta = (key: string) => metadataItems.find(m => m.key === key)?.value?.typed?.value ?? '';
    const name = getMeta('name');
    const description = getMeta('description');
    const iconUrl = getMeta('icon_url');
    const dAppDefinition = getMeta('dapp_definition');
    const claimedWebsites = metadataItems.find(m => m.key === 'claimed_websites')?.value?.typed?.values ?? [];

    const isCopied = copiedAddress === address;

    const [activeTab, setActiveTab] = useState<'summary' | 'metadata' | 'configuration' | 'raw'>('summary');

    const tabs = getTabsForEntity(address, tt);
    const ra = (entityData?.details as Record<string, unknown>)?.role_assignments;
    const configEntries = getConfigEntries(ra, tt);

    // Collapsed state
    if (!isExpanded && !isModal) {
        return (
            <m.div
                layoutId={`entityCard-${address}`}
                className="bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-2xl overflow-hidden flex flex-col sm:flex-row hover:border-[var(--color-primary)]/50 transition-colors cursor-pointer min-h-[140px]"
                onClick={() => onExpand(address)}
            >
                <div className="flex-1 p-5 flex flex-col justify-center">
                    <div className="flex items-start gap-4">
                        <div className="size-12 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] shrink-0 flex items-center justify-center overflow-hidden">
                            {iconUrl ? (
                                <SafeImage src={iconUrl} alt={name || 'Package'} className="w-full h-full object-cover" />
                            ) : (
                                <Package className="size-6 text-[var(--color-text-muted)]" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-[var(--color-text-main)] truncate mb-1">
                                {name || tt?.entity_type_package || 'Package'}
                            </h3>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs font-mono text-[var(--color-text-muted)] truncate" title={address}>
                                    {address.slice(0, 12)}...{address.slice(-12)}
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onCopy(address); }}
                                    className={`p-1 rounded-md transition-colors ${isCopied ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface)]'}`}
                                >
                                    {isCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
                                </button>
                            </div>
                            
                            {description && (
                                <p className="text-sm text-[var(--color-text-muted)] line-clamp-2 mb-3">
                                    {description}
                                </p>
                            )}

                            <div className="flex flex-wrap gap-2">
                                <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider bg-[var(--color-surface)] text-[var(--color-text-main)] rounded-md border border-[var(--color-card-border)]">
                                    {tt?.entity_type_package || 'Package'}
                                </span>
                                {dAppDefinition && (
                                    <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-md border border-[var(--color-primary)]/20 flex items-center gap-1">
                                        <ShieldAlert className="size-3" />
                                        dApp Linked
                                    </span>
                                )}
                                {claimedWebsites.length > 0 && (
                                    <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-500 rounded-md border border-blue-500/20 flex items-center gap-1">
                                        <Info className="size-3" />
                                        {claimedWebsites.length} Website{claimedWebsites.length !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </m.div>
        );
    }

    // Expanded state
    return (
        <m.div
            layoutId={`entityCard-${address}`}
            className="bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-2xl overflow-hidden flex flex-col shadow-2xl h-full"
        >
            <div className="border-b border-[var(--color-card-border)] bg-[var(--color-surface)]">
                <PanelTabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab as (tab: string) => void} layoutId={`pkgTabs-${instanceId}`} />
            </div>

            <div className="p-4 sm:p-6 min-h-[300px] overflow-y-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="size-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {activeTab === 'summary' && (
                            <EntitySummaryTab
                                address={address}
                                entityData={entityData ?? null}
                                entityName={name}
                                iconUrl={iconUrl}
                                metadataItems={metadataItems}
                                getMeta={getMeta}
                                tt={tt}
                                onCopy={onCopy}
                                copiedAddress={copiedAddress}
                                locale={locale}
                                network={network}
                            />
                        )}
                        {activeTab === 'metadata' && (
                            <PanelMetadataTab
                                metadataItems={metadataItems}
                                tt={tt}
                                onCopy={onCopy}
                                copiedAddress={copiedAddress}
                            />
                        )}
                        {activeTab === 'configuration' && (
                            <PanelConfigurationTab
                                configEntries={configEntries}
                                tt={tt}
                                onCopy={onCopy}
                                copiedAddress={copiedAddress}
                            />
                        )}
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
        </m.div>
    );
}
