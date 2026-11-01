/**
 * Server-side cache of the native pools Ociswap, DefiPlaza and Reddicks publish
 * (mainnet only), shared by /api/console/known-pools and the MCP tools.
 */
import { fetchKnownPools, type KnownPool } from '@/features/console/lib/known-pools';
import logger from '@/lib/logger';
import { gatewayPost } from './bases';

/**
 * A refresh reads ~19 Ociswap pages (~160 KB each, gzipped), DefiPlaza and Reddicks, so
 * it runs at most every 6 hours per instance; new pools are rare and anything
 * missing can still be typed. The HTTP route adds a CDN cache on top.
 */
export const KNOWN_POOLS_TTL_S = 6 * 60 * 60;
const TTL_MS = KNOWN_POOLS_TTL_S * 1000;
let cache: { at: number; pools: KnownPool[] } | null = null;
let inFlight: Promise<KnownPool[]> | null = null;

export async function getKnownPoolsCached(network: 'mainnet' | 'stokenet'): Promise<KnownPool[]> {
  if (network !== 'mainnet') return [];
  if (cache && Date.now() - cache.at < TTL_MS) return cache.pools;

  inFlight ??= fetchKnownPools(
    (url) => fetch(url, { headers: { 'user-agent': 'radix-community-console' } }),
    (path, body) => gatewayPost('mainnet', path, body),
  ).finally(() => {
    inFlight = null;
  });
  try {
    const pools = await inFlight;
    // An empty answer is an upstream hiccup: keep serving the last good list.
    if (pools.length > 0 || !cache) cache = { at: Date.now(), pools };
  } catch (error) {
    logger.warn({ err: error }, '[KnownPools] refresh failed');
    if (!cache) throw error;
  }
  return cache.pools;
}
