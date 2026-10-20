'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetchValidators } from '@/features/dashboard/services/apiClient';
import type { Network } from '@/features/dashboard/types';

/**
 * The validator set, from the same cache entry the staking list and the
 * explorer fill (`['validators', network]`), without their fingerprint
 * polling: for views that read it, such as the console, so a visit asks the
 * server once whichever of them comes first.
 */
export function useValidatorList(network: Network, enabled = true) {
  return useQuery({
    queryKey: ['validators', network],
    enabled,
    staleTime: 300_000,
    retry: 2,
    queryFn: () => apiFetchValidators(network as 'mainnet' | 'stokenet'),
  });
}
