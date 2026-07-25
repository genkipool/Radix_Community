
'use client';

import { useState, useTransition, useDeferredValue, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { DashboardView, Network } from '../types';
import { dashboardRoutes } from '../lib/routes';
import { isRadixAddress } from '../utils/radixAddress';

export interface UseDashboardUrlSyncOptions {
  initialView: DashboardView;

  initialNetwork: Network;
  initialSearchQuery: string;
  initialDateRange?: { start: string | null; end: string | null };
  /** Active locale, needed to build canonical dashboard paths. */
  locale: string;
}

function syncTxUrlParam(searchQuery: string) {
  const url = new URL(window.location.href);
  const currentTx = url.searchParams.get('tx');
  const isAddress = isRadixAddress(searchQuery);

  if (isAddress) {
    if (currentTx !== searchQuery) {
      url.searchParams.set('tx', searchQuery);
      window.history.replaceState({}, '', url.toString());
    }
  } else if (currentTx) {
    url.searchParams.delete('tx');
    window.history.replaceState({}, '', url.toString());
  }
}

export function useDashboardUrlSync({
  initialView,
  initialNetwork,
  initialSearchQuery,
  initialDateRange = { start: null, end: null },
  locale,
}: UseDashboardUrlSyncOptions) {

  const router = useRouter();
  const [, startViewTransition] = useTransition();

  const [activeView, setActiveView] = useState<DashboardView>(initialView);
  const [network, setNetwork] = useState<Network>(initialNetwork);
  const deferredNetwork = useDeferredValue(network);

  const [searchQuery, _setSearchQuery] = useState(initialSearchQuery);
  const deferredSearch = useDeferredValue(searchQuery);

  const [dateRange, setDateRange] = useState(initialDateRange);

  const setSearchQuery = (query: string) => {
    _setSearchQuery(query);
    syncTxUrlParam(query);
  };

  // Ensure ?network= is always present in the URL (once on mount)
  const networkUrlRef = useRef(false);
  useEffect(() => {
    if (!networkUrlRef.current && typeof window !== 'undefined') {
      networkUrlRef.current = true;
      const url = new URL(window.location.href);
      if (!url.searchParams.has('network')) {
        url.searchParams.set('network', network);
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [network]);

  const handleDateRangeChange = (range: { start: string | null; end: string | null }) => {
    const url = new URL(window.location.href);
    if (range.start) url.searchParams.set('start', range.start);
    else url.searchParams.delete('start');
    
    if (range.end) url.searchParams.set('end', range.end);
    else url.searchParams.delete('end');

    window.history.replaceState({}, '', url.toString());
    setDateRange(range);
  };

  /**
   * Each view is a route of its own now, so switching is a real navigation:
   * the URL becomes canonical, the server re-runs its prefetch, and the back
   * button undoes the change. The local state is still updated so the switch
   * paints immediately instead of waiting for the server round trip.
   */
  const handleViewChange = (view: DashboardView) => {
    _setSearchQuery('');
    setDateRange({ start: null, end: null });

    startViewTransition(() => {
      setActiveView(view);
      router.push(dashboardRoutes.view(locale, view, { network }), { scroll: false });
    });
  };

  const handleNetworkChange = (net: Network) => {
    const url = new URL(window.location.href);
    url.searchParams.set('network', net);
    // `tx` is the legacy focus param; drop both names so the new network is
    // not left pointing at an entity that belongs to the other ledger.
    url.searchParams.delete('tx');
    url.searchParams.delete('entity');
    window.history.replaceState({}, '', url.toString());
    _setSearchQuery('');
    setDateRange({ start: null, end: null });

    setNetwork(net);
  };

  return {
    activeView,
    network,
    setNetwork,
    deferredNetwork,
    searchQuery,
    setSearchQuery,
    deferredSearch,
    dateRange,
    handleDateRangeChange,
    handleViewChange,
    handleNetworkChange,
  };

}

export interface UseDashboardUrlEffectsOptions {
  searchQuery: string;
  activeView: DashboardView;
  network: Network;
  setExpandedTxs: (ids: Set<string>) => void;
}

export function useDashboardUrlEffects({
  searchQuery,
  activeView,
  setExpandedTxs,
}: UseDashboardUrlEffectsOptions) {
  useEffect(() => {
    if (searchQuery.startsWith('txid_')) {
      setExpandedTxs(new Set([searchQuery]));
    }
  }, [searchQuery, setExpandedTxs]);

  useEffect(() => {
    const txParam = typeof window !== 'undefined'
      ? new URL(window.location.href).searchParams.get('tx')
      : null;
    if (txParam && activeView === 'transactions') {
      setExpandedTxs(new Set([txParam]));
    }
  }, [activeView, setExpandedTxs]);
}
