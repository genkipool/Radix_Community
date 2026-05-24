'use client';

/**
 * features/dashboard/DashboardClient.tsx  — Client entry point
 *
 * Orchestrates data fetching, URL state, and user preferences.
 * All rendering is delegated to focused sub-components:
 *
 *   ContentHero        → hero banner (layout)
 *   DashboardStatsRow  → network-level KPI strip
 *   DashboardToolbar   → search / view / network / filters / grid controls
 *   DashboardCardGrid  → responsive validator / tx card grid + empty states
 *   DashboardModals    → reading-mode validator modal, tx modal, resource modal
 *
 * Cookie-persisted preferences are handled by useDashboardPreferences.
 * Expanded-card state (with toggle-all, auto-collapse, reading mode) lives
 * in useExpandedCards.
 */

import React, {
  useState,
  useDeferredValue, useEffect,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';

/* Services & types */
import type { NetworkStats } from '@/types/radix';
import type { Dictionary } from '@/i18n';
import type { DashboardInitialProps } from '@/features/dashboard/types';

/* React Query hooks */
import { setLiveNetwork, stopPolling } from '@/services/liveDataStore';
import { useValidatorsQuery, useValidatorFilters } from './staking';
import {
  useTransactionsQuery,
  flattenTransactionPages,
  useInfiniteScrollTx,
} from './explorador';

/* Feature hooks */
import { useDashboardPreferences } from './hooks/useDashboardPreferences';
import { useExpandedCards } from './hooks/useExpandedCards';
import { useCopyToClipboard } from './hooks/useCopyToClipboard';
import { useDashboardUrlSync, useDashboardUrlEffects } from './hooks/useDashboardUrlSync';
import { useExploradorFilters } from './explorador/hooks/useExploradorFilters';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useConnectedStakes } from './staking/hooks/useConnectedStakes';

/* Context */
import { useLanguage } from '@/context/LanguageContext';
import { useLayout } from '@/context/LayoutContext';

/* Layout & UI */
import { ContentHero } from '@/components/layout/ContentHero';

/* Dashboard sub-components */
import { DashboardStatsRow } from './components/DashboardStatsRow';
import { DashboardToolbar } from './components/DashboardToolbar';
import { DashboardCardGrid } from './components/DashboardCardGrid';
import { DashboardModals } from './components/DashboardModals';

/* Helpers */
import { getGridClass, VALIDATOR_MODAL_THRESHOLD } from '@/constants/dashboard';


export default function DashboardClient({
  timezone,
  initialView = 'staking',
  initialNetwork,
  initialActiveTag = ['All'],
  initialTransactionActiveTag = 'All',
  initialValSortMode = 'random',
  initialTxSortMode = 'newest',
  initialValColumns = 2,
  initialTxColumns = 1,
  initialValReadingMode = false,
  initialTxReadingMode = false,
  initialValAutoCollapse = false,
  initialTxAutoCollapse = false,
  initialSearchQuery = '',
  initialDateRange,
  randomSeed = 0,
  initialMarketData,
  dictionary,
}: DashboardInitialProps) {

  const { t: dict, language } = useLanguage();
  const { setShowFooter, setShowUnderConstruction } = useLayout();
  const t = (dictionary || dict || {}) as Dictionary;
  const dt = t.dashboard ?? {};

  /* View / Network / Search (URL Sync) / Date Range */
  const {
    activeView, network, deferredNetwork,
    searchQuery, setSearchQuery, deferredSearch,
    dateRange, handleDateRangeChange,
    handleViewChange, handleNetworkChange,
  } = useDashboardUrlSync({
    initialView, initialNetwork, initialSearchQuery,
    initialDateRange,
  });

  /* Date Range Filter (Temporal state while picking dates) */
  const [tempDateRange, setTempDateRange] = useState<{ start: string | null; end: string | null }>(dateRange);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [direction, setDirection] = useState(0);
  const [activeRanking, setActiveRanking] = useState<string | null>(null);

  // Sync temp state with committed state if URL changes externally (e.g., reset)
  const [prevDateRange, setPrevDateRange] = useState(dateRange);
  if (dateRange !== prevDateRange) {
      setPrevDateRange(dateRange);
      setTempDateRange(dateRange);
  }

  const handleSelectRange = (range: { start: string | null; end: string | null }) => {
    setTempDateRange(range);
    if (range.start && range.end) {
      setCalendarOpen(false);
      handleDateRangeChange(range);
    }
  };

  const handleCalendarToggle = (isOpen: boolean) => {
    setCalendarOpen(isOpen);
    // When closing with only start selected, treat as single-day filter
    if (!isOpen && tempDateRange.start && !tempDateRange.end) {
      const singleDay = { start: tempDateRange.start, end: tempDateRange.start };
      setTempDateRange(singleDay);
      handleDateRangeChange(singleDay);
    }
  };


  /* ── Cookie-persisted preferences ───────────────────────── */
  const prefs = useDashboardPreferences({
    initialValSortMode, initialTxSortMode,
    initialValColumns, initialTxColumns,
    initialValReadingMode, initialTxReadingMode,
    initialValAutoCollapse, initialTxAutoCollapse,
    initialActiveTag, initialTransactionActiveTag,
  });

  // ── View-local derived values (validators vs transactions) ──
  const sortMode = activeView === 'staking' ? prefs.valSortMode : prefs.txSortMode;
  const columns = activeView === 'staking' ? prefs.valColumns : prefs.txColumns;
  const deferredColumns = useDeferredValue(columns);
  const readingMode = activeView === 'staking' ? prefs.valReadingMode : prefs.txReadingMode;
  const autoCollapse = activeView === 'staking' ? prefs.valAutoCollapse : prefs.txAutoCollapse;

  const [wasValReadingModeManual, setWasValReadingModeManual] = useState(initialValReadingMode);
  const [wasTxReadingModeManual, setWasTxReadingModeManual] = useState(initialTxReadingMode);

  const setSortMode = (m: typeof sortMode) =>
    activeView === 'staking' ? prefs.setValSortMode(m) : prefs.setTxSortMode(m);
  const setColumns = (c: number) =>
    activeView === 'staking' ? prefs.setValColumns(c) : prefs.setTxColumns(c);

  const setReadingMode = (v: boolean) => {
    if (activeView === 'staking') {
      prefs.setValReadingMode(v);
      setWasValReadingModeManual(v);
    } else {
      prefs.setTxReadingMode(v);
      setWasTxReadingModeManual(v);
    }
  };

  const setAutoCollapse = (v: boolean) =>
    activeView === 'staking' ? prefs.setValAutoCollapse(v) : prefs.setTxAutoCollapse(v);

  /* ── Deferred filter values ──────────────────────────────── */
  const deferredActiveTag = useDeferredValue(prefs.activeTag);
  const deferredTransactionActiveTag = useDeferredValue(prefs.transactionActiveTag);

  /* ── Expanded cards ──────────────────────────────────────── */
  const expanded = useExpandedCards({
    valColumns: prefs.valColumns,
    txColumns: prefs.txColumns,
    activeView,
    readingMode,
    autoCollapse,
  });

  /* ── Copy helper ── */
  const { copiedText: copiedAddress, copy: copyAddress } = useCopyToClipboard(600);

  /* ══ React Query — Validators ============================== */
  const { data: validatorsData, isFetching: isValFetching } = useValidatorsQuery(deferredNetwork);
  const realValidators = validatorsData?.validators ?? [];
  const networkStats = validatorsData?.networkStats ?? null;

  /* ══ React Query — Transactions (Infinite Query) ═══════════ */
  const {
    data: txPages,
    isFetchingNextPage,
    isFetching: _isTxFetching,
    isLoading: isTxLoading,
    hasNextPage,
    fetchNextPage,
    status: txStatus,
  } = useTransactionsQuery({
    network: deferredNetwork,
    searchQuery,
    tag: deferredTransactionActiveTag,
    dateRange,
    // Pass whether the explorer view is active. The hook internally keeps
    // enabled:true always (so HydrationBoundary cache is consumed immediately)
    // but uses this flag to gate refetchOnMount — avoiding unnecessary network
    // calls while the validator view is shown.
    enabled: activeView === 'transactions',
  });

  const txs = flattenTransactionPages(txPages?.pages);
  const txsInitialized = txs.length > 0 || txStatus === 'success';
  // Use isLoading (status === 'pending', i.e. no data at all) rather than
  // isFetching (true even during background refetches) so the skeleton only
  // appears when there is genuinely no data — not when hydrated data exists.
  const loadingTxs = isTxLoading && txs.length === 0;

  /* ── Validator filters ───────────────────────────────────── */
  const { isConnected, accounts } = useRadixWallet();
  const connectedAccountAddress = isConnected && accounts.length > 0 ? accounts[0].address : null;
  const { pinnedValidatorAddresses } = useConnectedStakes(connectedAccountAddress, deferredNetwork as 'mainnet' | 'stokenet');

  const { filtered, visibleValCount, sentinelRef } = useValidatorFilters({
    validators: realValidators,
    activeTags: deferredActiveTag,
    searchQuery: deferredSearch,
    sortMode: prefs.valSortMode,
    network: deferredNetwork,
    activeView: 'staking',
    randomSeed,
    pinnedValidatorAddresses,
  });

  /* ── Infinite scroll effects ─────────────────────────────── */
  useInfiniteScrollTx({ activeView, hasNextPage, isFetchingNextPage, fetchNextPage });
  // Loops removed: server now handles filtering via "query"

  /* ── Derived network stats (fallback) ────────────────────── */
  const stats: NetworkStats = (() => {
    if (networkStats) return networkStats;
    const active = realValidators.filter(v => v.status === 'active');
    const totalStaked = realValidators.reduce((s, v) => s + v.totalStakeXRD, 0);
    return {
      totalStaked,
      activeValidators: active.length,
      totalValidators: realValidators.length,
      avgApy: active.length > 0 ? active.reduce((s, v) => s + v.apy, 0) / active.length : 0,
      avgUptime: active.length > 0 ? active.reduce((s, v) => s + v.uptimePercent, 0) / active.length : 0,
      epoch: 0,
    };
  })();

  /* ── Explorador Filters & Stats ───────────────────────────── */
  const { filteredTxs, explorerStats: _explorerStats } = useExploradorFilters({
    txs, deferredSearch, activeView,
  });

  /* ── Reading-mode: resolve the currently open card ──────── */
  const expandedPostId = expanded.expandedPosts.size > 0
    ? Array.from(expanded.expandedPosts)[expanded.expandedPosts.size - 1]
    : null;
  const expandedPost = expandedPostId ? realValidators.find(v => v.id === expandedPostId) ?? null : null;
  const expandedTx = expandedPostId ? txs.find(tx => tx.intentHash === expandedPostId) ?? null : null;
  const isAccountSearch = deferredSearch.trim().startsWith('account_') && deferredSearch.trim().length >= 60; // Simple heuristic or use isRadixAddress
  const expandedAccount = (isAccountSearch && expandedPostId === deferredSearch.trim()) ? expandedPostId : null;

  /* ── URL side effects (URL parameter sync) ──────────────── */
  useDashboardUrlEffects({
    searchQuery, activeView, network, setExpandedTxs: expanded.setExpandedTxs
  });

  // Forced Reading Mode for high columns (Grid 3+)
  useEffect(() => {
    const isManual = activeView === 'staking' ? wasValReadingModeManual : wasTxReadingModeManual;

    if (columns >= VALIDATOR_MODAL_THRESHOLD) {
      if (!readingMode) {
        // Auto-enable but don't set manual flag
        if (activeView === 'staking') prefs.setValReadingMode(true);
        else prefs.setTxReadingMode(true);
      }
    } else {
      // Deactivate if it was auto-enabled and we are back to Grid 1/2
      if (readingMode && !isManual) {
        if (activeView === 'staking') prefs.setValReadingMode(false);
        else prefs.setTxReadingMode(false);
      }
    }
  }, [columns, readingMode, activeView, wasValReadingModeManual, wasTxReadingModeManual, prefs]);

  // Keep footer visible whenever the view changes
  useEffect(() => { setShowFooter(true); }, [activeView, setShowFooter]);
  useEffect(() => {
    setShowFooter(true);
    return () => setShowFooter(true);
  }, [setShowFooter]);

  // Synchronize LiveStore network targeting
  useEffect(() => {
    setLiveNetwork(deferredNetwork as 'mainnet' | 'stokenet');
  }, [deferredNetwork]);

  // Stop liveDataStore polling when in the explorer view
  useEffect(() => {
    if (activeView === 'transactions') {
      stopPolling();
    }
  }, [activeView]);

  /* ===============═══════════ RENDER ===============═════════ */
  return (
    <div className="pb-20">
      {/* ── Hero ── */}
      <ContentHero
        brandName="Radix"
        title={dt.hero?.title}
        subtitle={dt.hero?.subtitle}
        gradient="from-[var(--color-secondary)] to-[var(--color-accent)]"
      />

      {/* ── Fixed-position loading bar (zero layout impact) ── */}
      <AnimatePresence>
        {isFetchingNextPage && (
          <motion.div
            key="tx-loading-bar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-0 left-0 right-0 z-50 h-0.5 overflow-hidden pointer-events-none"
            aria-hidden="true"
          >
            <div
              className="h-full w-1/2"
              style={{
                background: 'linear-gradient(to right, transparent, var(--color-primary), var(--color-accent), transparent)',
                animation: 'loading-bar 1.4s ease-in-out infinite',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12">
        {/* ── Stats strip ── */}
        <DashboardStatsRow
          activeView={activeView}
          stats={stats}
          marketData={initialMarketData}
          isLoading={activeView === 'staking'
            ? isValFetching && !validatorsData
            : isTxLoading && txs.length === 0}
          dt={dt}
          locale={language}
        />

        {/* ── Search / Filters / Grid controls ── */}
        <DashboardToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeView={activeView}
          onViewChange={handleViewChange}
          network={network}
          onNetworkChange={handleNetworkChange}
          activeTags={prefs.activeTag}
          onActiveTagChange={(tag) => {
            setSearchQuery('');
            const currentTags = prefs.activeTag;

            // 1. If "All" is clicked (tag === null from TagFilterBar or explicitly 'All')
            if (tag === 'All' || tag === null) {
              prefs.setActiveTag(['All']);
              return;
            }

            // 2. Multi-selection logic
            let newTags = currentTags.filter(t => t !== 'All');
            if (newTags.includes(tag)) {
              newTags = newTags.filter(t => t !== tag);
            } else {
              newTags.push(tag);
            }

            // 3. Check if all functional tags are selected
            const functionalTags = ['Active', 'Inactive', 'Low Fee', 'High Uptime', 'Foundation', 'Community'];
            const allSelected = functionalTags.every(ft => newTags.includes(ft));

            if (newTags.length === 0 || allSelected) {
              prefs.setActiveTag(['All']);
            } else {
              prefs.setActiveTag(newTags);
            }
          }}
          transactionActiveTag={prefs.transactionActiveTag}
          onTransactionTagChange={(tag) => {
            prefs.setTransactionActiveTag(tag);
            // Sync tag to URL so server prefetches correct filtered data
            const url = new URL(window.location.href);
            if (tag && tag !== 'All') {
              url.searchParams.set('tag', tag);
            } else {
              url.searchParams.delete('tag');
            }
            window.history.replaceState({}, '', url.toString());
          }}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          readingMode={readingMode}
          onReadingModeChange={setReadingMode}
          isReadingModeManual={activeView === 'staking' ? wasValReadingModeManual : wasTxReadingModeManual}
          autoCollapse={autoCollapse}
          onAutoCollapseChange={setAutoCollapse}
          expandedCount={expanded.expandedPosts.size}
          filteredCount={activeView === 'staking' ? filtered.length : filteredTxs.length}
          onToggleAll={() =>
            expanded.toggleAll(activeView === 'staking' ? filtered : filteredTxs)
          }
          calendarOpen={calendarOpen}
          onCalendarToggle={handleCalendarToggle}
          dateRange={tempDateRange}
          onSelectRange={handleSelectRange}
          onResetRange={() => {
            const empty = { start: null, end: null };
            setTempDateRange(empty);
            handleDateRangeChange(empty); // Reset commits immediately
            setCalendarOpen(false);
          }}
          calendarT={dt.calendar}

          columns={columns}
          onColumnsChange={setColumns}
          activeRanking={activeRanking}
          onRankingChange={(val) => {
            if (val) {
              setShowUnderConstruction(true);
            } else {
              setActiveRanking(null);
            }
          }}
          dt={dt}
        />

        <div className="w-full min-w-0">
          {/* ── Card grid + empty states ── */}
          <DashboardCardGrid
            activeView={activeView}
            gridClass={getGridClass(deferredColumns)}
            filteredValidators={filtered}
            visibleValCount={visibleValCount}
            sentinelRef={sentinelRef}
            filteredTxs={filteredTxs}
            loadingTxs={loadingTxs}
            txsInitialized={txsInitialized}
            columns={deferredColumns}
            expandedPosts={expanded.expandedPosts}
            readingMode={readingMode}
            copiedAddress={copiedAddress}
            searchQuery={deferredSearch}
            network={deferredNetwork}
            t={t}
            dt={dt}
            onExpand={expanded.handleExpandPost}
            onCopy={copyAddress}
            timezone={timezone}
            locale={language}
            marketData={initialMarketData}
          />
        </div>
      </div>

      {/* ── Modals (reading-mode) ── */}
      <DashboardModals
        activeView={activeView}
        readingMode={readingMode}
        expandedPost={expandedPost}
        filteredValidators={filtered}
        expandedTx={expandedTx}
        filteredTxs={filteredTxs}
        closeExpanded={expanded.closeExpanded}
        setExpandedPosts={expanded.setExpandedPosts}
        t={t}
        dt={dt}
        copiedAddress={copiedAddress}
        copyAddress={copyAddress}
        network={deferredNetwork}
        direction={direction}
        setDirection={setDirection}
        timezone={timezone}
        locale={language}
        marketData={initialMarketData}
        expandedAccount={expandedAccount}
      />
    </div>
  );
}