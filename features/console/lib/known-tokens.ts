/**
 * The genuine token behind each symbol, as the DEXes know it: the reference a
 * pool reserve is checked against, so a token calling itself "HUG" that is not
 * the HUG everyone trades shows as an impersonation. Mainnet only.
 *
 * - Ociswap lists its tokens with a symbol and their trading volume; several
 *   tokens can share a symbol, and the one traded most is taken as genuine.
 * - DefiPlaza's pairs fill in symbols Ociswap does not list, the pair with the
 *   most value locked deciding.
 *
 * Takes `fetch` and the Gateway as arguments so it can be tested offline.
 */
import type { GatewayPost } from './resource-holders';

type Fetch = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

const OCISWAP_TOKENS = 'https://api.ociswap.com/tokens';
const DEFIPLAZA_PAIRS = 'https://radix.defiplaza.net/api/pairs';
/** Ociswap has ~6 pages of 100; the cap only guards against a runaway cursor. */
const MAX_PAGES = 30;
const DETAILS_BATCH = 20;

/** Symbol (upper case) → address of the genuine token. */
export type KnownTokens = Record<string, string>;

const getJson = async (fetcher: Fetch, url: string) => {
  const res = await fetcher(url);
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
};

const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);

interface OciswapTokensPage {
  data?: { address?: string; symbol?: string; volume?: { xrd?: { '7d'?: string } } }[];
  next_cursor?: number | string | null;
}

/** Symbol → [address, score]: the highest score keeps the symbol. */
type Candidates = Map<string, [string, number]>;

const offer = (candidates: Candidates, symbol: string | undefined, address: string | undefined, score: number) => {
  const key = symbol?.trim().toUpperCase();
  if (!key || !address?.startsWith('resource_')) return;
  const current = candidates.get(key);
  if (!current || score > current[1]) candidates.set(key, [address, score]);
};

async function ociswapCandidates(fetcher: Fetch): Promise<Candidates> {
  const candidates: Candidates = new Map();
  let cursor: number | string | null | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const data = (await getJson(fetcher, `${OCISWAP_TOKENS}?limit=100${cursor ? `&cursor=${cursor}` : ''}`)) as OciswapTokensPage;
    for (const t of data.data ?? []) offer(candidates, t.symbol, t.address, num(t.volume?.xrd?.['7d']));
    cursor = data.next_cursor;
    if (!cursor) break;
  }
  return candidates;
}

interface PairsResponse {
  data?: { baseToken?: string; quoteToken?: string; tvlUSD?: number }[];
}

type MetadataList = { items?: { key: string; value?: { typed?: { value?: unknown } } }[] };

async function defiplazaCandidates(fetcher: Fetch, post: GatewayPost): Promise<Candidates> {
  const pairs = ((await getJson(fetcher, DEFIPLAZA_PAIRS)) as PairsResponse).data ?? [];
  const tvl = new Map<string, number>();
  for (const p of pairs) {
    for (const token of [p.baseToken, p.quoteToken]) {
      if (token) tvl.set(token, Math.max(tvl.get(token) ?? 0, num(p.tvlUSD)));
    }
  }
  const tokens = [...tvl.keys()];
  const candidates: Candidates = new Map();
  for (let i = 0; i < tokens.length; i += DETAILS_BATCH) {
    const page = await post<{ items: { address: string; explicit_metadata?: MetadataList }[] }>('/state/entity/details', {
      addresses: tokens.slice(i, i + DETAILS_BATCH),
      opt_ins: { explicit_metadata: ['symbol'] },
    });
    for (const item of page.items) {
      const symbol = item.explicit_metadata?.items?.find((m) => m.key === 'symbol')?.value?.typed?.value;
      if (typeof symbol === 'string') offer(candidates, symbol, item.address, tvl.get(item.address) ?? 0);
    }
  }
  return candidates;
}

/**
 * Every symbol the DEXes know, with its genuine token. Ociswap decides where it
 * lists the symbol; DefiPlaza only adds the ones it does not. A source that
 * fails is skipped.
 */
export async function fetchKnownTokens(fetcher: Fetch, post: GatewayPost): Promise<KnownTokens> {
  const [ociswap, defiplaza] = await Promise.allSettled([ociswapCandidates(fetcher), defiplazaCandidates(fetcher, post)]);
  const known: KnownTokens = {};
  for (const result of [defiplaza, ociswap]) {
    if (result.status !== 'fulfilled') continue;
    for (const [symbol, [address]] of result.value) known[symbol] = address;
  }
  return known;
}
