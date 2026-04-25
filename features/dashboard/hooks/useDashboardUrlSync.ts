'use client';

import { useState, useTransition, useDeferredValue, useEffect, useOptimistic } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // Optimistic UI for instant feedback on buttons and toggles
  const [activeView, setOptimisticView] = useOptimistic<DashboardView, DashboardView>(
    initialView,
    (_, newView) => newView
  );
  
  const [network, setOptimisticNetwork] = useOptimistic<Network, Network>(
    initialNetwork,
    (_, newNet) => newNet
  );

  const deferredNetwork = useDeferredValue(network);

  // Client-managed state for UI-heavy interactions (search/dates)
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const deferredSearch = useDeferredValue(searchQuery);
  const [dateRange, setDateRange] = useState(initialDateRange);

  const buildUrl = (params: Record<string, string | null>) => {
    const searchParams = new URLSearchParams(window.location.search);
    Object.entries(params).forEach(([key, value]) => {
      if (value === null) searchParams.delete(key);
      else searchParams.set(key, value);
    });
    return `${pathname}?${searchParams.toString()}`;
  };

  const handleDateRangeChange = (range: { start: string | null; end: string | null }) => {
    const url = buildUrl({
      start: range.start,
      end: range.end,
      view: activeView === 'transactions' ? 'transactions' : null,
    });
    
    router.replace(url, { scroll: false });
    setDateRange(range);
  };

  const handleViewChange = (view: DashboardView) => {
    const url = buildUrl({
      view: view === 'transactions' ? 'transactions' : null,
      tag: null,
      tx: null,
      start: null,
      end: null,
      network: network,
    });

    startTransition(() => {
      setOptimisticView(view);
      router.push(url, { scroll: false });
      setSearchQuery('');
      setDateRange({ start: null, end: null });
    });
  };

  const handleNetworkChange = (net: Network) => {
    const url = buildUrl({
      network: net,
      view: activeView === 'transactions' ? 'transactions' : null,
      tx: null,
      start: null,
      end: null,
    });

    startTransition(() => {
      setOptimisticNetwork(net);
      router.push(url, { scroll: false });
      setSearchQuery('');
      setDateRange({ start: null, end: null });
    });
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
    isPending,
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
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const url = new URL(window.location.href);
    const searchParams = new URLSearchParams(url.search);
    const currentTx = searchParams.get('tx');
    const isAddress = isRadixAddress(searchQuery);

    if (isAddress) {
      if (currentTx !== searchQuery) {
        searchParams.set('tx', searchQuery);
        router.replace(`${pathname}?${searchParams.toString()}`, { scroll: false });
        if (searchQuery.startsWith('txid_')) {
          setExpandedTxs(new Set([searchQuery]));
        }
      }
    } else if (currentTx) {
      searchParams.delete('tx');
      router.replace(`${pathname}?${searchParams.toString()}`, { scroll: false });
    }
  }, [searchQuery, setExpandedTxs, router, pathname]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('network')) {
      const searchParams = new URLSearchParams(url.search);
      searchParams.set('network', network);
      router.replace(`${pathname}?${searchParams.toString()}`, { scroll: false });
    }
  }, [network, router, pathname]);

  useEffect(() => {
    const txParam = new URL(window.location.href).searchParams.get('tx');
    if (txParam && activeView === 'transactions') {
      setExpandedTxs(new Set([txParam]));
    }
  }, [activeView, setExpandedTxs]);
}

