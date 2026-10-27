/**
 * Whether a DEX itself lists a pool, and the yield it reports for it.
 *
 * The ledger proves which component manages a pool, not that the component is
 * the DEX it claims to be: anyone can deploy a blueprint called "Pool". So
 * before tokens go into a DEX component, the DEX's own API is asked whether
 * the component is one of its pools. Mainnet only: no DEX has a Stokenet API.
 *
 * - Ociswap answers per component (`/pools/{component}`), with its APR.
 * - DefiPlaza and Reddicks publish every pair at once, each with its base and
 *   quote pools and the APY of each side.
 *
 * Runs on the server (DefiPlaza sends no CORS headers) and takes `fetch` as an
 * argument so it can be tested offline.
 */
import { OCISWAP_POOLS_API, PAIR_APIS } from './dex-apis';

export type DexName = 'ociswap' | 'defiplaza' | 'reddicks';

export interface DexListing {
  dex: DexName;
  /** The component users call: the Ociswap pool, or the DefiPlaza pair. */
  component: string;
  /** The DEX's name for the pool (Ociswap gives one; the pair APIs do not). */
  name: string;
  /** Yearly yield the DEX reports for each native pool it lists (DefiPlaza: one per side). */
  aprByPool: Record<string, number>;
  /** Yearly yield of the component as a whole, when the DEX gives one (Ociswap, 7-day). */
  apr: number | null;
}

export type Fetch = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface PairRow {
  address?: string;
  baseToken?: string;
  quoteToken?: string;
  basePool?: string;
  quotePool?: string;
  baseAPY?: number;
  quoteAPY?: number;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Every pair a DefiPlaza-style DEX publishes. */
export async function fetchPairs(fetcher: Fetch, dex: keyof typeof PAIR_APIS): Promise<PairRow[]> {
  const res = await fetcher(PAIR_APIS[dex]);
  if (!res.ok) throw new Error(`${dex} answered ${res.status}`);
  return ((await res.json()) as { data?: PairRow[] }).data ?? [];
}

/** The pair a component or native pool belongs to, from a DefiPlaza-style list. */
export function pairListing(pairs: PairRow[], dex: 'defiplaza' | 'reddicks', address: string): DexListing | null {
  const pair = pairs.find((p) => p.address === address || p.basePool === address || p.quotePool === address);
  if (!pair?.address) return null;
  const aprByPool: Record<string, number> = {};
  const baseApr = num(pair.baseAPY);
  const quoteApr = num(pair.quoteAPY);
  if (pair.basePool && baseApr !== null) aprByPool[pair.basePool] = baseApr;
  if (pair.quotePool && quoteApr !== null) aprByPool[pair.quotePool] = quoteApr;
  return { dex, component: pair.address, name: '', aprByPool, apr: null };
}

interface OciswapPool {
  address?: string;
  name?: string;
  liquidity_pool_address?: string | null;
  apr?: { '7d'?: string };
}

/** Ociswap's record of one component, or null when Ociswap does not list it (404). */
export async function ociswapComponentListing(fetcher: Fetch, component: string): Promise<DexListing | null> {
  const res = await fetcher(`${OCISWAP_POOLS_API}/${component}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Ociswap answered ${res.status}`);
  const body = (await res.json()) as OciswapPool;
  if (body.address !== component) return null;
  const apr = num(body.apr?.['7d']);
  const pool = body.liquidity_pool_address;
  return {
    dex: 'ociswap',
    component,
    name: body.name ?? '',
    aprByPool: pool?.startsWith('pool_') && apr !== null ? { [pool]: apr } : {},
    apr,
  };
}
