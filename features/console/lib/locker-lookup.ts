/**
 * Reads an AccountLocker: who can store and recover (from its role
 * assignments), and what is waiting in it for a given account (from the
 * Gateway's locker vault pages).
 *
 * Pure apart from `fetchLockerClaims`, which takes the POST function so the
 * browser, the MCP server and the tests can each bring their own.
 */

import { sumDecimals, sumSignedDecimals } from './decimal';
import { mainRoleRule, ownerRule, type RuleView } from './role-lookup';
import type { GatewayPost } from './resource-holders';

export interface LockerState {
  address: string;
  owner: RuleView;
  storer: RuleView;
  recoverer: RuleView;
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});

/** Parses Gateway entity details; null when the entity is not an AccountLocker. */
export function parseLockerState(entity: unknown): LockerState | null {
  const e = obj(entity);
  const details = obj(e.details);
  if (details.blueprint_name !== 'AccountLocker') return null;
  const roles = obj(details.role_assignments);
  const { rule: owner } = ownerRule(e);
  return {
    address: String(e.address ?? ''),
    owner,
    storer: mainRoleRule(roles, 'storer', owner),
    recoverer: mainRoleRule(roles, 'recoverer', owner),
  };
}

/** What a locker holds for one account, per resource. */
export interface LockerClaim {
  resource: string;
  /** Fungible amount waiting. */
  amount?: string;
  /** Non-fungible ids waiting. */
  nftIds?: string[];
}

interface VaultsPage {
  next_cursor?: string;
  items?: Array<{ type?: string; resource_address?: string; vault_address?: string; amount?: string; total_count?: number }>;
}

interface IdsPage {
  next_cursor?: string;
  items?: string[];
}

/**
 * The Gateway answers 404 "Account locker not found" when the locker never
 * stored anything for that account: that is "nothing waiting", not a failure.
 */
const isNothingStored = (error: unknown) =>
  (error as { status?: number })?.status === 404 && /account locker not found/i.test(String((error as Error)?.message));

/**
 * Everything waiting for `account` in `locker`. Empty vaults (already claimed
 * or recovered) are left out.
 */
export async function fetchLockerClaims(post: GatewayPost, locker: string, account: string): Promise<LockerClaim[]> {
  const claims: LockerClaim[] = [];
  let cursor: string | undefined;
  do {
    let page: VaultsPage;
    try {
      page = await post<VaultsPage>('/state/account-locker/page/vaults', {
        locker_address: locker,
        account_address: account,
        ...(cursor ? { cursor } : {}),
      });
    } catch (error) {
      if (isNothingStored(error)) return claims;
      throw error;
    }
    for (const item of page.items ?? []) {
      const resource = item.resource_address ?? '';
      if (!resource) continue;
      if (item.type === 'NonFungible') {
        if (!item.total_count) continue;
        const nftIds = await fetchVaultIds(post, locker, item.vault_address ?? '', resource);
        if (nftIds.length) claims.push({ resource, nftIds });
      } else if (Number(item.amount ?? 0) > 0) {
        claims.push({ resource, amount: item.amount });
      }
    }
    cursor = page.next_cursor;
  } while (cursor);
  return claims;
}

/**
 * What waits in a locker for each of many accounts, a few requests at a time
 * so a long recipient list does not trip the Gateway's rate limit. An account
 * that cannot be read counts as having nothing waiting.
 */
export async function fetchWaitingFor(
  post: GatewayPost,
  locker: string,
  accounts: string[],
  concurrency = 8,
): Promise<Record<string, LockerClaim[]>> {
  const waiting: Record<string, LockerClaim[]> = {};
  for (let i = 0; i < accounts.length; i += concurrency) {
    const slice = accounts.slice(i, i + concurrency);
    const claims = await Promise.all(slice.map((account) => fetchLockerClaims(post, locker, account).catch(() => [])));
    slice.forEach((account, j) => (waiting[account] = claims[j]));
  }
  return waiting;
}

async function fetchVaultIds(post: GatewayPost, entity: string, vault: string, resource: string): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await post<IdsPage>('/state/entity/page/non-fungible-vault/ids', {
      address: entity,
      vault_address: vault,
      resource_address: resource,
      ...(cursor ? { cursor } : {}),
    });
    ids.push(...(page.items ?? []));
    cursor = page.next_cursor;
  } while (cursor);
  return ids;
}

/**
 * Bulk-send rows → airdrop claimants for one resource. The locker takes a map
 * keyed by account, so repeated accounts are merged (amounts added exactly,
 * NFT ids joined).
 */
export function claimantsFor(
  rows: Array<{ account: string; resource: string; amount: string; nftId?: string }>,
  resource: string,
): Array<{ account: string; amount?: string; nftIds?: string[] }> {
  const byAccount = new Map<string, { account: string; amount?: string; nftIds?: string[] }>();
  for (const row of rows.filter((r) => r.resource === resource)) {
    const entry = byAccount.get(row.account) ?? { account: row.account };
    if (row.nftId) entry.nftIds = [...(entry.nftIds ?? []), row.nftId];
    else entry.amount = entry.amount ? sumDecimals([entry.amount, row.amount]) : row.amount;
    byAccount.set(row.account, entry);
  }
  return [...byAccount.values()];
}

/* ─── What the locker holds, from its history ─────────────────────────────── */

/**
 * What a locker holds in all, and what it has done. The Gateway reports no
 * balances for a locker (each claimant's tokens sit in its own internal
 * vault), but every transaction's balance changes are attributed to the
 * locker itself, so adding them up over its history gives what it holds
 * now; its Store / Claim / Recover events say for whom.
 */
export interface LockerActivity {
  /** Fungible amount held, per resource (only positive balances). */
  fungibles: Record<string, string>;
  /** Number of non-fungibles held, per resource. */
  nonFungibles: Record<string, number>;
  /** Accounts something was ever stored for. */
  claimants: number;
  /** Those accounts, in the order they first received something. */
  claimantAccounts: string[];
  stores: number;
  claims: number;
  recoveries: number;
  transactions: number;
  /** The history was longer than what was read: totals are not given then. */
  truncated: boolean;
}

interface StreamPage {
  next_cursor?: string | null;
  items: Array<{
    balance_changes?: {
      fungible_balance_changes?: Array<{ entity_address: string; resource_address: string; balance_change: string }>;
      non_fungible_balance_changes?: Array<{ entity_address: string; resource_address: string; added?: string[]; removed?: string[] }>;
    } | null;
    receipt?: {
      events?: Array<{ name: string; emitter?: { entity?: { entity_address?: string } }; data?: { fields?: Array<{ field_name?: string; value?: unknown }> } }> | null;
    } | null;
  }>;
}

/** Up to `maxPages` × 100 transactions; lockers past that are reported as truncated. */
export async function fetchLockerActivity(post: GatewayPost, locker: string, maxPages = 5): Promise<LockerActivity> {
  const fungibles: Record<string, string[]> = {};
  const nonFungibles: Record<string, number> = {};
  const claimants = new Set<string>();
  let stores = 0;
  let claims = 0;
  let recoveries = 0;
  let transactions = 0;
  let cursor: string | null | undefined;
  let pages = 0;
  do {
    const page = await post<StreamPage>('/stream/transactions', {
      affected_global_entities_filter: [locker],
      limit_per_page: 100,
      opt_ins: { balance_changes: true, receipt_events: true },
      ...(cursor ? { cursor } : {}),
    });
    for (const tx of page.items) {
      transactions++;
      for (const c of tx.balance_changes?.fungible_balance_changes ?? []) {
        if (c.entity_address === locker) (fungibles[c.resource_address] ??= []).push(c.balance_change);
      }
      for (const c of tx.balance_changes?.non_fungible_balance_changes ?? []) {
        if (c.entity_address === locker) {
          nonFungibles[c.resource_address] = (nonFungibles[c.resource_address] ?? 0) + (c.added?.length ?? 0) - (c.removed?.length ?? 0);
        }
      }
      for (const e of tx.receipt?.events ?? []) {
        if (e.emitter?.entity?.entity_address !== locker) continue;
        if (e.name === 'StoreEvent') {
          stores++;
          const claimant = e.data?.fields?.find((f) => f.field_name === 'claimant')?.value;
          if (typeof claimant === 'string') claimants.add(claimant);
        } else if (e.name === 'ClaimEvent') claims++;
        else if (e.name === 'RecoverEvent') recoveries++;
      }
    }
    cursor = page.next_cursor;
    pages++;
  } while (cursor && pages < maxPages);

  const held = Object.fromEntries(
    Object.entries(fungibles)
      .map(([resource, changes]) => [resource, sumSignedDecimals(changes)] as const)
      .filter(([, amount]) => Number(amount) > 0),
  );
  return {
    fungibles: held,
    nonFungibles: Object.fromEntries(Object.entries(nonFungibles).filter(([, n]) => n > 0)),
    claimants: claimants.size,
    claimantAccounts: [...claimants],
    stores,
    claims,
    recoveries,
    transactions,
    truncated: !!cursor,
  };
}
