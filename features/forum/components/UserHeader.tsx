'use client';

import React from 'react';
import { UserHeaderProps } from '../types/components.types';
import { useForum } from './ForumContext';
import { getUserRank } from '../data/forumData';
import { UserStats } from '@/components/ui/UserStats';
import { XPBar } from '@/components/ui/XPBar';
import { SafeImage } from '@/components/ui/SafeImage';

export function UserHeader({ authorId, compact = false, right, hideBadge = false }: UserHeaderProps) {
    const { t, users } = useForum();
    const u = users[authorId];
    if (!u) return null;
    const rank = getUserRank(u.xp);

    return (
        <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <SafeImage
                src={u.avatar}
                alt={u.name}
                fallbackName={u.name}
                title={u.name}
                className={`rounded-lg border-2 object-cover shrink-0 ${compact ? 'size-8' : 'size-10'}`}
                style={{ borderColor: rank.color }}
            />
            <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                <span className={`font-bold text-[var(--color-text-main)] ${compact ? 'text-xs' : 'text-sm'}`}>
                    {u.name}
                </span>
                <UserStats
                    posts={u.posts}
                    replies={u.replies}
                    likes={u.likes}
                    dislikes={u.dislikes}
                    layout="horizontal"
                    titles={{
                        topics: t.forum.sidebar.topics as string,
                        replies: t.forum.sidebar.replies as string,
                        likes: t.forum.sidebar.likes as string,
                        dislikes: t.forum.sidebar.dislikes as string,
                        ranking: t.forum.sidebar.ranking as string,
                    }}
                />
                {!hideBadge && (
                    <div className="flex items-center gap-1.5" title={`${t.forum.ranks[rank.name as keyof typeof t.forum.ranks] || rank.name} — ${u.xp} ${t.forum.header.points.xp}`}>
                        <XPBar
                            progress={rank.progress}
                            color={rank.color}
                            size="sm"
                            className="w-16"
                        />
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: rank.color }}>
                            {t.forum.ranks[rank.name as keyof typeof t.forum.ranks] || rank.name}
                        </span>
                    </div>
                )}
            </div>
            {right && <div className="ml-auto shrink-0">{right}</div>}
        </div>
    );
}
