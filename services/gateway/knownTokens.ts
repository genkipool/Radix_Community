/**
 * Server-side cache of the genuine token behind each symbol (mainnet only),
 * shared by /api/console/known-tokens and the MCP tools.
 */
import { fetchKnownTokens, type KnownTokens } from '@/features/console/lib/known-tokens';
import logger from '@/lib/logger';
import { gatewayPost } from './bases';

/** Symbols rarely change hands: a refresh every 6 hours per instance, the CDN on top. */
export const KNOWN_TOKENS_TTL_S = 6 * 60 * 60;
const TTL_MS = KNOWN_TOKENS_TTL_S * 1000;
let cache: { at: number; tokens: KnownTokens } | null = null;
let inFlight: Promise<KnownTokens> | null = null;

export async function getKnownTokensCached(network: 'mainnet' | 'stokenet'): Promise<KnownTokens> {
  if (network !== 'mainnet') return {};
  if (cache && Date.now() - cache.at < TTL_MS) return cache.tokens;

  inFlight ??= fetchKnownTokens(
    (url) => fetch(url, { headers: { 'user-agent': 'radix-community-console' } }),
    (path, body) => gatewayPost('mainnet', path, body),
  ).finally(() => {
    inFlight = null;
  });
  try {
    const tokens = await inFlight;
    // An empty answer is an upstream hiccup: keep serving the last good list.
    if (Object.keys(tokens).length > 0 || !cache) cache = { at: Date.now(), tokens };
  } catch (error) {
    logger.warn({ err: error }, '[KnownTokens] refresh failed');
    if (!cache) throw error;
  }
  return cache.tokens;
}
