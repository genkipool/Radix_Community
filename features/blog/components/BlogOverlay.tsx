'use client';
import Image from 'next/image';
import { motion } from 'motion/react';
import { Calendar, User, Eye, Heart, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CloseButton } from '@/components/ui/CloseButton';
import { FloatingNav } from '@/components/ui/FloatingNav';
import { PostContent } from '../PostContent';
import { tagColor, defaultTagColor } from '@/constants/tagColors';
import { BlogPost, BlogDictionary } from '../types';
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
    return (
        <>
            {/* Dark backdrop */}
            <motion.div
                key="blog-overlay-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/70 z-50"
                style={{ backdropFilter: 'blur(4px)' }}
            />

            <FloatingNav
                hasPrev={!!prevPost}
                hasNext={!!nextPost}
                onPrev={onGoToPrev}
                onNext={onGoToNext}
                prevLabel={blogT.previous || 'Anterior'}
                nextLabel={blogT.next || 'Siguiente'}
                className="hidden sm:flex"
            />

            {/* Scroll container — no animation on this, just positioning */}
            <div
                className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 px-4 overflow-y-auto pointer-events-none"
            >
                {/* Card shell — Swipeable navigation */}
                <SwipeableContainer
                    itemKey={post.id}
                    direction={direction}
                    setDirection={setDirection}
                    onPrev={prevPost ? onGoToPrev : undefined}
                    onNext={nextPost ? onGoToNext : undefined}
                    className="w-full max-w-3xl rounded-2xl bg-[var(--color-surface)] border border-[var(--color-card-border)] shadow-2xl overflow-hidden my-auto pointer-events-auto"
                >
                    {/* Header image */}
                    <div className="relative w-full h-48 md:h-64 overflow-hidden">
                        <Image src={post.image} alt={post.title} fill className="object-cover" sizes="100vw" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-surface)] via-transparent to-transparent" />
                        <CloseButton
                            onClose={onClose}
                            title={blogT.close || 'Cerrar'}
                            className="absolute top-4 right-4 z-10 !bg-black/40 hover:!bg-black/60 !border-white/10"
                            iconSize={20}
                        />
                    </div>

                    <motion.div
                        className="p-8 md:p-10"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, delay: 0.15 }}
                    >
                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-3 mb-4">
                            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]" title={blogT.calendar.title}>
                                <Calendar className="w-3 h-3" />
                                {new Date(post.date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                            {post.tags.map(tag => (
                                <span key={tag} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${tagColor[tag] || defaultTagColor}`}>
                                    {blogT.tags[tag as keyof typeof blogT.tags] || tag}
                                </span>
                            ))}
                            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]" title={blogT.author}>
                                <User className="w-3 h-3" />{post.author}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]" title={blogT.views}>
                                <Eye className="w-3.5 h-3.5" />
                                {post.views.toLocaleString()}
                            </span>
                            <Button
                                variant="primary"
                                size="sm"
                                className="ml-auto"
                                onClick={() => onToggleSpeech(`${post.title}. ${post.content}`)}
                                title={isSpeaking ? blogT.stop : blogT.listen}
                                leftIcon={isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                            >
                                {isSpeaking ? blogT.stop : blogT.listen}
                            </Button>
                        </div>

                        <h2 className="text-3xl md:text-4xl font-bold text-[var(--color-text-main)] mb-8 leading-tight">{post.title}</h2>
                        <div className="text-[var(--color-text-muted)] leading-relaxed text-[15px]">
                            <PostContent content={post.content} query={searchQuery} />
                        </div>

                        {/* Footer: author · date · like · tags */}
                        <div className="mt-10 pt-6 border-t border-[var(--color-card-border)]">
                            <div className="flex items-center justify-center gap-4">
                                <div className="flex flex-wrap items-center justify-center gap-3 flex-1 min-w-0">
                                    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]" title={blogT.author}><User className="w-3 h-3" />{post.author}</span>
                                    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]" title={blogT.calendar.title}><Calendar className="w-3 h-3" />{new Date(post.date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                    <button onClick={() => onToggleLike(post.id)} className={`inline-flex items-center gap-1.5 text-xs font-bold transition-colors ${likedPosts.has(post.id) ? 'text-red-400' : 'text-[var(--color-text-muted)] hover:text-red-400'}`} title={blogT.like}>
                                        <Heart className={`w-3.5 h-3.5 ${likedPosts.has(post.id) ? 'fill-red-400' : ''}`} />{getLikes(post)}
                                    </button>
                                    {post.tags.map(tag => (
                                        <span key={tag} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${tagColor[tag] || defaultTagColor}`}>
                                            {blogT.tags[tag as keyof typeof blogT.tags] || tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </SwipeableContainer>
            </div>
        </>
    );
}
