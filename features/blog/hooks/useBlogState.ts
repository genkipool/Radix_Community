import { useState, useEffect, useRef } from 'react';
import { useSpeedSyncURL } from '@/hooks/useSpeedSyncURL';
import { BlogPost } from '../types';
import { filterPosts } from '../utils/blogUtils';

export function useBlogState(initialPosts: BlogPost[], localizedPosts: BlogPost[]) {
    // URL-synced state
    const [activeTag, setActiveTag] = useSpeedSyncURL<string>('tag');
    const [selectedPostId, setSelectedPostId] = useSpeedSyncURL<string>('post');

    const selectedPost = selectedPostId 
        ? localizedPosts.find(p => p.id.toString() === selectedPostId) ?? null 
        : null;

    const [columns, setColumns] = useState(3);
    const [visibleCount, setVisibleCount] = useState(9);
    const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [sortMode, setSortMode] = useState<'newest' | 'oldest' | 'date' | 'random'>('newest');
    const [readingMode, setReadingMode] = useState(true);
    const [autoCollapse, setAutoCollapse] = useState(false);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
    const [expandedPosts, setExpandedPosts] = useState<Set<number>>(new Set());
    const [direction, setDirection] = useState(0);

    // Mobile detection: force 1 column on small screens
    useEffect(() => {
        const checkMobile = () => {
            if (window.innerWidth < 640) setColumns(1);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    // Infinite scroll
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;
        const observer = new IntersectionObserver(
            (entries) => { if (entries[0].isIntersecting) setVisibleCount(prev => prev + 6); },
            { rootMargin: '200px' }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [activeTag]);

    useEffect(() => { setVisibleCount(9); }, [activeTag]);

    const filtered = filterPosts(localizedPosts, activeTag, searchQuery, dateRange, sortMode);

    const displayedPosts = filtered.slice(0, visibleCount);
    const hasMore = visibleCount < filtered.length;

    // Navigation
    const currentIndex = selectedPost ? filtered.findIndex(p => p.id === selectedPost.id) : -1;
    const prevPost = currentIndex > 0 ? filtered[currentIndex - 1] : null;
    const nextPost = currentIndex >= 0 && currentIndex < filtered.length - 1 ? filtered[currentIndex + 1] : null;

    const toggleLike = (postId: number) => {
        setLikedPosts(prev => {
            const n = new Set(prev);
            if (n.has(postId)) n.delete(postId); else n.add(postId);
            return n;
        });
    };

    const toggleAllPosts = () => {
        if (expandedPosts.size < filtered.length) {
            setExpandedPosts(new Set(filtered.map(p => p.id)));
        } else {
            setExpandedPosts(new Set());
        }
    };

    return {
        activeTag, setActiveTag,
        selectedPostId, setSelectedPostId,
        selectedPost,
        columns, setColumns,
        visibleCount, setVisibleCount,
        likedPosts, setLikedPosts,
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
        currentIndex,
        direction,
        setDirection,
        toggleLike,
        toggleAllPosts
    };
}
