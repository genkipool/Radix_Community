/**
 * features/dashboard/utils/cacheInvalidation.ts
 * 
 * Global cache invalidation utilities for the Radix Dashboard.
 * Utilizes fuzzy matching to invalidate hierarchical query keys efficiently.
 */

import { QueryClient } from '@tanstack/react-query';
import { dashboardKeys } from './entityCache';

/**
 * Invalidates all staking, transaction, and entity data related to a specific account.
 * This should be called after a transaction succeeds (e.g., stake, unstake, claim) 
 * to ensure all dashboard views reflect the newest state.
 */
export const invalidateAccountStakingData = (
    queryClient: QueryClient,
    accountAddress?: string | null,
    network?: string
) => {
    // 1. Invalidate root of entities to ensure all entity states are refreshed
    // Using fuzzy matching, this invalidates details for accounts, validators, resources, etc.
    queryClient.invalidateQueries({ queryKey: dashboardKeys.entities.all() });

    // 2. Invalidate all transactions
    if (network) {
        queryClient.invalidateQueries({ queryKey: dashboardKeys.transactions.all() });
        // Invalidate specific account history if we have the address
        if (accountAddress) {
             queryClient.invalidateQueries({ queryKey: dashboardKeys.transactions.list(network, accountAddress, undefined, undefined) });
        }
    }

    // 3. Invalidate validators (to refresh global stakes and APYs)
    if (network) {
         queryClient.invalidateQueries({ queryKey: dashboardKeys.validators.list(network) });
    }

    // 4. Invalidate account-specific stats (claim NFTs, etc)
    if (accountAddress) {
        queryClient.invalidateQueries({ queryKey: dashboardKeys.account.all() });
    }

    // Legacy fallback to clean up unmigrated keys (to be removed once all are migrated)
    queryClient.invalidateQueries({ queryKey: ['account-staking-balance'] });
    queryClient.invalidateQueries({ queryKey: ['entity'] });
    queryClient.invalidateQueries({ queryKey: ['account-transactions'] });
    queryClient.invalidateQueries({ queryKey: ['account-claim-nfts'] });
    queryClient.invalidateQueries({ queryKey: ['account-entity-details'] });
    queryClient.invalidateQueries({ queryKey: ['validator-entity-details'] });
    queryClient.invalidateQueries({ queryKey: ['validators'] });
};
