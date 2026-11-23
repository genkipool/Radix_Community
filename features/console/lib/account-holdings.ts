/**
 * Pure mapping from Gateway entity-details responses to account holdings.
 * Shared by the console hooks (client) and the MCP ledger tools (server).
 */

import Big from 'big.js';
import { getMetadataString, type GatewayMetadataItem } from './metadata-manifests';
import type { AccountHoldings, FungibleHolding, NonFungibleHolding } from '../types/console.types';

export interface GatewayResourceItem {
  resource_address: string;
  explicit_metadata?: { items?: GatewayMetadataItem[] };
  /** Present with aggregation_level "Global" — the amount comes on the item itself. */
  amount?: string | number;
  /** Present with aggregation_level "Vault" — amounts/ids come per vault. */
  vaults?: {
    items?: Array<{ vault_address?: string; amount?: string; total_count?: number; items?: string[] }>;
  };
}

function sumVaultAmounts(item: GatewayResourceItem): string {
  const vaults = item.vaults?.items;
  if (!vaults) return String(item.amount ?? '0');
  if (vaults.length === 1) return vaults[0].amount ?? '0';
  const total = vaults.reduce((acc, vault) => {
    try {
      return acc.plus(new Big(vault.amount ?? '0'));
    } catch {
      return acc;
    }
  }, new Big(0));
  return total.toFixed();
}

const XRD_ICON_URL = 'https://assets.coingecko.com/coins/images/4374/standard/Radix.png';
const isXrdResource = (address: string) => address.includes('tknxxxxxxxxxradxrd');

export function mapHoldings(details: Record<string, unknown>): AccountHoldings {
  const fungibleItems =
    ((details.fungible_resources as { items?: GatewayResourceItem[] })?.items ?? []);
  const nonFungibleItems =
    ((details.non_fungible_resources as { items?: GatewayResourceItem[] })?.items ?? []);

  const fungibles: FungibleHolding[] = fungibleItems.map((item) => {
    const isXrd = isXrdResource(item.resource_address);
    return {
      resourceAddress: item.resource_address,
      name: getMetadataString(item.explicit_metadata?.items, 'name') || (isXrd ? 'Radix' : ''),
      symbol: getMetadataString(item.explicit_metadata?.items, 'symbol') || (isXrd ? 'XRD' : ''),
      iconUrl: getMetadataString(item.explicit_metadata?.items, 'icon_url') || (isXrd ? XRD_ICON_URL : undefined),
      amount: sumVaultAmounts(item),
      vaultAddress: item.vaults?.items?.[0]?.vault_address || undefined,
      pool: getMetadataString(item.explicit_metadata?.items, 'pool') || undefined,
    };
  });

  const nonFungibles: NonFungibleHolding[] = nonFungibleItems.map((item) => ({
    resourceAddress: item.resource_address,
    name: getMetadataString(item.explicit_metadata?.items, 'name'),
    iconUrl: getMetadataString(item.explicit_metadata?.items, 'icon_url') || undefined,
    ids: (item.vaults?.items ?? []).flatMap((vault) => vault.items ?? []),
    vaultAddress: item.vaults?.items?.[0]?.vault_address || undefined,
  }));

  return { fungibles, nonFungibles };
}
