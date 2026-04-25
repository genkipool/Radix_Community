'use client';

import { useState, useTransition, useDeferredValue, useEffect } from 'react';
import type { DashboardView, Network } from '../types';
import { isRadixAddress } from '../utils/radixAddress';

export interface UseDashboardUrlSyncOptions {
  initialView: DashboardView;

  initialNetwork: Network;
  initialSearchQuery: string;
  initialDateRange?: { start: string | null; end: string | null };
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

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const deferredSearch = useDeferredValue(searchQuery);

  const [dateRange, setDateRange] = useState(initialDateRange);

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
      url.searchParams.delete('tag'); // Transaction tags are not relevant for staking view
    }
    url.searchParams.set('network', network);
    url.searchParams.delete('tx'); // Clear tx parameter when changing views
    window.history.replaceState({}, '', url.toString());
    setSearchQuery(''); // Clear search when switching views
    setDateRange({ start: null, end: null }); // Reset dates on view change

    startViewTransition(() => setActiveView(view));
  };

  const handleNetworkChange = (net: Network) => {
    const url = new URL(window.location.href);
    url.searchParams.set('network', net);
    if (activeView === 'transactions') {
      url.searchParams.set('view', 'transactions');
    }
    url.searchParams.delete('tx'); // Clear tx parameter when changing network
    window.history.replaceState({}, '', url.toString());
    setSearchQuery(''); // Clear search on network change
    setDateRange({ start: null, end: null }); // Reset dates on network change

    setNetwork(net);
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
  network,
  setExpandedTxs,
}: UseDashboardUrlEffectsOptions) {
  /* Sync tx param from search */
  useEffect(() => {
    const url = new URL(window.location.href);
    const currentTx = url.searchParams.get('tx');
    const isAddress = isRadixAddress(searchQuery);

    if (isAddress) {
      if (currentTx !== searchQuery) {
        url.searchParams.set('tx', searchQuery);
        window.history.replaceState({}, '', url.toString());
        // Auto-expand only for specific transaction IDs and if not already expanded
        if (searchQuery.startsWith('txid_')) {
          setExpandedTxs(new Set([searchQuery]));
        }
      }
    } else if (currentTx) {
      url.searchParams.delete('tx');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchQuery, setExpandedTxs]);

  // Ensure ?network= is always present in the URL
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('network')) {
      url.searchParams.set('network', network);
      window.history.replaceState({}, '', url.toString());
    }
  }, [network]);

  // Auto-expand transaction from ?tx= URL param on load
  useEffect(() => {
    const txParam = new URL(window.location.href).searchParams.get('tx');
    if (txParam && activeView === 'transactions') {
      setExpandedTxs(new Set([txParam]));
    }
  }, [activeView, setExpandedTxs]);
}
