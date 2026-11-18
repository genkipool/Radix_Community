/**
 * services/xrdHistoricalPrices.ts
 *
 * Historical daily XRD closing prices in USD and EUR (`"YYYY-MM-DD": [usd, eur]`),
 * from Olympia launch (2021-07-26) to today.
 *
 * Zero-Redis design:
 * - Past days never change, so the baseline (2021-07-26 → build date) is bundled
 *   statically in `services/data/xrd-daily-prices.json` (~19 KB gzipped).
 * - For days after the static baseline, the service fetches only the missing
 *   recent window from CoinGecko's public `market_chart` endpoint at most once
 *   every 6 hours per server instance (with inflight coalescing and failure
 *   backoff), and overlays today's live price from `getMarketDataCached()`.
 * - Nothing is written to or read from Redis for historical prices.
 */
import 'server-only';
import logger from '@/lib/logger';
import { getMarketDataCached } from '@/services/marketData';
import staticPricesJson from './data/xrd-daily-prices.json';

/** `[usd, eur]` closing price of 1 XRD on a UTC day. */
export type DailyXrdPrice = [number, number];
export type XrdDailyPricesMap = Record<string, DailyXrdPrice>;

export interface XrdDailyPricesPayload {
    prices: XrdDailyPricesMap;
    updatedAt: number;
}

const STATIC_PRICES: XrdDailyPricesMap = staticPricesJson as unknown as XrdDailyPricesMap;
const STATIC_DAYS = Object.keys(STATIC_PRICES).sort();
const LAST_STATIC_DAY = STATIC_DAYS[STATIC_DAYS.length - 1] ?? '2021-07-26';

const FRESH_MS = 6 * 60 * 60_000; // 6 hours
const RETRY_MS = 60_000;          // 1 minute after failure
const TIMEOUT_MS = 8_000;
const MAX_BYTES = 2 * 1024 * 1024;

const toDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const roundPrice = (n: number): number => Number(n.toPrecision(6));
const validPrice = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0 && n < 1e6;

async function fetchCoinGeckoDaily(currency: 'usd' | 'eur', days: number): Promise<Map<string, number>> {
    const url = `https://api.coingecko.com/api/v3/coins/radix/market_chart?vs_currency=${currency}&days=${days}&interval=daily`;
    const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: 'no-store',
        headers: { accept: 'application/json' },
        redirect: 'error',
    });
    if (!res.ok) throw new Error(`CoinGecko market_chart (${currency}): ${res.status}`);
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > MAX_BYTES) throw new Error('CoinGecko market_chart: response too large');
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new Error('CoinGecko market_chart: response too large');
    const body = JSON.parse(text) as { prices?: unknown };
    const byDay = new Map<string, number>();
    if (!Array.isArray(body?.prices)) return byDay;
    for (const point of body.prices) {
        if (!Array.isArray(point) || point.length < 2) continue;
        const [mts, price] = point;
        if (typeof mts === 'number' && validPrice(price)) {
            byDay.set(toDay(mts), roundPrice(price));
        }
    }
    return byDay;
}

function daysBetween(fromDay: string, toDayStr: string): number {
    const a = Date.parse(`${fromDay}T00:00:00Z`);
    const b = Date.parse(`${toDayStr}T00:00:00Z`);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
    return Math.ceil((b - a) / 86_400_000);
}

let cached: { payload: XrdDailyPricesPayload; day: string } | null = null;
let failedAt = 0;
let inflight: Promise<XrdDailyPricesPayload> | null = null;

async function buildPayload(todayUtc: string): Promise<XrdDailyPricesPayload> {
    const merged: XrdDailyPricesMap = { ...STATIC_PRICES };
    const missingDays = daysBetween(LAST_STATIC_DAY, todayUtc);

    // Only hit CoinGecko when today is past the static baseline.
    if (missingDays > 0) {
        const windowDays = Math.min(365, Math.max(7, missingDays + 2));
        const [usdRes, eurRes] = await Promise.allSettled([
            fetchCoinGeckoDaily('usd', windowDays),
            fetchCoinGeckoDaily('eur', windowDays),
        ]);
        if (usdRes.status === 'rejected') logger.warn({ err: usdRes.reason }, '[XrdHistoricalPrices] CoinGecko USD tail failed');
        if (eurRes.status === 'rejected') logger.warn({ err: eurRes.reason }, '[XrdHistoricalPrices] CoinGecko EUR tail failed');

        const usdMap = usdRes.status === 'fulfilled' ? usdRes.value : new Map<string, number>();
        const eurMap = eurRes.status === 'fulfilled' ? eurRes.value : new Map<string, number>();

        for (const [day, usd] of usdMap.entries()) {
            const eur = eurMap.get(day);
            if (validPrice(usd) && validPrice(eur)) {
                merged[day] = [usd, eur];
            }
        }
    }

    // Overlay today's live price from the already-cached market data (no extra Redis hit).
    try {
        const live = await getMarketDataCached();
        if (live && validPrice(live.priceUsd) && validPrice(live.priceEur)) {
            merged[todayUtc] = [roundPrice(live.priceUsd), roundPrice(live.priceEur)];
        }
    } catch (err) {
        logger.warn({ err }, '[XrdHistoricalPrices] Failed to overlay live market price');
    }

    return { prices: merged, updatedAt: Date.now() };
}

/**
 * Returns the full daily XRD price map (`YYYY-MM-DD -> [usd, eur]`).
 * Cached in instance memory for 6 hours; concurrent callers share one refresh.
 */
export async function getXrdDailyPrices(): Promise<XrdDailyPricesPayload> {
    const now = Date.now();
    const todayUtc = toDay(now);

    if (cached && cached.day === todayUtc && now - cached.payload.updatedAt < FRESH_MS) {
        return cached.payload;
    }
    if (!inflight && cached && now - failedAt < RETRY_MS) {
        return cached.payload;
    }
    if (!inflight) {
        inflight = buildPayload(todayUtc)
            .then((payload) => {
                cached = { payload, day: todayUtc };
                return payload;
            })
            .catch((err) => {
                failedAt = Date.now();
                logger.warn({ err }, '[XrdHistoricalPrices] Refresh failed, serving static baseline');
                return cached?.payload ?? { prices: STATIC_PRICES, updatedAt: Date.now() };
            })
            .finally(() => {
                inflight = null;
            });
    }
    return inflight;
}
