'use client';

/**
 * features/dashboard/staking/hooks/useValidatorFilters.ts
 *
 * Memoized filtering + sorting of the validator list, plus progressive
 * rendering via an IntersectionObserver sentinel.
 */

import { useState, useEffect, useRef } from 'react';
import type { Validator } from '@/types/radix';
import { VALIDATOR_PAGE_SIZE } from '@/constants/dashboard';
import type { SortMode } from '@/features/dashboard/types';

interface UseValidatorFiltersOptions {
  validators:  Validator[];
  activeTags:  string[];
  searchQuery: string;
  sortMode:    SortMode;
  network:     string;
  activeView:  'staking' | 'transactions';
  randomSeed:  number;
  pinnedValidatorAddresses?: string[];
}

interface UseValidatorFiltersReturn {
  filtered:        Validator[];
  visibleValCount: number;
  sentinelRef:     React.RefObject<HTMLDivElement | null>;
}

export function useValidatorFilters({
  validators, activeTags, searchQuery, sortMode, network, activeView, randomSeed, pinnedValidatorAddresses
}: UseValidatorFiltersOptions): UseValidatorFiltersReturn {

  // React Compiler automatically memoizes this derived calculation.
  const filtered = (() => {
    let result = [...validators];

    // 1. Filter by Tags
    if (!activeTags.includes('All')) {
      const hasActive = activeTags.includes('Active');
      const hasInactive = activeTags.includes('Inactive');

      // Status filters (OR logic between them)
      if (hasActive || hasInactive) {
        result = result.filter(v => {
          if (hasActive && v.status === 'active') return true;
          if (hasInactive && v.status === 'inactive') return true;
          return false;
        });
      }

      // Attribute filters (AND logic)
      activeTags.forEach(tag => {
        if (tag === 'Active' || tag === 'Inactive') return;

        if (tag === 'Low Fee') {
          result = result.filter(v => v.nominalFee <= 2);
        } else if (tag === 'High Uptime') {
          result = result.filter(v => v.recentUptime >= 98.5);
        } else if (tag === 'Community') {
          result = result.filter(v =>
            (v.tags ?? []).includes('Community') || (v.tags ?? []).includes('Hispanic Community'),
          );
        } else {
          result = result.filter(v => (v.tags ?? []).includes(tag));
        }
      });
    }

    // 2. Search
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      result = result.filter(v =>
        v.name.toLowerCase().includes(query) ||
        v.address.toLowerCase().includes(query) ||
        (v.country ?? '').toLowerCase().includes(query),
      );
    }

    // 3. Sort
    if (activeTags.includes('Low Fee') && sortMode === 'random') {
      result.sort((a, b) => a.nominalFee - b.nominalFee);
    } else {
      if (sortMode === 'newest') result.sort((a, b) => b.totalStakeXRD - a.totalStakeXRD);
      if (sortMode === 'oldest') result.sort((a, b) => a.totalStakeXRD - b.totalStakeXRD);
      if (sortMode === 'date')   result.sort((a, b) => b.apy - a.apy);

      // Deterministic Random Sorting (using stable seed)
      if (sortMode === 'random') {
        // Mulberry32 PRNG — simple, fast, and deterministic
        const mulberry32 = (seed: number) => {
          return () => {
            let t = (seed += 0x6D2B79F5);
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
          };
        };

        const rand = mulberry32(randomSeed);

        // 1. Assign random 'eligibility' (Lottery only in 'All' view)
        const isMixedView = activeTags.includes('All') && !searchQuery.trim();

        const scored = result.map(v => {
          let p = 1.0;
          if (isMixedView) {
            if (v.status !== 'active') p = 0.05;
            else if (v.delegatedStakePercent > 2) p = 0.25;
          }

          // Lottery winner (deterministic based on seed + validator address)
          const vSeed = v.address.split('').reduce((acc, char) => acc + char.charCodeAt(0), randomSeed);
          const vRand = mulberry32(vSeed)();

          const lotteryWinner = vRand < p;
          return { v, lotteryWinner, tieBreaker: rand() };
        });

        // 2. Sort by lottery victory, then by random tie-breaker
        scored.sort((a, b) => {
          if (a.lotteryWinner !== b.lotteryWinner) {
            return a.lotteryWinner ? -1 : 1;
          }
          return b.tieBreaker - a.tieBreaker;
        });

        result = scored.map(s => s.v);
      }
    }

    // 4. Pin Delegated Validators (if provided)
    if (pinnedValidatorAddresses && pinnedValidatorAddresses.length > 0) {
      const pinned = result.filter(v => pinnedValidatorAddresses.includes(v.address));
      const others = result.filter(v => !pinnedValidatorAddresses.includes(v.address));
      return [...pinned, ...others];
    }

    return result;
  })();

  const [visibleValCount, setVisibleValCount] = useState(VALIDATOR_PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [prevDeps, setPrevDeps] = useState({ activeTags, searchQuery, sortMode, network, randomSeed });
  if (
    activeTags !== prevDeps.activeTags ||
    searchQuery !== prevDeps.searchQuery ||
    sortMode !== prevDeps.sortMode ||
    network !== prevDeps.network ||
    randomSeed !== prevDeps.randomSeed
  ) {
    setPrevDeps({ activeTags, searchQuery, sortMode, network, randomSeed });
    setVisibleValCount(VALIDATOR_PAGE_SIZE);
  }

  useEffect(() => {
    if (activeView !== 'staking' || visibleValCount >= filtered.length) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting)
          setVisibleValCount(prev => Math.min(prev + VALIDATOR_PAGE_SIZE, filtered.length));
      },
      { rootMargin: '200px' },
    );
    const el = sentinelRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [activeView, visibleValCount, filtered.length, filtered]);

  return { filtered, visibleValCount, sentinelRef };
}
