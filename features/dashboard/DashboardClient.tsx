
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
import type { Network } from '@/features/dashboard/types';
import { useFocusedColumns } from './hooks/useFocusedColumns';
import {
  reconcileNetwork,
  initialNetworkReconcileState,
} from './lib/networkReconcile';

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
import { useCommittedNetwork } from './hooks/useCommittedNetwork';
import { useFocusedEntity, useReadyEntities } from './hooks/useEntityReadiness';
import { setLiveNetwork } from '@/services/liveDataStore';
import { useExploradorFilters } from './explorador/hooks/useExploradorFilters';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useConnectedStakes } from './staking/hooks/useConnectedStakes';
import { ProtocolVoteProvider } from './staking/context/ProtocolVoteContext';
import { useStakesReady } from './staking/hooks/useStakesReady';
import { walletAccountsForNetwork } from './staking/lib/walletAccounts';
import { useSettledPins } from './staking/hooks/useSettledPins';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { dashboardKeys } from '@/features/dashboard/utils/entityCache';
import { CACHE_TIMES } from '@/features/dashboard/utils/queryCache';

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
  
  const { isConnected, accounts, activeNetwork, switchNetwork, selectedAccountAddresses, sessions } = useRadixWallet();


  /*
   * The page's ledger and the wallet's, kept in step by a small state machine
   * that lives in `lib/networkReconcile` — pure, and tested there, because
   * every bug this has had came from reading an innocent disagreement between
   * the two as a decision somebody made. See that file for the history.
   */
  const reconcileState = useRef(initialNetworkReconcileState);

  useEffect(() => {
    const { state, action } = reconcileNetwork(reconcileState.current, {
      pageNetwork: network as Network,
      walletNetwork: (activeNetwork as Network | null) ?? null,
    });
    reconcileState.current = state;

    // The wallet follows the URL; only a choice made IN the wallet moves the
    // page, and by then the machine has already ruled out everything else.
    if (action.type === 'askWallet') switchNetwork(action.to);
    else if (action.type === 'moveDashboard') handleNetworkChange(action.to);
  }, [activeNetwork, network, switchNetwork, handleNetworkChange]);

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

  // The toggle is a persisted preference (see useDashboardPreferences): a view
  // change is a real navigation, so anything kept only in memory would reset.
  const walletFilterToggled = prefs.walletFilter;
  const setWalletFilterToggled = prefs.setWalletFilter;
  /*
   * A search wins over the wallet filter, and the two are read from the SAME
   * snapshot of the search box — the deferred one, which is what the list is
   * actually filtered by.
   *
   * Reading this from the immediate value put the pair out of step for a
   * render, and that render showed EVERY validator: clearing the box lifted
   * the search at once while the wallet filter was still one frame behind, so
   * the whole network flashed before the wallet's own validators came back.
   * Typing an address had the mirror problem. Sharing the snapshot means there
   * is no frame in which neither filter applies.
   */
  const hasActiveSearch = deferredSearch.trim().length > 0;
  /*
   * Whether a wallet is connected, as this page can know it RIGHT NOW.
   *
   * The wallet context restores its session after mount, so for the first
   * renders — including the ones a navigation produces — it reports "not
   * connected" while the browser plainly is. The server already knew: it read
   * the connection from the cookie and sent it down, which is why every other
   * wallet-dependent value here falls back to it (see the address lists below).
   *
   * The filter did not, and THAT is the flash. Clearing the search box
   * navigates, and for the renders where the context had not caught up the
   * filter evaluated to "off" with no search left to narrow anything — so the
   * entire network appeared for an instant before the wallet's own validators
   * came back.
   */
  const walletHasAccounts =
    isConnected && accounts.length > 0
      ? true
      : initialIsWalletConnected && initialConnectedAccounts.length > 0;
  const isWalletFilterActive = !hasActiveSearch && walletFilterToggled && walletHasAccounts;

  // ── View-local derived values (validators vs transactions) ──
  const sortMode = activeView === 'staking' ? prefs.valSortMode : prefs.txSortMode;

  const storedColumns = activeView === 'staking' ? prefs.valColumns : prefs.txColumns;
  // One validator in focus collapses the grid to a single column; see the hook
  // for why the stored preference is left alone while that lasts.
  const { columns, isOverridden, releaseOverride } = useFocusedColumns(
    searchQuery,
    storedColumns,
  );
  // Deferring the column count keeps the grid responsive while the user drags
  // the column slider. But a deferred value holds the PREVIOUS one for a
  // render, and each view has its own count, so on a view switch that painted
  // the other view's grid for a frame — the flicker.
  //
  // Tagging the value with the view it belongs to fixes it without losing the
  // benefit: while the deferred pair still refers to the view we just left, the
  // immediate count is used instead.
  //
  // The single-column override is tagged for the same reason. Clearing the
  // search box lifts it, and deferring THAT repainted the grid at one column
  // before snapping back to the configured count: the same flicker again, just
  // triggered by the search box instead of the view switch.
  const columnsForView = { view: activeView, overridden: isOverridden, columns };
  const deferredPair = useDeferredValue(columnsForView);
  const deferredColumns =
    deferredPair.view === activeView && deferredPair.overridden === isOverridden
      ? deferredPair.columns
      : columns;
  const readingMode = activeView === 'staking' ? prefs.valReadingMode : prefs.txReadingMode;
  const autoCollapse = activeView === 'staking' ? prefs.valAutoCollapse : prefs.txAutoCollapse;

  const [wasValReadingModeManual, setWasValReadingModeManual] = useState(initialValReadingMode);
  const [wasTxReadingModeManual, setWasTxReadingModeManual] = useState(initialTxReadingMode);

  const setSortMode = (m: typeof sortMode) =>
    activeView === 'staking' ? prefs.setValSortMode(m) : prefs.setTxSortMode(m);
  const setColumns = (c: number) => {
    // Touching the slider ends the single-column override: an explicit choice
    // outranks the automatic one for as long as the focus lasts.
    releaseOverride();
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
  /*
   * TWO reads of the same query, and the difference matters.
   *
   * The REQUESTED ledger is what the user just asked for; its arrival is what
   * allows the page to move. The SHOWN ledger is the one whose cards are on
   * screen. Reading the list from the requested one put 287 Mainnet validators
   * in front of a grid still pinned and labelled Stokenet, so the wallet filter
   * matched nothing and announced that no staking nodes were found until the
   * rest caught up. They share a cache entry whenever they agree, which is
   * almost always, so this is one query in practice.
   */
  const {
    data: requestedValidators,
    isFetching: isValFetching,
    isPending: isValPending,
    isPlaceholderData: isValPlaceholder,
    isError: isValError,
    refetch: refetchValidators,
  } = useValidatorsQuery(network, activeView === 'staking');

  /* Which accounts the wallet is showing, needed both to read its stakes and to
     decide when the grid may adopt a new ledger. */
  /**
   * The wallet's accounts on a given ledger — read straight from the sessions,
   * which hold both at once, rather than from `accounts` (whichever ledger the
   * wallet happens to be pointed at).
   *
   * That is what took the wallet out of the critical path: the stakes for the
   * ledger being switched to can be read on the click, instead of after the
   * provider has finished changing its own network, and they can be warmed
   * before the click at all. See the helper for why the two differ.
   */
  const accountsOn = (net: Network) => walletAccountsForNetwork({
    network: net,
    sessions,
    activeNetwork,
    selectedAccountAddresses,
    pageNetwork: initialNetwork,
    initialIsWalletConnected,
    initialConnectedAccounts,
  });

  /*
   * Not deferred. Deferring is for smoothing what is PAINTED; here it only
   * delayed the moment a request could go out, which is the opposite of what
   * this value is for.
   */
  const requestedNetworkAccounts = accountsOn(network);

  // Asked for the REQUESTED ledger, not the committed one, so the read starts
  // with the click and the answer is in hand by the time the grid may show it.
  const walletPinsReady = useStakesReady(
    requestedNetworkAccounts,
    network as 'mainnet' | 'stokenet',
    // A session on the ledger being asked for means there ARE accounts, so an
    // empty list is "not told yet", not "none".
    !!sessions?.[network as 'mainnet' | 'stokenet'],
  );

  // The ledger the cards on screen belong to. See the hook for why the two can
  // legitimately disagree for a moment, and why nothing is torn down meanwhile.
  const stakingNetwork = useCommittedNetwork(initialNetwork, {
    requested: network,
    isStakingView: activeView === 'staking',
    hasOwnList: !isValPlaceholder && !!requestedValidators,
    walletPinsReady,
  });

  /**
   * Warms the other ledger's DATA before the user commits to it.
   *
   * The validator list is only half of what the grid needs: with a wallet
   * connected, which of its validators go FIRST comes from a separate read, and
   * the switch waits for it — showing the previous ledger's cards meanwhile, not
   * skeletons. Warming both is what makes that wait nothing.
   *
   * Data only. There was a `router.prefetch` of the other ledger's PAGE here
   * too, and it broke the switch outright in production: the navigation was
   * then served from that prefetched RSC payload, applying it raised a
   * hydration mismatch (React #418), and the transition was discarded — the
   * toolbar button lit up, the URL never moved, no request was made and the
   * grid stayed where it was. It never showed up in testing because a
   * programmatic `.click()` fires neither hover nor pointer-down, so the
   * prefetch never ran. It bought nothing either: the grid stopped waiting on
   * that navigation two commits ago.
   */
  const queryClient = useQueryClient();
  const warmNetwork = (net: Network) => {
    for (const address of accountsOn(net)) {
      if (!address) continue;
      queryClient.prefetchQuery({
        queryKey: dashboardKeys.entities.detail(address, net as 'mainnet' | 'stokenet'),
        queryFn: () => apiFetchEntityDetails(address, net as 'mainnet' | 'stokenet'),
        staleTime: CACHE_TIMES.MEDIUM,
      });
    }
  };

  const { data: validatorsData } = useValidatorsQuery(stakingNetwork, activeView === 'staking');
  const realValidators = validatorsData?.validators ?? [];

  /** What the staking half of the page reads; the explorer keeps its own. */
  const viewNetwork = activeView === 'staking' ? stakingNetwork : deferredNetwork;

  /*
   * Follows the ledger the CARDS are on, not the one the button highlights.
   * This wipes the store — an epoch number from one network means nothing on
   * the other — so doing it before the new list is on screen left the previous
   * ledger's cards showing their live counters fall back to the server
   * snapshot for as long as the switch took.
   */
  useEffect(() => {
    setLiveNetwork(stakingNetwork);
  }, [stakingNetwork]);
  // Nothing in hand and something on its way: the grid shows skeletons rather
  // than claiming the network has no validators.
  const listIsLoading =
    activeView === 'staking' && realValidators.length === 0 && (isValPending || isValFetching);
  // Out of retries with nothing to show. A failed refetch that still has a
  // list keeps the list: stale validators beat an error page.
  const validatorsFailed =
    activeView === 'staking' && isValError && realValidators.length === 0;
  const networkStats = validatorsData?.networkStats ?? initialNetworkStats ?? null;

  /* ══ React Query — Transactions (Infinite Query) ═══════════ */
  const connectedAddresses = (isConnected && accounts.length > 0) 
    ? (selectedAccountAddresses.length > 0 ? selectedAccountAddresses : accounts.map(a => a.address))
    : (initialIsWalletConnected ? initialConnectedAccounts : undefined);
    
  const deferredConnectedAddresses = useDeferredValue(connectedAddresses);
  const deferredIsWalletFilterActive = isWalletFilterActive;

  const txAddresses = deferredIsWalletFilterActive && deferredConnectedAddresses && deferredConnectedAddresses.length > 0 ? deferredConnectedAddresses : undefined;

  const {
    data: txPages,
    isFetchingNextPage,
    isFetching: _isTxFetching,
    isLoading: isTxLoading,
    isError: isTxError,
    refetch: refetchTxs,
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
  const txsFailed = activeView === 'transactions' && isTxError && txs.length === 0;

  /* ── Validator filters ───────────────────────────────────── */
    
  const {
    pinnedValidatorAddresses: freshPins,
    ownerValidatorAddresses: freshOwners,
    ownerValidatorMap,
    isLoading: isStakesLoading,
  } = useConnectedStakes(
    // The ledger ON SCREEN, so the pins always describe the cards beside them.
    accountsOn(stakingNetwork),
    stakingNetwork as 'mainnet' | 'stokenet',
    realValidators,
  );

  /*
   * Held steady while they are re-read. Every wallet-side move re-reads them —
   * the toolbar's ledger toggle, the one in the connect popover, the one in the
   * profile modal (which swaps the whole account list), picking accounts — and
   * raw, each of those passes through "nothing is pinned" for a moment. The
   * grid believed it and painted skeletons, or announced that no staking nodes
   * were found. See the hook.
   */
  const {
    pinnedValidatorAddresses,
    ownerValidatorAddresses,
  } = useSettledPins(
    { pinnedValidatorAddresses: freshPins, ownerValidatorAddresses: freshOwners },
    // Same reason `useStakesReady` avoids `isLoading`: it is false on the render
    // an observer mounts, which is exactly when nothing has been read yet.
    isStakesLoading || !walletPinsReady,
  );

  /*
   * The grid is waiting whenever it has nothing to show AND something to wait
   * for: the list itself, or — with the wallet filter on — the stakes that say
   * which validators are the wallet's. Without the second half the filter
   * answers "none" while it has nothing to filter by, and that reads on screen
   * as "no staking nodes found" a moment before they appear. The server
   * prefetches those stakes so this is rare; a wallet connected after load
   * still comes through here.
   */
  const loadingValidators =
    listIsLoading ||
    (activeView === 'staking' &&
      isWalletFilterActive &&
      isStakesLoading &&
      pinnedValidatorAddresses.length === 0);

  const { filtered, visibleValCount, sentinelRef } = useValidatorFilters({
    validators: realValidators,
    activeTags: deferredActiveTag,
    searchQuery: deferredSearch,
    sortMode: prefs.valSortMode,
    network: stakingNetwork,
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
          onPrefetchNetwork={warmNetwork}
          dt={dt}
        />

        <div className="w-full min-w-0">
          {/* ── Card grid + empty states ── */}
          <ProtocolVoteProvider ownerValidatorMap={ownerValidatorMap}>
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
            loadingValidators={loadingValidators}
            pinsPending={activeView === 'staking' && isWalletFilterActive && !walletPinsReady}
            validatorsFailed={validatorsFailed}
            onRetryValidators={() => void refetchValidators()}
            txsFailed={txsFailed}
            onRetryTxs={() => void refetchTxs()}
            columns={deferredColumns}
            expandedPosts={expanded.expandedPosts}
            readingMode={readingMode}
            copiedAddress={copiedAddress}
            searchQuery={deferredSearch}
            network={viewNetwork}
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
          </ProtocolVoteProvider>
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
        network={viewNetwork}
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