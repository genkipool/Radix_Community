import { FileText, MessageCircle, Heart, ArrowUp, Shield } from 'lucide-react';

interface UserStatsProps {
    posts: number;
    replies: number;
    likes: number;
    dislikes: number;
    ranking?: number;
    layout?: 'horizontal' | 'vertical';
    className?: string;
    titles?: {
        topics: string;
        replies: string;
        likes: string;
        dislikes: string;
        ranking: string;
    };
}

export function UserStats({
    posts,
    replies,
    likes,
    dislikes,
    ranking,
    layout = 'vertical',
    className = '',
    titles = { topics: 'Topics', replies: 'Replies', likes: 'Likes', dislikes: 'Dislikes', ranking: 'Ranking' }
}: UserStatsProps) {
    if (layout === 'horizontal') {
        return (
            <span
                className={`text-[10px] text-[var(--color-text-muted)] flex items-center gap-1.5 ${className}`}
                title={`${titles.topics}: ${posts} | ${titles.replies}: ${replies} | ${titles.likes}: ${likes} | ${titles.dislikes}: ${dislikes}`}
            >
                <FileText className="w-3 h-3 text-[var(--color-primary)]" />{posts}
                <MessageCircle className="w-3 h-3 text-[var(--color-accent)]" />{replies}
                <Heart className="w-3 h-3 text-[var(--color-accent)]" />{likes}
                <ArrowUp className="w-3 h-3 rotate-180 text-red-500" />{dislikes}
                {ranking !== undefined && (
                    <>
                        <Shield className="w-3 h-3 text-[var(--color-accent)]" />{ranking}
                    </>
                )}
            </span>
        );
    }

    return (
        <div className={`hidden sm:flex items-center justify-center gap-4 flex-wrap w-full mt-4 pt-4 border-t border-[var(--color-card-border)]/50 z-10 ${className}`}>
            <span className="flex flex-col items-center gap-0.5 text-[10px] text-[var(--color-text-muted)] font-bold" title={`${titles.topics}: ${posts}`}>
                <FileText className="w-4 h-4 text-[var(--color-primary)]" />
                {posts}
            </span>
            <span className="flex flex-col items-center gap-0.5 text-[10px] text-[var(--color-text-muted)] font-bold" title={`${titles.replies}: ${replies}`}>
                <MessageCircle className="w-4 h-4 text-[var(--color-accent)]" />
                {replies}
            </span>
            <span className="flex flex-col items-center gap-0.5 text-[10px] text-[var(--color-text-muted)] font-bold" title={`${titles.likes}: ${likes}`}>
                <Heart className="w-4 h-4 text-[var(--color-accent)]" />
                {likes}
            </span>
            <span className="flex flex-col items-center gap-0.5 text-[10px] text-[var(--color-text-muted)] font-bold" title={`${titles.dislikes}: ${dislikes}`}>
                <ArrowUp className="w-4 h-4 rotate-180 text-red-500" />
                {dislikes}
            </span>
            {ranking !== undefined && (
                <span className="flex flex-col items-center gap-0.5 text-[10px] text-[var(--color-text-muted)] font-bold" title={titles.ranking}>
                    <Shield className="w-4 h-4 text-[var(--color-accent)]" />
                    {ranking}
                </span>
            )}
        </div>
    );
}
