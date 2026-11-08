'use client';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';

import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { entityKeys } from '@/features/dashboard/utils/entityCache';
import type { GatewayEntityDetails, MetadataItem } from '@/features/dashboard/types';
import { SafeImage } from '@/components/ui/SafeImage';
import type { AccountCardProps } from '../types/components.types';
import { EntitySummaryTab, getTabsForEntity } from './ExpandableEntityBadge';
import { PanelMetadataTab, PanelConfigurationTab, PanelRawTab } from './EntityPanelShared';
import { EntityCardFrame, type EntityCardTab, type EntityFact } from './EntityCardFrame';
import { getConfigEntries } from '../../utils/resourceUtils';

export { STATUS_CLASS, type EntityCardTab, type EntityFact, type FactTone } from './EntityCardFrame';

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
    const { data: entityData, isLoading, isError } = useExplorerEntity(address, network);

    if (isError || isLoading) return null;

    const { metadataItems, getMeta } = entityMeta(entityData);
    const name = getMeta('name');
    const iconUrl = getMeta('icon_url');

    const [summaryTab, ...sharedTabs] = getTabsForEntity(address, tt);
    const configEntries = getConfigEntries((entityData?.details as Record<string, unknown>)?.role_assignments, tt);
    const sharedRender: Record<string, () => React.ReactNode> = {
        metadata: () => <PanelMetadataTab metadataItems={metadataItems} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} />,
        configuration: () => <PanelConfigurationTab configEntries={configEntries} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} />,
        raw: () => <PanelRawTab data={entityData} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} />,
    };
    const tabs: EntityCardTab[] = [
        {
            ...summaryTab,
            render: () => (
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
            ),
        },
        ...extraTabs,
        ...sharedTabs.map((tab) => ({ ...tab, render: sharedRender[tab.key] ?? (() => null) })),
    ];

    return (
        <EntityCardFrame
            address={address}
            avatar={iconUrl
                ? <SafeImage src={iconUrl} alt={name || address} fallbackName={name || address} className="size-8 object-cover rounded-xl" />
                : <Icon className="size-8" style={{ color: 'var(--color-accent)' }} />}
            facts={facts}
            tabs={tabs}
            isExpanded={isExpanded}
            onExpand={onExpand}
            onCopy={onCopy}
            copiedAddress={copiedAddress}
            isModal={isModal}
            closeLabel={t?.dashboard?.reading?.close}
        />
    );
}
