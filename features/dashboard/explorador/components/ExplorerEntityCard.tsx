'use client';
import React, { useState, useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';

import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { entityKeys } from '@/features/dashboard/utils/entityCache';
import type { GatewayEntityDetails, MetadataItem } from '@/features/dashboard/types';
import { SafeImage } from '@/components/ui/SafeImage';
import { Card } from '@/components/ui/Card';
import { CloseButton } from '@/components/ui/CloseButton';
import { CopyButton } from '@/components/ui/CopyButton';
import type { AccountCardProps } from '../types/components.types';
import { EntitySummaryTab, getTabsForEntity } from './ExpandableEntityBadge';
import { PanelTabBar, PanelMetadataTab, PanelConfigurationTab, PanelRawTab } from './EntityPanelShared';
import { getConfigEntries } from '../../utils/resourceUtils';

/** The colour a fact's value is drawn in. */
export type FactTone = 'accent' | 'secondary' | 'primary' | 'blue' | 'green' | 'danger' | 'main';

/** Colour only, for a value drawn outside the facts row (a status in a tile). */
export const STATUS_CLASS: Record<FactTone, string> = {
    accent: 'text-[var(--color-accent)]',
    secondary: 'text-[var(--color-secondary)]',
    primary: 'text-[var(--color-primary)]',
    blue: 'text-blue-500',
    green: 'text-green-500',
    danger: 'text-[var(--color-danger)]',
    main: 'text-[var(--color-text-main)]',
};

const TONE_CLASS: Record<FactTone, string> = {
    accent: 'font-mono text-[var(--color-accent)]',
    secondary: 'font-mono text-[var(--color-secondary)]',
    primary: 'font-mono text-[var(--color-primary)]',
    blue: 'font-mono text-blue-500',
    green: 'font-mono text-green-500',
    danger: 'text-[var(--color-danger)]',
    main: 'text-[var(--color-text-main)]',
};

/** One of the headline facts under the address (up to five fit on a row). */
export interface EntityFact {
    label: string;
    value: React.ReactNode;
    tone?: FactTone;
    /** Hover text, e.g. the exact value behind a rounded one. */
    title?: string;
}

/** A tab of the expanded card beyond the shared summary / metadata / configuration / raw. */
export interface EntityCardTab {
    key: string;
    label: string;
    tooltip?: string;
    render: () => React.ReactNode;
}

/**
 * The entity's Gateway details, under the key every explorer view shares, so
 * a card, its badge and the grid's readiness gate make one request between them.
 */
export function useExplorerEntity(address: string, network: AccountCardProps['network']) {
    return useQuery({
        queryKey: entityKeys.detail(address, network),
        queryFn: () => apiFetchEntityDetails(address, network as 'mainnet' | 'stokenet'),
        enabled: !!address,
        staleTime: Infinity,
        gcTime: 10 * 60_000,
    });
}

/** Typed metadata of an entity, as the cards read it. */
export function entityMeta(entityData: GatewayEntityDetails | null | undefined) {
    const metadataItems: MetadataItem[] = entityData?.metadata?.items ?? [];
    const getMeta = (key: string) => metadataItems.find((m) => m.key === key)?.value?.typed?.value ?? '';
    return { metadataItems, getMeta };
}

interface ExplorerEntityCardProps extends AccountCardProps {
    /** Shown when the entity has no icon of its own. */
    icon: LucideIcon;
    facts: EntityFact[];
    /** Tabs this kind adds, placed right after the summary. */
    extraTabs?: EntityCardTab[];
}

/**
 * The frame every non-account entity card shares: icon, address with copy,
 * up to six headline facts, and once expanded the summary, the kind's own
 * tabs, metadata, configuration (role assignments) and the raw details.
 *
 * Nothing is rendered until the details are in hand. The card must never
 * appear half-built: the grid holds its previous content until this resolves,
 * which is what keeps the swap in a single frame.
 */
export function ExplorerEntityCard({
    address,
    isExpanded,
    onExpand,
    onCopy,
    copiedAddress,
    t,
    network,
    locale,
    isModal,
    icon: Icon,
    facts,
    extraTabs = [],
}: ExplorerEntityCardProps) {
    const tt = t?.dashboard?.transactions;
    const instanceId = useId();
    const { data: entityData, isLoading, isError } = useExplorerEntity(address, network);
    const [activeTab, setActiveTab] = useState('summary');

    if (isError || isLoading) return null;

    const { metadataItems, getMeta } = entityMeta(entityData);
    const name = getMeta('name');
    const iconUrl = getMeta('icon_url');
    const isCopied = copiedAddress === address;
    const clickable = !isModal && !!onExpand;

    const [summaryTab, ...sharedTabs] = getTabsForEntity(address, tt);
    const tabs = [summaryTab, ...extraTabs.map(({ key, label, tooltip }) => ({ key, label, tooltip })), ...sharedTabs];
    const extra = extraTabs.find((tab) => tab.key === activeTab);
    const configEntries = getConfigEntries((entityData?.details as Record<string, unknown>)?.role_assignments, tt);

    return (
        <Card
            onClick={clickable ? () => onExpand?.(address) : undefined}
            className={`p-0 shadow-md transition-all duration-300 group ${clickable ? 'cursor-pointer' : 'cursor-default'} overflow-hidden col-span-full border border-[var(--color-accent)]/30 ${isModal ? 'bg-[var(--color-bg)] h-full flex flex-col' : 'bg-[var(--color-surface)]'} ${isExpanded ? 'ring-2 ring-[var(--color-primary)]' : 'hover:shadow-lg'}`}
            innerClassName={isModal ? 'flex flex-col h-full min-h-0 flex-1' : ''}
        >
            <div className="flex flex-col sm:flex-row shrink-0">
                <div
                    aria-hidden="true"
                    className="w-full sm:w-[140px] p-4 sm:p-6 border-r shrink-0 border-b sm:border-b-0 border-[var(--color-card-border)] bg-[var(--color-surface)] flex flex-row sm:flex-col items-center gap-3 text-center relative overflow-hidden cursor-pointer self-stretch justify-center"
                >
                    <div className="absolute top-0 inset-x-0 h-1/2 opacity-10" style={{ background: 'radial-gradient(circle at top, var(--color-accent), transparent)' }} />
                    <div
                        className="relative z-10 p-3 sm:p-4 rounded-2xl border-2 shadow-lg bg-[var(--color-bg)] transition-all duration-300 flex items-center justify-center border-[var(--color-accent)]"
                        style={{ boxShadow: '0 0 15px var(--color-accent)30' }}
                    >
                        {iconUrl ? (
                            <SafeImage src={iconUrl} alt={name || address} fallbackName={name || address} className="size-8 object-cover rounded-xl" />
                        ) : (
                            <Icon className="size-8" style={{ color: 'var(--color-accent)' }} />
                        )}
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-w-0">
                    <div className="p-5 flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-3 sm:flex-nowrap">
                            <div className="flex items-center gap-2 overflow-hidden shrink min-w-0 flex-1 pr-2">
                                <h3
                                    className="text-xs sm:text-sm font-mono font-black text-[var(--color-text-main)] group-hover:text-[var(--color-secondary)] transition-colors truncate mr-2"
                                    title={address}
                                >
                                    {address}
                                </h3>
                                <CopyButton
                                    value={address}
                                    variant="card-inline"
                                    size="sm"
                                    forceCopied={isCopied}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCopy(address);
                                    }}
                                    className="shrink-0"
                                />
                            </div>
                            {isModal && onExpand && (
                                <CloseButton
                                    onClose={() => onExpand?.(address)}
                                    title={t?.dashboard?.reading?.close || 'Close'}
                                    iconSize={20}
                                    className="shrink-0 ml-1 mt-1 sm:mt-0"
                                />
                            )}
                        </div>

                        <div className={`grid grid-cols-2 ${facts.length > 5 ? 'sm:grid-cols-6' : 'sm:grid-cols-5'} gap-2 sm:gap-4 text-sm mt-3 items-center`}>
                            {facts.map((fact) => (
                                <div key={fact.label} className="min-w-0">
                                    <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold truncate">
                                        {fact.label}
                                    </div>
                                    <div className={`text-sm font-bold truncate ${TONE_CLASS[fact.tone ?? 'main']}`} title={fact.title}>
                                        {fact.value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <AnimatePresence initial={false}>
                {isExpanded && (
                    <m.div
                        initial={isModal ? false : { height: 0, opacity: 0 }}
                        animate={isModal ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className={`overflow-hidden bg-[var(--color-bg)] w-full border-t border-[var(--color-card-border)] ${isModal ? 'flex-1 flex flex-col min-h-0' : ''}`}
                    >
                        <div role="presentation" onClick={(e) => e.stopPropagation()} className={`cursor-auto w-full ${isModal ? 'flex-1 flex flex-col min-h-0' : ''}`}>
                            <PanelTabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} layoutId={`entityTabs-${instanceId}`} />

                            <div className={`px-4 py-3 pb-6 ${isModal ? 'flex-1 overflow-y-auto min-h-0 custom-scrollbar' : ''}`}>
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
                                {extra?.render()}
                                {activeTab === 'metadata' && (
                                    <PanelMetadataTab metadataItems={metadataItems} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} />
                                )}
                                {activeTab === 'configuration' && (
                                    <PanelConfigurationTab configEntries={configEntries} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} />
                                )}
                                {activeTab === 'raw' && <PanelRawTab data={entityData} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} />}
                            </div>
                        </div>
                    </m.div>
                )}
            </AnimatePresence>
        </Card>
    );
}
