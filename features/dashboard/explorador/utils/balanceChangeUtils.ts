import { sanitizeText } from '@/utils/sanitize';
import { isConsensusManager } from '@/features/dashboard/utils/entityUtils';
import { getXrdAddress } from '../constants';
import type { Network } from '@/features/dashboard/types';
import type { BalanceChanges, FungibleChange, NonFungibleChange } from '../types';

/**
 * getResourceGroups
 * Filters out managerconsensus and groups fungible balance changes and fees by resource.
 */
export function getResourceGroups(
    balanceChanges: BalanceChanges | undefined,
    network: Network = 'mainnet'
): FungibleChange[][] {
    const fungibles = (balanceChanges?.fungible_balance_changes ?? [])
        .filter(f => !isConsensusManager(sanitizeText(f.entity_address)));

    const fees = (balanceChanges?.fungible_fee_balance_changes ?? [])
        .filter(f => !isConsensusManager(sanitizeText(f.entity_address)))
        .map(f => ({ ...f, is_fee: true, type: f.type } as FungibleChange));

    const changes = [...fungibles, ...fees];

    const map: Record<string, FungibleChange[]> = {};
    changes.forEach((c) => {
        const k = sanitizeText(c.resource_address || getXrdAddress(network));
        (map[k] ??= []).push(c);
    });
    return Object.values(map);
}

/**
 * getRealTransferAddresses
 * Returns a set of addresses that have at least one non-fee balance change
 * (either fungible or non-fungible).
 */
export function getRealTransferAddresses(
    balanceChanges: BalanceChanges | undefined
): Set<string> {
    const addresses = new Set<string>();
    
    // Non-fee fungible changes
    (balanceChanges?.fungible_balance_changes ?? []).forEach(f => {
        if (!isConsensusManager(sanitizeText(f.entity_address)) && parseFloat(f.balance_change) !== 0) {
            addresses.add(sanitizeText(f.entity_address));
        }
    });
    
    // Non-fungible changes (count all as "real" transfers)
    (balanceChanges?.non_fungible_balance_changes ?? []).forEach(nf => {
        if (!isConsensusManager(sanitizeText(nf.entity_address))) {
            addresses.add(sanitizeText(nf.entity_address));
        }
    });

    return addresses;
}

/**
 * getAllSenderAddresses
 * Returns a set of addresses that are net senders (negative balance change),
 * excluding managerconsensus.
 */
export function getAllSenderAddresses(
    balanceChanges: BalanceChanges | undefined
): Set<string> {
    return new Set<string>(
        (balanceChanges?.fungible_balance_changes ?? [])
            .filter((c) => !isConsensusManager(sanitizeText(c.entity_address)) && parseFloat(c.balance_change) < 0)
            .map((c) => sanitizeText(c.entity_address)),
    );
}

/**
 * getNftOnlyGroups
 * Creates synthetic resource groups for NFT transfers when no fungible changes exist.
 */
export function getNftOnlyGroups(
    balanceChanges: BalanceChanges | undefined,
    resourceGroupsCount: number
): FungibleChange[][] {
    const nftChanges: NonFungibleChange[] = balanceChanges?.non_fungible_balance_changes ?? [];
    if (nftChanges.length === 0 || resourceGroupsCount > 0) return [];
    
    // Create one synthetic fungible group per unique account pair
    const accountSet = new Set<string>();
    nftChanges.forEach((n) => accountSet.add(n.entity_address));
    
    // Return a single synthetic group with zero-balance entries per entity
    const syntheticChanges: FungibleChange[] = Array.from(accountSet).map(addr => ({
        resource_address: nftChanges[0]?.resource_address ?? '',
        entity_address: addr,
        balance_change: '0',
    }));
    return syntheticChanges.length > 0 ? [syntheticChanges] : [];
}
