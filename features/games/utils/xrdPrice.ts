/**
 * XRD price fetching utility.
 * Tries multiple APIs in sequence with a 5-second timeout each.
 * Reusable across the whole application.
 */

import { XRDPrice } from '../types/data.types';

/** EUR/USD approximation fallback when no direct EUR feed is available */
const EUR_USD_APPROX = 0.92;

/** Fetch XRD price from CoinGecko (free endpoint) */
async function fromCoinGecko(): Promise<XRDPrice> {
  const r = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=radix&vs_currencies=usd,eur',
    { signal: AbortSignal.timeout(5000) }
  );
  if (!r.ok) throw new Error(`CoinGecko HTTP ${r.status}`);
  const d = await r.json();
  if (!d?.radix?.usd) throw new Error('CoinGecko: missing radix.usd');
  return { usd: d.radix.usd, eur: d.radix.eur ?? d.radix.usd * EUR_USD_APPROX };
}

/** Fetch XRD price from CoinPaprika */
async function fromCoinPaprika(): Promise<XRDPrice> {
  const r = await fetch(
    'https://api.coinpaprika.com/v1/tickers/xrd-radix-network-token',
    { signal: AbortSignal.timeout(5000) }
  );
  if (!r.ok) throw new Error(`CoinPaprika HTTP ${r.status}`);
  const d = await r.json();
  const usd = d?.quotes?.USD?.price;
  if (!usd) throw new Error('CoinPaprika: missing USD price');
  return { usd, eur: usd * EUR_USD_APPROX };
}

/** Fetch XRD price from Binance (XRDUSDT pair) */
async function fromBinance(): Promise<XRDPrice> {
  const r = await fetch(
    'https://api.binance.com/api/v3/ticker/price?symbol=XRDUSDT',
    { signal: AbortSignal.timeout(5000) }
  );
  if (!r.ok) throw new Error(`Binance HTTP ${r.status}`);
  const d = await r.json();
  const usd = parseFloat(d.price);
  if (!usd || isNaN(usd)) throw new Error('Binance: invalid price');
  return { usd, eur: usd * EUR_USD_APPROX };
}

/**
 * Fetch the current XRD price in USD and EUR.
 * Tries CoinGecko → CoinPaprika → Binance in order.
 * Throws if all sources fail.
 */
export async function fetchXRDPrice(): Promise<XRDPrice> {
  const sources = [fromCoinGecko, fromCoinPaprika, fromBinance];
  const errors: unknown[] = [];

  for (const source of sources) {
    try {
      return await source();
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error);
      } else {
        errors.push(new Error(String(error)));
      }
    }
  }

  throw new AggregateError(errors, 'All XRD price sources failed');
}

/**
 * Formats a USD amount as a readable string, e.g. "$1,234.56"
 */
export function formatUSD(amount: number, decimals = 2): string {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/**
 * Formats an XRD amount as a readable string, e.g. "1,234.56 XRD"
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatXRD(amount: number, decimals = 2): string {
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} XRD`;
}
