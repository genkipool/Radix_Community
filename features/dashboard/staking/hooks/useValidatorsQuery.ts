'use client';

/**
 * features/dashboard/staking/hooks/useValidatorsQuery.ts
 *
 * React Query for validators + network stats.
 * Cache is pre-warmed server-side via HydrationBoundary — first render is instant.
 */

import { useQuery } from '@tanstack/react-query';
import { apiFetchValidators } from '@/features/dashboard/services/apiClient';
import type { Validator, NetworkStats } from '@/types/radix';
import type { Network } from '@/features/dashboard/types';

interface ValidatorsData {
  validators:   Validator[];
  networkStats: NetworkStats;
}

export function useValidatorsQuery(network: Network) {
  return useQuery<ValidatorsData>({
    queryKey:    ['validators', network],
    queryFn:     () => apiFetchValidators(network as 'mainnet' | 'stokenet'),
    staleTime:               300_000,
    refetchInterval:         300_000,
    refetchIntervalInBackground: false,
    placeholderData:         (prev) => prev,
  });
}
