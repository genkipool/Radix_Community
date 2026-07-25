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

/**
 * @param enabled  Views that do not show validators pass `false`, so the
 *                 explorer neither ships the list in its payload nor fetches
 *                 it on the client. Its aggregate figures arrive separately as
 *                 `networkStats` from the server.
 */
export function useValidatorsQuery(network: Network, enabled = true) {
  return useQuery<ValidatorsData>({
    enabled,
    queryKey:    ['validators', network],
    queryFn:     () => apiFetchValidators(network as 'mainnet' | 'stokenet'),
    staleTime:               300_000,
    refetchInterval:         300_000,
    refetchIntervalInBackground: false,
    placeholderData:         (prev) => prev,
  });
}
