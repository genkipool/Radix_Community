
'use client';

import { useState, useTransition, useDeferredValue, useRef, useEffect } from 'react';
import type { DashboardView, Network } from '../types';
import { isRadixAddress } from '../utils/radixAddress';

export interface UseDashboardUrlSyncOptions {
  initialView: DashboardView;

  initialNetwork: Network;
  initialSearchQuery: string;
  initialDateRange?: { start: string | null; end: string | null };
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
}: UseDashboardUrlSyncOptions) {

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

    if (activeView === 'transactions') {
      url.searchParams.set('view', 'transactions');
    }
    
    window.history.replaceState({}, '', url.toString());
    setDateRange(range);
  };

  const handleViewChange = (view: DashboardView) => {
    const url = new URL(window.location.href);
    if (view === 'transactions') {
      url.searchParams.set('view', 'transactions');
    } else {
      url.searchParams.delete('view');
      url.searchParams.delete('tag');
    }
    url.searchParams.set('network', network);
    url.searchParams.delete('tx');
    window.history.replaceState({}, '', url.toString());
    _setSearchQuery('');
    setDateRange({ start: null, end: null });

    startViewTransition(() => setActiveView(view));
  };

  const handleNetworkChange = (net: Network) => {
    const url = new URL(window.location.href);
    url.searchParams.set('network', net);
    if (activeView === 'transactions') {
      url.searchParams.set('view', 'transactions');
    }
    url.searchParams.delete('tx');
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
