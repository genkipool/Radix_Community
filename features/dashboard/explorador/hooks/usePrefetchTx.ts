'use client';

/**
 * features/dashboard/explorador/hooks/usePrefetchTx.ts
 *
 * Pre-warms the React Query cache for transaction details and associated
 * resource entity metadata on hover — so expanding a card is instant.
 */

import { useQueryClient } from '@tanstack/react-query';
import {
  apiFetchEntityDetails,
  apiFetchTransactionDetails,
} from '@/features/dashboard/services/apiClient';
import { entityKeys } from '@/features/dashboard/hooks/useEntityData';
import type { Network } from '@/features/dashboard/types';
import type { TransactionDetails, FungibleChange } from '@/features/dashboard/types/shared.types';

export function usePrefetchTransactionDetails() {
  const queryClient = useQueryClient();

  // React Compiler automatically memoizes this function.
  const prefetchTx = (intentHash: string, network: Network = 'mainnet') => {
    queryClient.prefetchQuery({
      queryKey: ['tx-details', intentHash, network],
      queryFn:  async () => {
        const details = (await apiFetchTransactionDetails(intentHash, network)) as TransactionDetails;

        if (details?.balance_changes?.fungible_balance_changes) {
          const uniqueResources = [
            ...new Set<string>(
              details.balance_changes.fungible_balance_changes
                .map((c: FungibleChange) => c.resource_address)
                .filter(Boolean),
            ),
          ];
          uniqueResources.forEach(resourceAddress => {
            queryClient.prefetchQuery({
              queryKey: entityKeys.full(resourceAddress, network),
              queryFn:  () => apiFetchEntityDetails(resourceAddress, network),
              staleTime: Infinity,
            });
          });
        }

        return details;
      },
      staleTime: 30_000,
    });
  };

  return { prefetchTx };
}
