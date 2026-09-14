'use client';

/**
 * features/dashboard/staking/hooks/useValidatorsQuery.ts
 *
 * React Query for validators + network stats.
 * Cache is pre-warmed server-side via HydrationBoundary — first render is instant.
 *
 * The list is kept for five minutes, which is right for stake and uptime but
 * wrong for a validator that was just created, registered or renamed. So the
 * validator set fingerprint is polled every half minute, and when it no longer
 * matches the list on screen the list is fetched again for that fingerprint.
 * The previous list stays rendered until the new one has arrived and then is
 * replaced in a single update: no skeleton, no half-updated grid.
 */

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  apiFetchValidators,
  apiFetchValidatorSetFingerprint,
} from '@/features/dashboard/services/apiClient';
import type { Validator, NetworkStats } from '@/types/radix';
import type { Network } from '@/features/dashboard/types';

interface ValidatorsData {
  validators:   Validator[];
  networkStats: NetworkStats;
  /** Validator set fingerprint the list was built from. */
  fingerprint?: string;
}

/** How often the live fingerprint is checked; matches its server-side lifetime. */
const FINGERPRINT_POLL_MS = 30_000;

/**
 * @param enabled  Views that do not show validators pass `false`, so the
 *                 explorer neither ships the list in its payload nor fetches
 *                 it on the client. Its aggregate figures arrive separately as
 *                 `networkStats` from the server.
 */
export function useValidatorsQuery(network: Network, enabled = true) {
  const apiNetwork = network as 'mainnet' | 'stokenet';

  const { data: live } = useQuery({
    enabled,
    queryKey:                ['validators-fingerprint', network],
    queryFn:                 () => apiFetchValidatorSetFingerprint(apiNetwork),
    staleTime:               FINGERPRINT_POLL_MS,
    refetchInterval:         FINGERPRINT_POLL_MS,
    refetchIntervalInBackground: false,
    retry:                   1,
  });
  const liveFingerprint = live?.fingerprint;

  const query = useQuery<ValidatorsData>({
    enabled,
    queryKey:    ['validators', network],
    queryFn:     () => apiFetchValidators(apiNetwork, liveFingerprint),
    staleTime:               300_000,
    refetchInterval:         300_000,
    refetchIntervalInBackground: false,
    placeholderData:         (prev) => prev,
    /*
     * The Gateway has bad seconds — a rate limit, a slow round — and the API
     * now says so with a 503 instead of an empty list. Retrying is what turns
     * that back into a page: four attempts backing off from a quarter second
     * to four, which outlives a hiccup without hammering a service that is
     * already struggling.
     */
    retry:                   4,
    retryDelay:              (attempt) => Math.min(250 * 2 ** attempt, 4_000),
  });

  /*
   * One refetch per fingerprint. If the server could not rebuild in time and
   * answers with the old list again, asking over and over would not help: the
   * next poll or the regular refetch picks the change up.
   */
  const requestedFingerprint = useRef<string | undefined>(undefined);
  const shownFingerprint = query.data?.fingerprint;
  const { refetch, isFetching } = query;

  useEffect(() => {
    if (!enabled || isFetching || !liveFingerprint || !shownFingerprint) return;
    if (liveFingerprint === shownFingerprint) return;
    if (requestedFingerprint.current === liveFingerprint) return;
    requestedFingerprint.current = liveFingerprint;
    void refetch();
  }, [enabled, isFetching, liveFingerprint, shownFingerprint, refetch]);

  return query;
}
