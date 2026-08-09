'use client';

/**
 * Whether the wallet's stakes on a given ledger have been read yet.
 *
 * Which validators the connected wallet is staking with decides which cards go
 * FIRST, so a grid drawn before that answer arrives is a grid in the wrong
 * order — and it visibly reorders itself a moment later. This is the signal
 * that says the order can be trusted, so the switch can wait for it instead of
 * painting twice.
 *
 * It reads the same query keys `useConnectedStakes` does, so it shares their
 * cache entries and costs no extra request; `select` throws the payload away so
 * it does not repeat that hook's parsing either. Asking for a ledger here is
 * also what starts fetching it.
 */
import { useQueries } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { dashboardKeys } from '@/features/dashboard/utils/entityCache';
import { CACHE_TIMES } from '@/features/dashboard/utils/queryCache';

export function useStakesReady(
  accountAddresses: string[],
  network: 'mainnet' | 'stokenet',
  /**
   * Whether the wallet HAS a session on this ledger, and therefore accounts we
   * have simply not been handed yet.
   */
  expectsAccounts = false,
): boolean {
  const results = useQueries({
    queries: accountAddresses.map((address) => ({
      queryKey: dashboardKeys.entities.detail(address, network),
      queryFn: () => apiFetchEntityDetails(address, network),
      enabled: !!address,
      staleTime: CACHE_TIMES.MEDIUM,
      gcTime: CACHE_TIMES.LONG,
      select: () => true as const,
    })),
  });

  /*
   * An empty list of accounts is only "nothing to wait for" when there really
   * is nothing: `[].every(...)` is true by vacuity, and that answered "ready"
   * during the window where the wallet's accounts had not arrived yet. The
   * server seeds them per ledger, from the session cookie, so a switch briefly
   * has none — the grid committed with nothing pinned, and the wallet's own
   * validators jumped to the top a moment later. Whether that window is even
   * open depends on when the navigation lands, which is why it came and went.
   */
  if (expectsAccounts && accountAddresses.length === 0) return false;

  /*
   * `isPending`, not `isLoading`. In React Query v5 `isLoading` is
   * `isPending && isFetching`, and on the render where an observer is first
   * mounted the fetch has been scheduled but not started — so `isLoading` is
   * already false while nothing has been read. Gating on it declared the
   * stakes ready before they had been asked for, the grid adopted the new
   * ledger with nothing pinned, and the wallet filter announced that no
   * staking nodes were found until the answer landed ~450 ms later.
   *
   * No wallet, nothing to wait for: an empty list is ready by definition.
   */
  return results.every((result) => !result.isPending);
}
