'use client';
import React from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { Calendar, User, Eye, Heart } from 'lucide-react';
import { HighlightText } from '@/components/ui/HighlightText';
import { Card } from '@/components/ui/Card';
import { PostContent } from '../PostContent';
import { LabelBadge } from '@/components/ui/LabelBadge';
import { BlogPost } from '../types/data.types';
import { BlogDictionary } from '../types/i18n.types';
import { getPostSpanStyle, getPostDisplayTag } from '../utils/blogUtils';

interface BlogPostCardProps {
    post: BlogPost;
    index: number;
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
}

export function BlogPostCard({
    post,
    index,
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
    getLikes
}: BlogPostCardProps) {
    const displayTag = getPostDisplayTag(post, activeTag);
    const spanStyle = getPostSpanStyle(index, post, columns);
    const isRowSpan = !!spanStyle.gridRow;
    const isExpanded = expandedPosts.has(post.id);
    const isSelected = selectedPostId === post.id;

    // Prevent card toggle when user is selecting text
    const mouseDownPos = React.useRef<{ x: number; y: number } | null>(null);

    const handleMouseDown = (e: React.MouseEvent) => {
        mouseDownPos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePostExpand = (e: React.MouseEvent) => {
        // If there is an active text selection, ignore the click
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) {
            e.stopPropagation();
            return;
        }

        // If mouse moved significantly, treat as drag/select, not click
        if (mouseDownPos.current) {
            const dx = Math.abs(e.clientX - mouseDownPos.current.x);
            const dy = Math.abs(e.clientY - mouseDownPos.current.y);
            if (dx > 5 || dy > 5) {
                mouseDownPos.current = null;
                return;
            }
        }
        mouseDownPos.current = null;
        onExpand(post.id);
    };

    return (
        <Card
            layoutId={readingMode ? `post-${post.id}` : undefined}
            onMouseDown={handleMouseDown}
            onClick={handlePostExpand}
            className="overflow-hidden shadow-md hover:shadow-lg hover:border-[var(--color-primary)]/30 group cursor-pointer border-[var(--color-card-border)] h-full select-text"
            innerClassName="h-full flex flex-col"
            style={{ ...spanStyle, position: 'relative' as const, zIndex: isSelected ? 50 : isExpanded ? 40 : 1 }}
        >
            {/* Image */}
            <div
                className={`relative w-full overflow-hidden bg-gradient-to-br from-[var(--color-primary)]/10 to-[var(--color-secondary)]/10 flex-shrink-0 ${index === 0 ? 'h-56 md:h-72' : isRowSpan ? 'min-h-[12rem]' : 'h-48'}`}
            >
                <div className="absolute inset-0 z-10">
                    <Image
                        src={post.image}
                        alt={post.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 768px) 100vw, 50vw"
                    />
                </div>
            </div>

            {/* Content Wrapper */}
            <div className="p-6 flex flex-col flex-1">
                <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-3 group-hover:text-[var(--color-primary)] transition-colors leading-snug line-clamp-2">
                    <HighlightText text={post.title} query={searchQuery} />
                </h3>

                <motion.div
                    initial={false}
                    animate={{ height: isExpanded ? 'auto' : 88, opacity: isExpanded ? 1 : 0.9 }}
                    transition={{ duration: 0.4, ease: 'easeOut', type: 'tween' }}
                    className="overflow-hidden"
                >
                    <div className={`text-[15px] text-[var(--color-text-muted)] leading-relaxed mb-4 ${isExpanded ? '' : 'line-clamp-3'}`}>
                        {isExpanded ? (
                            <PostContent content={post.content} query={searchQuery} />
                        ) : (
                            <PostContent content={post.summary} query={searchQuery} isSummary={true} />
                        )}
                    </div>
                </motion.div>

                {/* Footer */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-[var(--color-card-border)] mt-auto">
                    <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-text-muted)] font-medium">
                        <span className="flex items-center gap-1.5 shrink-0" title={blogT.calendar.title}>
                            <Calendar className="size-3.5" />
                            {new Date(post.date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0" title={blogT.author}>
                            <User className="size-3.5" />
                            {post.author}
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0" title={blogT.views}>
                            <Eye className="size-3.5" />
                            {post.views.toLocaleString()}
                        </span>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onToggleLike(post.id); }}
                            title={blogT.like}
                            className={`flex items-center gap-1.5 shrink-0 transition-colors ${likedPosts.has(post.id) ? 'text-red-400' : 'hover:text-red-400'}`}
                        >
                            <Heart className={`size-3.5 ${likedPosts.has(post.id) ? 'fill-red-400' : ''}`} />
                            {getLikes(post)}
                        </button>
                    </div>
                    <LabelBadge
                        value={blogT.tags[displayTag as keyof typeof blogT.tags] || displayTag}
                        className="group-hover:brightness-110"
                    />
                </div>
            </div>
        </Card>
    );
}
