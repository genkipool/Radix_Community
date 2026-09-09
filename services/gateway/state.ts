/**
 * services/gateway/state.ts
 *
 * Gateway state endpoints not wrapped elsewhere: non-fungible id listing,
 * resource holders and key-value store contents.
 * Used by: the MCP ledger tools.
 */

import { cacheLife, cacheTag } from 'next/cache';
import { withRetry, type Network } from './client';
import { gatewayPost } from './bases';

/* ─── Where a non-fungible lives ──────────────────────────────────────────── */

export interface NonFungibleHolder {
  /** Vault holding the NFT. */
  vault: string;
  /** Global entity owning that vault: an account, an access controller, … */
  holder?: string;
}

/**
 * Locates non-fungibles by id. Server-side counterpart of
 * `apiFetchNonFungibleLocation` in the dashboard's api client.
 *
 * Not cached: an NFT's whereabouts is exactly the thing that changes when
 * someone moves it, and the security check exists to notice that.
 */
export async function fetchNonFungibleLocations(
  resourceAddress: string,
  localIds: string[],
  network: Network = 'mainnet',
): Promise<Record<string, NonFungibleHolder>> {
  if (localIds.length === 0) return {};

  const res = await withRetry(() =>
    gatewayPost<{
      non_fungible_ids?: Array<{
        non_fungible_id: string;
        owning_vault_address?: string;
        owning_vault_global_ancestor_address?: string;
      }>;
    }>(network, '/state/non-fungible/location', {
      resource_address: resourceAddress,
      non_fungible_ids: localIds.slice(0, 100),
    }),
  );

  const located: Record<string, NonFungibleHolder> = {};
  for (const item of res.non_fungible_ids ?? []) {
    if (!item.owning_vault_address) continue;
    located[item.non_fungible_id] = {
      vault: item.owning_vault_address,
      holder: item.owning_vault_global_ancestor_address,
    };
  }
  return located;
}

/* ─── Non-fungible ids of a collection ────────────────────────────────────── */

export async function fetchNonFungibleIds(
  resourceAddress: string,
  network: Network = 'mainnet',
): Promise<{ totalCount: number | null; ids: string[] }> {
  'use cache';
  cacheLife('minutes');
  cacheTag('nft', `nft-ids-${resourceAddress}`);

  const res = await withRetry(() =>
    gatewayPost<{
      non_fungible_ids?: { total_count?: number; items?: string[] };
    }>(network, '/state/non-fungible/ids', { resource_address: resourceAddress }),
  );
  return {
    totalCount: res.non_fungible_ids?.total_count ?? null,
    ids: res.non_fungible_ids?.items ?? [],
  };
}

/**
 * Live total supply of a non-fungible resource — the count of NFTs that still
 * exist, EXCLUDING burned ones. (The `/non-fungible/ids` list and its
 * total_count keep burned ids, so they over-count a collection that has burns.)
 */
export async function fetchNonFungibleSupply(
  resourceAddress: string,
  network: Network = 'mainnet',
): Promise<string | null> {
  'use cache';
  cacheLife('minutes');
  cacheTag('nft', `nft-supply-${resourceAddress}`);

  const res = await withRetry(() =>
    gatewayPost<{ items?: Array<{ details?: { total_supply?: string } }> }>(
      network,
      '/state/entity/details',
      { addresses: [resourceAddress], aggregation_level: 'Global' },
    ),
  );
  return res.items?.[0]?.details?.total_supply ?? null;
}

/* ─── Top holders of a resource ───────────────────────────────────────────── */

export interface ResourceHolder {
  holderAddress: string;
  amount: string;
  /** 'Fungible' holds an amount; 'NonFungible' holds a count of ids */
  type: string;
}

export async function fetchResourceHolders(
  resourceAddress: string,
  network: Network = 'mainnet',
): Promise<{ totalCount: number | null; holders: ResourceHolder[] }> {
  'use cache';
  cacheLife('minutes');
  cacheTag('holders', `holders-${resourceAddress}`);

  const res = await withRetry(() =>
    gatewayPost<{
      total_count?: number;
      items?: Array<{
        holder_address?: string;
        type?: string;
        amount?: string;
        non_fungible_ids_count?: number;
      }>;
    }>(network, '/extensions/resource-holders/page', { resource_address: resourceAddress }),
  );

  return {
    totalCount: res.total_count ?? null,
    holders: (res.items ?? []).map((item) => ({
      holderAddress: item.holder_address ?? '',
      amount: item.amount ?? String(item.non_fungible_ids_count ?? ''),
      type: item.type ?? '',
    })),
  };
}

/* ─── Key-value store contents ────────────────────────────────────────────── */

export interface KeyValueStoreEntry {
  key: unknown;
  value: unknown;
}

export async function fetchKeyValueStoreEntries(
  kvsAddress: string,
  network: Network = 'mainnet',
  maxEntries = 20,
): Promise<{ totalKeys: number; entries: KeyValueStoreEntry[] }> {
  'use cache';
  cacheLife('minutes');
  cacheTag('kvs', `kvs-${kvsAddress}`);

  const keysRes = await withRetry(() =>
    gatewayPost<{
      items?: Array<{ key?: { raw_hex?: string; programmatic_json?: unknown } }>;
    }>(network, '/state/key-value-store/keys', { key_value_store_address: kvsAddress }),
  );
  const keys = (keysRes.items ?? []).slice(0, maxEntries);
  if (keys.length === 0) return { totalKeys: 0, entries: [] };

  const dataRes = await withRetry(() =>
    gatewayPost<{
      entries?: Array<{
        key?: { programmatic_json?: unknown };
        value?: { programmatic_json?: unknown };
      }>;
    }>(network, '/state/key-value-store/data', {
      key_value_store_address: kvsAddress,
      keys: keys.map((item) => ({ key_hex: item.key?.raw_hex ?? '' })),
    }),
  );

  return {
    totalKeys: keysRes.items?.length ?? keys.length,
    entries: (dataRes.entries ?? []).map((entry) => ({
      key: entry.key?.programmatic_json ?? null,
      value: entry.value?.programmatic_json ?? null,
    })),
  };
}
