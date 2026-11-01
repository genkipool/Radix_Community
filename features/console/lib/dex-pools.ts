/**
 * Pools a DEX manages, and the transaction that adds liquidity to them.
 *
 * A native pool a DEX runs is guarded by the DEX component (its manager role
 * is the component's caller badge), so its "contribute" is closed to users:
 * liquidity goes in through the component. Each DEX takes it differently:
 *
 * - Ociswap Basic (`BasicPool`) and Flex (`Pool`): `add_liquidity(x, y)`,
 *   both tokens in the ratio of the reserves; any excess comes back.
 * - DefiPlaza (`PlazaPair`): one token, to the pool of its side, as
 *   `add_liquidity(input, co_liquidity)`. Only a side in shortage also needs
 *   the other token (co-liquidity).
 * - Ociswap Precision (`PrecisionPool`): not a native pool. A position covers
 *   a price range: `add_liquidity(left_tick, right_tick, x, y)` mints an NFT.
 *
 * Everything is read from the ledger and cross-checked: the component must
 * name the pool, and the pool's manager must be the component's caller badge.
 * Whether the DEX lists the component is asked separately (`dex-listings`).
 */
import { decodeAddressNodeId } from './address-inspect';
import { findGlobalCaller, matchGlobalCaller } from './caller-badge';
import { isPositiveDecimal } from './decimal';
import { isManifestAddress } from './pool-manifests';
import { parsePoolState, type PoolState } from './pool-lookup';
import type { GatewayPost } from './resource-holders';

export type DexKind = 'ociswap-basic' | 'ociswap-flex' | 'ociswap-precision' | 'defiplaza';

/** Blueprint name of each DEX component. */
export const DEX_BLUEPRINTS: Record<DexKind, string> = {
  'ociswap-basic': 'BasicPool',
  'ociswap-flex': 'Pool',
  'ociswap-precision': 'PrecisionPool',
  defiplaza: 'PlazaPair',
};

interface DexBase {
  component: string;
  /** The two tokens, as the component orders them (x < y; DefiPlaza: base, quote). */
  x: string;
  y: string;
}

/** Ociswap Basic or Flex: one native two-resource pool behind the component. */
export interface OciswapNativeDex extends DexBase {
  kind: 'ociswap-basic' | 'ociswap-flex';
  pool: PoolState;
}

/** A DefiPlaza pair: a pool per side; x is the base token, y the quote token. */
export interface DefiPlazaDex extends DexBase {
  kind: 'defiplaza';
  basePool: PoolState;
  quotePool: PoolState;
  /** The side short of tokens, which then needs co-liquidity. */
  shortage: 'Equilibrium' | 'BaseShortage' | 'QuoteShortage';
}

/** An Ociswap Precision pool: concentrated liquidity, a price range per position. */
export interface PrecisionDex extends DexBase {
  kind: 'ociswap-precision';
  lpResource: string;
  /** √(price), price being y per x. */
  priceSqrt: number;
  tickSpacing: number;
}

export type DexPool = OciswapNativeDex | DefiPlazaDex | PrecisionDex;

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** A top-level state field's value (references and numbers come as strings). */
const field = (entity: unknown, name: string) => {
  const found = arr(obj(obj(obj(entity).details).state).fields).map(obj).find((f) => f.field_name === name);
  return found ? str(found.value) || str(found.variant_name) : '';
};
/** A field nested in a tuple field, e.g. DefiPlaza's `state.shortage`. */
const nestedField = (entity: unknown, outer: string, name: string) => {
  const tuple = arr(obj(obj(obj(entity).details).state).fields).map(obj).find((f) => f.field_name === outer);
  const inner = arr(tuple?.fields).map(obj).find((f) => f.field_name === name);
  return inner ? str(inner.value) || str(inner.variant_name) : '';
};

/** Byte order of two addresses, the order a Scrypto `ResourceAddress` comparison uses. */
export function compareAddressBytes(a: string, b: string): number {
  const x = decodeAddressNodeId(a);
  const y = decodeAddressNodeId(b);
  if (!x || !y) return a < b ? -1 : a > b ? 1 : 0;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

async function details(post: GatewayPost, addresses: string[]): Promise<Json[]> {
  const page = await post<{ items?: unknown[] }>('/state/entity/details', { addresses, aggregation_level: 'Global' });
  return (page.items ?? []).map(obj);
}

/** The pool's manager is exactly this component's caller badge. */
const managedBy = (pool: PoolState, component: string) => matchGlobalCaller(pool.manager, [component]) === component;

/**
 * The DEX behind an address: a native pool a DEX component manages, or the
 * DEX component itself. Null when it is neither (an own pool, an unknown
 * blueprint, or a pool whose manager is not the component it names).
 */
export async function resolveDexPool(post: GatewayPost, address: string): Promise<DexPool | null> {
  let component = address;
  if (address.startsWith('pool_')) {
    const [poolEntity] = await details(post, [address]);
    const pool = poolEntity ? parsePoolState(poolEntity) : null;
    if (!pool) return null;
    const callers = await findGlobalCaller(post, address, [pool.manager]);
    component = Object.values(callers)[0] ?? '';
    if (!component) return null;
  }
  if (!component.startsWith('component_')) return null;

  const [entity] = await details(post, [component]);
  const blueprint = str(obj(entity?.details).blueprint_name);
  const kind = (Object.keys(DEX_BLUEPRINTS) as DexKind[]).find((k) => DEX_BLUEPRINTS[k] === blueprint);
  if (!entity || !kind) return null;

  if (kind === 'ociswap-precision') {
    // The two tokens are the component's vaults; the pool keeps them sorted by address bytes.
    const held = [...new Set(arr(obj(entity.fungible_resources).items).map((i) => str(obj(i).resource_address)).filter(Boolean))];
    if (held.length !== 2) return null;
    const [x, y] = held.sort(compareAddressBytes);
    const priceSqrt = Number(field(entity, 'price_sqrt'));
    const tickSpacing = Number(field(entity, 'tick_spacing'));
    const lpResource = field(entity, 'lp_manager');
    if (!(priceSqrt > 0) || !(tickSpacing > 0) || !lpResource) return null;
    return { kind, component, x, y, lpResource, priceSqrt, tickSpacing };
  }

  if (kind === 'defiplaza') {
    const basePoolAddress = field(entity, 'base_pool');
    const quotePoolAddress = field(entity, 'quote_pool');
    const pools = await details(post, [basePoolAddress, quotePoolAddress]);
    const basePool = parsePoolState(pools.find((p) => p.address === basePoolAddress));
    const quotePool = parsePoolState(pools.find((p) => p.address === quotePoolAddress));
    if (!basePool || !quotePool || !managedBy(basePool, component) || !managedBy(quotePool, component)) return null;
    if (address.startsWith('pool_') && address !== basePoolAddress && address !== quotePoolAddress) return null;
    const shortage = nestedField(entity, 'state', 'shortage');
    return {
      kind,
      component,
      x: field(entity, 'base_address'),
      y: field(entity, 'quote_address'),
      basePool,
      quotePool,
      shortage: shortage === 'BaseShortage' || shortage === 'QuoteShortage' ? shortage : 'Equilibrium',
    };
  }

  const poolAddress = field(entity, 'liquidity_pool');
  if (address.startsWith('pool_') && address !== poolAddress) return null;
  const [poolEntity] = await details(post, [poolAddress]);
  const pool = poolEntity ? parsePoolState(poolEntity) : null;
  if (!pool || pool.kind !== 'two' || !managedBy(pool, component)) return null;
  const x = field(entity, 'x_address') || pool.resources[0];
  const y = field(entity, 'y_address') || pool.resources[1];
  return { kind, component, x, y, pool };
}

/* ─── Amounts ─────────────────────────────────────────────────────────────── */

/** A number as an engine Decimal string: no exponent, at most `digits` decimals. */
export function toDecimalString(value: number, digits = 18): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  const fixed = value.toFixed(Math.min(digits, 18));
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
}

/** The other token's amount that matches `amount` of `from` at the reserves' ratio. */
export function pairedAmount(reserves: Record<string, string>, from: string, to: string, amount: number): number {
  const a = Number(reserves[from]);
  const b = Number(reserves[to]);
  return a > 0 && b > 0 && amount > 0 ? (amount * b) / a : 0;
}

/* ─── Precision ranges ────────────────────────────────────────────────────── */

export const MAX_TICK = 887272;
export const MIN_TICK = -MAX_TICK;
const TICK_BASE = 1.0001;

export const tickToPrice = (tick: number) => TICK_BASE ** tick;
/** The tick at or below `price` (y per x). */
export const priceToTick = (price: number) => Math.floor(Math.log(price) / Math.log(TICK_BASE));

/** A range of ticks on the pool's grid, inside the allowed bounds, left < right. */
export function rangeTicks(minPrice: number, maxPrice: number, spacing: number): { left: number; right: number } | null {
  if (!(minPrice > 0) || !(maxPrice > minPrice) || !(spacing > 0)) return null;
  const lowest = Math.ceil(MIN_TICK / spacing) * spacing;
  const highest = Math.floor(MAX_TICK / spacing) * spacing;
  const left = Math.max(lowest, Math.floor(priceToTick(minPrice) / spacing) * spacing);
  const right = Math.min(highest, Math.ceil(priceToTick(maxPrice) / spacing) * spacing);
  return left < right ? { left, right } : null;
}

/** The widest range the pool allows: liquidity at every price. */
export function fullRangeTicks(spacing: number) {
  return { left: Math.ceil(MIN_TICK / spacing) * spacing, right: Math.floor(MAX_TICK / spacing) * spacing };
}

/**
 * How much of the other token a position needs, given one side's amount, for a
 * range at the current price (the usual concentrated-liquidity formulas). A
 * range wholly above the price takes only x, wholly below only y: the other is 0.
 */
export function precisionPairedAmount(
  priceSqrt: number,
  range: { left: number; right: number },
  from: 'x' | 'y',
  amount: number,
): number {
  const sa = Math.sqrt(tickToPrice(range.left));
  const sb = Math.sqrt(tickToPrice(range.right));
  const sp = Math.min(Math.max(priceSqrt, sa), sb);
  if (!(amount > 0) || sp <= sa || sp >= sb) return 0;
  if (from === 'x') {
    const liquidity = (amount * sp * sb) / (sb - sp);
    return liquidity * (sp - sa);
  }
  const liquidity = amount / (sp - sa);
  return (liquidity * (sb - sp)) / (sp * sb);
}

/** Which tokens a range takes at the current price. */
export function rangeSides(priceSqrt: number, range: { left: number; right: number }): { x: boolean; y: boolean } {
  const sa = Math.sqrt(tickToPrice(range.left));
  const sb = Math.sqrt(tickToPrice(range.right));
  return { x: priceSqrt < sb, y: priceSqrt > sa };
}

/* ─── Manifests ───────────────────────────────────────────────────────────── */

export interface AddLiquidityInput {
  account: string;
  dex: DexPool;
  /** Amount per token address; a token left out (or "0") is not sent. */
  amounts: Record<string, string>;
  /** DefiPlaza only: the side the liquidity goes to (its token is the input). */
  side?: 'base' | 'quote';
  /** Precision only: the range, in ticks. */
  range?: { left: number; right: number };
}

const networkOf = (address: string) => {
  const hrp = address.slice(0, address.lastIndexOf('1'));
  return hrp.slice(hrp.indexOf('_') + 1);
};

function assertAddresses(account: string, addresses: Array<[string, 'resource_' | 'component_']>) {
  if (!isManifestAddress(account, 'account_')) throw new Error(`The account "${account}" is not a valid account address.`);
  for (const [address, prefix] of addresses) {
    if (!isManifestAddress(address, prefix)) throw new Error(`"${address}" is not a valid ${prefix.slice(0, -1)} address.`);
    if (networkOf(address) !== networkOf(account)) throw new Error(`"${address}" is on another network.`);
  }
}

const withdraw = (account: string, resource: string, amount: string, bucket: string) => `CALL_METHOD
    Address("${account}")
    "withdraw"
    Address("${resource}")
    Decimal("${amount}")
;
TAKE_FROM_WORKTOP
    Address("${resource}")
    Decimal("${amount}")
    Bucket("${bucket}")
;`;

const DEPOSIT_ALL = (account: string) => `CALL_METHOD
    Address("${account}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP")
;`;

const amountOf = (amounts: Record<string, string>, resource: string) => {
  const value = (amounts[resource] ?? '').trim();
  if (!value || value === '0') return '';
  if (!isPositiveDecimal(value)) throw new Error(`"${value}" is not a valid amount.`);
  return value;
};

/**
 * Adds liquidity through the DEX component, and deposits what comes back
 * (pool units or the position NFT, plus any excess) into the same account.
 */
export function addLiquidityManifest({ account, dex, amounts, side, range }: AddLiquidityInput): string {
  assertAddresses(account, [[dex.component, 'component_'], [dex.x, 'resource_'], [dex.y, 'resource_']]);
  const x = amountOf(amounts, dex.x);
  const y = amountOf(amounts, dex.y);

  if (dex.kind === 'defiplaza') {
    const input = side === 'quote' ? dex.y : dex.x;
    const other = side === 'quote' ? dex.x : dex.y;
    const inputAmount = side === 'quote' ? y : x;
    const coAmount = side === 'quote' ? x : y;
    if (!inputAmount) return '';
    return `${withdraw(account, input, inputAmount, 'liquidity')}
${coAmount ? `${withdraw(account, other, coAmount, 'co_liquidity')}\n` : ''}CALL_METHOD
    Address("${dex.component}")
    "add_liquidity"
    Bucket("liquidity")
    ${coAmount ? 'Enum<1u8>(Bucket("co_liquidity"))' : 'Enum<0u8>()'}
;
${DEPOSIT_ALL(account)}
`;
  }

  if (dex.kind === 'ociswap-precision') {
    if (!range || !Number.isInteger(range.left) || !Number.isInteger(range.right) || range.left >= range.right) return '';
    if (range.left < MIN_TICK || range.right > MAX_TICK) throw new Error('The price range is outside what the pool allows.');
    if (!x && !y) return '';
    // The pool asks for both buckets; a side the range does not take goes as an empty bucket.
    const bucket = (resource: string, amount: string, name: string) =>
      amount
        ? withdraw(account, resource, amount, name)
        : `TAKE_ALL_FROM_WORKTOP
    Address("${resource}")
    Bucket("${name}")
;`;
    return `${bucket(dex.x, x, 'x_tokens')}
${bucket(dex.y, y, 'y_tokens')}
CALL_METHOD
    Address("${dex.component}")
    "add_liquidity"
    ${range.left}i32
    ${range.right}i32
    Bucket("x_tokens")
    Bucket("y_tokens")
;
${DEPOSIT_ALL(account)}
`;
  }

  if (!x || !y) return '';
  return `${withdraw(account, dex.x, x, 'x_tokens')}
${withdraw(account, dex.y, y, 'y_tokens')}
CALL_METHOD
    Address("${dex.component}")
    "add_liquidity"
    Bucket("x_tokens")
    Bucket("y_tokens")
;
${DEPOSIT_ALL(account)}
`;
}
