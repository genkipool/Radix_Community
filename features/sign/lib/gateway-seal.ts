/**
 * Isomorphic Gateway read primitives for Radix Seal (zero `'use client'`,
 * safe in both browser discovery and server-side verification / audit / MCP).
 *
 * Single source of truth for:
 *  - Gateway entity details & ledger state headers (`/state/entity/details`)
 *  - Paginated account non-fungible holdings (`/state/entity/page/non-fungibles/`)
 *  - Metadata extraction (`metadataString`, `metadataText`)
 *  - Locked owner-rule Seal extraction (`sealFromOwnerRule`, `ownerRuleGlobalId`)
 *  - Current ledger consensus clock (`/status/gateway-status`)
 */

import { gatewayPost } from '@/services/gateway/bases';
import type { Network } from '@/services/gateway/client';

export interface EntityMetadataItem {
  key?: string;
  value?: { typed?: { type?: string; value?: unknown; values?: string[] } };
  /** Whether the ledger will refuse any further change to this key. */
  is_locked?: boolean;
}

export interface NonFungibleResourceItem {
  resource_address?: string;
  vaults?: { items?: Array<{ items?: string[] }> };
}

export interface EntityDetailsItem {
  address?: string;
  metadata?: {
    items?: EntityMetadataItem[];
  };
  details?: {
    type?: string;
    total_supply?: string;
    total_minted?: string;
    total_burned?: string;
    non_fungible_data_mutable_fields?: string[];
    role_assignments?: {
      owner?: { rule?: unknown; updater?: string };
      entries?: Array<{
        role_key?: { module?: string; name?: string };
        assignment?: { resolution?: string; explicit_rule?: unknown };
        updater_roles?: unknown[];
      }>;
    };
  };
  non_fungible_resources?: {
    items?: NonFungibleResourceItem[];
    next_cursor?: string;
  };
}

interface EntityDetailsResponse {
  ledger_state?: {
    state_version?: number;
    proposer_round_timestamp?: string;
  };
  items?: EntityDetailsItem[];
}

/** Reads a single string metadata value, or `''` if absent/non-string. */
export function metadataString(
  item: EntityDetailsItem | undefined,
  key: string,
): string {
  const typed = item?.metadata?.items?.find((m) => m.key === key)?.value?.typed;
  return typeof typed?.value === 'string' ? typed.value : '';
}

/** Reads a metadata value whatever shape the Gateway returned it in. */
export function metadataText(item: EntityMetadataItem): string {
  const typed = item.value?.typed;
  if (!typed) return '';
  if (typeof typed.value === 'string') return typed.value;
  if (Array.isArray(typed.values)) return typed.values.join(', ');
  return '';
}

/**
 * Extracts the seal NFT global id from a collection's LOCKED owner rule.
 * Returns null unless the rule requires exactly a non-fungible (no AllowAll
 * escape hatch a forger could hide behind).
 */
export function sealFromOwnerRule(
  item: EntityDetailsItem | undefined,
): { resource: string; localId: string } | null {
  const owner = item?.details?.role_assignments?.owner;
  if (!owner) return null;
  const json = JSON.stringify(owner);
  if (/AllowAll/.test(json)) return null;
  let resource: string | null = null;
  let localId: string | null = null;
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if (
      typeof obj.resource_address === 'string' &&
      obj.resource_address.startsWith('resource_')
    ) {
      resource = obj.resource_address;
    }
    if (typeof obj.simple_rep === 'string') localId = obj.simple_rep;
    for (const v of Object.values(obj)) walk(v);
  };
  walk(owner);
  return resource && localId ? { resource, localId } : null;
}

/** Formats `sealFromOwnerRule(item)` as `<resource>:<localId>`, or null. */
export function ownerRuleGlobalId(
  item: EntityDetailsItem | undefined,
): string | null {
  const owner = sealFromOwnerRule(item);
  return owner ? `${owner.resource}:${owner.localId}` : null;
}

/** Batches `/state/entity/details` (20 addresses per call) with ledger cutoff. */
export async function entityDetailsWithLedger(
  network: Network,
  addresses: string[],
  optIns?: Record<string, unknown>,
): Promise<{
  items: EntityDetailsItem[];
  ledgerStateVersion: number | null;
  ledgerTimestamp: string | null;
}> {
  if (addresses.length === 0) {
    return { items: [], ledgerStateVersion: null, ledgerTimestamp: null };
  }
  const items: EntityDetailsItem[] = [];
  let ledgerStateVersion: number | null = null;
  let ledgerTimestamp: string | null = null;
  for (let i = 0; i < addresses.length; i += 20) {
    const data = await gatewayPost<EntityDetailsResponse>(
      network,
      '/state/entity/details',
      {
        addresses: addresses.slice(i, i + 20),
        aggregation_level: 'Vault',
        ...(optIns ? { opt_ins: optIns } : {}),
      },
    );
    items.push(...(data.items ?? []));
    if (
      ledgerStateVersion == null &&
      typeof data.ledger_state?.state_version === 'number'
    ) {
      ledgerStateVersion = data.ledger_state.state_version;
    }
    if (
      ledgerTimestamp == null &&
      typeof data.ledger_state?.proposer_round_timestamp === 'string'
    ) {
      ledgerTimestamp = data.ledger_state.proposer_round_timestamp;
    }
  }
  return { items, ledgerStateVersion, ledgerTimestamp };
}

export async function entityDetails(
  network: Network,
  addresses: string[],
  optIns?: Record<string, unknown>,
): Promise<EntityDetailsItem[]> {
  return (await entityDetailsWithLedger(network, addresses, optIns)).items;
}

/**
 * Fetches every non-fungible resource held by `account`, following pagination
 * so accounts with many NFT resources do not push their Seal or signing
 * collection off the first page.
 */
export async function allAccountNonFungibleResources(
  network: Network,
  account: string,
  optIns?: Record<string, unknown>,
  maxPages = 10,
): Promise<NonFungibleResourceItem[]> {
  const [accountItem] = await entityDetails(network, [account], optIns);
  const first = accountItem?.non_fungible_resources;
  const items: NonFungibleResourceItem[] = [...(first?.items ?? [])];
  let cursor = first?.next_cursor;
  let pages = 0;
  while (cursor && pages < maxPages) {
    pages += 1;
    const page = await gatewayPost<{
      items?: NonFungibleResourceItem[];
      next_cursor?: string;
    }>(network, '/state/entity/page/non-fungibles/', {
      address: account,
      aggregation_level: 'Vault',
      cursor,
      ...(optIns ? { opt_ins: optIns } : {}),
    }).catch(() => null);
    if (!page) break;
    items.push(...(page.items ?? []));
    cursor = page.next_cursor;
  }
  return items;
}

/**
 * Current consensus time as ISO-8601 from `/status/gateway-status`, falling back
 * to the local clock only if the Gateway is temporarily unreachable.
 */
export async function fetchLedgerTimestampNow(
  network: Network,
): Promise<string> {
  try {
    const status = await gatewayPost<{
      ledger_state?: { proposer_round_timestamp?: string };
    }>(network, '/status/gateway-status', {});
    const stamp = status.ledger_state?.proposer_round_timestamp;
    if (stamp && !Number.isNaN(Date.parse(stamp))) return stamp;
  } catch {
    /* fallback below */
  }
  return new Date().toISOString();
}
