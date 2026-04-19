import { en } from '@/i18n/locales/en';
import { ForumUser, ForumPost, ForumReply } from './data.types';

/* ═══════════════ CONTEXT TYPES ═══════════════ */

export interface ForumCtxValue {
    t: typeof en;
    language: 'en' | 'es';
    users: Record<string, ForumUser>;
    // State
    activeTag: string;
    searchQuery: string;
    columns: number;
    expandedPosts: Set<number>;
    likedPosts: Set<number>;
    dislikedPosts: Set<number>;
    likedReplies: Set<string>;
    dislikedReplies: Set<string>;
    readingMode: boolean;
    autoCollapse: boolean;
    showPublishModal: boolean;
    sortMode: 'newest' | 'oldest' | 'date' | 'random';
    calendarOpen: boolean;
    dateRange: { start: string | null; end: string | null };
    replyingToAuthorId: string | null;
    replyingToPost: { postId: number; authorId: string; content: string; date: string; title?: string; messageId?: number } | null;
    replyFilterUser: string;
    replyFilterPivotId: string | null;
    replyToFilter: string;
    expandedPost: ForumPost | null;
    filteredPosts: ForumPost[];
    direction: number;
    customTagValue: string;

    // Handlers
    setActiveTag: (tag: string) => void;
    setSearchQuery: (query: string) => void;
    setColumns: (cols: number) => void;
    setReadingMode: (mode: boolean) => void;
    setAutoCollapse: (mode: boolean) => void;
    setShowPublishModal: (show: boolean) => void;
    setSortMode: (mode: 'newest' | 'oldest' | 'date' | 'random') => void;
    setCalendarOpen: (open: boolean) => void;
    setDateRange: (range: { start: string | null; end: string | null }) => void;
    setReplyingToAuthorId: (id: string | null) => void;
    setReplyingToPost: (post: { postId: number; authorId: string; content: string; date: string; title?: string; messageId?: number } | null) => void;
    setReplyFilterUser: (id: string) => void;
    setReplyFilterPivotId: (id: string | null) => void;
    setReplyToFilter: (id: string) => void;
    setDirection: (direction: number) => void;
    setCustomTagValue: (val: string) => void;

    toggleLikePost: (id: number) => void;
    toggleDislikePost: (id: number) => void;
    toggleLikeReply: (postId: number, replyId: number) => void;
    toggleDislikeReply: (postId: number, replyId: number) => void;
    handleExpandPost: (postId: number) => void;
    toggleAllPosts: () => void;
    closeExpanded: () => void;

    getPostLikes: (p: ForumPost) => number;
    getPostDislikes: (p: ForumPost) => number;
    getReplyLikes: (postId: number, r: ForumReply) => number;
    getReplyDislikes: (postId: number, r: ForumReply) => number;
    addPost: (post: Omit<ForumPost, 'id' | 'date' | 'likes' | 'dislikes' | 'replies' | 'views'>) => void;
    addReply: (postId: number, reply: Omit<ForumReply, 'id' | 'date' | 'likes' | 'dislikes'>) => void;
}
