'use client';

import { useQuery } from '@tanstack/react-query';
import type { FiatCurrency } from '@/utils/currencyUtils';

/** `[usd, eur]` closing price of 1 XRD on a UTC day (`YYYY-MM-DD`). */
export type DailyXrdPrice = [number, number];
export type XrdDailyPricesMap = Record<string, DailyXrdPrice>;

export interface XrdDailyPricesResponse {
    prices: XrdDailyPricesMap;
    updatedAt: number;
}

const SIX_HOURS = 6 * 60 * 60_000;

async function fetchXrdDailyPrices(): Promise<XrdDailyPricesResponse> {
    const res = await fetch('/api/xrd-daily-prices');
    if (!res.ok) throw new Error(`xrd-daily-prices ${res.status}`);
    return res.json() as Promise<XrdDailyPricesResponse>;
}

/**
 * Historical daily XRD prices in USD and EUR. Fetched at most once per 6 hours
 * per browser session (shared across all Babylon and Olympia accounts/years).
 */
export function useXrdDailyPrices(enabled = true) {
    return useQuery({
        queryKey: ['xrd-daily-prices'] as const,
        queryFn: fetchXrdDailyPrices,
        enabled,
        staleTime: SIX_HOURS,
        gcTime: 12 * 60 * 60_000,
        retry: 1,
    });
}

function stepDayBack(day: string, offsetDays: number): string {
    const ms = Date.parse(`${day}T00:00:00Z`);
    if (!Number.isFinite(ms)) return day;
    return new Date(ms - offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Looks up the XRD fiat price on `day` (`YYYY-MM-DD`). If that exact day is
 * missing (e.g. today before CoinGecko updates), falls back to the nearest
 * prior day within 7 days, or `fallbackPrice` if supplied.
 */
export function lookupXrdFiatPrice(
    prices: XrdDailyPricesMap | undefined,
    day: string,
    currency: FiatCurrency,
    fallbackPrice?: number | null,
): number | null {
    const idx = currency === 'EUR' ? 1 : 0;
    if (prices) {
        const direct = prices[day]?.[idx];
        if (typeof direct === 'number' && Number.isFinite(direct) && direct > 0) return direct;
        for (let back = 1; back <= 7; back++) {
            const prev = prices[stepDayBack(day, back)]?.[idx];
            if (typeof prev === 'number' && Number.isFinite(prev) && prev > 0) return prev;
        }
    }
    return typeof fallbackPrice === 'number' && Number.isFinite(fallbackPrice) && fallbackPrice > 0
        ? fallbackPrice
        : null;
}

/**
 * Latest XRD fiat price from `marketData` when available, otherwise from the
 * most recent entry in the daily prices map.
 */
export function resolveCurrentXrdPrice(
    marketData: { priceUsd: number; priceEur: number } | null | undefined,
    prices: XrdDailyPricesMap | undefined,
    currency: FiatCurrency,
): number | null {
    if (marketData) {
        const p = currency === 'EUR' ? marketData.priceEur : marketData.priceUsd;
        if (Number.isFinite(p) && p > 0) return p;
    }
    if (!prices) return null;
    const today = new Date().toISOString().slice(0, 10);
    return lookupXrdFiatPrice(prices, today, currency);
}
