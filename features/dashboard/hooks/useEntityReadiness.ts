'use client';

import { useQuery, useQueries } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { entityKeys } from '@/features/dashboard/utils/entityCache';
import type { Network } from '../types';

const NONE: string[] = [];

export interface UseFocusedEntityOptions {
  /** The entity the user is asking for, from the search box or the URL. */
  requested: string | null;
  /** What to keep showing while `requested` is not ready yet. */
  fallback: string | null;
  network: Network;
}

/**
 * Decides which entity card the explorer grid is currently allowed to render.
 *
 * The card is full width and sits above the transaction list, so letting it in
 * before its data exists produced the flash the grid was reported for: the list
 * painted alone, then the card appeared on top and shoved it down.
 *
 * So the swap waits. The requested entity only becomes the shown one once its
 * details are in the cache; until then the grid keeps whatever it was already
 * showing. Nothing is ever rendered half-built, and there is no placeholder
 * standing in for it either.
 *
 * The query deliberately mirrors the one inside the cards: same key, same
 * fetcher, same `staleTime`. React Query collapses them into a single request,
 * so asking here costs nothing and the card finds its data already waiting.
 * When the server has prefetched the entity (every entity route does), this
 * resolves on the very first render and the page arrives complete.
 */
export function useFocusedEntity({
  requested,
  fallback,
  network,
}: UseFocusedEntityOptions): string {
  const { data } = useQuery({
    queryKey: entityKeys.detail(requested ?? '', network),
    queryFn: () => apiFetchEntityDetails(requested as string, network),
    enabled: !!requested,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  });

  return (data ? requested : fallback) ?? '';
}

/**
 * Gates a GROUP of entity cards on all of them being ready.
 *
 * The wallet filter puts one account card above the transactions per connected
 * account. Each fetched its own details, so they trickled into the grid as
 * their requests landed: the transaction list painted first, then every account
 * card shoved it down again in turn. Clearing the search box made this obvious,
 * because that is the moment the filter comes back on.
 *
 * Holding them until the whole group has settled turns that into a single
 * change. "Settled" rather than "loaded" on purpose: one account that fails to
 * resolve must not keep the others off the page forever.
 *
 * Cheap by construction. These use the same keys and fetcher as the cards, so
 * React Query serves one request per address no matter who asks, and the server
 * has already put the connected accounts in the cache before the first render.
 */
export function useReadyEntities(addresses: string[], network: Network): string[] {
  const results = useQueries({
    queries: addresses.map((address) => ({
      queryKey: entityKeys.detail(address, network),
      queryFn: () => apiFetchEntityDetails(address, network),
      staleTime: Infinity,
      gcTime: 10 * 60_000,
    })),
  });

  if (addresses.length === 0) return NONE;
  return results.every((result) => !result.isPending) ? addresses : NONE;
}
