'use client';

import React, { useState } from 'react';
import { FileText, MessageSquare, Tag, Wallet, Sparkles } from 'lucide-react';
import { RichTextEditor } from '@/components/ui/RichTextEditor/RichTextEditor';
import { LabelBadge } from '@/components/ui/LabelBadge';
import { PublishModalLayout } from '@/components/layout/PublishModalLayout';
import type { Dictionary } from '@/i18n';
import { BlogPost } from '../types';

interface BlogPublishModalProps {
    isOpen: boolean;
    onClose: () => void;
    t?: Partial<Dictionary>;
    customTagValue: string;
    setCustomTagValue: (val: string) => void;
    addPost: (post: Omit<BlogPost, 'id' | 'date'>) => void;
}

export function BlogPublishModal({ isOpen, onClose, t, customTagValue, setCustomTagValue, addPost }: BlogPublishModalProps) {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const blogTags = Object.keys(t?.blog?.tags || {}).filter(tag => tag !== 'Custom');
    const [selectedTag, setSelectedTag] = useState<string | null>(blogTags[0] || null);
    const [isEditingCustom, setIsEditingCustom] = useState(false);
    const longPressTimer = React.useRef<NodeJS.Timeout | null>(null);

    const handleLongPress = () => {
        setSelectedTag(null);
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

    const handleClose = () => {
        setTitle('');
        setMessage('');
        setSelectedTag(blogTags[0]);
        onClose();
    };

    const handleSubmit = () => {
        if (!title.trim() || !message.trim()) return;

        // Strip HTML tags to produce a clean plain-text summary
        const plainText = message.trim().replace(/<[^>]*>/g, '');

        // Add the post to the local state
        addPost({
            title: title.trim(),
            content: message.trim(),
            summary: plainText.slice(0, 150) + (plainText.length > 150 ? '...' : ''),
            tags: [selectedTag === 'Custom' ? customTagValue : (selectedTag || 'General')],
            author: 'Radix Community',
            image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2832&auto=format&fit=crop',
            likes: 0,
            views: 0
        });

        handleClose();
    };

    const canPublish = title.trim().length > 0 && message.trim().length > 0;

    return (
        <PublishModalLayout
            isOpen={isOpen}
            onClose={handleClose}
            onSubmit={handleSubmit}
            title={t?.blog?.modal?.new_post_title || 'New Post'}
            subtitle={t?.blog?.modal?.subtitle || ''}
            icon={<Sparkles className="w-6 h-6" />}
            isPublishing={false}
            canPublish={canPublish}
            publishLabel={t?.blog?.modal?.publish_btn || 'Publish'}
            disclaimer={t?.blog?.modal?.beta_disclaimer || ''}
            footerExtra={
                <div className="p-6 rounded-2xl bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-accent)]/5 border border-[var(--color-primary)]/20 shadow-inner">
                    <div className="flex items-start gap-5">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-[var(--color-primary)] shrink-0 border border-white/20 shadow-lg">
                            <Wallet className="w-6 h-6" />
                        </div>
                        <div className="flex-1 space-y-1.5">
                            <p className="text-sm font-black text-[var(--color-text-main)] uppercase tracking-wider">
                                {t?.blog?.modal?.reward_title}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                                {t?.blog?.modal?.reward_desc}
                            </p>
                        </div>
                    </div>
                </div>
            }
        >
            <div className="space-y-8">
                {/* Title */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] flex items-center gap-3">
                            <FileText className="w-4 h-4 text-[var(--color-primary)]" />
                            {t?.blog?.modal?.title_label}
                        </label>
                        <span className={`text-[10px] font-bold ${title.length > 60 ? 'text-red-500' : 'text-[var(--color-text-muted)]'}`}>
                            {title.length} / 70
                        </span>
                    </div>
                    <input
                        type="text"
                        autoFocus
                        maxLength={70}
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder={t?.blog?.modal?.title_placeholder}
                        className="w-full px-6 py-4 rounded-2xl border-2 border-[var(--color-card-border)] bg-[var(--color-bg)]/50 text-[var(--color-text-main)] text-base focus:outline-none focus:border-[var(--color-primary)]/50 transition-all placeholder:text-[var(--color-text-muted)]/40 shadow-inner"
                    />
                </div>

                {/* Content */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] flex items-center gap-3">
                            <MessageSquare className="w-4 h-4 text-[var(--color-primary)]" />
                            {t?.blog?.modal?.message_label}
                        </label>
                        <span className={`text-[10px] font-bold ${message.length > 4500 ? 'text-red-500' : 'text-[var(--color-text-muted)]'}`}>
                            {message.length} / 5000
                        </span>
                    </div>
                    <RichTextEditor
                        value={message}
                        onChange={setMessage}
                        placeholder={t?.blog?.modal?.message_placeholder}
                        t={t?.docs?.editor}
                        toolbarPosition="top"
                        minHeight="240px"
                        maxHeight="240px"
                        maxLength={5000}
                        disallowImages={true}
                    />
                </div>

                {/* Tags */}
                <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] flex items-center gap-3">
                        <Tag className="w-4 h-4 text-[var(--color-primary)]" />
                        {t?.blog?.modal?.tag_label}
                    </label>
                    <div className="flex flex-row gap-2 overflow-x-auto custom-scrollbar pb-1">
                        {blogTags.map(tag => {
                            const isSelected = selectedTag === tag;
                            return (
                                <LabelBadge
                                    key={tag}
                                    value={(t?.blog?.tags as Record<string, string>)?.[tag] || tag}
                                    onClick={() => {
                                        setSelectedTag(tag);
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
                            onMouseDown={selectedTag === 'Custom' ? startLongPress : undefined}
                            onMouseUp={clearLongPress}
                            onMouseLeave={clearLongPress}
                            onTouchStart={selectedTag === 'Custom' ? startLongPress : undefined}
                            onTouchEnd={clearLongPress}
                        >
                            {isEditingCustom ? (
                                <div className="inline-flex items-center px-4 py-2 rounded-full border border-[var(--color-primary)] bg-[var(--color-bg-alt)] shadow-lg shadow-[var(--color-primary)]/10">
                                    <input
                                        autoFocus
                                        className="bg-transparent border-none outline-none text-[9px] uppercase font-bold tracking-wider text-[var(--color-text-main)] w-[100px]"
                                        value={customTagValue}
                                        onChange={(e) => setCustomTagValue(e.target.value.slice(0, 16))}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                setIsEditingCustom(false);
                                                if (customTagValue.trim()) setSelectedTag('Custom');
                                            }
                                        }}
                                        onBlur={() => {
                                            setIsEditingCustom(false);
                                            if (customTagValue.trim()) setSelectedTag('Custom');
                                        }}
                                        maxLength={16}
                                        placeholder={t?.blog?.tags?.Custom || 'Custom'}
                                    />
                                </div>
                            ) : (
                                <LabelBadge
                                    value={customTagValue || t?.blog?.tags?.Custom || 'Custom'}
                                    onClick={() => {
                                        setIsEditingCustom(true);
                                    }}
                                    bgClass={selectedTag === 'Custom'
                                        ? 'bg-[var(--color-primary)] border-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/20'
                                        : 'bg-[var(--color-bg-alt)] border-[var(--color-border)] shadow-sm'}
                                    colorClass={selectedTag === 'Custom' ? 'text-white' : 'text-[var(--color-text-main)]'}
                                    className="justify-center !py-2.5 min-w-[100px]"
                                    title="Mantén pulsado para deseleccionar"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </PublishModalLayout>
    );
}
