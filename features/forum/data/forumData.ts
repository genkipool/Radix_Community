/* =============== FORUM DATA =============== */
import type { ForumUser, ForumPost } from '../types';

/* ═══════ RANKING SYSTEM ═══════
 * Publish = 3 pts | Reply = 2 pts | Like received = 1 pt
 * 100 pts per rank, except Omnipresente which needs 1000 extra (starts at 2000)
 * Registration gives 100 pts (Novato).
 *
 * Novato:        100–199
 * Aprendiz:      200–299
 * Contribuidor:  300–399
 * Activo:        400–499
 * Sabio:         500–599
 * Gurú:          600–699
 * Master:        700–799
 * Leyenda:       800–899
 * Élite:         900–1999
 * Omnipresente:  2000+
 */
export const RANKS = [
    { name: 'Novato', nameEn: 'Novice', minXp: 0, maxXp: 199, color: '#a1a1aa' },
    { name: 'Profesional', nameEn: 'Professional', minXp: 200, maxXp: 299, color: '#60a5fa' },
    { name: 'Especialista', nameEn: 'Specialist', minXp: 300, maxXp: 399, color: '#34d399' },
    { name: 'Maestro', nameEn: 'Master', minXp: 400, maxXp: 499, color: '#fbbf24' },
    { name: 'Elite', nameEn: 'Elite', minXp: 500, maxXp: 599, color: '#ec4899' },
    { name: 'Sabio', nameEn: 'Sage', minXp: 600, maxXp: 699, color: '#f97316' },
    { name: 'Guru', nameEn: 'Guru', minXp: 700, maxXp: 899, color: '#a855f7' },
    { name: 'Leyenda', nameEn: 'Legend', minXp: 900, maxXp: 999, color: '#ef4444' },
    { name: 'Omnipotente', nameEn: 'Omnipotent', minXp: 1000, maxXp: 1999, color: '#06b6d4' },
    { name: 'Omnipresente', nameEn: 'Omnipresent', minXp: 2000, maxXp: 99999, color: '#eab308' },
];

export function getUserRank(xp: number) {
    const rank = RANKS.find(r => xp >= r.minXp && xp <= r.maxXp) || RANKS[0];
    const progress = Math.min(100, Math.round(((xp - rank.minXp) / (rank.maxXp - rank.minXp + 1)) * 100));
    return { ...rank, progress };
}

/* ═══════ USERS ═══════ */
const av = (name: string) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=128&bold=true`;

export const users: Record<string, ForumUser> = {
    ceo_mark: { id: 'ceo_mark', name: 'MarkWilson_CEO', avatar: av('Mark Wilson'), posts: 8, replies: 22, likes: 156, dislikes: 0, xp: 218, badgeAddress: 'resource_rdx1nfy...m4wk' }, // Capped likes
    inv_sarah: { id: 'inv_sarah', name: 'SarahCapital', avatar: av('Sarah Chen'), posts: 6, replies: 18, likes: 132, dislikes: 0, xp: 182, badgeAddress: 'resource_rdx1nfy...q8j2' },
    dev_alex: { id: 'dev_alex', name: 'AlexDev', avatar: av('Alex Rivera'), posts: 45, replies: 312, likes: 890, dislikes: 0, xp: 1580, badgeAddress: 'resource_rdx1nfy...x7pn' },
    mod_lisa: { id: 'mod_lisa', name: 'LisaMod', avatar: av('Lisa Park'), posts: 38, replies: 245, likes: 720, dislikes: 0, xp: 1280, badgeAddress: 'resource_rdx1nfy...d3km' },
    val_tom: { id: 'val_tom', name: 'TomValidator', avatar: av('Tom Brady'), posts: 25, replies: 178, likes: 445, dislikes: 0, xp: 840, badgeAddress: 'resource_rdx1nfy...r5vt' },
    inv_james: { id: 'inv_james', name: 'JamesFund', avatar: av('James Liu'), posts: 4, replies: 12, likes: 67, dislikes: 0, xp: 101, badgeAddress: 'resource_rdx1nfy...h2wn' },
    dev_maria: { id: 'dev_maria', name: 'MariaScrypto', avatar: av('Maria Garcia'), posts: 52, replies: 389, likes: 1100, dislikes: 0, xp: 1980, badgeAddress: 'resource_rdx1nfy...k9sf' },
    new_peter: { id: 'new_peter', name: 'PeterNewbie', avatar: av('Peter Smith'), posts: 2, replies: 5, likes: 8, dislikes: 0, xp: 24, badgeAddress: 'resource_rdx1nfy...p4bz' },
    ceo_diana: { id: 'ceo_diana', name: 'DianaFintech', avatar: av('Diana Ross'), posts: 5, replies: 14, likes: 89, dislikes: 0, xp: 128, badgeAddress: 'resource_rdx1nfy...g7ct' },
    val_kenji: { id: 'val_kenji', name: 'KenjiNode', avatar: av('Kenji Tanaka'), posts: 30, replies: 210, likes: 560, dislikes: 0, xp: 1040, badgeAddress: 'resource_rdx1nfy...n2jq' },
    inv_elena: { id: 'inv_elena', name: 'ElenaVC', avatar: av('Elena Volkov'), posts: 3, replies: 9, likes: 42, dislikes: 0, xp: 68, badgeAddress: 'resource_rdx1nfy...w5rl' },
    dev_omar: { id: 'dev_omar', name: 'OmarRust', avatar: av('Omar Hassan'), posts: 40, replies: 290, likes: 780, dislikes: 0, xp: 1420, badgeAddress: 'resource_rdx1nfy...f8dh' },
};

/* ═══════ TAGS ═══════ */
export const FORUM_TAGS = ['General', 'Institutional', 'DeFi', 'Scrypto', 'Governance', 'Investment', 'Technical', 'Ecosystem'];

/* ═══════ POSTS ═══════ */
export const forumPosts: ForumPost[] = [
    {
        id: 1, authorId: 'ceo_mark',
        date: '2026-02-28T14:30:00', tags: ['Institutional', 'General'], views: 1245, likes: 47, dislikes: 0,
        replies: [
            { id: 1, authorId: 'mod_lisa', date: '2026-02-28T15:10:00', likes: 23, dislikes: 0 },
            { id: 2, authorId: 'dev_alex', date: '2026-02-28T15:45:00', likes: 31, dislikes: 0 },
            { id: 3, authorId: 'ceo_mark', replyTo: 'AlexDev', date: '2026-02-28T16:20:00', likes: 12, dislikes: 2 },
            { id: 4, authorId: 'dev_alex', replyTo: 'MarkWilson_CEO', date: '2026-02-28T16:50:00', likes: 28, dislikes: 0 },
            { id: 5, authorId: 'inv_sarah', date: '2026-02-28T18:00:00', likes: 19, dislikes: 0 },
        ]
    },
    {
        id: 2, authorId: 'inv_sarah',
        date: '2026-02-27T09:15:00', tags: ['Investment', 'Institutional'], views: 2340, likes: 63, dislikes: 0,
        replies: [
            { id: 1, authorId: 'val_tom', date: '2026-02-27T10:00:00', likes: 34, dislikes: 0 },
            { id: 2, authorId: 'ceo_diana', date: '2026-02-27T11:30:00', likes: 52, dislikes: 0 },
            { id: 3, authorId: 'inv_sarah', replyTo: 'DianaFintech', date: '2026-02-27T12:15:00', likes: 8, dislikes: 0 },
            { id: 4, authorId: 'ceo_diana', replyTo: 'SarahCapital', date: '2026-02-27T13:00:00', likes: 41, dislikes: 0 },
            { id: 5, authorId: 'dev_maria', date: '2026-02-27T14:30:00', likes: 27, dislikes: 0 },
            { id: 6, authorId: 'mod_lisa', replyTo: 'MariaScrypto', date: '2026-02-27T15:00:00', likes: 18, dislikes: 0 },
        ]
    },
    {
        id: 3, authorId: 'dev_alex',
        date: '2026-02-25T16:00:00', tags: ['Scrypto', 'Technical'], views: 3456, likes: 89, dislikes: 0,
        replies: [
            { id: 1, authorId: 'dev_omar', date: '2026-02-25T17:00:00', likes: 45, dislikes: 0 },
            { id: 2, authorId: 'new_peter', date: '2026-02-25T18:30:00', likes: 5, dislikes: 0 },
            { id: 3, authorId: 'dev_alex', replyTo: 'PeterNewbie', date: '2026-02-25T19:00:00', likes: 32, dislikes: 0 },
            { id: 4, authorId: 'dev_maria', date: '2026-02-26T08:00:00', likes: 38, dislikes: 0 },
        ]
    },
    {
        id: 4, authorId: 'ceo_diana',
        date: '2026-02-24T10:00:00', tags: ['Technical', 'Institutional'], views: 4120, likes: 78, dislikes: 0,
        replies: [
            { id: 1, authorId: 'val_kenji', date: '2026-02-24T11:00:00', likes: 56, dislikes: 0 },
            { id: 2, authorId: 'dev_alex', replyTo: 'MarkWilson_CEO', date: '2026-02-24T12:30:00', likes: 89, dislikes: 0 },
            { id: 3, authorId: 'ceo_diana', replyTo: 'AlexDev', date: '2026-02-24T13:00:00', likes: 15, dislikes: 0 },
            { id: 4, authorId: 'val_tom', replyTo: 'DianaFintech', date: '2026-02-24T14:00:00', likes: 67, dislikes: 0 },
            { id: 5, authorId: 'mod_lisa', replyTo: 'MarkWilson_CEO', date: '2026-02-24T15:30:00', likes: 43, dislikes: 0 },
        ]
    },
    {
        id: 5, authorId: 'inv_james',
        date: '2026-02-23T08:45:00', tags: ['Investment', 'General'], views: 1890, likes: 34, dislikes: 0,
        replies: [
            { id: 1, authorId: 'val_tom', replyTo: 'JamesFund', replyToId: 5, date: '2026-02-23T09:30:00', likes: 28, dislikes: 0 },
            { id: 2, authorId: 'mod_lisa', replyTo: 'JamesFund', replyToId: 5, date: '2026-02-23T10:15:00', likes: 22, dislikes: 0 },
            { id: 3, authorId: 'inv_james', replyTo: 'TomValidator', replyToId: 1, date: '2026-02-23T11:00:00', likes: 7, dislikes: 0 },
            { id: 4, authorId: 'val_kenji', replyTo: 'JamesFund', replyToId: 5, date: '2026-02-23T12:00:00', likes: 19, dislikes: 0 },
        ]
    }, {
        id: 6, authorId: 'dev_maria',
        date: '2026-02-21T15:00:00', tags: ['Scrypto', 'Technical'], views: 2870, likes: 92, dislikes: 0,
        replies: [
            { id: 1, authorId: 'dev_alex', replyTo: 'MariaScrypto', date: '2026-02-21T16:00:00', likes: 45, dislikes: 0 },
            { id: 2, authorId: 'dev_omar', replyTo: 'MariaScrypto', date: '2026-02-21T17:30:00', likes: 12, dislikes: 0 },
            { id: 3, authorId: 'dev_maria', replyTo: 'AlexDev', date: '2026-02-21T18:00:00', likes: 23, dislikes: 0 },
            { id: 4, authorId: 'inv_sarah', replyTo: 'MariaScrypto', date: '2026-02-21T20:00:00', likes: 56, dislikes: 0 },
        ]
    },
    {
        id: 7, authorId: 'val_tom',
        date: '2026-02-20T11:00:00', tags: ['Governance', 'Institutional'], views: 1540, likes: 28, dislikes: 0,
        replies: [
            { id: 1, authorId: 'val_kenji', replyTo: 'TomValidator', date: '2026-02-20T12:00:00', likes: 19, dislikes: 0 },
            { id: 2, authorId: 'val_tom', replyTo: 'KenjiValidator', date: '2026-02-20T13:30:00', likes: 12, dislikes: 0 },
            { id: 3, authorId: 'ceo_mark', replyTo: 'TomValidator', date: '2026-02-20T15:00:00', likes: 34, dislikes: 0 },
        ]
    },
    {
        id: 8, authorId: 'new_peter',
        date: '2026-02-19T14:00:00', tags: ['General', 'Community'], views: 980, likes: 15, dislikes: 0,
        replies: [
            { id: 1, authorId: 'mod_lisa', replyTo: 'PeterNewbie', date: '2026-02-19T15:30:00', likes: 21, dislikes: 0 },
            { id: 2, authorId: 'dev_maria', replyTo: 'PeterNewbie', date: '2026-02-19T17:00:00', likes: 15, dislikes: 0 },
            { id: 3, authorId: 'new_peter', replyTo: 'LisaMod', date: '2026-02-19T18:00:00', likes: 7, dislikes: 0 },
            { id: 4, authorId: 'val_tom', replyTo: 'PeterNewbie', date: '2026-02-19T20:00:00', likes: 11, dislikes: 0 },
        ]
    },
    {
        id: 9, authorId: 'inv_sarah',
        date: '2026-02-18T09:00:00', tags: ['Investment', 'Institutional'], views: 3120, likes: 84, dislikes: 0,
        replies: [
            { id: 1, authorId: 'ceo_mark', replyTo: 'SarahCapital', date: '2026-02-18T10:30:00', likes: 42, dislikes: 0 },
            { id: 2, authorId: 'dev_alex', replyTo: 'SarahCapital', date: '2026-02-18T12:00:00', likes: 53, dislikes: 0 },
            { id: 3, authorId: 'inv_sarah', replyTo: 'MarkWilson_CEO', date: '2026-02-18T13:30:00', likes: 19, dislikes: 0 },
            { id: 4, authorId: 'val_tom', replyTo: 'SarahCapital', date: '2026-02-18T15:00:00', likes: 27, dislikes: 0 },
            { id: 5, authorId: 'mod_lisa', replyTo: 'SarahCapital', date: '2026-02-18T16:30:00', likes: 31, dislikes: 0 },
        ]
    },
    {
        id: 10, authorId: 'dev_omar',
        date: '2026-02-17T16:00:00', tags: ['Technical', 'Community'], views: 2150, likes: 67, dislikes: 0,
        replies: [
            { id: 1, authorId: 'dev_alex', replyTo: 'OmarRust', date: '2026-02-17T17:30:00', likes: 38, dislikes: 0 },
            { id: 2, authorId: 'val_tom', replyTo: 'OmarRust', date: '2026-02-17T19:00:00', likes: 24, dislikes: 0 },
            { id: 3, authorId: 'dev_omar', replyTo: 'AlexDev', date: '2026-02-17T20:30:00', likes: 15, dislikes: 0 },
        ]
    },
    {
        id: 11, authorId: 'ceo_diana',
        date: '2026-02-16T11:00:00', tags: ['Institutional', 'Technical'], views: 1840, likes: 52, dislikes: 0,
        replies: [
            { id: 1, authorId: 'dev_alex', replyTo: 'DianaFintech', date: '2026-02-16T12:30:00', likes: 31, dislikes: 0 },
            { id: 2, authorId: 'dev_maria', replyTo: 'DianaFintech', date: '2026-02-16T14:00:00', likes: 27, dislikes: 0 },
            { id: 3, authorId: 'ceo_diana', replyTo: 'AlexDev', date: '2026-02-16T15:30:00', likes: 12, dislikes: 0 },
            { id: 4, authorId: 'val_tom', replyTo: 'DianaFintech', date: '2026-02-16T17:00:00', likes: 19, dislikes: 0 },
        ]
    },
    {
        id: 12, authorId: 'val_kenji',
        date: '2026-02-15T14:00:00', tags: ['Technical', 'Institutional'], views: 4230, likes: 115, dislikes: 0,
        replies: [
            { id: 1, authorId: 'val_tom', replyTo: 'KenjiNode', date: '2026-02-15T15:30:00', likes: 62, dislikes: 0 },
            { id: 2, authorId: 'inv_sarah', replyTo: 'KenjiNode', date: '2026-02-15T17:00:00', likes: 84, dislikes: 0 },
            { id: 3, authorId: 'val_kenji', replyTo: 'TomValidator', date: '2026-02-15T18:30:00', likes: 45, dislikes: 0 },
            { id: 4, authorId: 'ceo_mark', replyTo: 'KenjiNode', date: '2026-02-15T20:00:00', likes: 73, dislikes: 0 },
        ]
    },
    {
        id: 13, authorId: 'mod_lisa',
        date: '2026-02-14T10:00:00', tags: ['Governance', 'Community'], views: 1260, likes: 45, dislikes: 0,
        replies: [
            { id: 1, authorId: 'inv_sarah', replyTo: 'LisaMod', date: '2026-02-14T11:30:00', likes: 28, dislikes: 0 },
            { id: 2, authorId: 'new_peter', replyTo: 'LisaMod', date: '2026-02-14T13:00:00', likes: 15, dislikes: 0 },
            { id: 3, authorId: 'mod_lisa', replyTo: 'SarahCapital', date: '2026-02-14T14:30:00', likes: 22, dislikes: 0 },
        ]
    },
    {
        id: 14, authorId: 'ceo_mark',
        date: '2026-02-13T16:00:00', tags: ['Investment', 'Institutional'], views: 2450, likes: 68, dislikes: 0,
        replies: [
            { id: 1, authorId: 'dev_alex', replyTo: 'MarkWilson_CEO', date: '2026-02-13T17:30:00', likes: 35, dislikes: 0 },
            { id: 2, authorId: 'val_tom', replyTo: 'MarkWilson_CEO', date: '2026-02-13T19:00:00', likes: 29, dislikes: 0 },
            { id: 3, authorId: 'ceo_mark', replyTo: 'AlexDev', date: '2026-02-13T20:30:00', likes: 18, dislikes: 0 },
            { id: 4, authorId: 'mod_lisa', replyTo: 'MarkWilson_CEO', date: '2026-02-14T09:00:00', likes: 24, dislikes: 0 },
        ]
    },
    {
        id: 15, authorId: 'inv_sarah',
        date: '2026-02-12T11:00:00', tags: ['Scrypto', 'Institutional'], views: 1980, likes: 57, dislikes: 0,
        replies: [
            { id: 1, authorId: 'dev_alex', replyTo: 'SarahCapital', date: '2026-02-12T12:30:00', likes: 43, dislikes: 0 },
            { id: 2, authorId: 'dev_maria', replyTo: 'SarahCapital', date: '2026-02-12T14:00:00', likes: 38, dislikes: 0 },
            { id: 3, authorId: 'inv_sarah', replyTo: 'AlexDev', date: '2026-02-12T15:30:00', likes: 22, dislikes: 0 },
            { id: 4, authorId: 'dev_omar', replyTo: 'MariaScrypto', date: '2026-02-12T17:00:00', likes: 19, dislikes: 0 },
            { id: 5, authorId: 'dev_alex', replyTo: 'SarahCapital', date: '2026-02-12T18:30:00', likes: 31, dislikes: 0 },
        ]
    }
];
