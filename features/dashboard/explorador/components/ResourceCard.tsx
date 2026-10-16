'use client';
import { Box } from 'lucide-react';

import type { AccountCardProps } from '../types/components.types';
import { ExplorerEntityCard, entityMeta, useExplorerEntity } from './ExplorerEntityCard';

/** A resource: name, symbol, whether it is fungible, supply and description. */
export function ResourceCard(props: AccountCardProps) {
    const c = props.t?.dashboard?.entity_cards;
    const { data } = useExplorerEntity(props.address, props.network);
    const { getMeta } = entityMeta(data);
    const details = data?.details as Record<string, unknown> | undefined;
    const supply = String(details?.total_supply ?? '');
    const kind =
        details?.type === 'FungibleResource'
            ? c?.kinds.fungible ?? 'Fungible'
            : details?.type === 'NonFungibleResource'
              ? c?.kinds.non_fungible ?? 'Non-fungible'
              : c?.kinds.resource ?? 'Resource';

    return (
        <ExplorerEntityCard
            {...props}
            icon={Box}
            facts={[
                { label: c?.name ?? 'Name', value: getMeta('name') || (c?.kinds.resource ?? 'Resource'), tone: 'accent' },
                { label: c?.symbol ?? 'Symbol', value: getMeta('symbol') || '-', tone: 'secondary' },
                { label: c?.type ?? 'Type', value: kind, tone: 'blue' },
                { label: c?.supply ?? 'Supply', value: supply ? Number(supply).toLocaleString(props.locale) : '-', title: supply || undefined, tone: 'primary' },
                { label: c?.description ?? 'Description', value: getMeta('description') || '-' },
            ]}
        />
    );
}
