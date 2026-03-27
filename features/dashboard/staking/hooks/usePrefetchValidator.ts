'use client';

/**
 * features/dashboard/staking/hooks/usePrefetchValidator.ts
 *
 * Pre-warms entity metadata + stake history cache for a validator on hover,
 * so charts and detail view are ready before the user clicks.
 */

import { useQueryClient } from '@tanstack/react-query';
import {
  apiFetchEntityDetails,
  apiFetchStakeHistory,
} from '@/features/dashboard/services/apiClient';
import { entityKeys } from '@/features/dashboard/hooks/useEntityData';
import type { Network } from '@/features/dashboard/types';

export function usePrefetchValidatorEntity() {
  const queryClient = useQueryClient();

  // React Compiler automatically memoizes this function.
  const prefetchValidator = (address: string, network: Network = 'mainnet') => {
    if (!address?.startsWith('validator_')) return;

    queryClient.prefetchQuery({
      queryKey: entityKeys.full(address, network),
      queryFn:  () => apiFetchEntityDetails(address, network),
      staleTime: 60_000,
    });

    queryClient.prefetchQuery({
      queryKey: ['stake-history', network, address],
      queryFn:  () => apiFetchStakeHistory(address, network),
      staleTime: 5 * 60_000,
    });
  };

  return { prefetchValidator };
}
