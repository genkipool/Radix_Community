'use client';

import { useQueries } from '@tanstack/react-query';

import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import type { Network } from '@/features/dashboard/types';
import { getMetadataString, type GatewayMetadataItem } from '../lib/metadata-manifests';

/**
 * Display label (symbol, else name) and icon per resource address, plus the addresses
 * still loading, so a caller can hold a placeholder instead of showing the
 * address first and swapping it for the name a moment later. Addresses with
 * neither symbol nor name are left out of `labels` once loaded.
 * `network` defaults to the wallet's; the explorer passes the one it shows.
 */
export function useResourceLabelsState(addresses: string[], network?: Network) {
  const { activeNetwork: walletNetwork } = useRadixWallet();
  const activeNetwork = network ?? walletNetwork;
  const unique = [...new Set(addresses.filter((a) => a.startsWith('resource_')))];

  const results = useQueries({
    queries: unique.map((address) => ({
      queryKey: ['console-resource-identity', activeNetwork, address],
      staleTime: 5 * 60_000,
      retry: false,
      queryFn: async () => {
        const details = (await apiFetchEntityDetails(address, activeNetwork)) as unknown as {
          metadata?: { items?: GatewayMetadataItem[] };
        };
        const items = details.metadata?.items;
        return {
          label: getMetadataString(items, 'symbol') || getMetadataString(items, 'name'),
          icon: getMetadataString(items, 'icon_url'),
        };
      },
    })),
  });

  return {
    labels: Object.fromEntries(
      unique.flatMap((address, i) => (results[i]?.data?.label ? [[address, results[i].data!.label]] : [])),
    ) as Record<string, string>,
    /** Icon URL per resource, for those that have one. */
    icons: Object.fromEntries(
      unique.flatMap((address, i) => (results[i]?.data?.icon ? [[address, results[i].data!.icon]] : [])),
    ) as Record<string, string>,
    loading: new Set(unique.filter((_, i) => results[i]?.isPending)),
  };
}

/** Display label per resource address; callers fall back to a truncated address. */
export function useResourceLabels(addresses: string[], network?: Network): Record<string, string> {
  return useResourceLabelsState(addresses, network).labels;
}
