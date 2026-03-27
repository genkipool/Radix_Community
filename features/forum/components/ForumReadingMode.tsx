'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    X, ChevronLeft, ChevronRight, Calendar, Eye, MessageSquare 
} from 'lucide-react';
import { useForum } from './ForumContext';
import { ForumMessage } from './ForumMessage';
import { getReplyChildrenMap } from '../utils/replyTree';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { Button } from '@/components/ui/Button';
import { tagColor } from '@/constants/tagColors';

export function ForumReadingMode() {
    const { 
        t, language, readingMode, expandedPost, closeExpanded,
        handleExpandPost, filteredPosts,
        likedPosts, dislikedPosts, toggleLikePost, toggleDislikePost,
        toggleLikeReply, toggleDislikeReply,
        likedReplies, dislikedReplies,
        getPostLikes, getPostDislikes,
        getReplyLikes, getReplyDislikes,
        replyFilterUser, replyFilterPivotId, users
    } = useForum();

    if (!readingMode || !expandedPost) return null;

    const currentIdx = filteredPosts.findIndex(p => p.id === expandedPost.id);
    const prevPost = currentIdx > 0 ? filteredPosts[currentIdx - 1] : null;
    const nextPost = currentIdx < filteredPosts.length - 1 ? filteredPosts[currentIdx + 1] : null;

    return (
        <AnimatePresence>
            <ModalOverlay key="reading-mode-overlay" onClose={closeExpanded} blur="sm" />
            <motion.div 
                key="reading-mode-content"
                initial={{ opacity: 0, scale: 0.95, y: 40 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95, y: 40 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="fixed inset-0 z-[120] flex items-start justify-center pt-6 pb-6 px-4 overflow-y-auto" 
                onClick={closeExpanded}
            >
                <div 
                    className="w-full max-w-4xl rounded-3xl bg-[var(--color-surface)] border border-[var(--color-card-border)] shadow-2xl my-auto flex flex-col relative overflow-hidden" 
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-start gap-6 p-8 pb-6 border-b border-[var(--color-card-border)] bg-[var(--color-surface)]">
                        <div className="flex-1 min-w-0">
                            <h2 className="text-2xl md:text-3xl font-black text-[var(--color-text-main)] leading-tight mb-4 tracking-tight">
                                {expandedPost.title}
                            </h2>
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => prevPost && handleExpandPost(prevPost.id)}
                                            disabled={!prevPost}
                                            className={`w-8 h-8 rounded-full transition-all ${prevPost ? 'text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10' : 'opacity-20'}`}
                                            title={t.forum.reading.previous_post}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => nextPost && handleExpandPost(nextPost.id)}
                                            disabled={!nextPost}
                                            className={`w-8 h-8 rounded-full transition-all ${nextPost ? 'text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10' : 'opacity-20'}`}
                                            title={t.forum.reading.next_post}
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <span className="flex items-center gap-1.5" title={t.forum.post.date}>
                                        <Calendar className="w-3.5 h-3.5" />
                                        {new Date(expandedPost.date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                                    </span>
                                    <span className="flex items-center gap-1.5" title={t.forum.post.views}>
                                        <Eye className="w-3.5 h-3.5" />
                                        {expandedPost.views}
                                    </span>
                                    <span className="flex items-center gap-1.5" title={t.forum.post.replies}>
                                        <MessageSquare className="w-3.5 h-3.5" />
                                        {expandedPost.replies.length}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {expandedPost.tags.map(tag => (
                                        <span key={tag} className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${(tagColor as Record<string, string>)[tag] || (tagColor as Record<string, string>)['General']} bg-[var(--color-surface)] shadow-sm`}>
                                            {(t.forum.tags as Record<string, string>)[tag] || tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={closeExpanded}
                            className="w-10 h-10 rounded-full hover:bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-red-500 transition-all border border-transparent hover:border-red-500/20"
                            title={t.forum.reading.close}
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Messages Body */}
                    <div className="p-8 pt-0 space-y-6 overflow-y-auto custom-scrollbar">
                        <div className="py-8">
                            <ForumMessage
                                authorId={expandedPost.authorId}
                                content={expandedPost.content || ''}
                                date={expandedPost.date}
                                likes={getPostLikes(expandedPost)}
                                liked={likedPosts.has(expandedPost.id)}
                                onLike={() => toggleLikePost(expandedPost.id)}
                                dislikes={getPostDislikes(expandedPost)}
                                disliked={dislikedPosts.has(expandedPost.id)}
                                onDislike={() => toggleDislikePost(expandedPost.id)}
                                post={expandedPost}
                                messageId={expandedPost.id.toString()}
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-4 pb-4">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--color-card-border)] to-transparent" />
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)] px-4">
                                    {t.forum.post.replies}
                                </span>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--color-card-border)] to-transparent" />
                            </div>

                            <div className="space-y-6">
                                {(() => {
                                    const pivotId = replyFilterPivotId;
                                    const pivotUser = replyFilterUser;

                                    // If no pivot is active, show all replies normally
                                    if (!pivotId) {
                                        return expandedPost.replies.map((reply) => (
                                            <div key={reply.id} className="relative pl-6 md:pl-10">
                                                <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-full bg-[var(--color-card-border)]/30" />
                                                <div className="absolute left-0 top-8 w-6 md:w-10 h-1.5 rounded-full bg-[var(--color-card-border)]/30" />
                                                <ForumMessage
                                                    authorId={reply.authorId}
                                                    content={reply.content || ''}
                                                    date={reply.date}
                                                    likes={getReplyLikes(expandedPost.id, reply)}
                                                    liked={likedReplies.has(`${expandedPost.id}-${reply.id}`)}
                                                    onLike={() => toggleLikeReply(expandedPost.id, reply.id)}
                                                    dislikes={getReplyDislikes(expandedPost.id, reply)}
                                                    disliked={dislikedReplies.has(`${expandedPost.id}-${reply.id}`)}
                                                    onDislike={() => toggleDislikeReply(expandedPost.id, reply.id)}
                                                    replyTo={reply.replyTo}
                                                    replyToContent={reply.replyToContent}
                                                    post={expandedPost}
                                                    isReply={true}
                                                    messageId={reply.id.toString()}
                                                />
                                            </div>
                                        ));
                                    }

                                    // We have a pivot. 
                                    const replies = expandedPost.replies;
                                    
                                    // 1. Find pivot message index
                                    // The pivot ID is in format "[authorId]-[messageId]"
                                    // If pivot is the original post, pivotId might start with "root-"
                                    const pivotMsgId = pivotId.split('-')[1];
                                    const isRootPivot = pivotId.startsWith('root-');
                                    const pivotIndex = isRootPivot ? -1 : replies.findIndex(r => r.id.toString() === pivotMsgId);

                                    // Pre-calculate childrenMap for consistent tree-based filtering
                                    const childrenMap = getReplyChildrenMap(expandedPost, users);
                                    const pivotParentId: number | 'root' = isRootPivot ? 'root' : Number(pivotMsgId);
                                    const pivotChildren = childrenMap.get(pivotParentId) || [];
                                    const pivotChildrenSet = new Set(pivotChildren.map(c => c.id));

                                    return replies.map((reply, idx) => {
                                        // Messages above or at pivot index are always shown
                                        if (idx <= pivotIndex) {
                                            return (
                                                <div key={reply.id} className="relative pl-6 md:pl-10">
                                                    <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-full bg-[var(--color-card-border)]/30" />
                                                    <div className="absolute left-0 top-8 w-6 md:w-10 h-1.5 rounded-full bg-[var(--color-card-border)]/30" />
                                                    <ForumMessage
                                                        authorId={reply.authorId}
                                                        content={reply.content || ''}
                                                        date={reply.date}
                                                        likes={getReplyLikes(expandedPost.id, reply)}
                                                        liked={likedReplies.has(`${expandedPost.id}-${reply.id}`)}
                                                        onLike={() => toggleLikeReply(expandedPost.id, reply.id)}
                                                        dislikes={getReplyDislikes(expandedPost.id, reply)}
                                                        disliked={dislikedReplies.has(`${expandedPost.id}-${reply.id}`)}
                                                        onDislike={() => toggleDislikeReply(expandedPost.id, reply.id)}
                                                        replyTo={reply.replyTo}
                                                        replyToContent={reply.replyToContent}
                                                        post={expandedPost}
                                                        isReply={true}
                                                        messageId={reply.id.toString()}
                                                    />
                                                </div>
                                            );
                                        }

                                        // Filter logic: Check if message is a direct child of the pivot in our tree
                                        const isDirectChild = pivotChildrenSet.has(reply.id);
                                        const matchesUser = !pivotUser || reply.authorId === pivotUser;

                                        if (matchesUser && isDirectChild) {
                                            return (
                                                <div key={reply.id} className="relative pl-6 md:pl-10">
                                                    <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-full bg-[var(--color-card-border)]/30" />
                                                    <div className="absolute left-0 top-8 w-6 md:w-10 h-1.5 rounded-full bg-[var(--color-card-border)]/30" />
                                                    <ForumMessage
                                                        authorId={reply.authorId}
                                                        content={reply.content || ''}
                                                        date={reply.date}
                                                        likes={getReplyLikes(expandedPost.id, reply)}
                                                        liked={likedReplies.has(`${expandedPost.id}-${reply.id}`)}
                                                        onLike={() => toggleLikeReply(expandedPost.id, reply.id)}
                                                        dislikes={getReplyDislikes(expandedPost.id, reply)}
                                                        disliked={dislikedReplies.has(`${expandedPost.id}-${reply.id}`)}
                                                        onDislike={() => toggleDislikeReply(expandedPost.id, reply.id)}
                                                        replyTo={reply.replyTo}
                                                        post={expandedPost}
                                                        isReply={true}
                                                        messageId={reply.id.toString()}
                                                    />
                                                </div>
                                            );
                                        }

                                        return null;
                                    });
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
