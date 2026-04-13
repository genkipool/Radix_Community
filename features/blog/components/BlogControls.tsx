'use client';
import React from 'react';
import { SearchBar } from '@/components/ui/SearchBar';
import { ContentToolbar } from '@/components/ui/ContentToolbar';
import { SearchableTagFilter } from '@/components/ui/SearchableTagFilter';
import { GridToggle } from '@/components/ui/GridToggle';
import { BlogDictionary } from '../types';

interface BlogControlsProps {
    searchQuery: string;
    onSearchChange: (q: string) => void;
    sortMode: 'newest' | 'oldest' | 'date' | 'random';
    onSortChange: (m: 'newest' | 'oldest' | 'date' | 'random') => void;
    readingMode: boolean;
    onReadingModeChange: (v: boolean) => void;
    expandedCount: number;
    filteredCount: number;
    onToggleAll: () => void;
    autoCollapse: boolean;
    onAutoCollapseChange: (v: boolean) => void;
    calendarOpen: boolean;
    onCalendarOpenChange: (v: boolean) => void;
    dateRange: { start: string | null; end: string | null };
    onDateRangeChange: (range: { start: string | null; end: string | null }) => void;
    onResetRange: () => void;
    allTags: string[];
    activeTag: string | null;
    onTagSelect: (tag: string | null) => void;
    columns: number;
    onColumnsChange: (cols: number) => void;
    blogT: BlogDictionary;
}

export function BlogControls({
    searchQuery,
    onSearchChange,
    sortMode,
    onSortChange,
    readingMode,
    onReadingModeChange,
    expandedCount,
    filteredCount,
    onToggleAll,
    autoCollapse,
    onAutoCollapseChange,
    calendarOpen,
    onCalendarOpenChange,
    dateRange,
    onDateRangeChange,
    onResetRange,
    allTags,
    activeTag,
    onTagSelect,
    columns,
    onColumnsChange,
    blogT
}: BlogControlsProps) {
    return (
        <section className="pb-8">
            <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 space-y-4">
                {/* Controls Bar */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 w-full">
                    {/* LEFT — Sorting */}
                    <div className="shrink-0">
                        <ContentToolbar
                            sortMode={sortMode}
                            setSortMode={onSortChange}
                            readingMode={readingMode}
                            setReadingMode={onReadingModeChange}
                            expandedCount={expandedCount}
                            filteredCount={filteredCount}
                            onToggleAll={onToggleAll}
                            autoCollapse={autoCollapse}
                            setAutoCollapse={onAutoCollapseChange}
                            toolbarT={blogT.controls}
                            calendarOpen={calendarOpen}
                            setCalendarOpen={onCalendarOpenChange}
                            dateRange={dateRange}
                            onSelectRange={onDateRangeChange}
                            onResetRange={onResetRange}
                            calendarT={blogT.calendar}
                            columns={columns}
                        />
                    </div>

                    {/* SEARCH (FLEX-1) */}
                    <div className="flex-1 min-w-0 w-full xl:min-w-[400px]">
                        <SearchBar
                            value={searchQuery}
                            onChange={onSearchChange}
                            placeholder={blogT.controls.search_placeholder}
                            className="!w-full max-w-none"
                        />
                    </div>

                    {/* TAGS */}
                    <div className="shrink-0">
                        <SearchableTagFilter
                            tags={allTags}
                            activeTag={activeTag}
                            onSelect={onTagSelect}
                            allLabel={blogT.all}
                            tagLabels={blogT.tags}
                            placeholder={blogT.controls.search_placeholder}
                        />
                    </div>

                    {/* RIGHT — Grid Toggle */}
                    <div className="shrink-0 flex justify-end">
                        <GridToggle columns={columns} onChange={onColumnsChange} max={4} />
                    </div>
                </div>
            </div>
        </section>
    );
}
