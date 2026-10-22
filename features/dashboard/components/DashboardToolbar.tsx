'use client';

import React from 'react';
import { SearchBar } from '@/components/ui/SearchBar';
import { ContentToolbar } from '@/components/ui/ContentToolbar';
import { DashboardFilterSelect, type FilterSelectOption } from './DashboardFilterSelect';
import { MAX_FILTER_FAVORITES } from '@/constants/dashboard';
import { STAKE_STATE_TAGS } from '../staking/hooks/useValidatorFilters';
import { GridToggle } from '@/components/ui/GridToggle';
import { RadixIcon } from '@/components/shared/RadixIcon';
import { DASHBOARD_TAGS } from '@/constants/dashboard';
import { TRANSACTION_TAGS } from '../explorador/constants';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetchTransactions, apiFetchValidators } from '@/features/dashboard/services/apiClient';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import type { DashboardToolbarProps } from '../types';
import { NetworkPanelButton } from './NetworkPanelButton';
import { ReadingModeButton } from '@/components/ui/ReadingModeButton';

/** Rankings that have a data source; the others are not offered. */
const RANKING_TAGS = ['top_accounts', 'top_lsu', 'access_controllers', 'owner_unlocks'] as const;

/**
 * DashboardToolbar
 *
 * Search bar + view / network toggle + tag filter bar + content toolbar + grid toggle.
 * Fully controlled — all state lives in DashboardClient.

 */
export const DashboardToolbar = ({
    searchQuery, onSearchChange,
    activeView, onViewChange,
    network, onNetworkChange,
    activeTags, onActiveTagChange,
    transactionActiveTag, onTransactionTagChange,
    sortMode, onSortModeChange,
    readingMode, onReadingModeChange,
    autoCollapse, onAutoCollapseChange,
    expandedCount, filteredCount, onToggleAll,
    calendarOpen, onCalendarToggle,
    dateRange, onSelectRange, onResetRange,
    calendarT,
    columns, onColumnsChange,
    isReadingModeManual,
    isWalletFilterActive, onWalletFilterChange,
    activeRanking, onRankingChange,
    networkPanelOpen, onNetworkPanelToggle,
    filterFavorites, onFilterFavoriteToggle,
    onPrefetchNetwork,
    dt,
}: DashboardToolbarProps) => {
    const queryClient = useQueryClient();
    const { isConnected } = useRadixWallet();
    const isSearchActive = searchQuery.trim().length > 0;

    /**
     * Warms the OTHER view's data while the pointer is on its button, so the
     * switch has everything ready. Each view only loads its own data now, so
     * without this the first switch would wait on a request.
     *
     * The keys mirror the real queries exactly; a near-miss would prefetch into
     * a cache entry nobody reads.
     */
    const handlePrefetchView = () => {
        if (activeView === 'transactions') {
            queryClient.prefetchQuery({
                queryKey: ['validators', network],
                queryFn: () => apiFetchValidators(network as 'mainnet' | 'stokenet'),
                staleTime: 300_000,
            });
            return;
        }
        // Switching to the explorer resets search and date range, so the key is
        // the plain one for the active tag.
        queryClient.prefetchInfiniteQuery({
            queryKey: [
                'transactions', network, undefined, transactionActiveTag,
                { start: null, end: null },
            ],
            queryFn: () => apiFetchTransactions({
                cursor: undefined, limit: 15, address: undefined,
                network: network as 'mainnet' | 'stokenet',
            }),
            initialPageParam: undefined,
            staleTime: 30_000,
        });
    };

    /**
     * Warms the other ledger so the switch has nothing left to wait for.
     *
     * Called on hover AND on pointer-down: a finger never hovers, so on a phone
     * the hover-only version prefetched exactly nothing and every switch paid
     * full price. Pointer-down still buys the time between touch and release,
     * which is most of what a hover would have given.
     */
    const handlePrefetchNetwork = (net: 'mainnet' | 'stokenet') => {
        // The page itself, so a later real navigation to this URL is warm too.
        onPrefetchNetwork?.(net);

        queryClient.prefetchQuery({
            queryKey: ['validators', net],
            queryFn: () => apiFetchValidators(net),
            staleTime: 300_000,
        });

        // Switching ledger resets the search and the date range, so the key is
        // the plain one for the active tag — the SAME shape the real query uses.
        // Without the tag and the range it warmed an entry nobody ever read.
        if (activeView === 'transactions') {
            queryClient.prefetchInfiniteQuery({
                queryKey: [
                    'transactions', net, undefined, transactionActiveTag,
                    { start: null, end: null },
                ],
                queryFn: () => apiFetchTransactions({
                    cursor: undefined, limit: 15, address: undefined, network: net,
                }),
                initialPageParam: undefined,
                staleTime: 30_000,
            });
        }
    };

    // Staking / Unstaking / Claim describe the connected wallet's stakes.
    const stakingTags = [
        ...DASHBOARD_TAGS.filter(tag => tag !== 'All'),
        ...(isConnected ? STAKE_STATE_TAGS : []),
    ] as string[];

    // Always at hand, beside the ledger switch: it is a switch of its own, not one
    // of the choices in the select.
    const walletButton = isConnected && (
        <button
            type="button"
            disabled={isSearchActive}
            aria-pressed={isWalletFilterActive}
            onClick={() => onWalletFilterChange(!isWalletFilterActive)}
            className={`px-3 sm:px-4 py-2 rounded-xl text-sm font-bold border transition-all duration-200 shrink-0 ${isWalletFilterActive ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-[var(--color-card-border)] bg-[var(--color-surface)]'} ${isSearchActive ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--color-primary)]/40'}`}
        >
            {(dt?.tags as Record<string, string>)?.my_wallet || 'Mi Billetera'}
        </button>
    );

    const filterOptions: FilterSelectOption[] = activeView === 'staking'
        ? [
            ...stakingTags.map(tag => ({
                key: tag,
                label: dt?.tags?.[tag as keyof typeof dt.tags] || tag,
                active: activeTags.includes(tag),
                onToggle: () => onActiveTagChange(tag),
            })),
        ]
        : [
            ...RANKING_TAGS.map(ranking => ({
                key: `rank:${ranking}`,
                label: dt?.rankings?.[ranking] || ranking,
                active: activeRanking === ranking,
                onToggle: () => {
                    if (activeRanking === ranking) return onRankingChange(null);
                    onRankingChange(ranking);
                    if (transactionActiveTag !== 'All') onTransactionTagChange('All');
                },
            })),
            ...TRANSACTION_TAGS.filter(tag => tag !== 'All').map(tag => ({
                // Prefixed: "Staking" means a wallet's stakes in one view and
                // staking transactions in the other, so a star must not cross.
                key: `tx:${tag}`,
                label: dt?.transaction_tags?.[tag] || tag,
                active: transactionActiveTag === tag && !activeRanking,
                // The explorer shows one thing at a time: a tag or a ranking.
                onToggle: () => {
                    onRankingChange(null);
                    onTransactionTagChange(transactionActiveTag === tag && !activeRanking ? 'All' : tag);
                },
            })),
        ];

    // Starred filters get a button of their own beside the select. Only those
    // of the current view count toward the cap: keys saved for the other view
    // must not block a star here.
    const withFavorite = (option: FilterSelectOption): FilterSelectOption => ({
        ...option,
        favorite: filterFavorites.includes(option.key),
        onFavoriteToggle: () => onFilterFavoriteToggle(option.key),
    });
    const starredOptions = filterOptions.filter(o => filterFavorites.includes(o.key)).slice(0, MAX_FILTER_FAVORITES);
    const canAddFavorite = starredOptions.length < MAX_FILTER_FAVORITES;

    const allLabel = (activeView === 'staking' ? dt?.tags?.['All'] : dt?.transaction_tags?.['All']) || 'All';

    return (
        <div className="space-y-4 mb-6">
            <SearchBar
                value={searchQuery}
                onChange={onSearchChange}
                placeholder={activeView === 'staking'
                    ? (dt?.search?.placeholder || 'Search staking nodes by name or address...')
                    : (dt?.search?.explorer_placeholder || 'Search by account, transaction, validator or resource address...')}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
                {/* Left Controls: View & Network */}
                <div className="flex items-center justify-around w-full sm:w-auto sm:justify-start gap-2 sm:gap-3 shrink-0">
                    {/* View toggle */}
                    <button
                        type="button"
                        onClick={() => onViewChange(activeView === 'staking' ? 'transactions' : 'staking')}
                        onMouseEnter={handlePrefetchView}
                        className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-bold transition-colors border border-[var(--color-card-border)] bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] w-[130px] sm:w-[140px] shrink-0"
                    >
                        <RadixIcon className="size-[18px] shrink-0" strokeColor="currentColor" />
                        {activeView === 'staking'
                            ? (dt?.transactions?.toggle_transactions || 'Explorer')
                            : (dt?.transactions?.toggle_validators || 'Staking')}
                    </button>

                    {/* Network toggle */}
                    <div className="flex bg-[var(--color-surface)] p-1 rounded-xl border border-[var(--color-card-border)] shrink-0">
                        <button
                            type="button"
                            onClick={() => onNetworkChange('mainnet')}
                            onMouseEnter={() => network !== 'mainnet' && handlePrefetchNetwork('mainnet')}
                            onPointerDown={() => network !== 'mainnet' && handlePrefetchNetwork('mainnet')}
                            className={`px-2 sm:px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 border border-transparent ${network === 'mainnet'
                                ? 'bg-[var(--color-accent)] text-white shadow-md border-[var(--color-accent)]/20'
                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'
                                }`}
                        >
                            {dt?.network?.mainnet || 'Mainnet'}
                        </button>
                        <button
                            type="button"
                            onClick={() => onNetworkChange('stokenet')}
                            onMouseEnter={() => network !== 'stokenet' && handlePrefetchNetwork('stokenet')}
                            onPointerDown={() => network !== 'stokenet' && handlePrefetchNetwork('stokenet')}
                            className={`px-2 sm:px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 border border-transparent ${network === 'stokenet'
                                ? 'bg-[var(--color-accent)] text-white shadow-md border-[var(--color-accent)]/20'
                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'
                                }`}
                        >
                            {dt?.network?.stokenet || 'Stokenet'}
                        </button>
                    </div>

                    {walletButton}

                    {/* Reading mode, for the layouts where the full toolbar on
                        the right is hidden. Same component, so it behaves and
                        looks exactly like its desktop counterpart. */}
                    <NetworkPanelButton
                        className="xl:hidden shrink-0"
                        open={networkPanelOpen}
                        onToggle={onNetworkPanelToggle}
                        label={dt?.toolbar?.network_panel || 'Network flow'}
                    />
                    <ReadingModeButton
                        className="xl:hidden shrink-0"
                        readingMode={readingMode}
                        setReadingMode={onReadingModeChange}
                        columns={columns}
                        label={dt?.toolbar?.reading_mode || 'Reading Mode'}
                    />
                </div>

                {/* Starred filters, as buttons centred between the two groups */}
                {starredOptions.length > 0 && (
                    <div className="flex flex-1 flex-wrap items-center justify-center gap-2 min-w-0 w-full sm:w-auto">
                        {starredOptions.map(option => (
                            <button
                                key={option.key}
                                type="button"
                                disabled={option.disabled}
                                onClick={option.onToggle}
                                aria-pressed={option.active}
                                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 shrink-0 ${option.active ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-[var(--color-card-border)] bg-[var(--color-surface)]'} ${option.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--color-primary)]/40'}`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Right Controls: the filter select sits to the left of the sort /
                    calendar buttons */}
                <div className="flex items-center justify-end gap-1 sm:gap-2 shrink-0 ml-auto w-full sm:w-auto">
                    <DashboardFilterSelect
                        width="w-full sm:w-[220px]"
                        allOption={{
                            label: allLabel,
                            onSelect: () => {
                                if (activeView === 'staking') return onActiveTagChange('All');
                                onRankingChange(null);
                                onTransactionTagChange('All');
                            },
                        }}
                        options={filterOptions.map(withFavorite)}
                        canAddFavorite={canAddFavorite}
                        favoriteLabels={{
                            add: dt?.search?.favorite_add || 'Add to favourites',
                            remove: dt?.search?.favorite_remove || 'Remove from favourites',
                            limit: dt?.search?.favorite_limit || 'You can have up to 3 favourite filters',
                        }}
                        placeholder={dt?.search?.filters_placeholder || 'Filter...'}
                        closeLabel={dt?.search?.filters_close || 'Close'}
                    />
                    <div className="hidden xl:flex items-center gap-1 sm:gap-2 shrink-0">
                        <ContentToolbar
                            sortMode={sortMode}
                            setSortMode={onSortModeChange}
                            readingMode={readingMode}
                            setReadingMode={onReadingModeChange}
                            isReadingModeManual={isReadingModeManual}
                            expandedCount={expandedCount}
                            filteredCount={filteredCount}
                            onToggleAll={onToggleAll}
                            autoCollapse={autoCollapse}
                            setAutoCollapse={onAutoCollapseChange}
                            toolbarT={dt?.toolbar || {}}
                            showSortButtons={activeView !== 'transactions'}
                            calendarOpen={calendarOpen}
                            setCalendarOpen={onCalendarToggle}
                            dateRange={dateRange}
                            onSelectRange={onSelectRange}
                            onResetRange={onResetRange}
                            calendarT={calendarT}
                            columns={columns}
                            showCalendar={activeView === 'transactions'}
                            calendarButtonTitle={dt?.toolbar?.search_by_date}
                        afterCalendar={
                            <NetworkPanelButton
                                open={networkPanelOpen}
                                onToggle={onNetworkPanelToggle}
                                label={dt?.toolbar?.network_panel || 'Network flow'}
                            />
                        }
                        />
                        <GridToggle columns={columns} onChange={onColumnsChange} max={8} />
                    </div>
                </div>
            </div>
        </div>
    );
};