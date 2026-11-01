/**
 * Native pool units an account holds, and how a unit's value moved over time.
 *
 * A native pool unit names its pool in the `pool` metadata and the pool names
 * its unit in `pool_unit`; the engine writes both and locks them. A holding
 * only counts as a position when both agree, so a token that merely claims a
 * pool is left out.
 */
import { parsePoolState, redemptionValue, type PoolState } from './pool-lookup';
import type { GatewayPost } from './resource-holders';

export interface PoolUnitPosition {
  pool: PoolState;
  units: number;
  /** Total supply of the pool unit. */
  supply: number;
  /** What the units redeem for now, per resource. */
  value: Record<string, number>;
  /** The pool's or the unit's name. */
  name: string;
}

/** A fungible the account holds. */
export interface HeldFungible {
  resourceAddress: string;
  amount: string;
}

type Item = {
  address: string;
  details?: { total_supply?: string };
  explicit_metadata?: { items?: { key: string; value?: { typed?: { value?: unknown } } }[] };
};

const BATCH = 20;

const text = (item: Item | undefined, key: string) => {
  const value = item?.explicit_metadata?.items?.find((m) => m.key === key)?.value?.typed?.value;
  return typeof value === 'string' ? value : '';
};

async function details(post: GatewayPost, addresses: string[], body: Record<string, unknown> = {}): Promise<Item[]> {
  const out: Item[] = [];
  for (let i = 0; i < addresses.length; i += BATCH) {
    const page = await post<{ items?: Item[] }>('/state/entity/details', {
      addresses: addresses.slice(i, i + BATCH),
      aggregation_level: 'Global',
      opt_ins: { explicit_metadata: ['pool', 'pool_unit', 'pool_resources', 'name'] },
      ...body,
    });
    out.push(...(page.items ?? []));
  }
  return out;
}

/** The held fungibles that are units of a native pool, with what they redeem for. */
export async function findPoolUnitPositions(post: GatewayPost, held: HeldFungible[]): Promise<PoolUnitPosition[]> {
  const positive = held.filter((h) => Number(h.amount) > 0);
  if (!positive.length) return [];
  const resources = await details(post, positive.map((h) => h.resourceAddress));
  const candidates = resources.filter((r) => text(r, 'pool').startsWith('pool_'));
  if (!candidates.length) return [];

  const pools = await details(post, [...new Set(candidates.map((c) => text(c, 'pool')))]);
  return candidates.flatMap((unit) => {
    const poolItem = pools.find((p) => p.address === text(unit, 'pool'));
    const pool = poolItem ? parsePoolState(poolItem) : null;
    if (!pool || pool.poolUnit !== unit.address) return [];
    const units = Number(positive.find((h) => h.resourceAddress === unit.address)!.amount);
    const supply = Number(unit.details?.total_supply ?? 0);
    return [{ pool, units, supply, value: redemptionValue(pool.reserves, units, supply), name: text(poolItem, 'name') || text(unit, 'name') }];
  });
}

/** What one pool unit redeemed for at a moment (or now), per resource. Null when the pool did not exist yet. */
export async function unitValueAt(post: GatewayPost, pool: string, poolUnit: string, timestamp?: string): Promise<Record<string, number> | null> {
  try {
    const items = await details(post, [pool, poolUnit], timestamp ? { at_ledger_state: { timestamp } } : {});
    const state = parsePoolState(items.find((i) => i.address === pool));
    const supply = Number(items.find((i) => i.address === poolUnit)?.details?.total_supply ?? 0);
    if (!state || !(supply > 0)) return null;
    return redemptionValue(state.reserves, 1, supply);
  } catch {
    return null;
  }
}

/**
 * Geometric mean of a unit's value across its resources: in a constant-product
 * pool it grows with the fees whichever way prices move.
 */
const geometricMean = (values: number[]) =>
  values.length && values.every((v) => v > 0) ? Math.exp(values.reduce((s, v) => s + Math.log(v), 0) / values.length) : 0;

export interface UnitValueChange {
  days: number;
  /** A unit's value then and now, per resource. */
  then: Record<string, number>;
  now: Record<string, number>;
  /** Change of the geometric mean over the period (0.01 = +1 %). */
  growth: number;
  /** That change as a yearly rate, compounded. */
  annualized: number;
}

/** How a unit's value changed over `days`, from the ledger as it was then. */
export async function unitValueChange(
  post: GatewayPost,
  pool: string,
  poolUnit: string,
  days: number,
  now: Date = new Date(),
): Promise<UnitValueChange | null> {
  const thenAt = new Date(now.getTime() - days * 86_400_000).toISOString();
  const [then, current] = await Promise.all([unitValueAt(post, pool, poolUnit, thenAt), unitValueAt(post, pool, poolUnit)]);
  if (!then || !current) return null;
  // A one-sided pool (DefiPlaza's, in balance) holds nothing of the other token: only resources held both times count.
  const resources = Object.keys(current).filter((r) => (then[r] ?? 0) > 0 && current[r] > 0);
  if (!resources.length) return null;
  const before = geometricMean(resources.map((r) => then[r] ?? 0));
  const after = geometricMean(resources.map((r) => current[r] ?? 0));
  if (!(before > 0) || !(after > 0)) return null;
  const growth = after / before - 1;
  return { days, then, now: current, growth, annualized: (1 + growth) ** (365 / days) - 1 };
}
