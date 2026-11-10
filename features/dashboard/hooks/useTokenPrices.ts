'use client';
/**
 * The current fiat price of Radix mainnet tokens, from /api/token-prices
 * (Astrolescent, Ociswap only for what it lacks, XRD from CoinGecko). One
 * request for every card on the page, kept a minute: the server and the CDN
 * keep it a minute too, so asking more often would only get the same answer.
 */
import { useQuery } from '@tanstack/react-query';
import { getCurrencyForLocale } from '@/utils/currencyUtils';
import type { TokenPrices, PriceSource } from '@/services/tokenPrices';

const MINUTE = 60_000;

async function fetchTokenPrices(): Promise<TokenPrices | null> {
  const res = await fetch('/api/token-prices');
  if (res.status === 503) return null;
  if (!res.ok) throw new Error(`token-prices: ${res.status}`);
  return res.json() as Promise<TokenPrices>;
}

export interface TokenFiatPrice {
  /** One token in the visitor's currency. */
  unit: number;
  currency: 'EUR' | 'USD';
  source: PriceSource;
}

/** `priceOf(resource)`: its fiat price, or null when unknown (no source lists it, Stokenet, or not loaded yet). */
export function useTokenPrices(network: string, locale: string, enabled = true) {
  const currency = getCurrencyForLocale(locale);
  const { data } = useQuery({
    queryKey: ['token-prices'],
    queryFn: fetchTokenPrices,
    enabled: enabled && network === 'mainnet',
    staleTime: MINUTE,
    gcTime: 10 * MINUTE,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const xrdFiat = data?.xrd ? (currency === 'EUR' ? data.xrd.eur : data.xrd.usd) : 0;
  const priceOf = (resource: string): TokenFiatPrice | null => {
    const p = data?.tokens[resource];
    if (!p || !xrdFiat) return null;
    return { unit: p.xrd * xrdFiat, currency, source: p.src };
  };
  return { priceOf, currency, ready: !!data && xrdFiat > 0 };
}
