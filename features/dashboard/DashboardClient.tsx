
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

import {
  useState,
  useDeferredValue, useEffect, useRef
} from 'react';
import { AnimatePresence, m } from "motion/react";

const EMPTY_ACCOUNTS: string[] = [];

/**
 * Address prefixes the explorer can render a dedicated card for. Listed once so
 * the search box and the reading-mode modal cannot disagree about what counts
 * as an entity.
 */
const ENTITY_PREFIXES = [
  'account_',
  'package_',
  'component_',
  'resource_',
  'transactiontracker_',
  'consensusmanager_',
  'validator_',
] as const;

/* Services & types */
import type { NetworkStats } from '@/types/radix';
import type { Dictionary } from '@/i18n';
import type { DashboardInitialProps } from '@/features/dashboard/types/core.types';

/* React Query hooks */
import { useValidatorsQuery } from './staking/hooks/useValidatorsQuery';
import { useValidatorFilters } from './staking/hooks/useValidatorFilters';
import {
  useTransactionsQuery,
  flattenTransactionPages,
} from './explorador/hooks/useTransactionsQuery';
import { useInfiniteScrollTx } from './explorador/hooks/useDashboardTxEffects';

/* Feature hooks */
import { useDashboardPreferences } from './hooks/useDashboardPreferences';
import { useExpandedCards } from './hooks/useExpandedCards';
import { useCopyToClipboard } from './hooks/useCopyToClipboard';
import { useDashboardUrlSync, useDashboardUrlEffects } from './hooks/useDashboardUrlSync';
import { useFocusedEntity, useReadyEntities } from './hooks/useEntityReadiness';
import { setLiveNetwork } from '@/services/liveDataStore';
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

/* EntityBadge context */
import { EntityBadgeContext } from './explorador/components/EntityBadgeContext';
import { ExpandableEntityBadge } from './explorador/components/ExpandableEntityBadge';

/* Helpers */
import { getGridClass, VALIDATOR_MODAL_THRESHOLD } from '@/constants/dashboard';

const EntityBadgeAdapter = (props: Record<string, unknown>) => {
  const { entityAddress: _ea, ...rest } = props;
  const badgeProps = { ...rest, address: rest.address || _ea || '' } as unknown as React.ComponentProps<typeof ExpandableEntityBadge>;
  return <ExpandableEntityBadge {...badgeProps} />;
};

export default function DashboardClient({
  timezone,
  initialView = 'staking',
  initialNetwork,
  initialActiveTag = ['All'],
  initialTransactionActiveTag = 'All',
  initialWalletFilter = true,
  initialNetworkStats = null,
  initialNetworkFromUrl = false,
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
  heroHeadingLevel = 'h1',
  dictionary,
  initialIsWalletConnected = false,
  initialConnectedAccounts = EMPTY_ACCOUNTS,
}: DashboardInitialProps) {

  const { t: dict, language } = useLanguage();
  const { setShowUnderConstruction } = useLayout();
  const t = (dictionary || dict || {}) as Dictionary;
  const dt = t.dashboard ?? {};

  /* View / Network / Search (URL Sync) / Date Range */
  const {
    activeView, network, deferredNetwork,
    searchQuery, setSearchQuery, deferredSearch,
    dateRange, handleDateRangeChange,
    handleViewChange, handleNetworkChange, setTagInUrl,
    isNavigating, committedEntity,
  } = useDashboardUrlSync({
    initialView, initialNetwork, initialSearchQuery,
    initialDateRange, locale: language,
  });

  /* Date Range Filter (Temporal state while picking dates) */
  const [pendingRange, setPendingRange] = useState<{ start: string | null; end: string | null } | null>(null);
  const tempDateRange = pendingRange ?? dateRange;
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [direction, setDirection] = useState(0);
  const [activeRanking, setActiveRanking] = useState<string | null>(null);
  
  const { isConnected, accounts, activeNetwork, switchNetwork, selectedAccountAddresses } = useRadixWallet();


  // Last network the WALLET reported. The trigger below has to be an actual
  // wallet-side change, not merely "the wallet differs from the URL": the URL
  // is the source of truth, and while `switchNetwork` is in flight the two
  // legitimately disagree. Reacting to the difference navigated away from a
  // freshly opened entity link before its wallet switch had landed.
  const lastWalletNetwork = useRef<string | null>(null);

  // Synchronize dashboard network with wallet activeNetwork
  useEffect(() => {
    // Nothing to reconcile until the wallet reports a network.
    if (!activeNetwork) return;

    const previouslyKnown = lastWalletNetwork.current;
    lastWalletNetwork.current = activeNetwork;

    // FIRST time we learn the wallet's network. That is hydration, not a choice
    // the user just made: the wallet connects a moment after the page mounts and
    // reports its default. Treating it as a switch is what dragged a Stokenet
    // link onto Mainnet the instant the wallet woke up.
    //
    // The URL is the source of truth, so the WALLET follows it, never the other
    // way round, or a shared link would open on the wrong ledger.
    if (previouslyKnown === null) {
      if (activeNetwork !== network) {
        switchNetwork(network as 'mainnet' | 'stokenet');
      }
      return;
    }

    // A link that names its network PINS the page, and the wallet never drags
    // it elsewhere. This is not a nicety: the wallet provider restores its own
    // network from a cookie in a `setTimeout(0)` right after mount, and when
    // there is no session for the requested ledger it forces its own choice
    // outright. Following that would yank a shared Stokenet link onto Mainnet a
    // blink after opening it, and re-asserting instead would just loop against
    // a provider that is behaving correctly. The dashboard can perfectly well
    // display one ledger while the wallet is connected to another.
    if (initialNetworkFromUrl) return;

    // No network in the URL, so the wallet leads: follow a real switch.
    if (activeNetwork !== previouslyKnown && activeNetwork !== network) {
      handleNetworkChange(activeNetwork as 'mainnet' | 'stokenet');
    }
  }, [activeNetwork, network, switchNetwork, handleNetworkChange, initialNetworkFromUrl]);

  const handleSelectRange = (range: { start: string | null; end: string | null }) => {
    setPendingRange(range);
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
      setPendingRange(singleDay);
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
    initialWalletFilter,
  });

  /**
   * Point the live-proposal store at the ledger this page is showing.
   *
   * It defaulted to mainnet with no way to change it, so on Stokenet the
   * epoch-history table showed mainnet's live epoch and mainnet's proposal
   * counts next to Stokenet validators.
   *
   * The first call goes in a state initialiser rather than an effect on
   * purpose: child effects run BEFORE their parent's, so a validator card
   * mounting could otherwise kick off polling against mainnet and load
   * mainnet's persisted epoch before this component ever got a turn. Running
   * during the first render closes that window. The effect below then handles
   * the user switching network afterwards.
   */
  useState(() => {
    setLiveNetwork(initialNetwork);
    return null;
  });
  useEffect(() => {
    setLiveNetwork(network);
  }, [network]);

  // The toggle is a persisted preference (see useDashboardPreferences): a view
  // change is a real navigation, so anything kept only in memory would reset.
  const walletFilterToggled = prefs.walletFilter;
  const setWalletFilterToggled = prefs.setWalletFilter;
  const hasActiveSearch = searchQuery.trim().length > 0;
  const isWalletFilterActive = !hasActiveSearch && walletFilterToggled && isConnected && accounts.length > 0;

  // ── View-local derived values (validators vs transactions) ──
  const sortMode = activeView === 'staking' ? prefs.valSortMode : prefs.txSortMode;
  const columns = activeView === 'staking' ? prefs.valColumns : prefs.txColumns;
  // Deferring the column count keeps the grid responsive while the user drags
  // the column slider. But a deferred value holds the PREVIOUS one for a
  // render, and each view has its own count, so on a view switch that painted
  // the other view's grid for a frame — the flicker.
  //
  // Tagging the value with the view it belongs to fixes it without losing the
  // benefit: while the deferred pair still refers to the view we just left, the
  // immediate count is used instead.
  const columnsForView = { view: activeView, columns };
  const deferredPair = useDeferredValue(columnsForView);
  const deferredColumns =
    deferredPair.view === activeView ? deferredPair.columns : columns;
  const readingMode = activeView === 'staking' ? prefs.valReadingMode : prefs.txReadingMode;
  const autoCollapse = activeView === 'staking' ? prefs.valAutoCollapse : prefs.txAutoCollapse;

  const [wasValReadingModeManual, setWasValReadingModeManual] = useState(initialValReadingMode);
  const [wasTxReadingModeManual, setWasTxReadingModeManual] = useState(initialTxReadingMode);

  const setSortMode = (m: typeof sortMode) =>
    activeView === 'staking' ? prefs.setValSortMode(m) : prefs.setTxSortMode(m);
  const setColumns = (c: number) => {
    if (activeView === 'staking') {
      prefs.setValColumns(c);
      if (c >= VALIDATOR_MODAL_THRESHOLD && !prefs.valReadingMode) {
        prefs.setValReadingMode(true);
      } else if (c < VALIDATOR_MODAL_THRESHOLD && prefs.valReadingMode && !wasValReadingModeManual) {
        prefs.setValReadingMode(false);
      }
    } else {
      prefs.setTxColumns(c);
      if (c >= VALIDATOR_MODAL_THRESHOLD && !prefs.txReadingMode) {
        prefs.setTxReadingMode(true);
      } else if (c < VALIDATOR_MODAL_THRESHOLD && prefs.txReadingMode && !wasTxReadingModeManual) {
        prefs.setTxReadingMode(false);
      }
    }
  };

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
  const deferredDateRange = useDeferredValue(dateRange);

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
  // Only the staking view needs the validator list; the explorer gets the
  // aggregates it displays from the server instead of 287 full objects.
  const { data: validatorsData, isFetching: isValFetching } = useValidatorsQuery(
    deferredNetwork,
    activeView === 'staking',
  );
  const realValidators = validatorsData?.validators ?? [];
  const networkStats = validatorsData?.networkStats ?? initialNetworkStats ?? null;

  /* ══ React Query — Transactions (Infinite Query) ═══════════ */
  const connectedAddresses = (isConnected && accounts.length > 0) 
    ? (selectedAccountAddresses.length > 0 ? selectedAccountAddresses : accounts.map(a => a.address))
    : (initialIsWalletConnected ? initialConnectedAccounts : undefined);
    
  const deferredConnectedAddresses = useDeferredValue(connectedAddresses);
  const deferredIsWalletFilterActive = useDeferredValue(isWalletFilterActive);

  const txAddresses = deferredIsWalletFilterActive && deferredConnectedAddresses && deferredConnectedAddresses.length > 0 ? deferredConnectedAddresses : undefined;

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
    searchQuery: deferredSearch,
    tag: deferredTransactionActiveTag,
    dateRange: deferredDateRange,
    addresses: txAddresses,
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
  const connectedAccountAddresses = (isConnected && accounts.length > 0) 
    ? (selectedAccountAddresses.length > 0 ? selectedAccountAddresses : accounts.map(a => a.address))
    : (initialIsWalletConnected ? initialConnectedAccounts : []);
    
  const deferredConnectedAccountAddresses = useDeferredValue(connectedAccountAddresses);
    
  const { pinnedValidatorAddresses, ownerValidatorAddresses } = useConnectedStakes(deferredConnectedAccountAddresses, deferredNetwork as 'mainnet' | 'stokenet', realValidators);

  const { filtered, visibleValCount, sentinelRef } = useValidatorFilters({
    validators: realValidators,
    activeTags: deferredActiveTag,
    searchQuery: deferredSearch,
    sortMode: prefs.valSortMode,
    network: deferredNetwork,
    activeView: 'staking',
    randomSeed,
    pinnedValidatorAddresses,
    ownerValidatorAddresses,
    isWalletFilterActive: deferredIsWalletFilterActive,
  });


  /* ── Infinite scroll effects ─────────────────────────────── */
  const visibleTxCount = useInfiniteScrollTx({
    activeView, hasNextPage, isFetchingNextPage, fetchNextPage,
    loadedCount: txs.length,
  });
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
  const visibleTxs = filteredTxs.slice(0, visibleTxCount);

  /* ── Reading-mode: resolve the currently open card ──────── */
  const expandedPostId = expanded.expandedPosts.size > 0
    ? Array.from(expanded.expandedPosts)[expanded.expandedPosts.size - 1]
    : null;
  const expandedPost = expandedPostId ? realValidators.find(v => v.id === expandedPostId) ?? null : null;
  const expandedTx = expandedPostId ? txs.find(tx => tx.intentHash === expandedPostId) ?? null : null;
  /**
   * The address the entity cards are showing.
   *
   * Two things have to hold at once for the grid not to jump:
   *
   *  - CLEARING the box must not take effect until the navigation commits. The
   *    transactions underneath come from that same round trip, so removing the
   *    card immediately left the previous address's transactions alone on
   *    screen for a moment before the full list replaced them.
   *  - A NEW entity must not take effect until its details are in hand, which
   *    `useFocusedEntity` enforces. Until then the grid keeps showing what it
   *    already had.
   */
  const typedEntity = (() => {
    const value = deferredSearch.trim();
    return value.length >= 60 && ENTITY_PREFIXES.some((p) => value.startsWith(p)) ? value : null;
  })();
  const pendingEntity = isNavigating ? committedEntity : null;
  const focusedEntity = useFocusedEntity({
    requested: typedEntity ?? pendingEntity,
    fallback: pendingEntity,
    network: deferredNetwork,
  });

  const isAccountSearch = focusedEntity.startsWith('account_');
  const isPackageSearch = focusedEntity.startsWith('package_');
  const isComponentSearch = focusedEntity.startsWith('component_');
  const isResourceSearch = focusedEntity.startsWith('resource_');
  const isSystemSearch = focusedEntity.startsWith('transactiontracker_') || focusedEntity.startsWith('consensusmanager_');
  const isValidatorSearch = focusedEntity.startsWith('validator_');

  const expandedEntity =
    expandedPostId && ENTITY_PREFIXES.some((p) => expandedPostId.startsWith(p))
      ? expandedPostId
      : null;

  // Which entity cards the explorer grid puts above the transactions.
  //
  // The wallet's account cards wait for the whole group, so clearing the search
  // box no longer paints the transaction list first and then pushes it down as
  // each account resolves.
  const readyWalletAccounts = useReadyEntities(txAddresses ?? EMPTY_ACCOUNTS, deferredNetwork);
  const accountsToShow = isAccountSearch ? [focusedEntity] : readyWalletAccounts;
  const packagesToShow = isPackageSearch ? [focusedEntity] : [];
  const componentsToShow = isComponentSearch ? [focusedEntity] : [];
  const resourcesToShow = isResourceSearch ? [focusedEntity] : [];
  const systemEntitiesToShow = isSystemSearch ? [focusedEntity] : [];
  const validatorsToShow = isValidatorSearch ? [focusedEntity] : [];

  /* ── URL side effects (URL parameter sync) ──────────────── */
  useDashboardUrlEffects({
    searchQuery, activeView, network, setExpandedTxs: expanded.setExpandedTxs
  });

  /* ===============═══════════ RENDER ===============═════════ */
  return (
    <EntityBadgeContext.Provider value={EntityBadgeAdapter}>
    <div className="pb-20">
      {/* ── Hero ── */}
      <ContentHero
        brandName="Radix"
        title={dt.hero?.title}
        subtitle={dt.hero?.subtitle}
        gradient="from-[var(--color-secondary)] to-[var(--color-accent)]"
        headingLevel={heroHeadingLevel}
      />

      {/* ── Fixed-position loading bar (zero layout impact) ── */}
      <AnimatePresence>
        {isFetchingNextPage && (
          <m.div
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
                animation: 'loading-bar 0.8s ease-in-out infinite',
              }}
            />
          </m.div>
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
          onNetworkChange={(net) => {
            handleNetworkChange(net);
            if (net !== activeNetwork) {
              switchNetwork(net);
            }
          }}
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

            // 3. Update tags
            if (newTags.length === 0) {
              prefs.setActiveTag(['All']);
            } else {
              prefs.setActiveTag(newTags);
            }
          }}
          transactionActiveTag={prefs.transactionActiveTag}
          onTransactionTagChange={(tag) => {
            prefs.setTransactionActiveTag(tag);
            // The URL owns the filter, so the server prefetches the right slice.
            setTagInUrl(tag);
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
            setPendingRange(null);
            handleDateRangeChange(empty); // Reset commits immediately
            setCalendarOpen(false);
          }}
          calendarT={dt.calendar}

          columns={columns}
          onColumnsChange={setColumns}
          activeRanking={activeRanking}
          onRankingChange={(val: string | null) => {
            if (val) {
              setShowUnderConstruction(true);
            } else {
              setActiveRanking(null);
            }
          }}
          isWalletFilterActive={isWalletFilterActive}
          // Toggle the RAW preference, never the derived one. The button is
          // shown as inactive while a search is on (the search wins), so
          // writing the derived value back turned the filter ON instead of
          // off, and it then snapped on as soon as the search was cleared.
          onWalletFilterChange={() => setWalletFilterToggled((on: boolean) => !on)}
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
            // Only the visible window is rendered, exactly as the validator
            // grid does with visibleValCount. The full list stays available to
            // the expanded-card modal below.
            filteredTxs={visibleTxs}
            loadingTxs={loadingTxs}
            txsInitialized={txsInitialized}
            columns={deferredColumns}
            expandedPosts={expanded.expandedPosts}
            readingMode={readingMode}
            copiedAddress={copiedAddress}
            searchQuery={deferredSearch}
            network={deferredNetwork}
            accountsToShow={accountsToShow}
            packagesToShow={packagesToShow}
            componentsToShow={componentsToShow}
            resourcesToShow={resourcesToShow}
            systemEntitiesToShow={systemEntitiesToShow}
            validatorsToShow={validatorsToShow}
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
        expandedAccount={expandedEntity}
      />
    </div>
    </EntityBadgeContext.Provider>
  );
}