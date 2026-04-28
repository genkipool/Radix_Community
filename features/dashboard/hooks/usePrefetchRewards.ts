'use client';

import { useQueryClient } from '@tanstack/react-query';
import { 
  apiFetchValidatorRewardsYears, 
  apiFetchAccountRewardsYears 
} from '@/features/dashboard/services/apiClient';

/**
 * Hook to prefetch reward-related data on hover.
 */
export function usePrefetchRewards() {
  const queryClient = useQueryClient();

  /**
   * Prefetches available years for validator rewards.
   */
  const prefetchValidatorRewards = (address: string) => {
    if (!address) return;
    queryClient.prefetchQuery({
      queryKey: ['validator-rewards-years', address],
      queryFn: () => apiFetchValidatorRewardsYears(address),
      staleTime: 5 * 60_000, // 5 minutes
    });
  };

  /**
   * Prefetches available years for account rewards.
   */
  const prefetchAccountRewards = (address: string) => {
    if (!address) return;
    queryClient.prefetchQuery({
      queryKey: ['account-rewards-years', address],
      queryFn: () => apiFetchAccountRewardsYears(address),
      staleTime: 5 * 60_000, // 5 minutes
    });
  };

  return { prefetchValidatorRewards, prefetchAccountRewards };
}
