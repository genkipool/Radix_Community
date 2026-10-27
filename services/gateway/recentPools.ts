/**
 * Server-side cache of the pools with recent network-wide contributions or
 * redemptions, the console pickers' "Recent activity" tab. It is the same for
 * every visitor, so one lookup per network every few minutes serves them all,
 * instead of each browser chaining the stream and name reads on every popup.
 */
import { findLedgerEntities, type LedgerEntity } from '@/features/console/lib/ledger-entities';
import logger from '@/lib/logger';
import { gatewayPost } from './bases';

/** Recent activity goes stale quickly, unlike the DEX lists: 5 minutes. */
export const RECENT_POOLS_TTL_S = 5 * 60;
const TTL_MS = RECENT_POOLS_TTL_S * 1000;
type Network = 'mainnet' | 'stokenet';
const cache = new Map<Network, { at: number; pools: LedgerEntity[] }>();
const inFlight = new Map<Network, Promise<LedgerEntity[]>>();

export async function getRecentPoolsCached(network: Network): Promise<LedgerEntity[]> {
  const cached = cache.get(network);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.pools;

  let request = inFlight.get(network);
  if (!request) {
    request = findLedgerEntities((path, body) => gatewayPost(network, path, body), { accounts: [], kinds: ['pool'] }).finally(() =>
      inFlight.delete(network),
    );
    inFlight.set(network, request);
  }
  try {
    const pools = await request;
    // An empty answer is likely a Gateway hiccup: keep serving the last good list.
    if (pools.length > 0 || !cached) cache.set(network, { at: Date.now(), pools });
  } catch (error) {
    logger.warn({ err: error, network }, '[RecentPools] refresh failed');
    if (!cached) throw error;
  }
  return cache.get(network)!.pools;
}
