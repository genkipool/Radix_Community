'use client';

import React from 'react';
import { useForum } from './ForumContext';
import { RANKS } from '../data/forumData';
import { RankIcon } from './RankIcon';

export function ForumHeader() {
    const { t, setShowUnderConstruction } = useForum();
    
    return (
        <div className="text-sm md:text-base text-[var(--color-text-muted)] max-w-5xl mx-auto leading-relaxed mb-4 text-center">
            <p className="mb-2">
                {t.forum.header.description_p1}<br />{t.forum.header.description_p2}
                <strong> {t.forum.header.badge_name}</strong>.
                {' '}{t.forum.header.description_p3}
            </p>

            {/* Points Header - Compact & Highlighted */}
            <div className="flex flex-wrap justify-center items-center gap-4 md:gap-8 py-3 px-6 mb-4 bg-[var(--color-surface)]/40 backdrop-blur-sm rounded-2xl border border-[var(--color-card-border)]/30 mx-auto w-fit shadow-inner">
                <div className="flex items-center gap-1.5">
                    <span className="text-[var(--color-text-muted)] text-[10px] font-bold uppercase tracking-wider">{t.forum.header.points.post}</span>
                    <span className="text-[var(--color-primary)] font-black text-base">+3 {t.forum.header.points.xp}</span>
                </div>
                <div className="h-4 w-px bg-[var(--color-card-border)]/50 hidden sm:block" />
                <div className="flex items-center gap-1.5">
                    <span className="text-[var(--color-text-muted)] text-[10px] font-bold uppercase tracking-wider">{t.forum.header.points.reply}</span>
                    <span className="text-[var(--color-secondary)] font-black text-base">+2 {t.forum.header.points.xp}</span>
                </div>
                <div className="h-4 w-px bg-[var(--color-card-border)]/50 hidden sm:block" />
                <div className="flex items-center gap-1.5 cursor-help"
                    title={t.forum.header.points.max_xp_tooltip}>
                    <span className="text-[var(--color-text-muted)] text-[10px] font-bold uppercase tracking-wider">{t.forum.header.points.like}</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[var(--color-accent)] font-black text-base">+1 {t.forum.header.points.xp}</span>
                        <span className="text-[9px] opacity-40 font-black uppercase tracking-tighter">{t.forum.header.points.max_xp_label}</span>
                    </div>
                </div>
                <div className="h-4 w-px bg-[var(--color-card-border)]/50 hidden sm:block" />
                <div className="flex items-center gap-1.5">
                    <span className="text-[var(--color-text-muted)] text-[10px] font-bold uppercase tracking-wider">{t.forum.header.points.dislike}</span>
                    <span className="text-red-500 font-black text-base">-1 {t.forum.header.points.xp}</span>
                </div>
            </div>

            <p className="mb-6 text-sm md:text-base text-[var(--color-text-muted)]">
                {t.forum.header.ranks_desc}
            </p>

            {/* Ranks Grid - Responsive */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-y-3 gap-x-2 py-3 mb-4 w-full bg-[var(--color-bg)]/20 backdrop-blur-[2px] rounded-2xl border border-[var(--color-card-border)]/40 p-3 shadow-lg max-w-4xl mx-auto">
                {RANKS.map((r) => (
                    <div key={r.name} className="flex flex-col items-center gap-1 cursor-help p-2 rounded-xl border border-transparent">
                        <RankIcon name={r.name} color={r.color} className="w-7 h-7 sm:w-8 sm:h-8 drop-shadow-[0_0_5px_rgba(0,0,0,0.1)]" />
                        <div className="flex flex-col items-center leading-tight">
                            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-tighter" style={{ color: r.color }}>{t.forum.ranks[r.name as keyof typeof t.forum.ranks] || r.name}</span>
                            <span className="text-[11px] font-bold opacity-70" style={{ color: r.color }}>{r.minXp} {t.forum.header.points.xp}</span>
                        </div>
                    </div>
                ))}
            </div>

            <p>
                <button
                    onClick={() => setShowUnderConstruction(true)}
                    className="text-[var(--color-primary)] font-bold hover:text-[var(--color-accent)] transition-all"
                >
                    {t.forum.header.wallet_connect}
                </button>
                {' '}{t.forum.header.wallet_desc}
            </p>
        </div>
    );
}
