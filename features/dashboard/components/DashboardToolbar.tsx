'use client';

import React from 'react';
import { SearchBar } from '@/components/ui/SearchBar';
import { ContentToolbar } from '@/components/ui/ContentToolbar';
import { TagFilterBar } from '@/components/ui/TagFilterBar';
import { SearchableTagFilter } from '@/components/ui/SearchableTagFilter';
import { GridToggle } from '@/components/ui/GridToggle';
import { DASHBOARD_TAGS } from '@/constants/dashboard';
import { TRANSACTION_TAGS } from '../explorador/constants';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetchTransactions, apiFetchValidators } from '@/features/dashboard/services/apiClient';

import type { DashboardToolbarProps } from '../types';

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
    dt,
}: DashboardToolbarProps) => {
    const queryClient = useQueryClient();

    const handlePrefetchNetwork = (net: 'mainnet' | 'stokenet') => {
        // Prefetch validators
        queryClient.prefetchQuery({
            queryKey: ['validators', net],
            queryFn:  () => apiFetchValidators(net),
            staleTime: 60_000,
        });

        // Prefetch first page of transactions
        if (activeView === 'transactions') {
            queryClient.prefetchInfiniteQuery({
                queryKey: ['transactions', net, undefined],
            queryFn:  () => apiFetchTransactions({ cursor: undefined, limit: 15, address: undefined, network: net }),
                initialPageParam: undefined,
                staleTime: 10_000,
            });
        }
    };

    return (
        <div className="space-y-4 mb-6">
            <SearchBar
                value={searchQuery}
                onChange={onSearchChange}
                placeholder={dt?.search?.placeholder || 'Search...'}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
                {/* Left Controls: View & Network */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {/* View toggle */}
                    <button
                        onClick={() => onViewChange(activeView === 'staking' ? 'transactions' : 'staking')}
                        className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-bold transition-colors border border-[var(--color-card-border)] bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] w-[130px] sm:w-[140px] shrink-0"
                    >
                        <svg width="18" height="18" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
                            <path d="M14,53 L25,53 L42,78 L66,20 L88,20" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {activeView === 'staking'
                            ? (dt?.transactions?.toggle_transactions || 'Explorer')
                            : (dt?.transactions?.toggle_validators  || 'Staking')}
                    </button>

                    {/* Network toggle */}
                    <div className="flex bg-[var(--color-surface)] p-1 rounded-xl border border-[var(--color-card-border)] shrink-0">
                        <button
                            onClick={() => onNetworkChange('mainnet')}
                            onMouseEnter={() => network !== 'mainnet' && handlePrefetchNetwork('mainnet')}
                            className={`px-2 sm:px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 border border-transparent ${
                                network === 'mainnet'
                                    ? 'bg-[var(--color-accent)] text-white shadow-md border-[var(--color-accent)]/20'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'
                            }`}
                        >
                            {dt?.network?.mainnet || 'Mainnet'}
                        </button>
                        <button
                            onClick={() => onNetworkChange('stokenet')}
                            onMouseEnter={() => network !== 'stokenet' && handlePrefetchNetwork('stokenet')}
                            className={`px-2 sm:px-3 py-1.5 text-xs font-bold rounded-lg transition-all duration-150 border border-transparent ${
                                network === 'stokenet'
                                    ? 'bg-[var(--color-accent)] text-white shadow-md border-[var(--color-accent)]/20'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)]'
                            }`}
                        >
                            {dt?.network?.stokenet || 'Stokenet'}
                        </button>
                    </div>
                </div>

                {/* Center Controls: Tag Filters (Full width on mobile to drop to bottom) */}
                <div className="flex-1 flex justify-center min-w-[200px] order-last 2xl:order-none w-full 2xl:w-auto">
                    {/* Tag filter bar - Desktop */}
                    <div className="hidden 2xl:block w-full">
                        {activeView === 'staking' ? (
                            <TagFilterBar
                                tags={DASHBOARD_TAGS.filter(tag => tag !== 'All') as unknown as string[]}
                                activeTag={activeTags.includes('All') ? null : activeTags}
                                onSelect={tag => onActiveTagChange(tag || 'All')}
                                allLabel={dt?.tags?.['All'] || 'All'}
                                tagLabels={dt?.tags}
                            />
                        ) : (
                            <TagFilterBar
                                tags={TRANSACTION_TAGS.filter(tag => tag !== 'All') as unknown as string[]}
                                activeTag={transactionActiveTag === 'All' ? null : transactionActiveTag}
                                onSelect={tag => onTransactionTagChange(tag || 'All')}
                                allLabel={dt?.transaction_tags?.['All'] || 'All'}
                                tagLabels={dt?.transaction_tags}
                            />
                        )}
                    </div>

                    {/* Tag filter dropdown - Mobile / Tablet */}
                    <div className="block 2xl:hidden w-full max-w-sm">
                        {activeView === 'staking' ? (
                            <SearchableTagFilter
                                tags={DASHBOARD_TAGS.filter(tag => tag !== 'All') as unknown as string[]}
                                activeTag={activeTags.includes('All') ? null : activeTags[0] || null}
                                onSelect={tag => onActiveTagChange(tag || 'All')}
                                allLabel={dt?.tags?.['All'] || 'All'}
                                tagLabels={dt?.tags}
                                placeholder={dt?.search?.placeholder || 'Search tags...'}
                            />
                        ) : (
                            <SearchableTagFilter
                                tags={TRANSACTION_TAGS.filter(tag => tag !== 'All') as unknown as string[]}
                                activeTag={transactionActiveTag === 'All' ? null : transactionActiveTag}
                                onSelect={tag => onTransactionTagChange(tag || 'All')}
                                allLabel={dt?.transaction_tags?.['All'] || 'All'}
                                tagLabels={dt?.transaction_tags}
                                placeholder={dt?.search?.placeholder || 'Search tags...'}
                            />
                        )}
                    </div>
                </div>

                {/* Right Controls: Toolbar & Grid Toggle */}
                <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto">
                    <ContentToolbar
                        sortMode={sortMode}
                        setSortMode={onSortModeChange}
                        readingMode={readingMode}
                        setReadingMode={onReadingModeChange}
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
                    />
                    <GridToggle columns={columns} onChange={onColumnsChange} max={8} />
                </div>
            </div>
        </div>
    );
};
