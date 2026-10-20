'use client';

/**
 * features/dashboard/explorador/hooks/useEntityDetailsBatch.ts
 *
 * Full details for a set of entities in as few requests as the Gateway allows.
 *
 * Entities already in the explorer's cache (entityKeys.full) are taken from it;
 * the rest arrive in one request per 20 addresses, and each lands under the
 * same keys a single card would use, so opening any of them later, here or
 * in another card, asks for nothing.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetchEntityDetailsBatch } from '@/features/dashboard/services/apiClient';
import { entityKeys, needsFetch } from '@/features/dashboard/hooks/useEntityData';
import type { GatewayEntityDetails, Network } from '@/features/dashboard/types';

export function useEntityDetailsBatch(addresses: string[], network: Network) {
  const queryClient = useQueryClient();
  const unique = [...new Set(addresses.filter(needsFetch))].sort();

  return useQuery({
    queryKey: ['entity-batch', network, unique],
    queryFn: async (): Promise<Record<string, GatewayEntityDetails>> => {
      const cached = Object.fromEntries(unique.flatMap((address) => {
        const hit = queryClient.getQueryData<GatewayEntityDetails>(entityKeys.full(address, network));
        return hit ? [[address, hit]] : [];
      }));
      const missing = unique.filter((address) => !cached[address]);
      const fetched = missing.length ? await apiFetchEntityDetailsBatch(missing, network) : {};
      for (const [address, details] of Object.entries(fetched)) {
        // Both entries hold full details: cards read either, and the name,
        // icon and symbol hook reads its fields out of the second.
        queryClient.setQueryData(entityKeys.full(address, network), details);
        if (queryClient.getQueryData(entityKeys.detail(address, network)) === undefined) {
          queryClient.setQueryData(entityKeys.detail(address, network), details);
        }
      }
      return { ...cached, ...fetched };
    },
    enabled: unique.length > 0,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    retry: 1,
  });
}
