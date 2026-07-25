'use client';

/**
 * features/dashboard/explorador/hooks/useDashboardTxEffects.ts
 *
 * Side-effect hook for the transaction explorer:
 *   - useInfiniteScrollTx — scroll-based pagination (no DOM spinner)
 */

import { useEffect, useState } from 'react';
import { TRANSACTION_PAGE_SIZE } from '@/constants/dashboard';

// ── useInfiniteScrollTx ───────────────────────────────────────────────────────
interface UseInfiniteScrollTxOptions {
  activeView:          'staking' | 'transactions';
  hasNextPage:         boolean;
  isFetchingNextPage:  boolean;
  fetchNextPage:       () => void;
  /** How many transactions are currently loaded in the query cache. */
  loadedCount:         number;
}

/**
 * Drives pagination for the transaction explorer in two stages, the same shape
 * the validator list already uses.
 *
 * The server seeds the transaction tip from Redis, and that tip is 100 items by
 * design (the cache is deliberately kept at 100 so smaller requests cannot
 * shrink it). Rendering all of them on arrival meant ~100 transaction cards
 * hydrating before the page could respond, for a viewport that shows a handful.
 *
 * So scrolling first REVEALS more of what is already in memory, and only asks
 * the server for another page once the visible window has caught up with it.
 *
 * Throttled via requestAnimationFrame, passive listener, and no DOM spinner —
 * a spinner feeds back into scrollHeight and makes the footer flicker.
 */
export function useInfiniteScrollTx({
  activeView, hasNextPage, isFetchingNextPage, fetchNextPage, loadedCount,
}: UseInfiniteScrollTxOptions): number {
  const [visibleCount, setVisibleCount] = useState(TRANSACTION_PAGE_SIZE);

  useEffect(() => {
    if (activeView !== 'transactions') return;

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrolled = window.scrollY + window.innerHeight;
        const total    = document.documentElement.scrollHeight;
        if (scrolled >= total - 800) {
          if (visibleCount < loadedCount) {
            // Reveal more of what is already here: no network, no waiting.
            setVisibleCount((n) => n + TRANSACTION_PAGE_SIZE);
          } else if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }
        ticking = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // check immediately in case page is already short enough
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeView, hasNextPage, isFetchingNextPage, fetchNextPage, visibleCount, loadedCount]);

  return visibleCount;
}
