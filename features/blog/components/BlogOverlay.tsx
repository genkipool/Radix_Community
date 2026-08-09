'use client';
import React from 'react';
import Image from 'next/image';
import { motion } from "motion/react";
import { Calendar, User, Eye, Heart, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CloseButton } from '@/components/ui/CloseButton';
import { FloatingNav } from '@/components/ui/FloatingNav';
import { PostContent } from '../PostContent';
import { LabelBadge } from '@/components/ui/LabelBadge';
import { BlogPost } from '../types/data.types';
import { BlogDictionary } from '../types/i18n.types';
import { SwipeableContainer } from '@/components/ui/SwipeableContainer';

interface BlogOverlayProps {
    post: BlogPost;
    onClose: () => void;
    prevPost: BlogPost | null;
    nextPost: BlogPost | null;
    onGoToPrev: () => void;
    onGoToNext: () => void;
    onToggleLike: (id: number) => void;
    likedPosts: Set<number>;
    getLikes: (post: BlogPost) => number;
    isSpeaking: boolean;
    onToggleSpeech: (text: string) => void;
    language: string;
    blogT: BlogDictionary;
    searchQuery: string;
    direction: number;
    setDirection: (d: number) => void;
}

export function BlogOverlay({
    post,
    onClose,
    prevPost,
    nextPost,
    onGoToPrev,
    onGoToNext,
    onToggleLike,
    likedPosts,
    getLikes,
    isSpeaking,
    onToggleSpeech,
    language,
    blogT,
    searchQuery,
    direction,
    setDirection,
}: BlogOverlayProps) {
    // Track the stage of the morph animation to safely detach layout updates during navigation
    const [morphState, setMorphState] = React.useState<'opening' | 'open' | 'closing'>('opening');
    const initialPostId = post.id; // For the initial open animation

    // Restore smooth layout transition and specific layoutId before closing so it morphs back to the *current* card!
    const handleInternalClose = () => {
        setMorphState('closing');
        // Wait two frames so Framer Motion registers the new layoutId before unmounting
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                onClose();
            });
        });
    };

    let activeLayoutId: string | undefined;
    if (morphState === 'opening') {
        activeLayoutId = `post-${initialPostId}`;
    } else if (morphState === 'closing') {
        activeLayoutId = `post-${post.id}`;
    }

    /**
     * One post, rendered as the body of the modal. Used three times: for the post
     * being read and, while a finger is swiping, for the two neighbours that the
     * gesture uncovers.
     *
     * All three are drawn identically, down to the close button and with no
     * entrance fade of their own: a swipe hands over to a neighbour that is
     * already on screen, so anything the copies do differently would show up as
     * the content shifting or blinking the moment it lands.
     */
    const renderPost = (p: BlogPost) => {
        return (
            <>
                {/* Header image */}
                <div className="relative w-full h-48 md:h-64 overflow-hidden">
                    {/* Eager: a neighbour is off screen while the finger drags it
                        in, so a lazy image would only start loading once it had
                        already landed — the header would flash in under the
                        reader after the swipe finished. */}
                    <Image src={p.image} alt={p.title} fill className="object-cover" sizes="100vw" loading="eager" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-surface)] via-transparent to-transparent" />
                    <CloseButton
                        onClose={handleInternalClose}
                        title={blogT.close || 'Cerrar'}
                        className="absolute top-4 right-4 z-10 !bg-black/40 hover:!bg-black/60 !border-white/10"
                        iconSize={20}
                    />
                </div>

                <div className="p-8 md:p-10 touch-pan-y">
                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]" title={blogT.calendar.title}>
                            <Calendar className="size-3" />
                            {new Date(p.date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                        {p.tags.map(tag => (
                            <LabelBadge
                                key={tag}
                                value={blogT.tags[tag as keyof typeof blogT.tags] || tag}
                            />
                        ))}
                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]" title={blogT.author}>
                            <User className="size-3" />{p.author}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]" title={blogT.views}>
                            <Eye className="size-3.5" />
                            {p.views.toLocaleString()}
                        </span>
                        <Button
                            variant="primary"
                            size="sm"
                            className="ml-auto w-[110px] justify-center"
                            onClick={() => onToggleSpeech(`${p.title}. ${p.content}`)}
                            title={isSpeaking ? blogT.stop : blogT.listen}
                            leftIcon={isSpeaking ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                        >
                            {isSpeaking ? blogT.stop : blogT.listen}
                        </Button>
                    </div>

                    <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-text-main)] mb-8 leading-tight">{p.title}</h2>
                    <div className="text-[var(--color-text-muted)] leading-relaxed text-[15px]">
                        <PostContent content={p.content} query={searchQuery} />
                    </div>

                    {/* Footer: author · date · like · tags */}
                    <div className="mt-10 pt-6 border-t border-[var(--color-card-border)]">
                        <div className="flex items-center justify-center gap-4">
                            <div className="flex flex-wrap items-center justify-center gap-3 flex-1 min-w-0">
                                <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]" title={blogT.author}><User className="size-3" />{p.author}</span>
                                <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]" title={blogT.calendar.title}><Calendar className="size-3" />{new Date(p.date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                <button type="button" onClick={() => onToggleLike(p.id)} className={`inline-flex items-center gap-1.5 text-xs font-bold transition-colors ${likedPosts.has(p.id) ? 'text-red-400' : 'text-[var(--color-text-muted)] hover:text-red-400'}`} title={blogT.like}>
                                    <Heart className={`size-3.5 ${likedPosts.has(p.id) ? 'fill-red-400' : ''}`} />{getLikes(p)}
                                </button>
                                {p.tags.map(tag => (
                                    <LabelBadge
                                        key={tag}
                                        value={blogT.tags[tag as keyof typeof blogT.tags] || tag}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    };

    return (
        <>
            {/* Dark backdrop */}
            <motion.div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
                key="blog-overlay-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                onClick={handleInternalClose}
                className="fixed inset-0 bg-black/70 z-50"
                style={{ backdropFilter: 'blur(4px)' }}
            />

            <FloatingNav
                hasPrev={!!prevPost}
                hasNext={!!nextPost}
                onPrev={() => { setDirection(-1); onGoToPrev(); }}
                onNext={() => { setDirection(1); onGoToNext(); }}
                prevLabel={blogT.previous || 'Anterior'}
                nextLabel={blogT.next || 'Siguiente'}
                className="hidden sm:flex"
            />

            {/* Scroll container — no animation on this, just positioning */}
            <div role="presentation"
                className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 px-4 overflow-y-auto pointer-events-none cursor-auto"
                onClick={handleInternalClose}
                style={{ right: 'var(--sidebar-width, 0px)' }}
            >
                {/* Card shell — layoutId drives the shared element transition. Detached when 'open' to avoid flashes/diagonal leaks */}
                <motion.div
                    layoutId={activeLayoutId}
                    className="w-full max-w-3xl rounded-2xl bg-[var(--color-surface)] border border-[var(--color-card-border)] shadow-2xl overflow-hidden my-auto pointer-events-auto"
                    onClick={e => e.stopPropagation()}
                    transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                    onLayoutAnimationComplete={() => {
                        if (morphState === 'opening') setMorphState('open');
                    }}
                >
                    {/* Isolation wrapper — strictly clips exiting absolute card during popLayout */}
                    <div className="relative w-full overflow-hidden flex flex-col h-full bg-[var(--color-surface)]">
                        {/* Inner content — swipeable, only THIS slides on next/prev */}
                        <SwipeableContainer
                            itemKey={post.id}
                            direction={direction}
                            setDirection={setDirection}
                            onPrev={prevPost ? onGoToPrev : undefined}
                            onNext={nextPost ? onGoToNext : undefined}
                            prevContent={prevPost ? renderPost(prevPost) : null}
                            nextContent={nextPost ? renderPost(nextPost) : null}
                            className="flex flex-col min-h-0 bg-[var(--color-surface)]"
                        >
                            {renderPost(post)}
                        </SwipeableContainer>
                    </div>
                </motion.div>
            </div>
        </>
    );
}
