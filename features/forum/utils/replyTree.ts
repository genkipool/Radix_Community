import { ForumPost, ForumReply, ForumUser } from '../types/data.types';

/**
 * Builds a map from a message ID (or 'root') to its direct child replies.
 * This correctly associates replies with their specific parent message,
 * resolving cases where multiple messages by the same author exist in the thread.
 */
export function getReplyChildrenMap(post: ForumPost, users: Record<string, ForumUser>) {
    const childrenMap = new Map<number | 'root', ForumReply[]>();
    childrenMap.set('root', []);

    for (let i = 0; i < post.replies.length; i++) {
        const reply = post.replies[i];

        // Parent ID resolution
        let parentId: number | 'root' | null = null;

        if (reply.replyToId !== undefined) {
            // Specific ID link (most reliable)
            parentId = reply.replyToId === post.id ? 'root' : reply.replyToId;
        } else if (!reply.replyTo) {
            // Empty replyTo implies direct reply to root
            parentId = 'root';
        } else {
            // Name-based fallback (for legacy mock data or edge cases)
            // Find closest preceding message by replyTo user
            for (let j = i - 1; j >= 0; j--) {
                const prev = post.replies[j];
                if (users[prev.authorId]?.name === reply.replyTo) {
                    parentId = prev.id;
                    break;
                }
            }

            // If no preceding nested message found, verify if it falls back to the original root post
            if (parentId === null) {
                const rootAuthorName = users[post.authorId]?.name;
                if (rootAuthorName === reply.replyTo) {
                    parentId = 'root';
                } else {
                    parentId = 'root'; // Fallback orphan to root
                }
            }
        }

        if (parentId !== null) {
            if (!childrenMap.has(parentId)) {
                childrenMap.set(parentId, []);
            }
            childrenMap.get(parentId)!.push(reply);
        }
    }

    return childrenMap;
}

/**
 * Gets all nested descendants (direct children, grandchildren, etc) for a given message ID.
 */
export function getAllDescendants(
    messageId: number | 'root',
    childrenMap: Map<number | 'root', ForumReply[]>
): ForumReply[] {
    const children = childrenMap.get(messageId) || [];
    let descendants = [...children];

    for (const child of children) {
        descendants = descendants.concat(getAllDescendants(child.id, childrenMap));
    }
    return descendants;
}
