'use client';

import { useState, useEffect } from 'react';
import { ForumPost, ForumReply, ForumClientProps } from '../types';
import { useSpeedSyncURL } from '@/hooks/useSpeedSyncURL';

export function useForumState({ t, initialPosts, initialUsers }: ForumClientProps) {
    const [urlActiveTag, setActiveTag] = useSpeedSyncURL<string>('tag', 'General');
    const activeTag = urlActiveTag || 'General';
    const [searchQuery, setSearchQuery] = useState('');
    const [columns, setColumns] = useState(1);
    const [expandedPosts, setExpandedPosts] = useState<Set<number>>(new Set());
    const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());
    const [dislikedPosts, setDislikedPosts] = useState<Set<number>>(new Set());
    const [likedReplies, setLikedReplies] = useState<Set<string>>(new Set());
    const [dislikedReplies, setDislikedReplies] = useState<Set<string>>(new Set());
    const [sortMode, setSortMode] = useState<'newest' | 'oldest' | 'date' | 'random'>('newest');
    const [readingMode, setReadingMode] = useState(false);
    const [autoCollapse, setAutoCollapse] = useState(false);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [showUnderConstruction, setShowUnderConstruction] = useState(false);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
    const [replyingToAuthorId, setReplyingToAuthorId] = useState<string | null>(null);
    const [direction, setDirection] = useState(0);
    const [customTagValue, setCustomTagValue] = useState('');

    // Mobile detection: force 1 column on small screens
    useEffect(() => {
        const checkMobile = () => {
            if (typeof window !== 'undefined' && window.innerWidth < 640) setColumns(1);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    const [replyingToPost, setReplyingToPost] = useState<{
        postId: number;
        authorId: string;
        content: string;
        date: string;
        title?: string;
        messageId?: number;
    } | null>(null);
    const [replyFilterUser, setReplyFilterUser] = useState<string>('');
    const [replyFilterPivotId, setReplyFilterPivotId] = useState<string | null>(null);
    const [replyToFilter, setReplyToFilter] = useState<string>('');
    const [customPosts, setCustomPosts] = useState<ForumPost[]>([]);

    // Derived Data
    const [localizedPosts, setLocalizedPosts] = useState<ForumPost[]>([]);

    useEffect(() => {
        const postsContent = t.forum.posts_content as Record<string, { title: string; content: string; replies?: Record<string, string> }>;

        const formatContent = (text: string) => {
            if (!text) return '';
            // If it already looks like HTML (starts with < or has tags), return as is
            if (text.trim().startsWith('<') || /<[a-z][\s\S]*>/i.test(text)) return text;
            // Otherwise replace newlines with <br /> for dangerouslySetInnerHTML
            return text.replace(/\n/g, '<br />');
        };

        const newLocalizedPosts = initialPosts.map(post => {
            const content = postsContent[post.id];
            return {
                ...post,
                title: content?.title || '',
                content: formatContent(content?.content || ''),
                replies: post.replies.map((reply: ForumReply) => ({
                    ...reply,
                    content: formatContent(content?.replies?.[reply.id] || '')
                }))
            };
        });
        setLocalizedPosts(newLocalizedPosts);
    }, [initialPosts, t.forum.posts_content]);

    const allPosts = [...localizedPosts, ...customPosts];

    const filteredPosts = allPosts
        .filter(p => activeTag === 'General' || p.tags.includes(activeTag))
        .filter(p => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (p.title?.toLowerCase().includes(q) ?? false) ||
                (p.content?.toLowerCase().includes(q) ?? false) ||
                initialUsers[p.authorId]?.name.toLowerCase().includes(q);
        })
        .sort((a, b) => {
            if (sortMode === 'newest') return new Date(b.date.replace(/-/g, '/')).getTime() - new Date(a.date.replace(/-/g, '/')).getTime();
            if (sortMode === 'oldest') return new Date(a.date.replace(/-/g, '/')).getTime() - new Date(b.date.replace(/-/g, '/')).getTime();
            return 0; // For 'date' or 'random' or other modes, keep original order
        });

    const expandedPostId = expandedPosts.size > 0 ? Array.from(expandedPosts)[expandedPosts.size - 1] : null;
    const expandedPost = expandedPostId ? localizedPosts.find(p => p.id === expandedPostId) || null : null;

    // Handlers
    const toggleLikePost = (id: number) => {
        setLikedPosts(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else {
                next.add(id);
                setDislikedPosts(d => { const n = new Set(d); n.delete(id); return n; });
            }
            return next;
        });
    };

    const toggleDislikePost = (id: number) => {
        setDislikedPosts(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else {
                next.add(id);
                setLikedPosts(l => { const n = new Set(l); n.delete(id); return n; });
            }
            return next;
        });
    };

    const toggleLikeReply = (postId: number, replyId: number) => {
        const key = `${postId}-${replyId}`;
        setLikedReplies(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else {
                next.add(key);
                setDislikedReplies(d => { const n = new Set(d); n.delete(key); return n; });
            }
            return next;
        });
    };

    const toggleDislikeReply = (postId: number, replyId: number) => {
        const key = `${postId}-${replyId}`;
        setDislikedReplies(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else {
                next.add(key);
                setLikedReplies(l => { const n = new Set(l); n.delete(key); return n; });
            }
            return next;
        });
    };

    const handleExpandPost = (postId: number) => {
        if (readingMode) {
            setExpandedPosts(new Set([postId]));
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

    const toggleAllPosts = () => {
        if (expandedPosts.size < filteredPosts.length) {
            setExpandedPosts(new Set(filteredPosts.map(p => p.id)));
        } else {
            setExpandedPosts(new Set());
        }
    };

    const closeExpanded = () => {
        setExpandedPosts(new Set());
        // We might want to clear other modal-specific state here if needed
    };

    const getPostLikes = (p: ForumPost) => p.likes + (likedPosts.has(p.id) ? 1 : 0);
    const getPostDislikes = (p: ForumPost) => p.dislikes + (dislikedPosts.has(p.id) ? 1 : 0);
    const getReplyLikes = (postId: number, r: ForumReply) => r.likes + (likedReplies.has(`${postId}-${r.id}`) ? 1 : 0);
    const getReplyDislikes = (postId: number, r: ForumReply) => r.dislikes + (dislikedReplies.has(`${postId}-${r.id}`) ? 1 : 0);

    const addPost = (post: Omit<ForumPost, 'id' | 'date' | 'likes' | 'dislikes' | 'replies' | 'views'>) => {
        const newPost: ForumPost = {
            ...post,
            id: Date.now(),
            date: new Date().toISOString(),
            likes: 0,
            dislikes: 0,
            views: 0,
            replies: []
        };
        setCustomPosts(prev => [newPost, ...prev]);
        setSortMode('newest'); // Ensure the new post appears at the top
    };

    const addReply = (postId: number, reply: Omit<ForumReply, 'id' | 'date' | 'likes' | 'dislikes'>) => {
        const newReply: ForumReply = {
            ...reply,
            id: Date.now(),
            date: new Date().toISOString(),
            likes: 0,
            dislikes: 0
        };

        // If it's a reply to a localized post, we need to add it to a tracking state for new replies
        // or just update localizedPosts/customPosts.
        // For simplicity, let's update whichever list contains the post.
        setLocalizedPosts(prev => prev.map(p => p.id === postId ? { ...p, replies: [...p.replies, newReply] } : p));
        setCustomPosts(prev => prev.map(p => p.id === postId ? { ...p, replies: [...p.replies, newReply] } : p));
    };

    return {
        activeTag, setActiveTag,
        searchQuery, setSearchQuery,
        columns, setColumns,
        expandedPosts, setExpandedPosts,
        likedPosts, setLikedPosts,
        dislikedPosts, setDislikedPosts,
        likedReplies, setLikedReplies,
        dislikedReplies, setDislikedReplies,
        sortMode, setSortMode,
        readingMode, setReadingMode,
        autoCollapse, setAutoCollapse,
        showPublishModal, setShowPublishModal,
        showUnderConstruction, setShowUnderConstruction,
        calendarOpen, setCalendarOpen,
        dateRange, setDateRange,
        replyingToAuthorId, setReplyingToAuthorId,
        replyingToPost, setReplyingToPost,
        replyFilterUser, setReplyFilterUser,
        replyFilterPivotId, setReplyFilterPivotId,
        replyToFilter, setReplyToFilter,
        expandedPost,
        filteredPosts,
        direction,
        setDirection,

        toggleLikePost,
        toggleDislikePost,
        toggleLikeReply,
        toggleDislikeReply,
        handleExpandPost,
        toggleAllPosts,
        closeExpanded,
        getPostLikes,
        getPostDislikes,
        getReplyLikes,
        getReplyDislikes,
        addPost,
        addReply,
        customTagValue,
        setCustomTagValue
    };
}
