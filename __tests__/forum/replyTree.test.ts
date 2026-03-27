import { describe, it, expect } from 'vitest';
import { getReplyChildrenMap, getAllDescendants } from '@/features/forum/utils/replyTree';
import { ForumPost, ForumUser, ForumReply } from '@/features/forum/types';

describe('replyTree utils', () => {
    const mockUsers: Record<string, ForumUser> = {
        'user-1': { id: 'user-1', name: 'Alice', avatar: '', posts: 0, replies: 0, likes: 0, dislikes: 0, xp: 0, badgeAddress: '' },
        'user-2': { id: 'user-2', name: 'Bob', avatar: '', posts: 0, replies: 0, likes: 0, dislikes: 0, xp: 0, badgeAddress: '' },
        'user-3': { id: 'user-3', name: 'Charlie', avatar: '', posts: 0, replies: 0, likes: 0, dislikes: 0, xp: 0, badgeAddress: '' },
    };

    const mockPost: ForumPost = {
        id: 100,
        authorId: 'user-1',
        date: new Date().toISOString(),
        tags: ['General'],
        views: 0,
        likes: 0,
        dislikes: 0,
        title: 'Original Post',
        content: 'Root content',
        replies: [
            { id: 1, authorId: 'user-2', date: '', likes: 0, dislikes: 0, content: 'Reply to root' }, // Root
            { id: 2, authorId: 'user-3', date: '', likes: 0, dislikes: 0, content: 'Reply to 1', replyToId: 1 }, // Reply to 1
            { id: 3, authorId: 'user-2', date: '', likes: 0, dislikes: 0, content: 'Reply to 2', replyTo: 'Charlie' }, // Fallback to 2
            { id: 4, authorId: 'user-1', date: '', likes: 0, dislikes: 0, content: 'Another reply to root', replyTo: 'Alice' }, // Root fallback
        ] as ForumReply[]
    };

    describe('getReplyChildrenMap', () => {
        it('should correctly map root level replies', () => {
            const map = getReplyChildrenMap(mockPost, mockUsers);
            const rootReplies = map.get('root');
            expect(rootReplies).toHaveLength(2);
            expect(rootReplies?.map(r => r.id)).toContain(1);
            expect(rootReplies?.map(r => r.id)).toContain(4);
        });

        it('should correctly map nested replies by ID', () => {
            const map = getReplyChildrenMap(mockPost, mockUsers);
            const repliesTo1 = map.get(1);
            expect(repliesTo1).toHaveLength(1);
            expect(repliesTo1?.[0].id).toBe(2);
        });

        it('should correctly map nested replies by name fallback', () => {
            const map = getReplyChildrenMap(mockPost, mockUsers);
            const repliesTo2 = map.get(2);
            expect(repliesTo2).toHaveLength(1);
            expect(repliesTo2?.[0].id).toBe(3);
        });

        it('should handle complex proximity in name-based fallback', () => {
            const complexPost: ForumPost = {
                ...mockPost,
                replies: [
                    { id: 1, authorId: 'user-2', date: '' } as ForumReply, // Bob #1
                    { id: 2, authorId: 'user-2', date: '' } as ForumReply, // Bob #2
                    { id: 3, authorId: 'user-3', date: '', replyTo: 'Bob' } as ForumReply, // Should link to #2 (closest)
                ]
            };
            const map = getReplyChildrenMap(complexPost, mockUsers);
            expect(map.get(1)).toBeUndefined();
            expect(map.get(2)).toHaveLength(1);
            expect(map.get(2)?.[0].id).toBe(3);
        });
    });

    describe('getAllDescendants', () => {
        it('should retrieve all nested replies for a given message', () => {
            const map = getReplyChildrenMap(mockPost, mockUsers);
            const descendants = getAllDescendants(1, map);
            // 1 has child 2, 2 has child 3. So 1 has descendants [2, 3]
            expect(descendants).toHaveLength(2);
            expect(descendants.map(r => r.id)).toContain(2);
            expect(descendants.map(r => r.id)).toContain(3);
        });

        it('should return empty array if no descendants exist', () => {
            const map = getReplyChildrenMap(mockPost, mockUsers);
            const descendants = getAllDescendants(3, map);
            expect(descendants).toHaveLength(0);
        });

        it('should retrieve all thread replies from root', () => {
            const map = getReplyChildrenMap(mockPost, mockUsers);
            const descendants = getAllDescendants('root', map);
            expect(descendants).toHaveLength(mockPost.replies.length);
        });
    });
});
