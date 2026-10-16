'use client';
import { Inbox } from 'lucide-react';

import type { AccountCardProps } from '../types/components.types';
import { ExplorerEntityCard, entityMeta, useExplorerEntity, type EntityFact } from './ExplorerEntityCard';
import { LockerDetails, useLockerActivity } from './LockerDetails';

/**
 * An Account Locker: its name, what it holds, for how many recipients, and
 * how much of it has been claimed. The Contents tab opens it in detail.
 */
export function LockerCard(props: AccountCardProps) {
    const { address, network, locale, copiedAddress, onCopy } = props;
    const c = props.t?.dashboard?.entity_cards;
    const l = c?.locker;
    const { data } = useExplorerEntity(address, network);
    const { getMeta } = entityMeta(data);
    const { data: activity, isLoading, isError } = useLockerActivity(address, network);

    const count = Object.keys(activity?.fungibles ?? {}).length + Object.keys(activity?.nonFungibles ?? {}).length;
    const pending = isLoading ? '…' : isError ? '-' : null;
    const name = getMeta('name');
    const facts: EntityFact[] = [
        name
            ? { label: c?.name ?? 'Name', value: name, tone: 'accent' }
            : { label: c?.type ?? 'Type', value: c?.kinds.locker ?? 'Account Locker', tone: 'accent' },
        {
            label: l?.holds ?? 'Contents',
            value: pending ?? (count === 0 ? l?.nothing ?? 'Empty' : count === 1 ? l?.one_resource ?? '1 resource' : (l?.resources ?? '{count} resources').replace('{count}', String(count))),
            tone: 'primary',
        },
        { label: l?.claimants ?? 'Recipients', value: pending ?? activity?.claimants ?? 0, tone: 'blue' },
        { label: l?.stores ?? 'Deposits', value: pending ?? activity?.stores ?? 0, tone: 'secondary' },
        { label: l?.claims ?? 'Claimed', value: pending ?? activity?.claims ?? 0, tone: 'green' },
    ];

    return (
        <ExplorerEntityCard
            {...props}
            icon={Inbox}
            facts={facts}
            extraTabs={[
                {
                    key: 'contents',
                    label: l?.contents_tab ?? 'Contents',
                    tooltip: l?.contents_tab_tooltip,
                    render: () => <LockerDetails address={address} network={network} locale={locale} copiedAddress={copiedAddress} onCopy={onCopy} />,
                },
            ]}
        />
    );
}
