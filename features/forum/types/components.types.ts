import { Dictionary } from '@/i18n';
import { ForumPost, ForumUser } from './data.types';

/* =============== COMPONENT TYPES =============== */

export interface ForumClientProps {
    /** Dictionary resolved server-side (SSG pattern). */
    t: Dictionary;
    /** Locale resolved server-side — needed for date formatting. */
    language: 'en' | 'es';
    /** Pre-rendered post list from the server. */
    initialPosts: ForumPost[];
    /** User map passed from the server so it's available to sub-components. */
    initialUsers: Record<string, ForumUser>;
}

export interface UserHeaderProps {
    authorId: string;
    compact?: boolean;
    right?: React.ReactNode;
    hideBadge?: boolean;
}

export interface RankIconProps {
    name: string;
    color: string;
    className?: string;
}
