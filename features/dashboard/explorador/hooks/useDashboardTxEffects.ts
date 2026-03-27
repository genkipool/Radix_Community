'use client';

/**
 * features/dashboard/explorador/hooks/useDashboardTxEffects.ts
 *
 * Side-effect hook for the transaction explorer:
 *   - useInfiniteScrollTx — scroll-based pagination (no DOM spinner)
 */

import { useEffect } from 'react';

// ── useInfiniteScrollTx ───────────────────────────────────────────────────────
interface UseInfiniteScrollTxOptions {
  activeView:          'staking' | 'transactions';
  hasNextPage:         boolean;
  isFetchingNextPage:  boolean;
  fetchNextPage:       () => void;
}

/**
 * Drives scroll-based pagination for the transaction explorer.
 * Throttled via requestAnimationFrame. Uses a passive listener for max scroll perf.
 * No spinner rendered in the DOM — avoids scrollHeight feedback loop / footer flicker.
 */
export function useInfiniteScrollTx({
  activeView, hasNextPage, isFetchingNextPage, fetchNextPage,
}: UseInfiniteScrollTxOptions): void {
  useEffect(() => {
    if (activeView !== 'transactions') return;

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrolled = window.scrollY + window.innerHeight;
        const total    = document.documentElement.scrollHeight;
        if (scrolled >= total - 800 && hasNextPage && !isFetchingNextPage) fetchNextPage();
        ticking = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // check immediately in case page is already short enough
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeView, hasNextPage, isFetchingNextPage, fetchNextPage]);
}
