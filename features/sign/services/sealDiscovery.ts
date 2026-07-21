'use client';

/**
 * On-ledger discovery for the single signing flow — no server state:
 *
 *  - the user's own SEAL NFT (their soulbound insignia, minted from the
 *    open-mint Radix Seal brand), and
 *  - the user's SIGNING COLLECTION (the resource owned by that seal, marked
 *    with `radix_sign_collection = v1`), plus its next free integer id
 *    (`totalSupply + 1`; ids are contiguous for practical purposes).
 *
 * Results are cached in localStorage per (network, account) but always
 * re-verified against the ledger.
 */
import { gatewayPost } from '@/services/gateway/bases';
import type { Network } from '@/services/gateway/client';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import {
  radixSealAddress,
  RADIX_SEAL_STANDARD_KEY,
  SIGN_COLLECTION_MARKER_KEY,
  SIGN_COLLECTION_MARKER_VALUE,
} from '../constants/seal';

export interface UserSeal {
  /** `<seal resource>:<local id>` — the collection owner rule's requirement. */
  globalId: string;
  localId: string;
}

export interface UserSignCollection {
  resourceAddress: string;
  totalSupply: number;
}

interface MetadataItem {
  key: string;
  value?: { typed?: { value?: string; type?: string } };
}
interface NonFungibleResourceItem {
  resource_address: string;
  vaults?: { items?: Array<{ items?: string[] }> };
}
interface EntityDetailsItem {
  address: string;
  metadata?: { items?: MetadataItem[] };
  details?: { total_supply?: string };
  non_fungible_resources?: {
    items?: NonFungibleResourceItem[];
    /** Set when the account holds more NFT resources than one page returns. */
    next_cursor?: string;
  };
}
interface EntityDetailsResponse {
  items?: EntityDetailsItem[];
}

function network(networkId: number): Network {
  return networkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
}

async function entityDetails(
  net: Network,
  addresses: string[],
  optIns?: Record<string, unknown>,
): Promise<EntityDetailsItem[]> {
  if (addresses.length === 0) return [];
  const data = await gatewayPost<EntityDetailsResponse>(
    net,
    '/state/entity/details',
    {
      addresses,
      aggregation_level: optIns ? 'Vault' : 'Global',
      ...(optIns ? { opt_ins: optIns } : {}),
    },
  );
  return data.items ?? [];
}

/**
 * Every non-fungible resource the account holds, following pagination. The
 * first page rides on the entity-details response; the rest come from the
 * non-fungibles page endpoint. Without this an account holding many NFT
 * resources can push its seal or signing collection past the first page, so
 * discovery misses it and wrongly re-shows the "create collection" onboarding
 * (typically when a shared link switches network and the localStorage cache no
 * longer short-circuits the scan).
 */
async function allNonFungibleResources(
  net: Network,
  account: string,
  optIns?: Record<string, unknown>,
): Promise<NonFungibleResourceItem[]> {
  const [item] = await entityDetails(net, [account], optIns);
  const first = item?.non_fungible_resources;
  const items: NonFungibleResourceItem[] = [...(first?.items ?? [])];
  let cursor = first?.next_cursor;
  while (cursor) {
    const page = await gatewayPost<{
      items?: NonFungibleResourceItem[];
      next_cursor?: string;
    }>(net, '/state/entity/page/non-fungibles/', {
      address: account,
      aggregation_level: optIns ? 'Vault' : 'Global',
      cursor,
      ...(optIns ? { opt_ins: optIns } : {}),
    }).catch(() => null);
    if (!page) break;
    items.push(...(page.items ?? []));
    cursor = page.next_cursor;
  }
  return items;
}

/* ─── Seal ────────────────────────────────────────────────────────────────── */

/** The account's own seal NFT, or null (not minted yet / brand undeployed). */
export async function findUserSeal(
  networkId: number,
  account: string,
): Promise<UserSeal | null> {
  const sealResource = radixSealAddress(networkId);
  if (!sealResource) return null;
  const items = await allNonFungibleResources(network(networkId), account, {
    non_fungible_include_nfids: true,
  });
  const vaults =
    items.find((r) => r.resource_address === sealResource)?.vaults?.items ?? [];
  const localId = vaults.flatMap((v) => v.items ?? [])[0];
  return localId
    ? { globalId: `${sealResource}:${localId}`, localId }
    : null;
}

/* ─── Signing collection ──────────────────────────────────────────────────── */

function metadataValue(item: EntityDetailsItem, key: string): string | undefined {
  return item.metadata?.items?.find((m) => m.key === key)?.value?.typed?.value;
}

function isSignCollection(item: EntityDetailsItem): boolean {
  return (
    metadataValue(item, SIGN_COLLECTION_MARKER_KEY) ===
    SIGN_COLLECTION_MARKER_VALUE
  );
}

/**
 * True when the collection references the CURRENT official Radix Seal resource
 * (its locked `radix_seal` metadata). After a brand redeploy the seal resource
 * address changes, so a collection created for an OLD seal must NOT be treated
 * as ready: it can no longer be minted into with the user's new seal, and a new
 * collection has to be created. When the brand is not deployed the check is
 * skipped (nothing to compare against).
 */
function belongsToCurrentSeal(item: EntityDetailsItem, networkId: number): boolean {
  const official = radixSealAddress(networkId);
  if (!official) return true;
  return metadataValue(item, RADIX_SEAL_STANDARD_KEY) === official;
}

function forgetSignCollection(networkId: number, account: string): void {
  try {
    localStorage.removeItem(cacheKey(networkId, account));
  } catch {
    /* ignore */
  }
}

function toSupply(item: EntityDetailsItem): number {
  return Math.floor(Number(item.details?.total_supply ?? '0')) || 0;
}

const cacheKey = (networkId: number, account: string) =>
  `radix-sign-collection:${networkId}:${account}`;

function readCache(networkId: number, account: string): string | null {
  try {
    return localStorage.getItem(cacheKey(networkId, account));
  } catch {
    return null;
  }
}

export function rememberSignCollection(
  networkId: number,
  account: string,
  resourceAddress: string,
): void {
  try {
    localStorage.setItem(cacheKey(networkId, account), resourceAddress);
  } catch {
    /* private mode — discovery still works, just uncached */
  }
}

/** The account's signing collection, or null if not created yet. */
export async function findSignCollection(
  networkId: number,
  account: string,
): Promise<UserSignCollection | null> {
  const net = network(networkId);

  const cached = readCache(networkId, account);
  if (cached) {
    const [item] = await entityDetails(net, [cached]).catch(() => []);
    if (item && isSignCollection(item) && belongsToCurrentSeal(item, networkId)) {
      return { resourceAddress: cached, totalSupply: toSupply(item) };
    }
    // Stale (e.g. a collection from a previous seal deploy): drop it.
    forgetSignCollection(networkId, account);
  }

  const held = (await allNonFungibleResources(net, account)).map(
    (r) => r.resource_address,
  );
  for (let i = 0; i < held.length; i += 20) {
    const details = await entityDetails(net, held.slice(i, i + 20));
    const match = details.find(
      (item) => isSignCollection(item) && belongsToCurrentSeal(item, networkId),
    );
    if (match) {
      rememberSignCollection(networkId, account, match.address);
      return { resourceAddress: match.address, totalSupply: toSupply(match) };
    }
  }
  return null;
}
