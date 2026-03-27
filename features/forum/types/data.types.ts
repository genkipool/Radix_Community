import { en } from '@/i18n/locales/en';

/* ═══════════════ DATA TYPES ═══════════════ */

export interface ForumUser {
    id: string;
    name: string;
    avatar: string;
    posts: number;
    replies: number;
    likes: number;
    dislikes: number;
    xp: number;
    badgeAddress: string;
}

export interface ForumReply {
    id: number;
    authorId: string;
    replyTo?: string;
    replyToId?: number;
    replyToContent?: string;
    date: string;
    likes: number;
    dislikes: number;
    title?: string;
    content?: string;
}

export interface ForumPost {
    id: number;
    authorId: string;
    date: string;
    tags: string[];
    views: number;
    likes: number;
    dislikes: number;
    replies: ForumReply[];
    title?: string;
    content?: string;
}

export interface Rank {
    name: string;
    nameEn: string; // from forumData.ts
    minXp: number;
    maxXp: number;
    color: string;
    progress?: number; // added by getUserRank
}

export type ForumDictionary = typeof en.forum;
