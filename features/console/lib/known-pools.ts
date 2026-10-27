/**
 * Native pools that DEXes publish in their own APIs: the closest thing to a
 * list of every pool, which the Gateway cannot give. Mainnet only; none of
 * the DEXes has a Stokenet API.
 *
 * - Ociswap: `liquidity_pool_address` of its basic and flex pools, with a name.
 * - DefiPlaza: the base and quote pools of each pair, named from the tokens.
 * - Reddicks: a DefiPlaza fork with the same `/api/pairs` shape.
 *
 * Runs on the server (DefiPlaza sends no CORS headers) and takes `fetch`
 * and the Gateway as arguments so it can be tested offline.
 */
import { OCISWAP_POOLS_API, PAIR_APIS } from './dex-apis';
import type { GatewayPost } from './resource-holders';

export type KnownPoolSource = 'ociswap' | 'defiplaza' | 'reddicks';

export interface KnownPool {
  address: string;
  name: string;
  source: KnownPoolSource;
  /** Value locked in USD, when the DEX reports it; used to sort. */
  tvlUsd: number;
}

/** Compact row [address, name, source] the HTTP route sends: about half the bytes of objects. */
export type KnownPoolRow = [address: string, name: string, source: KnownPoolSource];

type Fetch = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/** Ociswap has ~19 pages of 100; the cap only guards against a runaway cursor. */
const MAX_OCISWAP_PAGES = 50;
const DETAILS_BATCH = 20;

const getJson = async (fetcher: Fetch, url: string) => {
  const res = await fetcher(url);
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
};

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);

interface OciswapPage {
  data?: {
    name?: string;
    liquidity_pool_address?: string | null;
    total_value_locked?: { usd?: { now?: string } };
  }[];
  next_cursor?: number | string | null;
}

export async function fetchOciswapPools(fetcher: Fetch): Promise<KnownPool[]> {
  const pools: KnownPool[] = [];
  let cursor: number | string | null | undefined;
  for (let page = 0; page < MAX_OCISWAP_PAGES; page++) {
    const data = (await getJson(fetcher, `${OCISWAP_POOLS_API}?limit=100${cursor ? `&cursor=${cursor}` : ''}`)) as OciswapPage;
    for (const p of data.data ?? []) {
      // Precision pools are Ociswap's own component, with no native pool behind them.
      if (p.liquidity_pool_address?.startsWith('pool_')) {
        pools.push({
          address: p.liquidity_pool_address,
          name: p.name ?? '',
          source: 'ociswap',
          tvlUsd: num(p.total_value_locked?.usd?.now),
        });
      }
    }
    cursor = data.next_cursor;
    if (!cursor) break;
  }
  return pools;
}

interface PairsResponse {
  data?: { baseToken?: string; quoteToken?: string; basePool?: string; quotePool?: string; tvlUSD?: number }[];
}

type MetadataList = { items?: { key: string; value?: { typed?: { value?: unknown } } }[] };

interface DetailsPage {
  items: { address: string; explicit_metadata?: MetadataList; metadata?: MetadataList }[];
}

/** Symbol (or name) of each resource. */
async function symbols(post: GatewayPost, resources: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (let i = 0; i < resources.length; i += DETAILS_BATCH) {
    const data = await post<DetailsPage>('/state/entity/details', {
      addresses: resources.slice(i, i + DETAILS_BATCH),
      opt_ins: { explicit_metadata: ['symbol', 'name'] },
    });
    for (const item of data.items) {
      const meta = [...(item.explicit_metadata?.items ?? []), ...(item.metadata?.items ?? [])];
      const read = (key: string) => meta.find((m) => m.key === key)?.value?.typed?.value;
      const label = read('symbol') || read('name');
      if (typeof label === 'string' && label) out[item.address] = label;
    }
  }
  return out;
}

export async function fetchPairPools(
  fetcher: Fetch,
  post: GatewayPost,
  source: keyof typeof PAIR_APIS,
): Promise<KnownPool[]> {
  const pairs = ((await getJson(fetcher, PAIR_APIS[source])) as PairsResponse).data ?? [];
  const tokens = [...new Set(pairs.flatMap((p) => [p.baseToken, p.quoteToken]).filter((t): t is string => !!t))];
  const names = await symbols(post, tokens).catch(() => ({}) as Record<string, string>);
  const sym = (t?: string) => (t ? names[t] ?? `${t.slice(0, 14)}…` : '?');

  return pairs.flatMap((p): KnownPool[] => {
    const pair = `${sym(p.baseToken)}/${sym(p.quoteToken)}`;
    const tvlUsd = num(p.tvlUSD) / 2;
    // Each pair keeps one pool per side; the side's token tells them apart.
    const sides: [string | undefined, string | undefined][] = [
      [p.basePool, p.baseToken],
      [p.quotePool, p.quoteToken],
    ];
    return sides
      .filter((side): side is [string, string | undefined] => !!side[0]?.startsWith('pool_'))
      .map(([address, token]) => ({ address, name: `${pair} (${sym(token)})`, source, tvlUsd }));
  });
}

/**
 * Every DEX, deduplicated, largest first. A DEX that fails is skipped.
 * Reddicks also lists some DefiPlaza pairs; the earlier DEX keeps the pool.
 */
export async function fetchKnownPools(fetcher: Fetch, post: GatewayPost): Promise<KnownPool[]> {
  const lists = await Promise.allSettled([
    fetchOciswapPools(fetcher),
    fetchPairPools(fetcher, post, 'defiplaza'),
    fetchPairPools(fetcher, post, 'reddicks'),
  ]);
  const seen = new Set<string>();
  return lists
    .flatMap((list) => (list.status === 'fulfilled' ? list.value : []))
    .filter((p) => !seen.has(p.address) && seen.add(p.address))
    .sort((a, b) => b.tvlUsd - a.tvlUsd);
}
