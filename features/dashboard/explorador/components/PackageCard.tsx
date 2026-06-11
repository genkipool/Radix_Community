'use client';
import React, { useState, useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { entityKeys } from '@/features/dashboard/utils/entityCache';
import { Package } from 'lucide-react';
import { SafeImage } from '@/components/ui/SafeImage';
import type { AccountCardProps } from '../types/components.types';
import { EntitySummaryTab, getTabsForEntity } from './ExpandableEntityBadge';
import {
    PanelTabBar,
    PanelMetadataTab,
    PanelConfigurationTab,
    PanelRawTab,
} from './EntityPanelShared';
import { getConfigEntries } from '../../utils/resourceUtils';

import { Card } from '@/components/ui/Card';
import { CloseButton } from '@/components/ui/CloseButton';
import { CopyButton } from '@/components/ui/CopyButton';

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
    const isVertical = false; // PackageCard uses a horizontal layout internally like AccountCard
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

    const isCopied = copiedAddress === address;

    const [activeTab, setActiveTab] = useState<'summary' | 'metadata' | 'configuration' | 'raw'>('summary');

    const tabs = getTabsForEntity(address, tt);
    const ra = (entityData?.details as Record<string, unknown>)?.role_assignments;
    const configEntries = getConfigEntries(ra, tt);

    return (
        <Card
            onClick={(!isModal && onExpand) ? () => onExpand?.(address) : undefined}
            className={`p-0 shadow-md transition-all duration-300 group ${(!isModal && onExpand) ? 'cursor-pointer' : 'cursor-default'} overflow-hidden col-span-full border border-[var(--color-accent)]/30 ${isModal ? 'bg-[var(--color-bg)] h-full flex flex-col' : 'bg-[var(--color-surface)]'} ${isExpanded ? 'ring-2 ring-[var(--color-primary)]' : 'hover:shadow-lg'}`}
            innerClassName={isModal ? "flex flex-col h-full min-h-0 flex-1" : ""}
        >
            <div className={`flex ${isVertical ? 'flex-col' : 'flex-col sm:flex-row'} shrink-0`}>
                {/* ── AVATAR / SIDEBAR (Matching AccountCard/TransactionCard) ── */}
                <div aria-hidden="true"
                    className={`${isVertical ? 'w-full p-3' : 'w-full sm:w-[140px] p-4 sm:p-6 border-r'} shrink-0 border-b sm:border-b-0 border-[var(--color-card-border)] bg-[var(--color-surface)] flex flex-row ${isVertical ? 'justify-between' : 'sm:flex-col'} items-center gap-3 text-center relative overflow-hidden cursor-pointer self-stretch justify-center`}>
                    <div className="absolute top-0 inset-x-0 h-1/2 opacity-10" style={{ background: `radial-gradient(circle at top, var(--color-accent), transparent)` }} />
                    <div className="relative z-10 p-3 sm:p-4 rounded-2xl border-2 shadow-lg bg-[var(--color-bg)] transition-all duration-300 flex items-center justify-center border-[var(--color-accent)]" style={{ boxShadow: `0 0 15px var(--color-accent)30` }}>
                        {iconUrl ? (
                            <SafeImage src={iconUrl} alt={name || 'Package'} fallbackName={name || 'Package'} className="size-8 object-cover rounded-xl" />
                        ) : (
                            <Package className="size-8" style={{ color: 'var(--color-accent)' }} />
                        )}
                    </div>
                </div>

                {/* ── MAIN CONTENT ── */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className={`${isVertical ? 'p-3 pt-4' : 'p-5'} flex-1 min-w-0`}>
                        {/* Header: Address + Close Button */}
                        <div className={`flex items-start justify-between gap-4 mb-3 sm:flex-nowrap`}>
                            <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center gap-2 overflow-hidden shrink min-w-0 pr-2">
                                    <h3 className={`${isVertical ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'} font-mono font-black text-[var(--color-text-main)] group-hover:text-[var(--color-secondary)] transition-colors truncate flex items-center gap-1.5 sm:gap-2 mr-2`}
                                        title={address}>
                                        <span className="truncate">{address}</span>
                                    </h3>
                                    <CopyButton
                                        value={address}
                                        variant="card-inline"
                                        size="sm"
                                        forceCopied={isCopied}
                                        onClick={(e) => { e.stopPropagation(); onCopy(address); }}
                                        className="shrink-0"
                                    />
                                </div>
                            </div>
                            <div className="shrink-0 flex items-center mt-1 sm:mt-0 gap-3">
                                {isModal && onExpand && (
                                    <CloseButton
                                        onClose={() => onExpand?.(address)}
                                        title={t?.dashboard?.reading?.close || 'Close'}
                                        iconSize={20}
                                        className="shrink-0 ml-1"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Stats Rows - 5 grid items corresponding to package main info */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4 text-sm mt-3 items-center">
                            <div className="col-span-2 sm:col-span-2">
                                <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold truncate flex items-center gap-1">
                                    {tt?.resource_panel_summary || 'Name'}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold font-mono text-[var(--color-accent)] truncate">
                                        {name || tt?.entity_type_package || 'Package'}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold truncate flex items-center gap-1">
                                    {tt?.resource_panel_type || 'Type'}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-[var(--color-secondary)] font-mono">
                                        {tt?.entity_type_package || 'Package'}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold truncate flex items-center gap-1">
                                    dApp
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-[var(--color-primary)] font-mono">
                                        {dAppDefinition ? 'Linked' : 'No'}
                                    </span>
                                </div>
                            </div>
                            <div className="col-span-2 sm:col-span-5 mt-2">
                                <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold truncate flex items-center gap-1">
                                    {tt?.resource_panel_blueprint || 'Description'}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-[var(--color-text-main)] line-clamp-1">
                                        {description || '-'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Expanded Content (Modal Only) ── */}
            {isModal && (
                <div className="flex-1 flex flex-col min-h-0 bg-[var(--color-bg)]">
                    <div className="border-b border-t border-[var(--color-card-border)] bg-[var(--color-surface)] shrink-0">
                        <PanelTabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab as (tab: string) => void} layoutId={`pkgTabs-${instanceId}`} />
                    </div>

                    <div className="p-4 sm:p-6 min-h-[300px] overflow-y-auto flex-1">
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
                </div>
            )}
        </Card>
    );
}
