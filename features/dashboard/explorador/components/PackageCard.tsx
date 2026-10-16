'use client';
import { Package } from 'lucide-react';

import type { AccountCardProps } from '../types/components.types';
import { ExplorerEntityCard, entityMeta, useExplorerEntity } from './ExplorerEntityCard';

/** A package: its name, the dApp and websites that claim it, and its description. */
export function PackageCard(props: AccountCardProps) {
    const c = props.t?.dashboard?.entity_cards;
    const { data } = useExplorerEntity(props.address, props.network);
    const { metadataItems, getMeta } = entityMeta(data);
    const websites = metadataItems.find((m) => m.key === 'claimed_websites')?.value?.typed?.values ?? [];

    return (
        <ExplorerEntityCard
            {...props}
            icon={Package}
            facts={[
                { label: c?.name ?? 'Name', value: getMeta('name') || (c?.kinds.package ?? 'Package'), tone: 'accent' },
                { label: c?.type ?? 'Type', value: c?.kinds.package ?? 'Package', tone: 'secondary' },
                { label: c?.dapp_linked ?? 'Linked dApp', value: getMeta('dapp_definition') ? (c?.yes ?? 'Yes') : (c?.no ?? 'No'), tone: 'primary' },
                { label: c?.websites ?? 'Websites', value: websites.length, tone: 'blue' },
                { label: c?.description ?? 'Description', value: getMeta('description') || '-' },
            ]}
        />
    );
}
