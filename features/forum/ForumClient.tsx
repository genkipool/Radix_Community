'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ForumClientProps } from './types';
import { ForumProvider, useForum } from './components/ForumContext';
import { ForumToolbar } from './components/ForumToolbar';
import { ForumPostCard } from './components/ForumPostCard';
import { ForumReadingMode } from './components/ForumReadingMode';
import { ForumPublishModal } from './components/ForumPublishModal';
import { ForumHeroWidgets } from './components/hero/ForumHeroWidgets';
import { ContentHero } from '@/components/layout/ContentHero';
import '@/components/ui/RichTextEditor/RichTextEditor.css';

function ForumContent() {
    const { 
        t, filteredPosts, columns, 
        showPublishModal, setShowUnderConstruction
    } = useForum();

    return (
        <ContentHero
            title={t.forum.header.title.replace('Radix ', '')}
            heroPadding="pt-32 pb-16"
            subtitle={
                <div className="flex flex-col gap-4">
                    <p className="text-base md:text-lg leading-relaxed max-w-3xl mx-auto" style={{ color: 'var(--color-text-muted)' }}>
                        {t.forum.header.description_p1}<br />{t.forum.header.description_p2}
                        <strong className="text-[var(--color-text-main)]"> {t.forum.header.badge_name}</strong>.
                        {' '}{t.forum.header.description_p3}
                    </p>
                    <p className="text-sm md:text-base" style={{ color: 'var(--color-text-muted)' }}>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setShowUnderConstruction(true);
                            }}
                            className="text-[var(--color-primary)] font-bold hover:text-[var(--color-accent)] transition-all mr-1"
                        >
                            {t.forum.header.wallet_connect}
                        </button>
                        {t.forum.header.wallet_desc}
                    </p>
                </div>
            }
            badge={{ text: t.forum.header.badge_name }}
            actions={<ForumHeroWidgets />}
        >
            <main className="min-h-screen bg-transparent pb-20 relative px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <ForumToolbar />

                    <div className={`grid gap-6 transition-all duration-500 ${columns === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-[1500px] mx-auto'}`}>
                        <AnimatePresence mode="popLayout">
                            {filteredPosts.map(post => (
                                <ForumPostCard key={post.id} post={post} />
                            ))}
                        </AnimatePresence>
                    </div>

                    {filteredPosts.length === 0 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 bg-[var(--color-surface)]/20 rounded-3xl border border-dashed border-[var(--color-card-border)] max-w-2xl mx-auto">
                            <p className="text-[var(--color-text-muted)] text-lg font-medium italic">
                                {t.forum.post.no_posts || "No matching posts found."}
                            </p>
                        </motion.div>
                    )}
                </div>

                <ForumReadingMode />

                {showPublishModal && (
                    <ForumPublishModal />
                )}
            </main>
        </ContentHero>
    );
}

export default function ForumClient(props: ForumClientProps) {
    return (
        <ForumProvider props={props}>
            <ForumContent />
        </ForumProvider>
    );
}
