'use client';
import { useLanguage } from '@/context/LanguageContext';
import { useState } from 'react';
import { ContentHero } from '@/components/layout/ContentHero';
import { AnimatePresence } from 'motion/react';

import type { BlogClientProps, BlogDictionary } from './types';
import { useBlogState } from './hooks/useBlogState';
import { useBlogSpeech } from './hooks/useBlogSpeech';
import { BlogControls } from './components/BlogControls';
import { BlogGrid } from './components/BlogGrid';
import { BlogOverlay } from './components/BlogOverlay';
import { BlogPublishModal } from './components/BlogPublishModal';

export default function Blog({ initialPosts = [] }: BlogClientProps) {
  const { language, t: dict } = useLanguage();
  const [showPublishModal, setShowPublishModal] = useState(false);
  const blogT = dict.blog as BlogDictionary;
  const es = language === 'es';

  // State & Logic extracted to hooks
  const {
    activeTag, setActiveTag,
    selectedPost,
    columns, setColumns,
    likedPosts,
    searchQuery, setSearchQuery,
    sortMode, setSortMode,
    readingMode, setReadingMode,
    autoCollapse, setAutoCollapse,
    calendarOpen, setCalendarOpen,
    dateRange, setDateRange,
    expandedPosts, setExpandedPosts,
    sentinelRef,
    filtered,
    displayedPosts,
    hasMore,
    nextPost,
    prevPost,
    toggleLike,
    toggleAllPosts,
    setSelectedPostId,
    direction,
    setDirection,
    customTagValue,
    setCustomTagValue,
    allPosts,
    addPost
  } = useBlogState(initialPosts, blogT?.posts || []);


  const { isSpeaking, stopSpeech, toggleSpeech } = useBlogSpeech(es);

  // Handlers
  const handleClose = () => { stopSpeech(); setSelectedPostId(null); };

  const handleExpandPost = (postId: number) => {
    if (readingMode) {
      setSelectedPostId(postId.toString());
    } else {
      setExpandedPosts(prev => {
        const next = new Set(prev);
        const isOpening = !next.has(postId);
        if (isOpening) {
          if (autoCollapse) next.clear();
          next.add(postId);
        } else {
          next.delete(postId);
        }
        return next;
      });
    }
  };

  const getLikes = (post: { likes: number; id: number }) => post.likes + (likedPosts.has(post.id) ? 1 : 0);

  const goToPrev = () => { if (prevPost) { setDirection(-1); stopSpeech(); setSelectedPostId(prevPost.id.toString()); } };
  const goToNext = () => { if (nextPost) { setDirection(1); stopSpeech(); setSelectedPostId(nextPost.id.toString()); } };

  // All unique tags for the filter
  const allTags = Array.from(new Set((allPosts || []).flatMap(p => p.tags)));

  return (
    <ContentHero
      title={blogT.title.split(' ')[1] || 'Blog'}
      subtitle={blogT.subtitle}
    >
      <BlogControls
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortMode={sortMode}
        onSortChange={setSortMode}
        readingMode={readingMode}
        onReadingModeChange={setReadingMode}
        expandedCount={expandedPosts.size}
        filteredCount={filtered.length}
        onToggleAll={toggleAllPosts}
        autoCollapse={autoCollapse}
        onAutoCollapseChange={setAutoCollapse}
        calendarOpen={calendarOpen}
        onCalendarOpenChange={setCalendarOpen}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onResetRange={() => { setDateRange({ start: null, end: null }); setCalendarOpen(false); }}
        allTags={allTags}
        activeTag={activeTag}
        onTagSelect={setActiveTag}
        columns={columns}
        onColumnsChange={setColumns}
        blogT={blogT}
        onPublishClick={() => setShowPublishModal(true)}
      />

      <BlogGrid
        displayedPosts={displayedPosts}
        columns={columns}
        activeTag={activeTag}
        searchQuery={searchQuery}
        expandedPosts={expandedPosts}
        likedPosts={likedPosts}
        readingMode={readingMode}
        selectedPostId={selectedPost?.id ?? null}
        language={language}
        blogT={blogT}
        onExpand={handleExpandPost}
        onToggleLike={toggleLike}
        getLikes={getLikes}
        hasMore={hasMore}
        sentinelRef={sentinelRef}
      />

      <AnimatePresence>
        {selectedPost && (
          <BlogOverlay
            key="blog-overlay"
            post={selectedPost}
            onClose={handleClose}
            prevPost={prevPost}
            nextPost={nextPost}
            onGoToPrev={goToPrev}
            onGoToNext={goToNext}
            onToggleLike={toggleLike}
            likedPosts={likedPosts}
            getLikes={getLikes}
            isSpeaking={isSpeaking}
            onToggleSpeech={toggleSpeech}
            language={language}
            blogT={blogT}
            searchQuery={searchQuery}
            direction={direction}
            setDirection={setDirection}
          />
        )}

        <BlogPublishModal
          isOpen={showPublishModal}
          onClose={() => setShowPublishModal(false)}
          t={dict}
          customTagValue={customTagValue}
          setCustomTagValue={setCustomTagValue}
          addPost={addPost}
        />
      </AnimatePresence>
    </ContentHero>
  );
}
