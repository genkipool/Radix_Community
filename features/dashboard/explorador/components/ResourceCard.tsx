'use client';
import { Box } from 'lucide-react';

import type { AccountCardProps } from '../types/components.types';
import { ExplorerEntityCard, entityMeta, useExplorerEntity } from './ExplorerEntityCard';
import { useOlympiaResource } from '@/features/dashboard/services/olympiaApi';
import { olympiaDict } from '../olympia/dict';
import { ResourceOlympiaTab } from '../olympia/ResourceOlympiaTab';

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
    // A token migrated from Olympia gets an Olympia tab, as accounts do.
    const tt = props.t?.dashboard?.transactions;
    const o = olympiaDict(tt);
    const { data: olympia } = useOlympiaResource(props.network === 'mainnet' && props.address.startsWith('resource_rdx1') ? props.address : null);

    return (
        <ExplorerEntityCard
            {...props}
            icon={Box}
            extraTabs={olympia ? [{
                key: 'olympia',
                label: o.tab ?? 'Olympia',
                tooltip: o.resource_tab_tooltip,
                render: () => <ResourceOlympiaTab r={olympia} tt={tt} locale={props.locale} onCopy={props.onCopy} copiedAddress={props.copiedAddress} />,
            }] : []}
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
