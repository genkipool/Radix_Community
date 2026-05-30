'use client';

import React, { useState } from 'react';
import { AnimatePresence, m } from "motion/react";
import {
    MessageSquarePlus, FileText, MessageSquare, Filter, Wallet
} from 'lucide-react';
import { useForum } from './ForumContext';
import { FORUM_TAGS } from '../data/forumData';
import { RichTextEditor } from '@/components/ui/RichTextEditor/RichTextEditor';
import { CodeHighlighter } from '@/components/ui/CodeHighlighter';
import { applyMarkdownToHtml } from '@/features/docs/utils/markdownParser';
import { LabelBadge } from '@/components/ui/LabelBadge';
import { PublishModalLayout } from '@/components/layout/PublishModalLayout';

export function ForumPublishModal() {
    const {
        t, showPublishModal, setShowPublishModal,
        replyingToAuthorId, replyingToPost, setReplyingToPost,
        users, addPost, addReply, customTagValue, setCustomTagValue
    } = useForum();
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [publishTag, setPublishTag] = useState<string | null>(FORUM_TAGS[0]);
    const [showOriginalContent, setShowOriginalContent] = useState(false);
    const [isEditingCustom, setIsEditingCustom] = useState(false);
    const longPressTimer = React.useRef<NodeJS.Timeout | null>(null);

    const handleLongPress = () => {
        setPublishTag(null);
    };

    const startLongPress = () => {
        longPressTimer.current = setTimeout(handleLongPress, 500);
    };

    const clearLongPress = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const isReply = !!replyingToPost;

    const onClose = () => {
        setTitle('');
        setMessage('');
        setPublishTag(FORUM_TAGS[0]);
        setShowOriginalContent(false);
        setReplyingToPost(null);
        setShowPublishModal(false);
    };

    const handleSubmit = () => {
        if (!message.trim() || message.length > 2000) return;
        if (!isReply && !title.trim()) return;

        if (isReply && replyingToPost) {
            addReply(replyingToPost.postId, {
                authorId: 'dev_alex',
                content: message.trim(),
                replyTo: users[replyingToPost.authorId]?.name,
                replyToId: replyingToPost.messageId,
                replyToContent: replyingToPost.content
            });
        } else {
            addPost({
                authorId: 'dev_alex',
                title: title.trim(),
                content: message.trim(),
                tags: [publishTag === 'Custom' ? customTagValue : (publishTag || 'General')],
            });
        }

        onClose();
    };

    const canPublish = message.trim().length > 0 && (isReply || title.trim().length > 0);

    const initialUsers = users || {};
    const authorName = initialUsers[replyingToAuthorId || '']?.name || '';

    return (
        <PublishModalLayout
            isOpen={showPublishModal}
            onClose={onClose}
            onSubmit={handleSubmit}
            title={isReply ? t.forum.modal.reply_title.replace('{{name}}', authorName) : t.forum.modal.new_post_title}
            subtitle={t.forum.modal.subtitle}
            icon={<MessageSquarePlus className="size-6" />}
            isPublishing={false}
            canPublish={canPublish}
            publishLabel={isReply ? (t.forum.modal.send || 'Enviar') : t.forum.modal.publish}
            disclaimer={t.forum.modal.beta_disclaimer}
            footerExtra={
                <div className="p-6 rounded-2xl bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-accent)]/5 border border-[var(--color-primary)]/20 shadow-inner">
                    <div className="flex items-start gap-5">
                        <div className="size-12 rounded-2xl bg-white/10 flex items-center justify-center text-[var(--color-primary)] shrink-0 border border-white/20 shadow-lg">
                            <Wallet className="size-6" />
                        </div>
                        <div className="flex-1 space-y-1.5">
                            <p className="text-sm font-black text-[var(--color-text-main)] uppercase tracking-wider">
                                {t.forum.modal.reward_title}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                                {t.forum.modal.reward_desc}
                            </p>
                        </div>
                    </div>
                </div>
            }
        >
            <div className="space-y-8">
                {isReply && replyingToPost ? (
                    <div className="space-y-4 p-5 rounded-2xl bg-[var(--color-bg)]/30 border border-[var(--color-card-border)] relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-primary)]">
                                    {t.forum.post.in_reply_to}:
                                </span>
                            </div>
                            <h4 className="text-xl font-bold text-[var(--color-text-main)] mb-3">
                                {replyingToPost.title || 'Post sin título'}
                            </h4>
                            <button aria-label="button action"
                                type="button"
                                onClick={() => setShowOriginalContent(!showOriginalContent)}
                                className="text-[11px] font-bold text-[var(--color-primary)] hover:underline flex items-center gap-2 mb-2"
                            >
                                {showOriginalContent ? t.forum.modal.hide_original : t.forum.modal.view_original}
                            </button>
                            <AnimatePresence>
                                {showOriginalContent && (
                                    <m.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <CodeHighlighter
                                            className="rich-text-content forum-content text-sm text-[var(--color-text-muted)] p-4 rounded-xl bg-[var(--color-bg)]/50 border border-[var(--color-card-border)] max-h-[100px] overflow-y-auto custom-scrollbar leading-relaxed"
                                            html={applyMarkdownToHtml(replyingToPost.content || '')}
                                        />
                                    </m.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label htmlFor="forum-title" className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] flex items-center gap-3">
                                <FileText className="size-4 text-[var(--color-primary)]" />
                                {t.forum.modal.title_label}
                            </label>
                            <span className={`text-[10px] font-bold ${title.length > 60 ? 'text-red-500' : 'text-[var(--color-text-muted)]'}`}>
                                {title.length} / 70
                            </span>
                        </div>
                        <input
                            type="text"
                            id="forum-title"
                            maxLength={70}
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder={t.forum.modal.title_placeholder}
                            className="w-full px-6 py-4 rounded-2xl border-2 border-[var(--color-card-border)] bg-[var(--color-bg)]/50 text-[var(--color-text-main)] text-base focus:outline-none focus:border-[var(--color-primary)]/50 transition-all placeholder:text-[var(--color-text-muted)]/40 shadow-inner"
                        />
                    </div>
                )}

                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] flex items-center gap-3">
                            <MessageSquare className="size-4 text-[var(--color-primary)]" />
                            {t.forum.modal.message_label}
                        </label>
                        <span className={`text-[10px] font-bold ${message.length > 1900 ? 'text-red-500' : 'text-[var(--color-text-muted)]'}`}>
                            {message.length} / 2000
                        </span>
                    </div>
                    <RichTextEditor
                        value={message}
                        onChange={setMessage}
                        placeholder={t.forum.modal.message_placeholder}
                        t={t.docs.editor}
                        toolbarPosition="top"
                        minHeight="240px"
                        maxHeight="240px"
                        maxLength={2000}
                        disallowImages={true}
                    />
                </div>

                {!isReply && (
                    <div className="space-y-4">
                        <label className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] flex items-center gap-3">
                            <Filter className="size-4 text-[var(--color-primary)]" />
                            {t.forum.modal.tag_label}
                        </label>
                        <div className="flex flex-row gap-2 overflow-x-auto custom-scrollbar pb-1">
                            {FORUM_TAGS.map(tag => {
                                const isSelected = publishTag === tag;
                                return (
                                    <LabelBadge
                                        key={tag}
                                        value={(t.forum.tags as Record<string, string>)[tag] || tag}
                                        onClick={() => {
                                            setPublishTag(tag);
                                            setIsEditingCustom(false);
                                        }}
                                        bgClass={isSelected
                                            ? 'bg-[var(--color-primary)] border-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/20'
                                            : 'bg-[var(--color-bg-alt)] border-[var(--color-border)] shadow-sm'}
                                        colorClass={isSelected ? 'text-white' : 'text-[var(--color-text-main)]'}
                                        className="justify-center !py-2.5"
                                    />
                                );
                            })}
                            {/* Custom Tag Pill */}
                            <div
                                className="relative flex shrink-0"
                                onMouseDown={publishTag === 'Custom' ? startLongPress : undefined}
                                onMouseUp={clearLongPress}
                                onMouseLeave={clearLongPress}
                                onTouchStart={publishTag === 'Custom' ? startLongPress : undefined}
                                onTouchEnd={clearLongPress}
                            >
                                {isEditingCustom ? (
                                    <div className="inline-flex items-center px-4 py-2 rounded-full border border-[var(--color-primary)] bg-[var(--color-bg-alt)] shadow-lg shadow-[var(--color-primary)]/10">
                                        <input
                                            className="bg-transparent border-none outline-none text-[9px] uppercase font-bold tracking-wider text-[var(--color-text-main)] w-[100px]"
                                            value={customTagValue}
                                            onChange={(e) => setCustomTagValue(e.target.value.slice(0, 16))}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    setIsEditingCustom(false);
                                                    if (customTagValue.trim()) setPublishTag('Custom');
                                                }
                                            }}
                                            onBlur={() => {
                                                setIsEditingCustom(false);
                                                if (customTagValue.trim()) setPublishTag('Custom');
                                            }}
                                            maxLength={16}
                                            placeholder={(t.forum.tags as Record<string, string>).Custom}
                                        />
                                    </div>
                                ) : (
                                    <LabelBadge
                                        value={customTagValue || (t.forum.tags as Record<string, string>).Custom}
                                        onClick={() => {
                                            setIsEditingCustom(true);
                                        }}
                                        bgClass={publishTag === 'Custom'
                                            ? 'bg-[var(--color-primary)] border-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/20'
                                            : 'bg-[var(--color-bg-alt)] border-[var(--color-border)] shadow-sm'}
                                        colorClass={publishTag === 'Custom' ? 'text-white' : 'text-[var(--color-text-main)]'}
                                        className="justify-center !py-2.5 min-w-[100px]"
                                        title="Mantén pulsado para deseleccionar"
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PublishModalLayout>
    );
}
