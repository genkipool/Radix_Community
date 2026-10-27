/**
 * What each participant has put into a native pool, from the pool's history.
 *
 * The Gateway keeps no per-account record of contributions, but every
 * contribution and redemption shows in the transaction's balance changes: the
 * account's pool units go up (or down) and its reserve resources go the other
 * way. Adding those reserve changes up per account gives what it has put in
 * and what it has taken back by redeeming.
 *
 * `poolContributions` is pure; `fetchPoolContributions` reads the history
 * through the POST function the caller brings (browser, MCP, tests).
 */

import { sumSignedDecimals } from './decimal';
import type { GatewayPost } from './resource-holders';

export interface PoolHistoryTransaction {
  confirmed_at?: string | null;
  balance_changes?: {
    fungible_balance_changes?: Array<{ entity_address: string; resource_address: string; balance_change: string }>;
  } | null;
}

/** Per reserve resource, what an account put in and what it took back. */
export interface AccountPoolFlows {
  putIn: Record<string, string>;
  takenOut: Record<string, string>;
}

/**
 * Reserves moved by the manager: the pool's own balance changed in a
 * transaction where no pool unit moved, which only protected_deposit and
 * protected_withdraw do. On a DEX pool that is every swap; on a pool managed
 * by a badge, it is a person taking reserves out (or putting them in).
 */
export interface ManagerMoves {
  /** Transactions with such a move. */
  count: number;
  withdrawn: Record<string, string>;
  deposited: Record<string, string>;
  /** When the latest one was confirmed (the history is newest first). */
  lastAt: string | null;
}

export interface PoolContributions {
  byAccount: Record<string, AccountPoolFlows>;
  managerMoves: ManagerMoves;
  transactions: number;
  /** The history was longer than what was read: amounts cover the latest part only. */
  truncated: boolean;
}

/**
 * What each account put in and took back. Only transactions where the
 * account's pool units changed count, so a plain transfer of a reserve token
 * is not taken for a contribution.
 */
export function poolContributions(
  transactions: PoolHistoryTransaction[],
  poolUnit: string,
  resources: string[],
): Record<string, AccountPoolFlows> {
  const flows: Record<string, { putIn: Record<string, string[]>; takenOut: Record<string, string[]> }> = {};
  for (const tx of transactions) {
    const rows = tx.balance_changes?.fungible_balance_changes ?? [];
    const participants = new Set(rows.filter((r) => r.resource_address === poolUnit).map((r) => r.entity_address));
    for (const row of rows) {
      if (!participants.has(row.entity_address) || !resources.includes(row.resource_address)) continue;
      const entry = (flows[row.entity_address] ??= { putIn: {}, takenOut: {} });
      // Leaving the account is a contribution; arriving, a redemption.
      if (row.balance_change.startsWith('-')) (entry.putIn[row.resource_address] ??= []).push(row.balance_change.slice(1));
      else (entry.takenOut[row.resource_address] ??= []).push(row.balance_change);
    }
  }
  const total = (byResource: Record<string, string[]>) =>
    Object.fromEntries(Object.entries(byResource).map(([resource, values]) => [resource, sumSignedDecimals(values)]));
  return Object.fromEntries(
    Object.entries(flows).map(([account, { putIn, takenOut }]) => [account, { putIn: total(putIn), takenOut: total(takenOut) }]),
  );
}

export function poolManagerMoves(
  transactions: PoolHistoryTransaction[],
  pool: string,
  poolUnit: string,
  resources: string[],
): ManagerMoves {
  const withdrawn: Record<string, string[]> = {};
  const deposited: Record<string, string[]> = {};
  let count = 0;
  let lastAt: string | null = null;
  for (const tx of transactions) {
    const rows = tx.balance_changes?.fungible_balance_changes ?? [];
    if (rows.some((row) => row.resource_address === poolUnit)) continue;
    const moves = rows.filter((row) => row.entity_address === pool && resources.includes(row.resource_address));
    if (!moves.length) continue;
    count++;
    lastAt ??= tx.confirmed_at ?? null;
    for (const row of moves) {
      if (row.balance_change.startsWith('-')) (withdrawn[row.resource_address] ??= []).push(row.balance_change.slice(1));
      else (deposited[row.resource_address] ??= []).push(row.balance_change);
    }
  }
  const total = (byResource: Record<string, string[]>) =>
    Object.fromEntries(Object.entries(byResource).map(([resource, values]) => [resource, sumSignedDecimals(values)]));
  return { count, withdrawn: total(withdrawn), deposited: total(deposited), lastAt };
}

/** Up to `maxPages` × 100 of the pool's transactions, newest first. */
export async function fetchPoolContributions(
  post: GatewayPost,
  pool: { address: string; poolUnit: string; resources: string[] },
  maxPages = 5,
): Promise<PoolContributions> {
  const transactions: PoolHistoryTransaction[] = [];
  let cursor: string | null | undefined;
  let pages = 0;
  do {
    const page = await post<{ items: PoolHistoryTransaction[]; next_cursor?: string | null }>('/stream/transactions', {
      affected_global_entities_filter: [pool.address],
      limit_per_page: 100,
      opt_ins: { balance_changes: true },
      ...(cursor ? { cursor } : {}),
    });
    transactions.push(...page.items);
    cursor = page.next_cursor;
    pages++;
  } while (cursor && pages < maxPages);
  return {
    byAccount: poolContributions(transactions, pool.poolUnit, pool.resources),
    managerMoves: poolManagerMoves(transactions, pool.address, pool.poolUnit, pool.resources),
    transactions: transactions.length,
    truncated: !!cursor,
  };
}
