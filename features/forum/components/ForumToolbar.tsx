'use client';

import React from 'react';
import { useForum } from './ForumContext';
import { FORUM_TAGS, forumPosts } from '../data/forumData';
import { SearchBar } from '@/components/ui/SearchBar';
import { TagFilterBar } from '@/components/ui/TagFilterBar';
import { ContentToolbar } from '@/components/ui/ContentToolbar';
import { GridToggle } from '@/components/ui/GridToggle';
import { ActionButton } from '@/components/ui/ActionButton';

export function ForumToolbar() {
    const { 
        t, activeTag, setActiveTag, searchQuery, setSearchQuery, 
        columns, setColumns, sortMode, setSortMode,
        readingMode, setReadingMode, autoCollapse, setAutoCollapse,
        expandedPosts, toggleAllPosts,
        calendarOpen, setCalendarOpen,
        dateRange, setDateRange,
        setShowPublishModal, setReplyingToAuthorId
    } = useForum();

    // In a real scenario we'd get the filtered count from the context or parent.
    const filteredCount = forumPosts.length; 

    return (
        <div className="space-y-4 mb-8">
            <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t.forum.controls.search_placeholder}
            />

            <div className="flex flex-col lg:flex-row items-center gap-3">
                <ContentToolbar
                    sortMode={sortMode}
                    setSortMode={setSortMode}
                    readingMode={readingMode}
                    setReadingMode={setReadingMode}
                    expandedCount={expandedPosts.size}
                    filteredCount={filteredCount}
                    onToggleAll={toggleAllPosts}
                    autoCollapse={autoCollapse}
                    setAutoCollapse={setAutoCollapse}
                    isReadingModeManual={true}
                    toolbarT={t.forum.controls}
                    calendarOpen={calendarOpen}
                    setCalendarOpen={setCalendarOpen}
                    dateRange={dateRange}
                    onSelectRange={setDateRange}
                    onResetRange={() => { setDateRange({ start: null, end: null }); setCalendarOpen(false); }}
                    calendarT={t.forum.calendar}
                    columns={columns}
                />

                <TagFilterBar
                    tags={FORUM_TAGS.filter(tag => tag !== 'General')}
                    activeTag={activeTag === 'General' ? null : activeTag}
                    onSelect={(tag) => setActiveTag(tag || 'General')}
                    allLabel={t.forum.controls.all_tags}
                    tagLabels={t.forum.tags}
                />

                <div className="flex items-center gap-2 shrink-0">
                    <ActionButton
                        onClick={() => { setReplyingToAuthorId(null); setShowPublishModal(true); }}
                        label={t.forum.controls.publish}
                        title={t.forum.controls.publish}
                        icon="plus"
                    />
                    <div className="hidden sm:block">
                        <GridToggle
                            columns={columns}
                            onChange={setColumns}
                            label={t.forum.controls.columns}
                            max={2}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
