'use client';

/**
 * features/dashboard/hooks/useExpandedCards.ts
 *
 * Manages expanded-card state for both validators and transactions.
 *
 * Responsibilities:
 * - Initialises sets from server-read cookies (zero hydration flash)
 * - Syncs sets back to cookies on every change (survive reloads & locale switches)
 * - Auto-collapses all cards when the user switches to a dense grid (≥4 cols)
 * - Provides typed expand / close / toggle-all callbacks
 */

import { useState, useEffect } from 'react';
import type { Validator } from '@/types/radix';
import type { TransactionInfo } from '@/types/radix';
import { COOKIE_KEYS } from '@/constants/dashboard';
import { setCookie } from '@/utils/cookies';
import { getNetworkCookieKey } from '../utils/cookieUtils';

const EXPANDED_CARDS_MAX_AGE = 604800; // 7 days

import { type UseExpandedCardsOptions } from '../types';

/**
 * Manages the state of which cards are currently expanded on the dashboard.
 * Supports toggle-all, auto-collapse (close others when one opens),
 * and shared state for reading mode.
 */
export function useExpandedCards({
  network,
  initialExpandedValidators,
  initialExpandedTxs,
  valColumns,
  txColumns,
  activeView,
  readingMode,
  autoCollapse,
}: UseExpandedCardsOptions) {
  const [expandedValidators, setExpandedValidators] = useState<Set<string>>(new Set(initialExpandedValidators));
  const [expandedTxs, setExpandedTxs]                 = useState<Set<string>>(new Set(initialExpandedTxs));

  // ── Cookie sync ──────────────────────────────────────────────────
  useEffect(() => {
    const key = getNetworkCookieKey(COOKIE_KEYS.expandedValidators, network);
    setCookie(key, Array.from(expandedValidators).join(','), EXPANDED_CARDS_MAX_AGE);
  }, [expandedValidators, network]);

  useEffect(() => {
    const key = getNetworkCookieKey(COOKIE_KEYS.expandedTxs, network);
    setCookie(key, Array.from(expandedTxs).join(','), EXPANDED_CARDS_MAX_AGE);
  }, [expandedTxs, network]);

  // ── Auto-collapse on dense grid ──────────────────────────────────
  useEffect(() => {
    if (valColumns >= 4 && expandedValidators.size > 0) setExpandedValidators(new Set());
  }, [valColumns]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (txColumns >= 4 && expandedTxs.size > 0) setExpandedTxs(new Set());
  }, [txColumns]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived view-local set ───────────────────────────────────────
  const expandedPosts    = activeView === 'staking' ? expandedValidators : expandedTxs;
  const setExpandedPosts = activeView === 'staking' ? setExpandedValidators : setExpandedTxs;

  // ── Expand / collapse ────────────────────────────────────────────
  // React Compiler automatically memoizes these functions; no useCallback needed.
  const handleExpandPost = (id: string) => {
    const setter = activeView === 'staking' ? setExpandedValidators : setExpandedTxs;

    if (readingMode) {
      setter(new Set([id]));
    } else {
      setter(prev => {
        const next = new Set(prev);
        if (autoCollapse) {
          void (next.has(id) ? next.delete(id) : (next.clear(), next.add(id)));
        } else {
          void (next.has(id) ? next.delete(id) : next.add(id));
        }
        return next;
      });
    }
  };

  const closeExpanded = () => {
    (activeView === 'staking' ? setExpandedValidators : setExpandedTxs)(new Set());
  };

  // ── Toggle all (expand all visible / collapse all) ───────────────
  const toggleAll = (filteredItems: Validator[] | TransactionInfo[]) => {
    const setter = activeView === 'staking' ? setExpandedValidators : setExpandedTxs;
    if (expandedPosts.size > 0) {
      setter(new Set());
    } else {
      const ids = (filteredItems as Array<{ id?: string; intentHash?: string }>).map(
        item => item.id ?? item.intentHash ?? '',
      );
      setter(new Set(ids));
    }
  };

  return {
    expandedValidators,
    expandedTxs,
    expandedPosts,
    setExpandedPosts,
    setExpandedValidators,
    setExpandedTxs,
    handleExpandPost,
    closeExpanded,
    toggleAll,
  };
}