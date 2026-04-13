'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Clock, Eye, MessageSquare, Heart, ArrowUp 
} from 'lucide-react';
import { useForum } from './ForumContext';
import { ForumMessage } from './ForumMessage';
import { ReplyFilterWidget } from './ReplyFilterWidget';
import { ForumPost, ForumReply } from '../types';
import { getUserRank } from '../data/forumData';
import { getReplyChildrenMap } from '../utils/replyTree';
import { RankIcon } from './RankIcon';
import { XPBar } from '@/components/ui/XPBar';
import { UserStats } from '@/components/ui/UserStats';
import { HighlightText } from '@/components/ui/HighlightText';
import { StatButton } from '@/components/ui/StatButton';
import { Button } from '@/components/ui/Button';
import { tagColor } from '@/constants/tagColors';
import Image from 'next/image';
import { CodeHighlighter } from '@/components/ui/CodeHighlighter';
import { applyMarkdownToHtml } from '@/features/docs/utils/markdownParser';

interface ForumPostCardProps {
    post: ForumPost;
}

export function ForumPostCard({ post }: ForumPostCardProps) {
    const {
        t, language, users, expandedPosts, handleExpandPost,
        toggleLikePost, toggleDislikePost,
        likedPosts, dislikedPosts,
        readingMode, searchQuery,
        toggleLikeReply, toggleDislikeReply,
        likedReplies,
        getReplyLikes,
        setReplyingToAuthorId, setReplyingToPost, setShowPublishModal,
        columns,
        replyFilterPivotId, replyFilterUser,
    } = useForum();

    const isExpanded = expandedPosts.has(post.id);
    const author = users[post.authorId];
    const rank = author ? getUserRank(author.xp) : null;
    const sortedUsers = Object.values(users).sort((a, b) => b.xp - a.xp);
    const displayTag = post.tags[0] || 'General';

    const getPostLikes = (p: ForumPost) => p.likes + (likedPosts.has(p.id) ? 1 : 0);
    const getPostDislikes = (p: ForumPost) => p.dislikes + (dislikedPosts.has(p.id) ? 1 : 0);

    const getFilteredReplies = (p: ForumPost) => {
        const pivotId = replyFilterPivotId;
        if (!pivotId) return [...p.replies];

        const childrenMap = getReplyChildrenMap(p, users);
        const rootPivotId = `root-${p.id}`;
        const isRootPivot = pivotId === rootPivotId;

        if (isRootPivot) {
            // Root pivot: direct children of 'root' in the tree
            const rootChildren = childrenMap.get('root') || [];
            return rootChildren.filter(r => !replyFilterUser || r.authorId === replyFilterUser);
        }

        // Message pivot: children of the specific message
        const pivotMsgId = pivotId.split('-').pop();
        const pivotIndex = p.replies.findIndex(r => r.id.toString() === pivotMsgId);
        if (pivotIndex === -1) return [...p.replies];

        const pivotChildren = childrenMap.get(Number(pivotMsgId)) || [];
        const pivotChildrenSet = new Set(pivotChildren.map(c => c.id));

        return p.replies.filter((r, idx) => {
            if (idx <= pivotIndex) return true; // Keep messages at/before pivot
            const isDirectChild = pivotChildrenSet.has(r.id);
            const matchesUser = !replyFilterUser || r.authorId === replyFilterUser;
            return matchesUser && isDirectChild;
        });
    };

    const filteredReplies = getFilteredReplies(post);
    
    // For the original post card, the filter widget represents the ROOT of the tree.
    // It should include only direct replies (and relevant authors) to match the root filter logic.
    const childrenMap = post ? getReplyChildrenMap(post, users) : new Map<number | 'root', ForumReply[]>();
    const specificReplies = childrenMap.get('root') || [];
    const repliersToAuthor = Array.from(new Set(specificReplies.map((r: ForumReply) => r.authorId)))
        .map(id => users[id])
        .filter(Boolean);

    const renderInlineExpanded = () => {
        return (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }} className="overflow-hidden border-t border-[var(--color-card-border)] bg-[var(--color-surface)]/30">
                <div className="pl-8 sm:pl-32 py-4 pr-5 sm:pr-5">
                    <div className="relative">
                        <div className="absolute top-0 bottom-0 left-6 w-0.5 bg-[var(--color-card-border)]/50" />
                        <div className="space-y-4 relative z-10 w-full">
                            {filteredReplies.map((reply, idx) => (
                                <div key={`${post.id}-${reply.id}-${idx}`} className="w-full">
                                    <ForumMessage
                                        authorId={reply.authorId}
                                        content={reply.content || ''}
                                        date={reply.date}
                                        likes={getReplyLikes(post.id, reply)}
                                        liked={likedReplies.has(`${post.id}-${reply.id}`)}
                                        onLike={() => toggleLikeReply(post.id, reply.id)}
                                        dislikes={getReplyLikes(post.id, reply)}
                                        disliked={likedReplies.has(`${post.id}-${reply.id}`)}
                                        onDislike={() => toggleDislikeReply(post.id, reply.id)}
                                        replyTo={reply.replyTo}
                                        replyToContent={reply.replyToContent}
                                        post={post}
                                        isReply={true}
                                        messageId={reply.id.toString()}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    };

    const handleCardClick = () => {
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;
        handleExpandPost(post.id);
    };

    return (
        <motion.div
            className={`rounded-3xl border border-[var(--color-card-border)] bg-[var(--color-surface)]/40 backdrop-blur-xl shadow-md hover:shadow-xl hover:border-[var(--color-primary)]/30 group cursor-pointer overflow-hidden transition-all duration-500 ${isExpanded ? 'z-20' : 'z-10'}`}
            onClick={handleCardClick}
        >
            <div className="flex flex-col sm:flex-row">
                {/* User sidebar */}
                {author && rank && (
                    <div onClick={(e) => e.stopPropagation()}
                        className="w-full sm:w-[200px] shrink-0 border-b sm:border-b-0 sm:border-r border-[var(--color-card-border)] p-4 sm:p-5 bg-[var(--color-surface)] flex flex-row sm:flex-col items-center gap-4 sm:gap-3 text-left sm:text-center relative overflow-hidden cursor-default self-stretch">
                        <div className="absolute top-0 inset-x-0 h-1/2 opacity-10" style={{ background: `radial-gradient(circle at top, ${rank.color}, transparent)` }} />

                        <div className="flex flex-col sm:items-center flex-1 sm:flex-none z-10 min-w-0">
                            <span className="text-sm font-black text-[var(--color-text-main)] truncate w-full">{author.name}</span>

                            <div className="flex items-center sm:justify-center gap-1.5 font-bold text-[13px] sm:text-[16px] uppercase tracking-widest mt-1 w-full" style={{ color: rank.color }} title={(t.forum.ranks as Record<string, string>)[rank.name] || rank.name}>
                                <span className="truncate">{(t.forum.ranks as Record<string, string>)[rank.name] || rank.name}</span> 
                                <RankIcon name={rank.name} color={rank.color} className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                            </div>
                        </div>
                        <Image src={author.avatar} alt={author.name} width={96} height={96} className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl border-2 sm:border-4 object-cover shadow-2xl z-10 order-first sm:order-none" style={{ borderColor: rank.color }} title={author.name} unoptimized />

                        <div className="hidden sm:block w-full mt-4 relative z-10 px-2">
                            <XPBar
                                progress={rank.progress}
                                color={rank.color}
                                label={`${author.xp} ${t.forum.header.points.xp}`}
                                size="md"
                            />
                        </div>

                        <UserStats
                            posts={author.posts}
                            replies={author.replies}
                            likes={author.likes}
                            dislikes={author.dislikes}
                            ranking={sortedUsers.findIndex(u => u.id === author.id) + 1}
                            layout="vertical"
                            titles={{
                                topics: (t.forum.sidebar as Record<string, string>).topics,
                                replies: (t.forum.sidebar as Record<string, string>).replies,
                                likes: (t.forum.sidebar as Record<string, string>).likes,
                                dislikes: (t.forum.sidebar as Record<string, string>).dislikes,
                                ranking: (t.forum.sidebar as Record<string, string>).ranking,
                            }}
                        />
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 p-6 flex flex-col min-w-0">
                    <h3 className="text-[24px] font-bold text-[var(--color-text-main)] mb-2 group-hover:text-[var(--color-primary)] transition-colors line-clamp-2">
                        <HighlightText text={post.title || ''} query={searchQuery} />
                    </h3>
                    <CodeHighlighter 
                        className={`rich-text-content forum-content text-[14px] text-[var(--color-text-muted)] leading-relaxed mb-6 select-text cursor-pointer ${isExpanded ? '' : 'line-clamp-3'}`}
                        html={applyMarkdownToHtml(post.content || '')}
                    />

                    {/* Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[var(--color-card-border)] mt-auto">
                        <div className={`flex min-w-0 ${columns === 1 ? 'flex-row items-center gap-4' : 'flex-col-reverse items-start gap-1.5'}`}>
                            <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] opacity-80 shrink-0" title={t.forum.post.date}>
                                <Clock className="w-3.5 h-3.5" />
                                {new Date(post.date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] font-medium shrink-0">
                                <span className="flex items-center gap-1.5 shrink-0" title={t.forum.post.views}><Eye className="w-3.5 h-3.5" />{post.views}</span>
                                <span className="flex items-center gap-1.5 shrink-0" title={t.forum.post.replies}><MessageSquare className="w-3.5 h-3.5" />{post.replies.length}</span>
                                <StatButton
                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); toggleLikePost(post.id); }}
                                    title={t.forum.post.like}
                                    icon={<Heart className={`w-3.5 h-3.5 ${likedPosts.has(post.id) ? 'fill-red-500' : ''}`} />}
                                    count={getPostLikes(post)}
                                    isActive={likedPosts.has(post.id)}
                                />
                                <StatButton
                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); toggleDislikePost(post.id); }}
                                    title={t.forum.post.dislike}
                                    icon={<ArrowUp className={`w-3.5 h-3.5 rotate-180 ${dislikedPosts.has(post.id) ? 'fill-red-500' : ''}`} />}
                                    count={getPostDislikes(post)}
                                    isActive={dislikedPosts.has(post.id)}
                                />
                            </div>
                        </div>

                         <div className="flex items-center gap-2 flex-wrap justify-end shrink-0 ml-auto max-w-full">
                            {isExpanded && post.replies.length > 0 && (
                                <ReplyFilterWidget
                                    authorId={post.authorId}
                                    post={post}
                                    uniqueFilterId={`root-${post.id}`}
                                    specificReplies={specificReplies}
                                    repliersToAuthor={repliersToAuthor}
                                />
                            )}
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border whitespace-nowrap transition-all duration-200 ${tagColor[displayTag] || tagColor['General']}`} title={displayTag}>
                                {(t.forum.tags as Record<string, string>)[displayTag] || displayTag}
                            </span>

                            <Button
                                title={t.forum.post.reply}
                                variant="secondary"
                                size="sm"
                                className="!text-[10px] !tracking-wider"
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setReplyingToAuthorId(post.authorId); 
                                    setReplyingToPost({ 
                                        postId: post.id,
                                        authorId: post.authorId, 
                                        content: post.content || '', 
                                        date: post.date, 
                                        title: post.title,
                                        messageId: post.id // Explicitly link to root post
                                    });
                                    setShowPublishModal(true); 
                                }}
                            >
                                {t.forum.post.reply}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
            {/* Inline expand integrated inside the card container */}
            <AnimatePresence>{isExpanded && !readingMode && renderInlineExpanded()}</AnimatePresence>
        </motion.div>
    );
}
