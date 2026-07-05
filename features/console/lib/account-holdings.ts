/**
 * Pure mapping from Gateway entity-details responses to account holdings.
 * Shared by the console hooks (client) and the MCP ledger tools (server).
 */

import { getMetadataString, type GatewayMetadataItem } from './metadata-manifests';
import type { AccountHoldings, FungibleHolding, NonFungibleHolding } from '../types/console.types';

export interface GatewayResourceItem {
  resource_address: string;
  explicit_metadata?: { items?: GatewayMetadataItem[] };
  vaults?: {
    items?: Array<{ vault_address?: string; amount?: string; total_count?: number; items?: string[] }>;
  };
}

function sumVaultAmounts(item: GatewayResourceItem): string {
  const total = (item.vaults?.items ?? []).reduce(
    (acc, vault) => acc + Number(vault.amount ?? 0),
    0,
  );
  return String(total);
}

export function mapHoldings(details: Record<string, unknown>): AccountHoldings {
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
    vaultAddress: item.vaults?.items?.[0]?.vault_address || undefined,
  }));

  const nonFungibles: NonFungibleHolding[] = nonFungibleItems.map((item) => ({
    resourceAddress: item.resource_address,
    name: getMetadataString(item.explicit_metadata?.items, 'name'),
    iconUrl: getMetadataString(item.explicit_metadata?.items, 'icon_url') || undefined,
    ids: (item.vaults?.items ?? []).flatMap((vault) => vault.items ?? []),
    vaultAddress: item.vaults?.items?.[0]?.vault_address || undefined,
  }));

  return { fungibles, nonFungibles };
}
