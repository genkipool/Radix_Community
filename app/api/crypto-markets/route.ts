import { NextResponse } from 'next/server';
import logger from '@/lib/logger';
import {
  FALLBACK_CRYPTO_COINS,
  type CryptoMarketCoin,
  type CryptoMarketsPayload,
} from '@/features/console/lib/crypto-compare';

/**
 * GET /api/crypto-markets
 *
 * Returns top 100 cryptocurrencies by market cap + Radix (XRD) + EUR/USD rate.
 * Uses ZERO Redis commands: cached in instance memory for 15 minutes and at
 * the Vercel CDN edge (`s-maxage=900, stale-while-revalidate=3600`).
 */

const CACHE_TTL_MS = 15 * 60_000;
const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
};

let memoryCache: { payload: CryptoMarketsPayload; at: number } | null = null;
let inflight: Promise<CryptoMarketsPayload> | null = null;

interface CoinGeckoMarketRow {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price?: number | null;
  market_cap?: number | null;
  fully_diluted_valuation?: number | null;
  circulating_supply?: number | null;
  total_supply?: number | null;
  market_cap_rank?: number | null;
  price_change_percentage_24h?: number | null;
}

function mapRow(r: CoinGeckoMarketRow): CryptoMarketCoin {
  return {
    id: r.id,
    symbol: String(r.symbol ?? '').toUpperCase(),
    name: r.name,
    image: r.image,
    priceUsd: Number(r.current_price ?? 0),
    marketCapUsd: Number(r.market_cap ?? 0),
    fdvUsd: r.fully_diluted_valuation != null ? Number(r.fully_diluted_valuation) : null,
    circulatingSupply: Number(r.circulating_supply ?? 0),
    totalSupply: r.total_supply != null ? Number(r.total_supply) : null,
    rank: r.market_cap_rank ?? null,
    change24h: r.price_change_percentage_24h ?? null,
  };
}

async function fetchFromCoinGecko(): Promise<CryptoMarketsPayload> {
  const [topRes, radixRes, fxRes] = await Promise.all([
    fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h',
      { next: { revalidate: 900 } },
    ),
    fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=radix&sparkline=false&price_change_percentage=24h',
      { next: { revalidate: 900 } },
    ),
    fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=eur',
      { next: { revalidate: 900 } },
    ),
  ]);

  if (!topRes.ok) {
    throw new Error(`CoinGecko markets returned ${topRes.status}`);
  }

  const topRows = (await topRes.json()) as CoinGeckoMarketRow[];
  const coins = topRows.map(mapRow).filter((c) => c.priceUsd > 0 && c.marketCapUsd > 0);

  if (!coins.some((c) => c.id === 'radix') && radixRes.ok) {
    const radixRows = (await radixRes.json()) as CoinGeckoMarketRow[];
    if (radixRows[0]) {
      coins.unshift(mapRow(radixRows[0]));
    }
  }

  let eurPerUsd = 0.92;
  if (fxRes.ok) {
    const fx = (await fxRes.json()) as { 'usd-coin'?: { eur?: number } };
    const rate = fx?.['usd-coin']?.eur;
    if (typeof rate === 'number' && rate > 0.5 && rate < 2) {
      eurPerUsd = rate;
    }
  }

  return {
    coins,
    eurPerUsd,
    updatedAt: new Date().toISOString(),
  };
}

export async function getCryptoMarkets(): Promise<CryptoMarketsPayload> {
  const now = Date.now();
  if (memoryCache && now - memoryCache.at < CACHE_TTL_MS) {
    return memoryCache.payload;
  }
  if (inflight) return inflight;

  inflight = fetchFromCoinGecko()
    .then((payload) => {
      memoryCache = { payload, at: Date.now() };
      return payload;
    })
    .catch((err) => {
      logger.warn({ err }, '[CryptoMarkets] CoinGecko fetch failed; serving cached/fallback data');
      if (memoryCache) return memoryCache.payload;
      return {
        coins: FALLBACK_CRYPTO_COINS,
        eurPerUsd: 0.92,
        updatedAt: new Date().toISOString(),
        fallback: true,
      };
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export async function GET() {
  const payload = await getCryptoMarkets();
  return NextResponse.json(payload, { headers: CACHE_HEADERS });
}
