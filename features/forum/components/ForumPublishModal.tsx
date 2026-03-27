'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    X, MessageSquarePlus, FileText, MessageSquare, Filter, Wallet
} from 'lucide-react';
import { useForum } from './ForumContext';
import { FORUM_TAGS } from '../data/forumData';
import { tagColor } from '@/constants/tagColors';
import { Button } from '@/components/ui/Button';
import { RichTextEditor } from '@/components/ui/RichTextEditor/RichTextEditor';
import { CodeHighlighter } from '@/components/ui/CodeHighlighter';
import { applyMarkdownToHtml } from '@/features/docs/utils/markdownParser';

export function ForumPublishModal() {
    const {
        t, showPublishModal, setShowPublishModal,
        replyingToAuthorId, replyingToPost, setReplyingToPost,
        users, addPost, addReply
    } = useForum();
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [publishTag, setPublishTag] = useState(FORUM_TAGS[0]);
    const [showOriginalContent, setShowOriginalContent] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);

    const isReply = !!replyingToPost;

    // Helper function for closing the modal and resetting state
    const onClose = () => {
        setTitle('');
        setMessage('');
        setPublishTag(FORUM_TAGS[0]);
        setShowOriginalContent(false);
        setReplyingToPost(null); // Clear replyingToPost when modal closes
        setShowPublishModal(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!message.trim() || message.length > 2000) return;
        if (!isReply && !title.trim()) return; // Title is only required for new posts

        setIsPublishing(true);

        if (isReply && replyingToPost) {
            addReply(replyingToPost.postId, {
                authorId: 'dev_alex', // For demonstration, in real app it would be current user
                content: message.trim(),
                replyTo: users[replyingToPost.authorId]?.name,
                replyToId: replyingToPost.messageId,
                replyToContent: replyingToPost.content
            });
        } else {
            addPost({
                authorId: 'dev_alex', // Hardcoded for this simulation as requested "functional"
                title: title.trim(),
                content: message.trim(),
                tags: [publishTag], // Use publishTag for new posts
            });
        }

        // Simulate network request
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsPublishing(false);
        onClose();
    };

    if (!showPublishModal) return null;

    const initialUsers = users || {}; // Kept for existing usage in header

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/80 backdrop-blur-md transition-all duration-300"
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-[var(--color-surface)] border border-[var(--color-card-border)] shadow-2xl rounded-3xl overflow-hidden relative z-10"
                    onClick={e => e.stopPropagation()}
                >
                    <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
                        {/* Header */}
                        <div className="p-6 flex flex-col gap-1 relative overflow-hidden border-b border-[var(--color-card-border)] shrink-0">
                            <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)]/10 via-transparent to-[var(--color-accent)]/5 pointer-events-none" />
                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] flex items-center justify-center text-white shadow-xl">
                                        <MessageSquarePlus className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-[var(--color-text-main)] tracking-tight">
                                            {isReply && replyingToAuthorId
                                                ? t.forum.modal.reply_title.replace('{{name}}', (initialUsers as Record<string, { name: string }>)[replyingToAuthorId]?.name || '')
                                                : t.forum.modal.new_post_title}
                                        </h3>
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-primary)] opacity-80">
                                            {t.forum.modal.subtitle}
                                        </p>
                                    </div>
                                </div>
                                <button type="button" onClick={onClose}
                                    className="w-10 h-10 rounded-full hover:bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-all border border-transparent hover:border-[var(--color-card-border)]">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar flex-1">
                            <div className="grid gap-6">
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
                                            <button
                                                type="button"
                                                onClick={() => setShowOriginalContent(!showOriginalContent)}
                                                className="text-[11px] font-bold text-[var(--color-primary)] hover:underline flex items-center gap-2 mb-2"
                                            >
                                                {showOriginalContent ? t.forum.modal.hide_original : t.forum.modal.view_original}
                                            </button>
                                            <AnimatePresence>
                                                {showOriginalContent && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <CodeHighlighter
                                                            className="rich-text-content forum-content text-sm text-[var(--color-text-muted)] p-4 rounded-xl bg-[var(--color-bg)]/50 border border-[var(--color-card-border)] max-h-[100px] overflow-y-auto custom-scrollbar leading-relaxed"
                                                            html={applyMarkdownToHtml(replyingToPost.content || '')}
                                                        />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] flex items-center gap-3">
                                                <FileText className="w-4 h-4 text-[var(--color-primary)]" />
                                                {t.forum.modal.title_label}
                                            </label>
                                            <span className={`text-[10px] font-bold ${title.length > 80 ? 'text-red-500' : 'text-[var(--color-text-muted)]'}`}>
                                                {title.length} / 85
                                            </span>
                                        </div>
                                        <input
                                            type="text"
                                            autoFocus
                                            maxLength={85}
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                            placeholder={t.forum.modal.title_placeholder}
                                            className="w-full px-6 py-4 rounded-2xl border-2 border-[var(--color-card-border)] bg-[var(--color-bg)]/50 text-[var(--color-text-main)] text-base focus:outline-none focus:border-[var(--color-primary)]/50 transition-all placeholder:text-[var(--color-text-muted)]/40 shadow-inner" />
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] flex items-center gap-3">
                                            <MessageSquare className="w-4 h-4 text-[var(--color-primary)]" />
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
                            </div>
                            {/* Tags - Hidden for replies */}
                            {!isReply && (
                                <div className="space-y-4">
                                    <label className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] flex items-center gap-3">
                                        <Filter className="w-4 h-4 text-[var(--color-primary)]" />
                                        {t.forum.modal.tag_label}
                                    </label>
                                    <div className="p-1 rounded-2xl bg-[var(--color-bg)]/80 border border-[var(--color-card-border)] shadow-inner">
                                        <div className="flex w-full items-center justify-between gap-1 overflow-hidden">
                                            {FORUM_TAGS.map(tag => (
                                                <button key={tag} type="button" onClick={() => setPublishTag(tag)}
                                                    className={`flex-1 min-w-0 px-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-tighter border transition-all active:scale-95 text-center ${publishTag === tag
                                                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/20'
                                                        : `hover:border-[var(--color-primary)]/30 ${(tagColor as Record<string, string>)[tag] || (tagColor as Record<string, string>)['General']} bg-[var(--color-surface)] shadow-sm`}`}>
                                                    {(t.forum.tags as Record<string, string>)[tag] || tag}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="p-6 rounded-2xl bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-accent)]/5 border border-[var(--color-primary)]/20 shadow-inner">
                                <div className="flex items-start gap-5">
                                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-[var(--color-primary)] shrink-0 border border-white/20 shadow-lg">
                                        <Wallet className="w-6 h-6" />
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
                        </div>

                        <div className="p-8 pt-0 flex flex-col sm:flex-row justify-end gap-4 shrink-0 mt-auto relative z-10 border-t border-[var(--color-card-border)] bg-[var(--color-surface)]/50 pt-8">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onClose}
                                className="font-black uppercase tracking-widest text-[11px]"
                            >
                                {t.forum.modal.discard}
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                disabled={isPublishing || (!isReply && !title.trim()) || !message.trim() || message.length > 2000}
                                className="px-8 font-black uppercase tracking-widest text-[11px] shadow-xl disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
                            >
                                {isPublishing ? '...' : (isReply ? (t.forum.modal.send || 'Enviar') : t.forum.modal.publish)}
                            </Button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
