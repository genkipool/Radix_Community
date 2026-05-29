'use client';

import React from 'react';
import { Clock, Heart, ArrowUp, MessageSquare } from 'lucide-react';
import { useForum } from './ForumContext';
import { UserHeader } from './UserHeader';
import { ReplyFilterWidget } from './ReplyFilterWidget';
import { Button } from '@/components/ui/Button';
import { StatButton } from '@/components/ui/StatButton';
import { ForumPost, ForumReply } from '../types/data.types';
import { getReplyChildrenMap } from '../utils/replyTree';
import { CodeHighlighter } from '@/components/ui/CodeHighlighter';
import { applyMarkdownToHtml } from '@/features/docs/utils/markdownParser';
import { sanitizeText } from '@/utils/sanitize';

interface ForumMessageProps {
    authorId: string;
    content: string;
    date: string;
    likes: number;
    liked: boolean;
    onLike: () => void;
    dislikes: number;
    disliked: boolean;
    onDislike: () => void;
    replyTo?: string;
    replyToContent?: string;
    tags?: string[];
    post?: ForumPost;
    messageId?: string;
    isReply?: boolean; // Keep this in the interface as it's passed from parent
}

export function ForumMessage({
    authorId, content, date, likes, liked, onLike, dislikes, disliked, onDislike,
    replyTo, replyToContent, tags, post, messageId,
    isReply = false,
}: ForumMessageProps) {
    const {
        t, language, users,
        setReplyingToAuthorId, setReplyingToPost, setShowPublishModal,
    } = useForum();

    // Compute reply content (avoid IIFE in JSX)
    const replyContent = isReply ? (() => {
        if (replyToContent) return replyToContent;
        const currentMsgIndex = (post && messageId) ? post.replies.findIndex((r) => r.id.toString() === messageId) : -1;
        if (!post || currentMsgIndex < 0) return post ? (post.content || '') : '';
        const precedingReplies = post ? post.replies.slice(0, currentMsgIndex >= 0 ? currentMsgIndex : 0) : [];
        for (let i = precedingReplies.length - 1; i >= 0; i--) {
            if (users[precedingReplies[i].authorId]?.name === replyTo) {
                return precedingReplies[i].content || '';
            }
        }
        const rootAuthorName = users[post.authorId]?.name;
        if (rootAuthorName === replyTo || !replyTo) return post.content || '';
        return '';
    })() : '';

    // Build reply tree to find exact descendants
    const childrenMap = post ? getReplyChildrenMap(post, users) : new Map<number | 'root', ForumReply[]>();

    // For root post (not isReply), we want all top-level replies (replies to 'root')
    const specificReplies = post
        ? (isReply && messageId ? (childrenMap.get(Number(messageId)) || []) : (childrenMap.get('root') || []))
        : [];

    const repliersToAuthor = Array.from(new Set(specificReplies.map((r: ForumReply) => r.authorId))).flatMap(id => users[id] ? [users[id]] : []);

    const uniqueFilterId = isReply ? `${authorId}-${messageId}` : `root-${post?.id || 'root'}`;

    return (
        <div className={`rounded-xl border border-[var(--color-card-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)]/20 transition-colors cursor-pointer ${isReply ? 'mt-2' : ''}`}>
            {/* Header */}
            <div className={`px-4 bg-[var(--color-surface)] border-b border-[var(--color-card-border)] rounded-t-xl ${isReply ? 'py-4 sm:py-5' : 'py-2.5'} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
                <div className="flex items-center gap-4 flex-wrap">
                    <UserHeader authorId={authorId} hideBadge={true} />
                    {tags && (
                        <div className="flex gap-1.5 flex-wrap">
                            {tags.map(tag => (
                                <span key={tag} className="inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-[var(--color-card-border)] shadow-sm">
                                    {t.forum.tags[tag as keyof typeof t.forum.tags] || tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                {post && repliersToAuthor.length > 0 && (
                    <div className="flex justify-end sm:justify-start shrink-0">
                        <ReplyFilterWidget
                            authorId={authorId}
                            post={post}
                            uniqueFilterId={uniqueFilterId}
                            specificReplies={specificReplies}
                            repliersToAuthor={repliersToAuthor}
                        />
                    </div>
                )}
            </div>
            {/* Body */}
            <div className={`${isReply ? 'px-5 py-4 sm:py-5' : 'px-4 py-3'}`}>
                {isReply && (
                    <div className="mb-3 pl-3 border-l border-[var(--color-primary)]/50 bg-[var(--color-surface)]/30 rounded-r-lg py-2 pr-3">
                        <span className="flex items-center gap-1.5 text-[10px] text-[var(--color-primary)] font-bold mb-1">
                            <ArrowUp className="size-3" /> {t.forum.post.in_reply_to} @{replyTo || (post ? users[post.authorId]?.name : '')}
                        </span>
                        <div className="text-[12px] text-[var(--color-text-muted)]/70 line-clamp-1 italic">
                            {sanitizeText(applyMarkdownToHtml(replyContent))}
                        </div>
                    </div>
                )}
                <CodeHighlighter
                    className={`rich-text-content forum-content ${isReply ? 'text-[14px]' : 'text-[16px]'} text-[var(--color-text-muted)] leading-relaxed`}
                    html={applyMarkdownToHtml(content || '')}
                />
            </div>
            {/* Footer */}
            <div className="px-4 py-2 border-t border-[var(--color-card-border)] flex flex-wrap items-center justify-between gap-3 bg-[var(--color-surface)]/50 rounded-b-xl">
                <div className="flex flex-wrap-reverse items-center gap-x-4 gap-y-2 text-[10px] text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1.5 opacity-80" title={t.forum.post.date}><Clock className="size-3.5 opacity-60" />
                        {new Date(date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <div className="flex items-center gap-2">
                        <StatButton
                            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onLike(); }}
                            title={t.forum.post.like as string}
                            icon={<Heart className={`size-3.5 ${liked ? 'fill-red-500' : ''}`} />}
                            count={likes}
                            isActive={liked}
                        />
                        <StatButton
                            onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDislike(); }}
                            title={t.forum.post.dislike as string}
                            icon={<ArrowUp className={`size-3.5 rotate-180 ${disliked ? 'fill-red-500' : ''}`} />}
                            count={dislikes}
                            isActive={disliked}
                        />
                        {specificReplies.length > 0 && (
                            <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--color-primary)]/5 text-[var(--color-primary)] font-black" title={t.forum.post.replies as string}>
                                <MessageSquare className="size-3.5" />
                                {specificReplies.length}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {tags && (
                        <div className="flex gap-1.5 flex-wrap">
                            {tags.map(tag => (
                                <span key={tag} className="inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-[var(--color-card-border)] shadow-sm">
                                    {t.forum.tags[tag as keyof typeof t.forum.tags] || tag}
                                </span>
                            ))}
                        </div>
                    )}

                    <Button
                        title={t.forum.post.reply as string}
                        variant="secondary"
                        size="sm"
                        className="!text-[10px] !tracking-wider whitespace-nowrap"
                        onClick={(e) => {
                            e.stopPropagation();
                            setReplyingToAuthorId(authorId);
                            if (post) {
                                setReplyingToPost({
                                    postId: post.id,
                                    authorId,
                                    content,
                                    date,
                                    title: post.title,
                                    messageId: messageId ? Number(messageId) : undefined
                                });
                            }
                            setShowPublishModal(true);
                        }}
                    >
                        <span>{t.forum.post.reply}</span>
                    </Button>
                </div>
            </div>
        </div >
    );
}
