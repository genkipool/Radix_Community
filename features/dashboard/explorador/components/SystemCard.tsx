'use client';
import { Box } from 'lucide-react';

import { useValidatorsQuery } from '@/features/dashboard/staking/hooks/useValidatorsQuery';
import { formatPercent, formatXRD, formatXRDExact } from '@/utils/formatters';
import type { AccountCardProps } from '../types/components.types';
import { ExplorerEntityCard, entityMeta, useExplorerEntity, type EntityFact } from './ExplorerEntityCard';

/** A web link that does not expand the card it sits on. */
function WebLink({ url }: { url: string }) {
    if (!url) return <>-</>;
    return (
        <a
            href={url.startsWith('http') ? url : `https://${url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline hover:text-[var(--color-primary)]"
            onClick={(e) => e.stopPropagation()}
        >
            {url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
        </a>
    );
}

const short = (address: string) => (address ? `${address.slice(0, 12)}...${address.slice(-6)}` : '-');

/**
 * Protocol entities (consensus manager, transaction tracker) and validators.
 * A validator shows its staking figures; the rest their blueprint.
 */
export function SystemCard(props: AccountCardProps) {
    const { address, locale, network } = props;
    const c = props.t?.dashboard?.entity_cards;
    const { data } = useExplorerEntity(address, network);
    const { data: validators } = useValidatorsQuery(network);
    const { getMeta } = entityMeta(data);
    const details = data?.details as Record<string, unknown> | undefined;
    const validator = address.startsWith('validator_') ? validators?.validators?.find((v) => v.address === address) : null;

    const facts: EntityFact[] = validator
        ? [
              { label: c?.name ?? 'Name', value: validator.name || getMeta('name') || (c?.kinds.validator ?? 'Validator'), tone: 'accent' },
              { label: c?.stake ?? 'Stake', value: `${formatXRD(validator.totalStakeXRD, locale)} XRD`, title: formatXRDExact(validator.totalStakeXRD, locale), tone: 'primary' },
              { label: c?.commission ?? 'Commission', value: formatPercent(validator.feePercent, 2, locale), tone: 'blue' },
              { label: c?.uptime ?? 'Uptime', value: formatPercent(validator.uptimePercent, 2, locale), tone: 'green' },
              { label: c?.web ?? 'Web', value: <WebLink url={validator.website ?? ''} /> },
          ]
        : [
              { label: c?.blueprint_name ?? 'Blueprint name', value: String(details?.blueprint_name ?? '') || getMeta('name') || '-', tone: 'accent' },
              { label: c?.blueprint_version ?? 'Blueprint version', value: String(details?.blueprint_version ?? '-'), tone: 'secondary' },
              { label: c?.type ?? 'Type', value: String(details?.type ?? '') || (c?.kinds.system ?? 'System entity'), tone: 'blue' },
              { label: c?.package ?? 'Package', value: short(String(details?.package_address ?? '')), title: String(details?.package_address ?? '') },
              { label: c?.web ?? 'Web', value: <WebLink url={getMeta('info_url')} /> },
          ];

    return <ExplorerEntityCard {...props} icon={Box} facts={facts} />;
}
