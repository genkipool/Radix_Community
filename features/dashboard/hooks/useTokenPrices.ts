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

export type TokenPriceSource = PriceSource | 'onchain';

export interface TokenFiatPrice {
  /** One token in the visitor's currency. */
  unit: number;
  currency: 'EUR' | 'USD';
  source: TokenPriceSource;
}

export interface PricedTokenInput {
  address: string;
  isLsu?: boolean;
  /** On-chain XRD per 1 LSU from the validator's stake vault / LSU supply. */
  lsu2xrdFactor?: number;
}

/**
 * Resolves the unit fiat price for a resource or parsed token.
 * Validator LSUs are always priced from their live on-chain `lsu2xrdFactor`
 * (never from DEX feeds, which omit many LSUs and can serve stale quotes).
 */
export function resolveTokenFiatPrice(
  token: string | PricedTokenInput,
  data: TokenPrices | null | undefined,
  currency: 'EUR' | 'USD',
): TokenFiatPrice | null {
  const xrdFiat = data?.xrd ? (currency === 'EUR' ? data.xrd.eur : data.xrd.usd) : 0;
  if (!xrdFiat) return null;
  if (typeof token !== 'string' && token.isLsu) {
    const factor = token.lsu2xrdFactor;
    if (typeof factor === 'number' && Number.isFinite(factor) && factor > 0) {
      return { unit: factor * xrdFiat, currency, source: 'onchain' };
    }
    return null;
  }
  const resource = typeof token === 'string' ? token : token.address;
  const p = data?.tokens[resource];
  if (!p) return null;
  return { unit: p.xrd * xrdFiat, currency, source: p.src };
}

/** `priceOf(token)`: its fiat price, or null when unknown (no source lists it, Stokenet, or not loaded yet). */
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
  const priceOf = (token: string | PricedTokenInput): TokenFiatPrice | null =>
    resolveTokenFiatPrice(token, data, currency);
  return { priceOf, currency, ready: !!data && xrdFiat > 0 };
}
