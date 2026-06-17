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
 * Loads the fungible and non-fungible holdings of one or more accounts, with metadata,
 * from the Radix Gateway. Used by the console tools to offer resource pickers.
 */
export function useAccountResources(accountAddresses: string[] | string | null) {
  const { activeNetwork } = useRadixWallet();

  const addresses = Array.isArray(accountAddresses) ? accountAddresses : (accountAddresses ? [accountAddresses] : []);

  return useQuery({
    queryKey: ['console-account-resources', activeNetwork, addresses.join(',')],
    queryFn: async () => {
      const mergedHoldings: AccountHoldings = { fungibles: [], nonFungibles: [] };
      if (addresses.length === 0) return mergedHoldings;

      const promises = addresses.map(addr => apiFetchEntityDetails(addr, activeNetwork));
      const results = await Promise.all(promises);

      for (const details of results) {
        const holdings = mapHoldings(details as unknown as Record<string, unknown>);
        
        // Merge fungibles
        for (const f of holdings.fungibles) {
          const existing = mergedHoldings.fungibles.find(e => e.resourceAddress === f.resourceAddress);
          if (existing) {
            existing.amount = String(Number(existing.amount) + Number(f.amount));
          } else {
            mergedHoldings.fungibles.push(f);
          }
        }

        // Merge nonFungibles
        for (const nf of holdings.nonFungibles) {
          const existing = mergedHoldings.nonFungibles.find(e => e.resourceAddress === nf.resourceAddress);
          if (existing) {
            existing.ids = Array.from(new Set([...existing.ids, ...nf.ids]));
          } else {
            mergedHoldings.nonFungibles.push(nf);
          }
        }
      }

      return mergedHoldings;
    },
    enabled: addresses.length > 0,
    staleTime: 30_000,
  });
}
