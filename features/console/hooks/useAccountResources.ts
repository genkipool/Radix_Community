'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { getMetadataString, type GatewayMetadataItem } from '../lib/metadata-manifests';
import type { AccountHoldings, FungibleHolding, NonFungibleHolding } from '../types/console.types';

interface GatewayResourceItem {
  resource_address: string;
  explicit_metadata?: { items?: GatewayMetadataItem[] };
  vaults?: {
    items?: Array<{ amount?: string; total_count?: number; items?: string[] }>;
  };
}

function sumVaultAmounts(item: GatewayResourceItem): string {
  const total = (item.vaults?.items ?? []).reduce(
    (acc, vault) => acc + Number(vault.amount ?? 0),
    0,
  );
  return String(total);
}

function mapHoldings(details: Record<string, unknown>): AccountHoldings {
  const fungibleItems =
    ((details.fungible_resources as { items?: GatewayResourceItem[] })?.items ?? []);
  const nonFungibleItems =
    ((details.non_fungible_resources as { items?: GatewayResourceItem[] })?.items ?? []);

  const fungibles: FungibleHolding[] = fungibleItems.map((item) => ({
    resourceAddress: item.resource_address,
    name: getMetadataString(item.explicit_metadata?.items, 'name'),
    symbol: getMetadataString(item.explicit_metadata?.items, 'symbol'),
    iconUrl: getMetadataString(item.explicit_metadata?.items, 'icon_url') || undefined,
    amount: sumVaultAmounts(item),
  }));

  const nonFungibles: NonFungibleHolding[] = nonFungibleItems.map((item) => ({
    resourceAddress: item.resource_address,
    name: getMetadataString(item.explicit_metadata?.items, 'name'),
    iconUrl: getMetadataString(item.explicit_metadata?.items, 'icon_url') || undefined,
    ids: (item.vaults?.items ?? []).flatMap((vault) => vault.items ?? []),
  }));

  return { fungibles, nonFungibles };
}

/**
 * Loads the fungible and non-fungible holdings of an account, with metadata,
 * from the Radix Gateway. Used by the console tools to offer resource pickers.
 */
export function useAccountResources(accountAddress: string | null) {
  const { activeNetwork } = useRadixWallet();

  return useQuery({
    queryKey: ['console-account-resources', activeNetwork, accountAddress],
    queryFn: async () => {
      const details = await apiFetchEntityDetails(accountAddress!, activeNetwork);
      return mapHoldings(details as unknown as Record<string, unknown>);
    },
    enabled: !!accountAddress,
    staleTime: 30_000,
  });
}
