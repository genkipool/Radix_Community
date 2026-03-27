import { BlogPost } from './data.types';

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
}
