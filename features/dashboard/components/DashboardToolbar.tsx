'use client';

import React from 'react';
import { SearchBar } from '@/components/ui/SearchBar';
import { ContentToolbar } from '@/components/ui/ContentToolbar';
import { TagFilterBar } from '@/components/ui/TagFilterBar';
import { SearchableTagFilter } from '@/components/ui/SearchableTagFilter';
import { GridToggle } from '@/components/ui/GridToggle';
import { RadixIcon } from '@/components/shared/RadixIcon';
import { DASHBOARD_TAGS } from '@/constants/dashboard';
import { TRANSACTION_TAGS } from '../explorador/constants';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetchTransactions, apiFetchValidators } from '@/features/dashboard/services/apiClient';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import type { DashboardToolbarProps } from '../types';
import { ReadingModeButton } from '@/components/ui/ReadingModeButton';

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
    activeRanking, onRankingChange,
    isReadingModeManual,
    isWalletFilterActive, onWalletFilterChange,
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

    const handlePrefetchNetwork = (net: 'mainnet' | 'stokenet') => {
        // Prefetch validators
        queryClient.prefetchQuery({
            queryKey: ['validators', net],
            queryFn: () => apiFetchValidators(net),
            staleTime: 300_000,
        });

        // Prefetch first page of transactions
        if (activeView === 'transactions') {
            queryClient.prefetchInfiniteQuery({
                queryKey: ['transactions', net, undefined],
                queryFn: () => apiFetchTransactions({ cursor: undefined, limit: 15, address: undefined, network: net }),
                initialPageParam: undefined,
                staleTime: 30_000,
            });
        }
    };

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
                            className={`px-2 sm:px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 border border-transparent ${network === 'stokenet'
                                ? 'bg-[var(--color-accent)] text-white shadow-md border-[var(--color-accent)]/20'
                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'
                                }`}
                        >
                            {dt?.network?.stokenet || 'Stokenet'}
                        </button>
                    </div>

                    {/* Reading mode, for the layouts where the full toolbar on
                        the right is hidden. Same component, so it behaves and
                        looks exactly like its desktop counterpart. */}
                    <ReadingModeButton
                        className="xl:hidden shrink-0"
                        readingMode={readingMode}
                        setReadingMode={onReadingModeChange}
                        columns={columns}
                        label={dt?.toolbar?.reading_mode || 'Reading Mode'}
                    />
                </div>

                {/* Center Controls: Tag Filters (Full width on mobile to drop to bottom) */}
                <div className="flex-1 flex justify-center min-w-[200px] order-last 2xl:order-none w-full 2xl:w-auto">
                    {/* Tag filter bar - Desktop */}
                    <div className="hidden 2xl:block w-full">
                        {activeView === 'staking' ? (
                            <div className="flex items-center justify-center gap-3">
                                {isConnected && (
                                    <button
                                        type="button"
                                        disabled={isSearchActive}
                                        onClick={() => onWalletFilterChange(!isWalletFilterActive)}
                                        className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 shrink-0 ${isWalletFilterActive ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-[var(--color-card-border)] bg-[var(--color-surface)]'} ${isSearchActive ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--color-primary)]/40'}`}
                                    >
                                        {(dt?.tags as Record<string, string>)?.my_wallet || 'Mi Billetera'}
                                    </button>
                                )}
                                <TagFilterBar
                                    tags={DASHBOARD_TAGS.filter(tag => tag !== 'All') as unknown as string[]}
                                    activeTag={activeTags.includes('All') ? null : activeTags}
                                    onSelect={tag => onActiveTagChange(tag || 'All')}
                                    allLabel={dt?.tags?.['All'] || 'All'}
                                    tagLabels={dt?.tags}
                                    hideAll={true}
                                />
                            </div>
                        ) : (
                            <div className="flex items-center justify-center gap-3">
                                {isConnected && (
                                    <button
                                        type="button"
                                        disabled={isSearchActive}
                                        onClick={() => onWalletFilterChange(!isWalletFilterActive)}
                                        className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 shrink-0 ${isWalletFilterActive ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-[var(--color-card-border)] bg-[var(--color-surface)]'} ${isSearchActive ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--color-primary)]/40'}`}
                                    >
                                        {(dt?.tags as Record<string, string>)?.my_wallet || 'Mi Billetera'}
                                    </button>
                                )}
                                <TagFilterBar
                                    tags={TRANSACTION_TAGS.filter(tag => tag !== 'All') as unknown as string[]}
                                    activeTag={transactionActiveTag === 'All' ? null : transactionActiveTag}
                                    onSelect={tag => onTransactionTagChange(tag || 'All')}
                                    allLabel={dt?.transaction_tags?.['All'] || 'All'}
                                    tagLabels={dt?.transaction_tags}
                                    hideAll={true}
                                />
                                {!isConnected && (
                                    <SearchableTagFilter
                                        tags={['top_accounts', 'top_tokens', 'top_nfts', 'contracts', 'blueprints']}
                                        activeTag={activeRanking}
                                        onSelect={onRankingChange}
                                        allLabel={dt?.rankings?.['filter_by'] || 'Filtrar por...'}
                                        tagLabels={dt?.rankings}
                                        hideAll={true}
                                        width="w-[240px]"
                                        placeholder={dt?.rankings?.search_placeholder || 'Filtrar rankings...'}
                                    />
                                )}
                            </div>
                        )}
                    </div>

                    {/* Tag filter dropdown - Mobile / Tablet */}
                    <div className="block 2xl:hidden w-full max-w-sm">
                        {activeView === 'staking' ? (
                            <div className="flex flex-col sm:flex-row items-center gap-3 w-full animate-in fade-in slide-in-from-top-1 duration-500">
                                {isConnected && (
                                    <button
                                        type="button"
                                        disabled={isSearchActive}
                                        onClick={() => onWalletFilterChange(!isWalletFilterActive)}
                                        className={`w-full sm:w-auto px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 shrink-0 ${isWalletFilterActive ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-[var(--color-card-border)] bg-[var(--color-surface)]'} ${isSearchActive ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--color-primary)]/40'}`}
                                    >
                                        {(dt?.tags as Record<string, string>)?.my_wallet || 'Mi Billetera'}
                                    </button>
                                )}
                                <div className="hidden sm:block w-full">
                                    <SearchableTagFilter
                                        tags={DASHBOARD_TAGS.filter(tag => tag !== 'All') as unknown as string[]}
                                        activeTag={activeTags.includes('All') ? null : activeTags[0] || null}
                                        onSelect={tag => onActiveTagChange(tag || 'All')}
                                        allLabel={dt?.tags?.['All'] || 'All'}
                                        tagLabels={dt?.tags}
                                        placeholder={dt?.search?.tags_placeholder || 'Buscar etiquetas...'}
                                        hideAll={true}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col sm:flex-row items-center gap-3 w-full animate-in fade-in slide-in-from-top-1 duration-500">
                                {isConnected && (
                                    <button
                                        type="button"
                                        disabled={isSearchActive}
                                        onClick={() => onWalletFilterChange(!isWalletFilterActive)}
                                        className={`w-full sm:w-auto px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 shrink-0 ${isWalletFilterActive ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-[var(--color-card-border)] bg-[var(--color-surface)]'} ${isSearchActive ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--color-primary)]/40'}`}
                                    >
                                        {(dt?.tags as Record<string, string>)?.my_wallet || 'Mi Billetera'}
                                    </button>
                                )}
                                <div className="hidden sm:block w-full">
                                    <SearchableTagFilter
                                        tags={TRANSACTION_TAGS.filter(tag => tag !== 'All') as unknown as string[]}
                                        activeTag={transactionActiveTag === 'All' ? null : transactionActiveTag}
                                        onSelect={tag => onTransactionTagChange(tag || 'All')}
                                        allLabel={dt?.transaction_tags?.['All'] || 'All'}
                                        tagLabels={dt?.transaction_tags}
                                        placeholder={dt?.search?.transactions_placeholder || 'Filtrar transacciones...'}
                                        hideAll={true}
                                    />
                                </div>
                                <div className="hidden sm:block sm:shrink-0 w-full sm:w-auto">
                                    {!isConnected && (
                                        <SearchableTagFilter
                                            tags={['top_accounts', 'top_tokens', 'top_nfts', 'contracts', 'blueprints']}
                                            activeTag={activeRanking}
                                            onSelect={onRankingChange}
                                            allLabel={dt?.rankings?.['filter_by'] || 'Filtrar por...'}
                                            tagLabels={dt?.rankings}
                                            hideAll={true}
                                            width="w-full sm:w-[240px]"
                                            placeholder={dt?.rankings?.search_placeholder || 'Filtrar rankings...'}
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Controls: Toolbar & Grid Toggle */}
                <div className="hidden xl:flex items-center gap-1 sm:gap-2 shrink-0 ml-auto">
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
                    />
                    <GridToggle columns={columns} onChange={onColumnsChange} max={8} />
                </div>
            </div>
        </div>
    );
};
