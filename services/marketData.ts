import { Redis } from '@upstash/redis';
import logger from '@/lib/logger';

export interface MarketData {
    priceUsd: number;
    priceEur: number;
    priceChange24h: number;
    marketCapUsd: number;
    marketCapEur: number;
    circulatingSupply: number;
    totalValueLockedUsd: number;
    totalValueLockedEur: number;
}

const REDIS_KEY = 'radix_market_data';

/**
 * Returns an Upstash Redis client or null when env vars are missing.
 */
const getRedisClient = () => {
    try {
        if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
            return new Redis({
                url: process.env.KV_REST_API_URL,
                token: process.env.KV_REST_API_TOKEN,
            });
        }
    } catch (e) {
        logger.error({ err: e }, '[MarketData] Failed to initialize Redis');
    }
    return null;
};

/**
 * Fetches fresh market data from CoinGecko API.
 */
export const fetchMarketData = async (): Promise<MarketData | null> => {
    try {
        const res = await fetch(
            'https://api.coingecko.com/api/v3/coins/radix?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false',
            { next: { revalidate: 60 } }
        );

        if (!res.ok) {
            logger.error({ status: res.statusText }, '[MarketData] Failed to fetch data from CoinGecko');
            return null;
        }

        const data = await res.json();

        if (!data?.market_data) {
            return null;
        }

        const tvlUsd = data.market_data.total_value_locked?.usd ?? 0;
        const priceUsd = data.market_data.current_price?.usd ?? 1;
        const priceEur = data.market_data.current_price?.eur ?? 1;
        // Derive EUR/USD rate from price data (CoinGecko lacks TVL in EUR for Radix)
        const eurUsdRate = priceUsd > 0 ? priceEur / priceUsd : 1;

        return {
            priceUsd: data.market_data.current_price?.usd ?? 0,
            priceEur: priceEur,
            priceChange24h: data.market_data.price_change_percentage_24h ?? 0,
            marketCapUsd: data.market_data.market_cap?.usd ?? 0,
            marketCapEur: data.market_data.market_cap?.eur ?? 0,
            circulatingSupply: data.market_data.circulating_supply ?? 0,
            totalValueLockedUsd: tvlUsd,
            totalValueLockedEur: tvlUsd * eurUsdRate,
        };
    } catch (error) {
        logger.error({ error }, '[MarketData] Exception fetching from CoinGecko');
        return null;
    }
};

/**
 * SWR (Stale-While-Revalidate) with Redis persistence:
 *
 * 1. Try Redis for an instant cached hit.
 * 2. If found, serve it immediately AND refresh in background.
 * 3. If not found, fetch fresh, store in Redis, and return.
 *
 * This ensures the first page load always has data (no flash)
 * and the next load will have updated data.
 */
export const getMarketDataCached = async (): Promise<MarketData | null> => {
    const redis = getRedisClient();

    // ── Step 1: Redis fast hit ─────────────────────────────────────────
    if (redis) {
        try {
            const stale = await redis.get<MarketData>(REDIS_KEY);
            if (stale && typeof stale.priceUsd === 'number') {
                logger.info({}, '[MarketData] Serving from Redis cache — refreshing in background');

                // Background refresh: do NOT await
                fetchMarketData().then(async (fresh) => {
                    if (fresh) {
                        await redis.set(REDIS_KEY, fresh);
                        logger.info({}, '[MarketData] Redis cache updated with fresh CoinGecko data');
                    }
                }).catch((e) =>
                    logger.error({ err: e }, '[MarketData] Background refresh failed')
                );

                return stale;
            }
        } catch (e) {
            logger.error({ err: e }, '[MarketData] Redis read failed — falling through to CoinGecko');
        }
    }

    // ── Step 2: Cache miss — fetch fresh ────────────────────────────────
    logger.info({}, '[MarketData] Cache miss — fetching fresh from CoinGecko');
    const fresh = await fetchMarketData();

    // Seed Redis for next request
    if (fresh && redis) {
        redis.set(REDIS_KEY, fresh).catch((e) =>
            logger.error({ err: e }, '[MarketData] Failed to seed Redis')
        );
    }

    return fresh;
};
