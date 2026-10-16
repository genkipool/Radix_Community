'use client';
import { Box } from 'lucide-react';

import type { AccountCardProps } from '../types/components.types';
import { ExplorerEntityCard, entityMeta, useExplorerEntity } from './ExplorerEntityCard';

/** A component: its blueprint, whether a dApp claims it, and its description. */
export function ComponentCard(props: AccountCardProps) {
    const c = props.t?.dashboard?.entity_cards;
    const { data } = useExplorerEntity(props.address, props.network);
    const { getMeta } = entityMeta(data);
    const details = data?.details as Record<string, unknown> | undefined;

    return (
        <ExplorerEntityCard
            {...props}
            icon={Box}
            facts={[
                { label: c?.blueprint_name ?? 'Blueprint name', value: String(details?.blueprint_name ?? '-'), tone: 'accent' },
                { label: c?.type ?? 'Type', value: c?.kinds.component ?? 'Component', tone: 'secondary' },
                { label: c?.blueprint_version ?? 'Blueprint version', value: String(details?.blueprint_version ?? '-'), tone: 'blue' },
                { label: c?.dapp_linked ?? 'Linked dApp', value: getMeta('dapp_definition') ? (c?.yes ?? 'Yes') : (c?.no ?? 'No'), tone: 'primary' },
                { label: c?.description ?? 'Description', value: getMeta('description') || '-' },
            ]}
        />
    );
}
