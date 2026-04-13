'use client';
import { useLanguage } from '@/context/LanguageContext';
import { ContentHero } from '@/components/layout/ContentHero';

import type { BlogClientProps, BlogDictionary } from './types';
import { useBlogState } from './hooks/useBlogState';
import { useBlogSpeech } from './hooks/useBlogSpeech';
import { BlogControls } from './components/BlogControls';
import { BlogGrid } from './components/BlogGrid';
import { BlogOverlay } from './components/BlogOverlay';

export default function Blog({ initialPosts = [] }: BlogClientProps) {
  const { language, t: dict } = useLanguage();
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
    prevPost,
    nextPost,
    toggleLike,
    toggleAllPosts,
    setSelectedPostId
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

  const goToPrev = () => { if (prevPost) { stopSpeech(); setSelectedPostId(prevPost.id.toString()); } };
  const goToNext = () => { if (nextPost) { stopSpeech(); setSelectedPostId(nextPost.id.toString()); } };

  // All unique tags for the filter
  const allTags = Array.from(new Set((blogT?.posts || []).flatMap(p => p.tags)));

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
      />

      <BlogGrid
        displayedPosts={displayedPosts}
        columns={columns}
        activeTag={activeTag}
        searchQuery={searchQuery}
        expandedPosts={expandedPosts}
        likedPosts={likedPosts}
        readingMode={readingMode}
        language={language}
        blogT={blogT}
        onExpand={handleExpandPost}
        onToggleLike={toggleLike}
        getLikes={getLikes}
        hasMore={hasMore}
        sentinelRef={sentinelRef}
      />

      <BlogOverlay
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
      />
    </ContentHero>
  );
}
