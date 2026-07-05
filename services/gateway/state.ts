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
