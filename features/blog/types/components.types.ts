import { BlogPost } from './data.types';
import type { Dictionary } from '@/i18n';

export interface PostContentProps {
    content: string;
    query: string;
    isSummary?: boolean;
}

export interface BlogClientProps {
    /**
     * Posts pre-rendered by the server (ISR).
     */
    initialPosts?: BlogPost[];
    dictionary?: Partial<Dictionary>;
}
