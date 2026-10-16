'use client';

import { useQueries } from '@tanstack/react-query';

import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import type { Network } from '@/features/dashboard/types';
import { getMetadataString, type GatewayMetadataItem } from '../lib/metadata-manifests';

/**
 * Display label (symbol, else name) per resource address. Addresses without
 * either are left out, so callers fall back to a truncated address.
 * `network` defaults to the wallet's; the explorer passes the one it shows.
 */
export function useResourceLabels(addresses: string[], network?: Network): Record<string, string> {
  const { activeNetwork: walletNetwork } = useRadixWallet();
  const activeNetwork = network ?? walletNetwork;
  const unique = [...new Set(addresses.filter((a) => a.startsWith('resource_')))];

  const results = useQueries({
    queries: unique.map((address) => ({
      queryKey: ['console-resource-label', activeNetwork, address],
      staleTime: 5 * 60_000,
      retry: false,
      queryFn: async () => {
        const details = (await apiFetchEntityDetails(address, activeNetwork)) as unknown as {
          metadata?: { items?: GatewayMetadataItem[] };
        };
        const items = details.metadata?.items;
        return getMetadataString(items, 'symbol') || getMetadataString(items, 'name');
      },
    })),
  });

  return Object.fromEntries(
    unique.flatMap((address, i) => (results[i]?.data ? [[address, results[i].data as string]] : [])),
  );
}
