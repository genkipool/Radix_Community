'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useForum } from './ForumContext';
import { ForumPost, ForumReply, ForumUser } from '../types/data.types';

interface ReplyFilterWidgetProps {
    /** The author ID of the message this widget belongs to */
    authorId: string;
    /** The post containing replies */
    post: ForumPost;
    /** Unique ID for this filter pivot instance */
    uniqueFilterId: string;
    /** Replies that match this author (position-aware count) */
    specificReplies: ForumReply[];
    /** Users who have replied to this author (position-aware) */
    repliersToAuthor: ForumUser[];
}

export function ReplyFilterWidget({
    authorId,
    post,
    uniqueFilterId,
    specificReplies,
    repliersToAuthor,
}: ReplyFilterWidgetProps) {
    const {
        t, users,
        replyFilterPivotId, replyFilterUser,
        setReplyToFilter, setReplyFilterUser, setReplyFilterPivotId,
    } = useForum();

    const [filterDropdownOpen, setFilterDropdownOpen] = useState<string | null>(null);
    const [filterSearchQuery, setFilterSearchQuery] = useState('');

    const cycleFilterUser = (direction: 'next' | 'prev') => {
        if (!post) return;
        const repliers = repliersToAuthor;
        let currentIdx = -1;
        if (replyFilterPivotId === uniqueFilterId) {
            currentIdx = replyFilterUser ? repliers.findIndex(u => u.id === replyFilterUser) : repliers.length;
        }

        const cycleLength = repliers.length + 1;
        let nextIdx = 0;
        if (direction === 'next') nextIdx = (currentIdx + 1) % cycleLength;
        else nextIdx = (currentIdx - 1 + cycleLength) % cycleLength;

        setReplyToFilter(authorId);
        if (nextIdx === repliers.length) setReplyFilterUser('');
        else setReplyFilterUser(repliers[nextIdx].id);
        setReplyFilterPivotId(uniqueFilterId);
    };

    if (repliersToAuthor.length === 0) return null;

    return (
        <div className="relative filter-dropdown-container">
            <div className={`flex items-center rounded-full border transition-all shadow-md overflow-hidden bg-[var(--color-bg)] border-[var(--color-card-border)] group/filter`}>
                <button type="button" onClick={(e) => { e.stopPropagation(); cycleFilterUser('prev'); }}
                    className="p-1 px-2 hover:bg-[var(--color-primary)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors border-r border-[var(--color-card-border)]">
                    <ChevronLeft className="size-3.5" />
                </button>

                <button type="button" onClick={(e) => {
                    e.stopPropagation();
                    if (replyFilterPivotId === uniqueFilterId) {
                        setReplyToFilter(''); setReplyFilterUser(''); setReplyFilterPivotId(null);
                    } else {
                        setReplyToFilter(authorId);
                        setReplyFilterUser('');
                        setReplyFilterPivotId(uniqueFilterId);
                    }
                }}
                    className={`px-4 py-1 text-[13px] font-bold transition-colors truncate w-[140px] text-center ${replyFilterPivotId === uniqueFilterId ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}>
                    {replyFilterPivotId === uniqueFilterId && replyFilterUser ? users[replyFilterUser]?.name : `${specificReplies.length} ${t.forum.post.replies.toLowerCase()}`}
                </button>

                <button type="button" onClick={(e) => { e.stopPropagation(); cycleFilterUser('next'); }}
                    className="p-1 px-2 hover:bg-[var(--color-primary)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors border-l border-[var(--color-card-border)]">
                    <ChevronRight className="size-3.5" />
                </button>

                <button type="button" onClick={(e) => {
                    e.stopPropagation();
                    setFilterDropdownOpen(filterDropdownOpen === uniqueFilterId ? null : uniqueFilterId);
                    setFilterSearchQuery('');
                }}
                    className={`p-1 px-2.5 transition-colors border-l border-[var(--color-card-border)] ${filterDropdownOpen === uniqueFilterId ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)]'}`}
                    title={t.forum.controls.search_placeholder}>
                    <Search className="size-3.5" />
                </button>
            </div>

            <AnimatePresence>
                {filterDropdownOpen === uniqueFilterId && (
                    <motion.div
                        initial={{ opacity: 0, y: 5, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)]/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden"
                    >

                        <div className="p-3 border-b border-[var(--color-card-border)] bg-[var(--color-bg)]/50">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-muted)]" />
                                <input type="text"
                                    placeholder={t.forum.controls.search_placeholder}
                                    value={filterSearchQuery}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => setFilterSearchQuery(e.target.value)}
                                    aria-label={t.forum.controls.search_placeholder}
                                    className="w-full bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-lg py-2 pl-9 pr-3 text-xs text-[var(--color-text-main)] focus:outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-[var(--color-text-muted)]/50"
                                />
                            </div>
                        </div>

                        <div className="max-h-64 overflow-y-auto p-2 custom-scrollbar space-y-1">
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setReplyToFilter(''); setReplyFilterUser(''); setReplyFilterPivotId(null); setFilterDropdownOpen(null); }}
                                className={`w-full flex items-center px-3 py-2 text-xs rounded-lg transition-colors ${!replyFilterUser ? 'bg-[var(--color-primary)] text-white font-bold' : 'text-[var(--color-text-main)] hover:bg-[var(--color-bg)]'}`}>
                                {t.forum.controls.all_tags}
                            </button>
                            {repliersToAuthor.flatMap(u => u.name.toLowerCase().includes(filterSearchQuery.toLowerCase()) ? [(
                                <button type="button" key={u.id}
                                    onClick={(e) => { e.stopPropagation(); setReplyToFilter(authorId); setReplyFilterUser(u.id); setReplyFilterPivotId(uniqueFilterId); setFilterDropdownOpen(null); }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-lg transition-colors ${replyFilterUser === u.id && replyFilterPivotId === uniqueFilterId ? 'bg-[var(--color-primary)] text-white font-bold' : 'text-[var(--color-text-main)] hover:bg-[var(--color-bg)]'}`}>
                                    <Image src={u.avatar} alt={u.name} width={24} height={24} className="size-6 rounded-full object-cover border border-white/20" unoptimized />
                                    <span className="truncate">{u.name}</span>
                                </button>
                            )] : [])}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
