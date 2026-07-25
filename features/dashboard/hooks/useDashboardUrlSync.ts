'use client';

/**
 * Dashboard view state that the URL is the source of truth for.
 *
 * The local state here exists only so the UI paints immediately; every change
 * is also written to the URL through `useDashboardNavigation`, which re-runs
 * the server component so the prefetch stays in play. Nothing in this file
 * touches `window.history` any more.
 */
import { useState, useDeferredValue, useEffect } from 'react';
import type { DashboardView, Network } from '../types';
import { segmentToView } from '../lib/routes';
import { isRadixAddress } from '../utils/radixAddress';
import { useDashboardNavigation } from './useDashboardNavigation';

export interface UseDashboardUrlSyncOptions {
  initialView: DashboardView;
  initialNetwork: Network;
  initialSearchQuery: string;
  initialDateRange?: { start: string | null; end: string | null };
  /** Active locale, needed to build canonical dashboard paths. */
  locale: string;
}

export function useDashboardUrlSync({
  initialView,
  initialNetwork,
  initialSearchQuery,
  initialDateRange = { start: null, end: null },
  locale,
}: UseDashboardUrlSyncOptions) {
  // The URL is still the source of truth, but the view is held in state so a
  // switch is instant: the History API moves the address without unmounting the
  // dashboard, and the effect below keeps the two in step for back/forward.
  const [activeView, setActiveView] = useState<DashboardView>(initialView);

  // Back/forward move through the History API without a navigation, so the view
  // is re-read from the address rather than left behind.
  useEffect(() => {
    const syncFromUrl = () => {
      const segment = window.location.pathname.split('/').filter(Boolean).pop() ?? '';
      const fromUrl = segmentToView(segment);
      if (fromUrl) setActiveView(fromUrl);
    };
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);
  const [network, setNetwork] = useState<Network>(initialNetwork);
  const deferredNetwork = useDeferredValue(network);

  const [searchQuery, _setSearchQuery] = useState(initialSearchQuery);
  const laggingSearch = useDeferredValue(searchQuery);
  // Deferring keeps typing smooth, but CLEARING has to land at once: switching
  // view resets the search, and a stale term would filter the incoming list for
  // a frame and flash an empty state.
  const deferredSearch = searchQuery === '' ? '' : laggingSearch;

  const [dateRange, setDateRange] = useState(initialDateRange);

  const nav = useDashboardNavigation({ locale, view: activeView });

  /**
   * Typing filters on the client instantly. Only a COMPLETE address is a
   * shareable destination, so only then does the URL move (to that entity's
   * page); clearing the box returns to the list.
   */
  const setSearchQuery = (query: string) => {
    _setSearchQuery(query);
    const trimmed = query.trim();
    if (isRadixAddress(trimmed)) nav.focusEntity(trimmed);
    else if (!trimmed) nav.focusEntity(null);
  };

  const handleDateRangeChange = (range: { start: string | null; end: string | null }) => {
    setDateRange(range);
    nav.setDateRange(range);
  };

  /**
   * Each view is a route of its own, so switching is a real navigation: the URL
   * becomes canonical, the server re-runs its prefetch and the back button
   * undoes it.
   *
   * The view is NOT flipped locally first. Doing so made the still-mounted page
   * render the other view for a frame, which showed the wrong grid column count
   * (the deferred value still held the previous view's) and made the toolbar
   * button's active styling bounce. Inside a transition React keeps the current
   * UI untouched until the new route is ready, so the switch stays clean.
   */
  const handleViewChange = (view: DashboardView) => {
    _setSearchQuery('');
    setDateRange({ start: null, end: null });
    setActiveView(view);
    nav.goToView(view);
  };

  const handleNetworkChange = (net: Network) => {
    _setSearchQuery('');
    setDateRange({ start: null, end: null });
    setNetwork(net);
    nav.setNetwork(net);
  };

  return {
    activeView,
    network,
    deferredNetwork,
    searchQuery,
    setSearchQuery,
    deferredSearch,
    dateRange,
    handleDateRangeChange,
    handleViewChange,
    handleNetworkChange,
    /** Lets the UI show a pending state while the server catches up. */
    isNavigating: nav.isNavigating,
    /** Query-only URL writes, for state owned elsewhere (e.g. the tag filter). */
    setTagInUrl: nav.setTag,
  };
}

export interface UseDashboardUrlEffectsOptions {
  searchQuery: string;
  activeView: DashboardView;
  network: Network;
  setExpandedTxs: (ids: Set<string>) => void;
}

/**
 * Expands the transaction a link points at. The entity now lives in the path,
 * so it arrives through `searchQuery` (the server seeds it from the route) and
 * no longer has to be read back out of `window.location`.
 */
export function useDashboardUrlEffects({
  searchQuery,
  setExpandedTxs,
}: UseDashboardUrlEffectsOptions) {
  useEffect(() => {
    const value = searchQuery.trim();
    if (value.startsWith('txid_')) setExpandedTxs(new Set([value]));
  }, [searchQuery, setExpandedTxs]);
}
