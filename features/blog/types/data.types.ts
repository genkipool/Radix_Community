export interface BlogPost {
    id: number;
    title: string;
    summary: string;
    content: string;
    date: string;
    tags: string[];
    image: string;
    author: string;
    likes: number;
    views: number;
    colSpan?: number;
    rowSpan?: number;
}
