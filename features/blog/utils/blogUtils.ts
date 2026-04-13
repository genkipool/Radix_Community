import { BlogPost } from '../types';

/**
 * Filter and sort blog posts based on search query, active tag, and date range.
 */
export function filterPosts(
    posts: BlogPost[],
    activeTag: string | null,
    searchQuery: string,
    dateRange: { start: string | null; end: string | null },
    sortMode: 'newest' | 'oldest' | 'date' | 'random'
): BlogPost[] {
    let result = [...posts];

    if (activeTag) {
        result = result.filter(p => p.tags.includes(activeTag));
    }

    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        result = result.filter(p =>
            p.title.toLowerCase().includes(q) ||
            p.summary.toLowerCase().includes(q) ||
            p.content.toLowerCase().includes(q)
        );
    }

    if (dateRange.start) {
        result = result.filter(p => {
            const postDate = p.date.slice(0, 10);
            if (dateRange.end) return postDate >= dateRange.start! && postDate <= dateRange.end;
            return postDate === dateRange.start;
        });
    }

    if (sortMode === 'newest') {
        result.sort((a, b) => new Date(b.date.replace(/-/g, '/')).getTime() - new Date(a.date.replace(/-/g, '/')).getTime());
    } else if (sortMode === 'oldest') {
        result.sort((a, b) => new Date(a.date.replace(/-/g, '/')).getTime() - new Date(b.date.replace(/-/g, '/')).getTime());
    }

    return result;
}

/**
 * Calculate grid span styles for a post based on columns and index.
 */
export function getPostSpanStyle(
    index: number,
    post: BlogPost,
    columns: number
): React.CSSProperties {
    if (columns === 1) return {};
    if (index === 0) return { gridColumn: '1 / -1' };
    
    const style: React.CSSProperties = {};

    if (post.colSpan && post.colSpan > 1) {
        style.gridColumn = `span ${Math.min(post.colSpan, 2)}`;
    }
    if (post.rowSpan && post.rowSpan > 1) {
        style.gridRow = `span ${Math.min(post.rowSpan, 2)}`;
    }
    
    return style;
}

/**
 * Determine which tag to display on the post card.
 */
export function getPostDisplayTag(post: BlogPost, activeTag: string | null): string {
    if (activeTag && post.tags.includes(activeTag)) return activeTag;
    return post.tags[0];
}
