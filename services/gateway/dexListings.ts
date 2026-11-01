/**
 * Server-side cache of what the DEXes say about their pools (mainnet only),
 * shared by /api/console/dex-listing and the MCP tools: whether a component
 * or native pool is listed, and the yield the DEX reports.
 */
import { fetchPairs, ociswapComponentListing, pairListing, type DexListing, type PairRow } from '@/features/console/lib/dex-listings';
import logger from '@/lib/logger';

/** Listings change rarely and APRs move slowly: an hour per instance, the CDN on top. */
export const DEX_LISTING_TTL_S = 60 * 60;
const TTL_MS = DEX_LISTING_TTL_S * 1000;

const fetcher = (url: string) => fetch(url, { headers: { 'user-agent': 'radix-community-console' } });

const pairCache = new Map<'defiplaza' | 'reddicks', { at: number; pairs: PairRow[] }>();
const ociswapCache = new Map<string, { at: number; listing: DexListing | null }>();

async function pairsOf(dex: 'defiplaza' | 'reddicks'): Promise<PairRow[]> {
  const cached = pairCache.get(dex);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.pairs;
  try {
    const pairs = await fetchPairs(fetcher, dex);
    if (pairs.length || !cached) pairCache.set(dex, { at: Date.now(), pairs });
  } catch (error) {
    logger.warn({ err: error, dex }, '[DexListings] pairs refresh failed');
    if (!cached) return [];
  }
  return pairCache.get(dex)?.pairs ?? [];
}

async function ociswap(component: string): Promise<DexListing | null> {
  const cached = ociswapCache.get(component);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.listing;
  const listing = await ociswapComponentListing(fetcher, component);
  ociswapCache.set(component, { at: Date.now(), listing });
  return listing;
}

/** The DEX listing of a component or native pool, or null when no DEX lists it (always null off mainnet). */
export async function getDexListing(network: 'mainnet' | 'stokenet', address: string): Promise<DexListing | null> {
  if (network !== 'mainnet') return null;
  for (const dex of ['defiplaza', 'reddicks'] as const) {
    const found = pairListing(await pairsOf(dex), dex, address);
    if (found) return found;
  }
  return address.startsWith('component_') ? ociswap(address) : null;
}
