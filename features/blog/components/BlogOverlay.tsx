'use client';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, User, Eye, Heart, Volume2, VolumeX, ChevronLeft, ChevronRight } from 'lucide-react';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { Button } from '@/components/ui/Button';
import { PostContent } from '../PostContent';
import { tagColor, defaultTagColor } from '@/constants/tagColors';
import { BlogPost, BlogDictionary } from '../types';

interface BlogOverlayProps {
    post: BlogPost | null;
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
    searchQuery
}: BlogOverlayProps) {
    if (!post) return null;

    return (
        <AnimatePresence>
            <ModalOverlay key="blog-overlay-bg" onClose={onClose} blur="sm" />
            <motion.div
                key="blog-overlay-bg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 px-4 overflow-y-auto"
                onClick={onClose}
            >
                <motion.div 
                    layoutId={`post-${post.id}`}
                    className="w-full max-w-3xl rounded-2xl bg-[var(--color-surface)] border border-[var(--color-card-border)] shadow-2xl overflow-hidden my-auto" 
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header image */}
                    <div className="relative w-full h-48 overflow-hidden">
                        <Image src={post.image} alt={post.title} fill className="object-cover" sizes="100vw" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-surface)] via-transparent to-transparent" />
                        <Button
                            onClick={onClose}
                            variant="outline"
                            size="icon"
                            className="absolute top-4 right-4 !bg-black/40 hover:!bg-[var(--color-primary)] !text-white/70 hover:!text-white hover:scale-110"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    <div className="p-8 md:p-10">
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

                        {/* Footer: prev | author · date · like · tags | next */}
                        <div className="mt-10 pt-6 border-t border-[var(--color-card-border)]">
                            <div className="flex items-center justify-between gap-4">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onGoToPrev}
                                    disabled={!prevPost}
                                    title={prevPost ? prevPost.title : ''}
                                    className={`shrink-0 ${prevPost ? '!text-[var(--color-primary)] opacity-100' : 'opacity-20 cursor-default'}`}
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </Button>
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
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onGoToNext}
                                    disabled={!nextPost}
                                    title={nextPost ? nextPost.title : ''}
                                    className={`shrink-0 ${nextPost ? '!text-[var(--color-primary)] opacity-100' : 'opacity-20 cursor-default'}`}
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
