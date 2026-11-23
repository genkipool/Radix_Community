'use client';

import { useQuery } from '@tanstack/react-query';
import type { CryptoMarketsPayload } from '../lib/crypto-compare';

/**
 * Shared React Query hook for `/api/crypto-markets` (top 100 coins + Radix + EUR/USD).
 * Zero Redis commands: served from Vercel CDN (`s-maxage=900`) and cached in React Query.
 */
export function useCryptoMarkets() {
  return useQuery<CryptoMarketsPayload>({
    queryKey: ['console', 'crypto-markets'],
    queryFn: async () => {
      const res = await fetch('/api/crypto-markets');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });
}
