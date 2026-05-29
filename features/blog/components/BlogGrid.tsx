'use client';
import React from 'react';
import { BlogPost } from '../types/data.types';
import { BlogDictionary } from '../types/i18n.types';
import { BlogPostCard } from './BlogPostCard';

interface BlogGridProps {
    displayedPosts: BlogPost[];
    columns: number;
    activeTag: string | null;
    searchQuery: string;
    expandedPosts: Set<number>;
    likedPosts: Set<number>;
    readingMode: boolean;
    selectedPostId: number | null;
    language: string;
    blogT: BlogDictionary;
    onExpand: (id: number) => void;
    onToggleLike: (id: number) => void;
    getLikes: (post: BlogPost) => number;
    hasMore: boolean;
    sentinelRef: React.RefObject<HTMLDivElement | null>;
}

export function BlogGrid({
    displayedPosts,
    columns,
    activeTag,
    searchQuery,
    expandedPosts,
    likedPosts,
    readingMode,
    selectedPostId,
    language,
    blogT,
    onExpand,
    onToggleLike,
    getLikes,
    hasMore,
    sentinelRef
}: BlogGridProps) {
    return (
        <section className="pb-24">
            <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12">
                <div
                    className={`grid gap-5 auto-rows-min ${columns === 1 ? 'grid-cols-1' :
                        columns === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                            columns === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
                                'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                        }`}
                    style={{
                        gridAutoFlow: columns > 1 ? 'dense' : 'row',
                    }}
                >
                    {displayedPosts.map((post, i) => (
                        <BlogPostCard
                            key={post.id}
                            post={post}
                            index={i}
                            columns={columns}
                            activeTag={activeTag}
                            searchQuery={searchQuery}
                            expandedPosts={expandedPosts}
                            likedPosts={likedPosts}
                            readingMode={readingMode}
                            selectedPostId={selectedPostId}
                            language={language}
                            blogT={blogT}
                            onExpand={onExpand}
                            onToggleLike={onToggleLike}
                            getLikes={getLikes}
                        />
                    ))}
                </div>

                {hasMore && (
                    <div ref={sentinelRef} className="flex justify-center py-12">
                        <div className="size-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
                    </div>
                )}
            </div>
        </section>
    );
}
