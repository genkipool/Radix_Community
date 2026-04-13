'use client';
import Image from 'next/image';
import { Calendar, User, Eye, Heart } from 'lucide-react';
import { HighlightText } from '@/components/ui/HighlightText';
import { Card } from '@/components/ui/Card';
import { PostContent } from '../PostContent';
import { tagColor, defaultTagColor } from '@/constants/tagColors';
import { BlogPost, BlogDictionary } from '../types';
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

    return (
        <Card
            layout={readingMode ? true : false}
            layoutId={readingMode ? `post-${post.id}` : undefined}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '0px' }}
            transition={{ delay: Math.min(index * 0.02, 0.2), duration: 0.3 }}
            onClick={() => onExpand(post.id)}
            className="overflow-hidden shadow-md hover:shadow-lg hover:border-[var(--color-primary)]/30 group cursor-pointer border-[var(--color-card-border)] h-full"
            innerClassName="h-full flex flex-col"
            style={spanStyle}
        >
            {/* Image */}
            <div
                className={`relative w-full overflow-hidden bg-gradient-to-br from-[var(--color-primary)]/10 to-[var(--color-secondary)]/10 flex-shrink-0 ${index === 0 ? 'h-56 md:h-72' : isRowSpan ? 'min-h-[12rem]' : 'h-48'}`}
            >
                <Image 
                    src={post.image} 
                    alt={post.title} 
                    fill 
                    className="object-cover group-hover:scale-105 transition-transform duration-500" 
                    sizes="(max-width: 768px) 100vw, 50vw" 
                />
            </div>

            {/* Content Wrapper */}
            <div className="p-6 flex flex-col flex-1">
                <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-3 group-hover:text-[var(--color-primary)] transition-colors leading-snug line-clamp-2">
                    <HighlightText text={post.title} query={searchQuery} />
                </h3>

                <div 
                    className={`overflow-hidden transition-all duration-700 ease-in-out ${isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-[88px] opacity-90'}`}
                >
                    <div className={`text-[15px] text-[var(--color-text-muted)] leading-relaxed mb-4 ${isExpanded ? '' : 'line-clamp-3'}`}>
                        {isExpanded ? (
                            <PostContent content={post.content} query={searchQuery} />
                        ) : (
                            <PostContent content={post.summary} query={searchQuery} isSummary={true} />
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-[var(--color-card-border)] mt-auto">
                    <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-text-muted)] font-medium">
                        <span className="flex items-center gap-1.5 shrink-0" title={blogT.calendar.title}>
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(post.date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0" title={blogT.author}>
                            <User className="w-3.5 h-3.5" />
                            {post.author}
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0" title={blogT.views}>
                            <Eye className="w-3.5 h-3.5" />
                            {post.views.toLocaleString()}
                        </span>
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleLike(post.id); }}
                            title={blogT.like}
                            className={`flex items-center gap-1.5 shrink-0 transition-colors ${likedPosts.has(post.id) ? 'text-red-400' : 'hover:text-red-400'}`}
                        >
                            <Heart className={`w-3.5 h-3.5 ${likedPosts.has(post.id) ? 'fill-red-400' : ''}`} />
                            {getLikes(post)}
                        </button>
                    </div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all duration-200 group-hover:brightness-110 ${tagColor[displayTag] || defaultTagColor}`}>
                        {blogT.tags[displayTag as keyof typeof blogT.tags] || displayTag}
                    </span>
                </div>
            </div>
        </Card>
    );
}
