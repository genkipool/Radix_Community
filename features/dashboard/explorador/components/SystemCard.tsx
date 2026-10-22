'use client';
import { Box } from 'lucide-react';

import { useValidatorsQuery } from '@/features/dashboard/staking/hooks/useValidatorsQuery';
import { formatPercent, formatXRD, formatXRDExact } from '@/utils/formatters';
import type { AccountCardProps } from '../types/components.types';
import { epochDate, summarizeOwnerUnlocks, type PendingOwnerUnlock } from '../utils/ownerUnlocks';
import { pendingFeeChange, type FeeChangeRequest } from '../utils/feeChange';
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

    // What is about to change: LSUs the owner has in the unlock period, a commission waiting to apply.
    const ledger = (data as { ledger_state?: { epoch?: number; proposer_round_timestamp?: string } } | undefined)?.ledger_state;
    const state = details?.state as { pending_owner_stake_unit_withdrawals?: PendingOwnerUnlock[]; validator_fee_factor?: string; validator_fee_change_request?: FeeChangeRequest | null } | undefined;
    const unlock = validator && ledger?.epoch !== undefined ? summarizeOwnerUnlocks(state?.pending_owner_stake_unit_withdrawals, ledger.epoch) : null;
    const feeChange = validator && ledger?.epoch !== undefined ? pendingFeeChange(state, ledger.epoch) : null;
    /** The day an epoch of the future starts, or the epoch itself when the ledger's clock is not at hand. */
    const when = (epoch: number, short = false) => ledger?.epoch !== undefined && ledger.proposer_round_timestamp
        ? epochDate(epoch, ledger.epoch, ledger.proposer_round_timestamp).toLocaleDateString(locale, short ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' })
        : `Epoch ${epoch}`;

    const facts: EntityFact[] = validator
        ? [
              { label: c?.name ?? 'Name', value: validator.name || getMeta('name') || (c?.kinds.validator ?? 'Validator'), tone: 'accent' },
              { label: c?.stake ?? 'Stake', value: `${formatXRD(validator.totalStakeXRD, locale)} XRD`, title: formatXRDExact(validator.totalStakeXRD, locale), tone: 'primary' },
              feeChange
                  ? {
                        label: c?.commission ?? 'Commission',
                        value: `${formatPercent(feeChange.current, 2, locale)} → ${formatPercent(feeChange.next, 2, locale)}`,
                        title: `Epoch ${feeChange.epoch}`,
                        tone: feeChange.next > feeChange.current ? 'danger' : 'green',
                    }
                  : { label: c?.commission ?? 'Commission', value: formatPercent(validator.feePercent, 2, locale), tone: 'blue' },
              { label: c?.uptime ?? 'Uptime', value: formatPercent(validator.uptimePercent, 2, locale), tone: 'green' },
              ...(feeChange ? [{ label: c?.fee_effective ?? 'New commission from', value: when(feeChange.epoch), title: `Epoch ${feeChange.epoch}`, tone: 'secondary' as const }] : []),
              ...(unlock
                  ? feeChange
                      // Both at once would not fit a row of six: the unlock goes in one fact, its date beside the amount.
                      ? [{ label: c?.owner_unlocking ?? 'Owner unlocking', value: `${formatXRD(unlock.unlocking, locale)} LSU · ${when(unlock.nextEpoch, true)}`, title: `${formatXRDExact(unlock.unlocking, locale)} LSU · Epoch ${unlock.nextEpoch}`, tone: 'secondary' as const }]
                      : [
                            { label: c?.owner_unlocking ?? 'Owner unlocking', value: `${formatXRD(unlock.unlocking, locale)} LSU`, title: formatXRDExact(unlock.unlocking, locale), tone: 'secondary' as const },
                            { label: c?.owner_available ?? 'Available from', value: when(unlock.nextEpoch), title: `Epoch ${unlock.nextEpoch}`, tone: 'secondary' as const },
                        ]
                  : []),
              // The link gives way to whatever is about to change.
              ...(feeChange || unlock ? [] : [{ label: c?.web ?? 'Web', value: <WebLink url={validator.website ?? ''} /> }]),
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
