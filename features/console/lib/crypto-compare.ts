/**
 * Pure crypto market-cap comparison engine.
 * Shared by the Console UI (`CryptoCompareTool`) and MCP (`compare_crypto_marketcap`).
 */

export type CompareMode = 'mcap' | 'fdv';

export interface CryptoMarketCoin {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  priceUsd: number;
  marketCapUsd: number;
  fdvUsd: number | null;
  circulatingSupply: number;
  totalSupply: number | null;
  rank: number | null;
  change24h: number | null;
}

export interface CryptoMarketsPayload {
  coins: CryptoMarketCoin[];
  eurPerUsd: number;
  updatedAt: string;
  fallback?: boolean;
}

export interface CryptoComparisonResult {
  mode: CompareMode;
  base: CryptoMarketCoin;
  target: CryptoMarketCoin;
  baseCapUsd: number;
  targetCapUsd: number;
  /** How many times larger (or smaller) target's cap is relative to base's cap. */
  multiplier: number;
  /** Projected unit price of `base` if it reached `target`'s cap. */
  projectedPriceUsd: number;
  projectedPriceEur: number;
  currentPriceEur: number;
  /** Percentage difference from base's current price (e.g. +1450 means +1450%). */
  percentChange: number;
  /** Ratio baseCap / targetCap in [0, 1] for visual progress bar (clamped). */
  barSharePct: number;
  /** Optional portfolio projection when `amount > 0`. */
  holding?: {
    amount: number;
    currentUsd: number;
    currentEur: number;
    projectedUsd: number;
    projectedEur: number;
    gainUsd: number;
    gainEur: number;
  };
}

export const POPULAR_TARGET_IDS = [
  'bitcoin',
  'ethereum',
  'solana',
  'cardano',
  'sui',
  'avalanche-2',
] as const;

/** Minimal static fallback if CoinGecko is temporarily unavailable/rate-limited. */
export const FALLBACK_CRYPTO_COINS: CryptoMarketCoin[] = [
  { id: 'radix', symbol: 'XRD', name: 'Radix', priceUsd: 0.015, marketCapUsd: 185_000_000, fdvUsd: 195_000_000, circulatingSupply: 12_333_333_333, totalSupply: 13_000_000_000, rank: 250, change24h: 0 },
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', priceUsd: 90_000, marketCapUsd: 1_780_000_000_000, fdvUsd: 1_890_000_000_000, circulatingSupply: 19_780_000, totalSupply: 21_000_000, rank: 1, change24h: 0 },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', priceUsd: 3_200, marketCapUsd: 385_000_000_000, fdvUsd: 385_000_000_000, circulatingSupply: 120_300_000, totalSupply: 120_300_000, rank: 2, change24h: 0 },
  { id: 'solana', symbol: 'SOL', name: 'Solana', priceUsd: 190, marketCapUsd: 90_000_000_000, fdvUsd: 112_000_000_000, circulatingSupply: 474_000_000, totalSupply: 589_000_000, rank: 4, change24h: 0 },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano', priceUsd: 0.75, marketCapUsd: 26_500_000_000, fdvUsd: 33_750_000_000, circulatingSupply: 35_300_000_000, totalSupply: 45_000_000_000, rank: 9, change24h: 0 },
  { id: 'sui', symbol: 'SUI', name: 'Sui', priceUsd: 3.2, marketCapUsd: 9_600_000_000, fdvUsd: 32_000_000_000, circulatingSupply: 3_000_000_000, totalSupply: 10_000_000_000, rank: 15, change24h: 0 },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche', priceUsd: 32, marketCapUsd: 13_100_000_000, fdvUsd: 23_000_000_000, circulatingSupply: 409_000_000, totalSupply: 720_000_000, rank: 12, change24h: 0 },
];

function effectiveCap(coin: CryptoMarketCoin, mode: CompareMode): number {
  if (mode === 'fdv') {
    if (coin.fdvUsd && coin.fdvUsd > 0) return coin.fdvUsd;
    if (coin.totalSupply && coin.totalSupply > 0 && coin.priceUsd > 0) {
      return coin.totalSupply * coin.priceUsd;
    }
  }
  return coin.marketCapUsd > 0 ? coin.marketCapUsd : 0;
}

/**
 * Computes what unit price `base` would have if it had `target`'s market cap
 * (or FDV). Returns null when either coin lacks positive cap/price data.
 */
export function compareCryptoMarketCap(
  base: CryptoMarketCoin,
  target: CryptoMarketCoin,
  mode: CompareMode = 'mcap',
  eurPerUsd = 0.92,
  amount?: number,
): CryptoComparisonResult | null {
  const baseCapUsd = effectiveCap(base, mode);
  const targetCapUsd = effectiveCap(target, mode);
  if (baseCapUsd <= 0 || targetCapUsd <= 0 || base.priceUsd <= 0) return null;

  const multiplier = targetCapUsd / baseCapUsd;
  const projectedPriceUsd = base.priceUsd * multiplier;
  const safeRate = eurPerUsd > 0 ? eurPerUsd : 0.92;
  const currentPriceEur = base.priceUsd * safeRate;
  const projectedPriceEur = projectedPriceUsd * safeRate;
  const percentChange = (multiplier - 1) * 100;
  const ratio = baseCapUsd / targetCapUsd;
  // Use a base-10 logarithmic scale for ratios < 1 (crypto caps span 5+ orders of
  // magnitude, so a linear bar looks stuck at ~0.5% for BTC/ETH/SOL/AVAX/etc.).
  const barSharePct = ratio >= 1
    ? 100
    : Math.min(100, Math.max(4, 4 + ((Math.max(-6, Math.log10(ratio)) + 6) / 6) * 96));

  const validAmount = typeof amount === 'number' && Number.isFinite(amount) && amount > 0 ? amount : undefined;
  const holding = validAmount !== undefined
    ? {
        amount: validAmount,
        currentUsd: validAmount * base.priceUsd,
        currentEur: validAmount * currentPriceEur,
        projectedUsd: validAmount * projectedPriceUsd,
        projectedEur: validAmount * projectedPriceEur,
        gainUsd: validAmount * (projectedPriceUsd - base.priceUsd),
        gainEur: validAmount * (projectedPriceEur - currentPriceEur),
      }
    : undefined;

  return {
    mode,
    base,
    target,
    baseCapUsd,
    targetCapUsd,
    multiplier,
    projectedPriceUsd,
    projectedPriceEur,
    currentPriceEur,
    percentChange,
    barSharePct,
    holding,
  };
}

/** Finds a coin by id, symbol, or name (case-insensitive). */
export function findCoin(coins: CryptoMarketCoin[], query: string): CryptoMarketCoin | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return (
    coins.find((c) => c.id.toLowerCase() === q)
    ?? coins.find((c) => c.symbol.toLowerCase() === q)
    ?? coins.find((c) => c.name.toLowerCase() === q)
  );
}
