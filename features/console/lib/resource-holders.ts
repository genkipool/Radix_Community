/**
 * Holders of a resource: paging through the Gateway, classifying who holds
 * it, summarising concentration, and turning the list into a distribution
 * (CSV for the bulk sender or the Account Locker airdrop).
 *
 * Pure apart from `fetchAllHolders`, which takes the POST function so the
 * browser, the MCP server and the tests can each bring their own.
 */

import { sumDecimals } from './decimal';

export interface Holder {
  address: string;
  /** Fungible amount, or the number of NFTs for a non-fungible resource. */
  amount: string;
}

export type HolderKind = 'account' | 'pool' | 'locker' | 'validator' | 'component' | 'other';

/** What kind of entity holds the resource, from the address prefix. */
export function holderKind(address: string): HolderKind {
  if (address.startsWith('account_')) return 'account';
  if (address.startsWith('pool_')) return 'pool';
  if (address.startsWith('locker_')) return 'locker';
  if (address.startsWith('validator_')) return 'validator';
  if (address.startsWith('component_')) return 'component';
  return 'other';
}

interface HoldersPage {
  total_count?: number;
  next_cursor?: string;
  items?: Array<{ holder_address?: string; amount?: string; non_fungible_ids_count?: number }>;
}

export type GatewayPost = <T>(path: string, body: Record<string, unknown>) => Promise<T>;

/**
 * Every holder, page by page (100 per page). `max` caps how many are read so a
 * token held by hundreds of thousands of accounts cannot run away; `onPage`
 * reports progress. Holders come ordered by amount, largest first.
 */
export async function fetchAllHolders(
  post: GatewayPost,
  resourceAddress: string,
  { max = 20_000, onPage }: { max?: number; onPage?: (loaded: number, total: number | null) => void } = {},
): Promise<{ holders: Holder[]; total: number | null; truncated: boolean }> {
  const holders: Holder[] = [];
  let cursor: string | undefined;
  let total: number | null = null;
  do {
    const page = await post<HoldersPage>('/extensions/resource-holders/page', {
      resource_address: resourceAddress,
      limit_per_page: 100,
      ...(cursor ? { cursor } : {}),
    });
    total = page.total_count ?? total;
    for (const item of page.items ?? []) {
      if (!item.holder_address) continue;
      holders.push({ address: item.holder_address, amount: item.amount ?? String(item.non_fungible_ids_count ?? 0) });
    }
    cursor = page.next_cursor;
    onPage?.(holders.length, total);
  } while (cursor && holders.length < max);
  return { holders, total, truncated: !!cursor };
}

export interface HolderFilter {
  /** Only these kinds (empty: all). */
  kinds?: HolderKind[];
  /** Drop holders below this amount. */
  minAmount?: number;
  /** Drop these addresses (the treasury, an exchange, the sender…). */
  exclude?: string[];
}

export function filterHolders(holders: Holder[], { kinds = [], minAmount = 0, exclude = [] }: HolderFilter): Holder[] {
  const skip = new Set(exclude.map((a) => a.trim()).filter(Boolean));
  return holders.filter(
    (h) =>
      (kinds.length === 0 || kinds.includes(holderKind(h.address))) &&
      Number(h.amount) >= minAmount &&
      Number(h.amount) > 0 &&
      !skip.has(h.address),
  );
}

export interface HolderStats {
  count: number;
  total: string;
  /** Share of the total held by the largest 1 / 10 holders (0..1). */
  top1Share: number;
  top10Share: number;
  byKind: Record<HolderKind, number>;
}

export function holderStats(holders: Holder[]): HolderStats {
  const total = sumDecimals(holders.map((h) => h.amount));
  const sorted = [...holders].sort((a, b) => Number(b.amount) - Number(a.amount));
  const t = Number(total);
  const share = (n: number) => (t > 0 ? Number(sumDecimals(sorted.slice(0, n).map((h) => h.amount))) / t : 0);
  const byKind = { account: 0, pool: 0, locker: 0, validator: 0, component: 0, other: 0 } as Record<HolderKind, number>;
  for (const h of holders) byKind[holderKind(h.address)] += 1;
  return { count: holders.length, total, top1Share: share(1), top10Share: share(10), byKind };
}

/** "address,amount" lines with a header, for spreadsheets. */
export function holdersToCsv(holders: Holder[]): string {
  return ['address,amount', ...holders.map((h) => `${h.address},${h.amount}`)].join('\n') + '\n';
}

export type DistributionMode = 'equal' | 'proportional';

export interface Distribution {
  address: string;
  amount: string;
}

/**
 * Splits `total` of a token among holders: the same to each, or in proportion
 * to what each holds. Amounts are truncated (never rounded up) to
 * `divisibility` decimals, so the sum never exceeds `total`; holders whose
 * share truncates to zero are left out.
 */
export function distribute(
  holders: Holder[],
  total: string,
  mode: DistributionMode,
  divisibility = 18,
): Distribution[] {
  const SCALE = 10n ** 18n;
  const toFixed = (v: string) => {
    const [i, f = ''] = v.trim().split('.');
    return BigInt(i || '0') * SCALE + BigInt((f + '0'.repeat(18)).slice(0, 18));
  };
  const step = 10n ** BigInt(18 - Math.max(0, Math.min(18, divisibility)));
  const fmt = (x: bigint) => {
    const truncated = x - (x % step);
    const int = truncated / SCALE;
    const frac = (truncated % SCALE).toString().padStart(18, '0').replace(/0+$/, '');
    return frac ? `${int}.${frac}` : String(int);
  };

  const pot = toFixed(total);
  if (pot <= 0n || holders.length === 0) return [];
  const weights = holders.map((h) => (mode === 'equal' ? 1n : toFixed(h.amount)));
  const sum = weights.reduce((a, b) => a + b, 0n);
  if (sum === 0n) return [];

  return holders
    .map((h, i) => ({ address: h.address, amount: fmt((pot * weights[i]) / sum) }))
    .filter((d) => d.amount !== '0');
}

/** "account,resource,amount" lines: the bulk sender's input format. */
export function distributionToCsv(rows: Distribution[], resource: string): string {
  return ['account,resource,amount', ...rows.map((r) => `${r.address},${resource},${r.amount}`)].join('\n') + '\n';
}
