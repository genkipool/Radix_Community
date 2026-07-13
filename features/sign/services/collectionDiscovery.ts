'use client';

/**
 * Discovers a user's Radix Seal attestation collection on-ledger — no server
 * state. The collection is the (single) non-fungible resource the account
 * holds whose metadata carries our marker (`radix_seal_collection = v1`).
 * Result is cached in localStorage per (network, account) but always
 * re-verified against the ledger, so a cleared cache or a new device just
 * re-discovers it. `nextId = totalSupply + 1` (ids are contiguous — burning is
 * denied).
 */
import { gatewayPost } from '@/services/gateway/bases';
import type { Network } from '@/services/gateway/client';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { COLLECTION_MARKER_KEY, COLLECTION_MARKER_VALUE } from '../constants/seal';

export interface UserCollection {
  resourceAddress: string;
  totalSupply: number;
}

interface MetadataItem {
  key: string;
  value?: { typed?: { value?: string; type?: string } };
}
interface EntityDetailsItem {
  address: string;
  metadata?: { items?: MetadataItem[] };
  details?: { total_supply?: string; type?: string };
  non_fungible_resources?: { items?: Array<{ resource_address: string }> };
}
interface EntityDetailsResponse {
  items?: EntityDetailsItem[];
}

export function networkName(networkId: number): Network {
  return networkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
}

function metadataValue(item: EntityDetailsItem, key: string): string | undefined {
  return item.metadata?.items?.find((m) => m.key === key)?.value?.typed?.value;
}

async function entityDetails(
  network: Network,
  addresses: string[],
): Promise<EntityDetailsItem[]> {
  if (addresses.length === 0) return [];
  const data = await gatewayPost<EntityDetailsResponse>(
    network,
    '/state/entity/details',
    { addresses, aggregation_level: 'Global' },
  );
  return data.items ?? [];
}

function isMarkedCollection(item: EntityDetailsItem): boolean {
  return metadataValue(item, COLLECTION_MARKER_KEY) === COLLECTION_MARKER_VALUE;
}

function toSupply(item: EntityDetailsItem): number {
  return Math.floor(Number(item.details?.total_supply ?? '0')) || 0;
}

const cacheKey = (networkId: number, account: string) =>
  `radix-seal-collection:${networkId}:${account}`;

function readCache(networkId: number, account: string): string | null {
  try {
    return localStorage.getItem(cacheKey(networkId, account));
  } catch {
    return null;
  }
}

function writeCache(networkId: number, account: string, resource: string): void {
  try {
    localStorage.setItem(cacheKey(networkId, account), resource);
  } catch {
    /* private mode / disabled storage — discovery still works, just uncached */
  }
}

/** Returns the account's collection, or null if they don't have one yet. */
export async function findUserCollection(
  networkId: number,
  account: string,
): Promise<UserCollection | null> {
  const network = networkName(networkId);

  // Fast path: verify the cached resource still marks itself as our collection.
  const cached = readCache(networkId, account);
  if (cached) {
    const [item] = await entityDetails(network, [cached]).catch(() => []);
    if (item && isMarkedCollection(item)) {
      return { resourceAddress: cached, totalSupply: toSupply(item) };
    }
  }

  // Full scan: enumerate the account's NF resources, then read their metadata.
  const [accountItem] = await entityDetails(network, [account]);
  const held = (accountItem?.non_fungible_resources?.items ?? []).map(
    (r) => r.resource_address,
  );
  for (let i = 0; i < held.length; i += 20) {
    const details = await entityDetails(network, held.slice(i, i + 20));
    const match = details.find(isMarkedCollection);
    if (match) {
      writeCache(networkId, account, match.address);
      return { resourceAddress: match.address, totalSupply: toSupply(match) };
    }
  }
  return null;
}

export function rememberCollection(
  networkId: number,
  account: string,
  resourceAddress: string,
): void {
  writeCache(networkId, account, resourceAddress);
}
