'use client';

import { useQueries, useQuery } from '@tanstack/react-query';

import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { gatewayPost } from '@/services/gateway/bases';
import type { DexListing } from '../lib/dex-listings';
import { resolveDexPool } from '../lib/dex-pools';
import { findPoolUnitPositions, unitValueChange } from '../lib/pool-positions';
import { useAccountResources } from './useAccountResources';

/** The DEX behind a native pool or component address, read from the ledger (null when there is none). */
export function useDexPool(address: string) {
  const { activeNetwork } = useRadixWallet();
  const valid = /^(pool|component)_/.test(address);
  return useQuery({
    queryKey: ['console-dex-pool', activeNetwork, address],
    enabled: valid,
    // Reserves and prices move: the amounts the form proposes follow them.
    staleTime: 10_000,
    refetchInterval: 30_000,
    retry: false,
    queryFn: () => resolveDexPool((path, body) => gatewayPost(activeNetwork, path, body), address),
  });
}

/** What the DEX itself says about a component or pool: listed or not, and its yield. Mainnet only. */
export function useDexListing(address: string | null) {
  const { activeNetwork } = useRadixWallet();
  return useQuery({
    queryKey: ['console-dex-listing', activeNetwork, address],
    enabled: !!address && activeNetwork === 'mainnet',
    staleTime: 60 * 60_000,
    retry: false,
    queryFn: async (): Promise<DexListing | null> => {
      const res = await fetch(`/api/console/dex-listing?network=${activeNetwork}&address=${address}`);
      if (!res.ok) throw new Error(`dex listing: ${res.status}`);
      return ((await res.json()) as { listing: DexListing | null }).listing;
    },
  });
}

/** The native pool units an account holds, with what they redeem for now. */
export function usePoolUnitPositions(account: string | null) {
  const { activeNetwork } = useRadixWallet();
  const holdings = useAccountResources(account);
  const fungibles = holdings.data?.fungibles ?? [];
  const key = fungibles.map((f) => `${f.resourceAddress}:${f.amount}`).join(',');
  const positions = useQuery({
    queryKey: ['console-pool-unit-positions', activeNetwork, account, key],
    enabled: !!account && holdings.isSuccess,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
    queryFn: () => findPoolUnitPositions((path, body) => gatewayPost(activeNetwork, path, body), fungibles),
  });
  return {
    positions: positions.data ?? [],
    loading: !!account && (holdings.isPending || positions.isPending),
    error: holdings.error ?? positions.error,
  };
}

/** How a pool unit's value changed over each period, from the ledger as it was then. */
export function useUnitValueChanges(pool: string | null, poolUnit: string | null, periods: number[]) {
  const { activeNetwork } = useRadixWallet();
  return useQueries({
    queries: periods.map((days) => ({
      queryKey: ['console-unit-value-change', activeNetwork, pool, poolUnit, days],
      enabled: !!pool && !!poolUnit,
      staleTime: 10 * 60_000,
      retry: false,
      queryFn: () => unitValueChange((path, body) => gatewayPost(activeNetwork, path, body), pool!, poolUnit!, days),
    })),
  });
}
