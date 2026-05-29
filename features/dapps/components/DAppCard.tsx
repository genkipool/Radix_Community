/**
 * features/dapps/components/DAppCard.tsx
 */

import React from 'react';
import { Heart, Globe, ExternalLink, ArrowUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { SafeImage } from '@/components/ui/SafeImage';
import { StatButton } from '@/components/ui/StatButton';
import { HighlightText } from '@/components/ui/HighlightText';
import { TagBadge } from './TagBadge';
import { type DAppCardProps } from '../types/components.types';
import { MAX_TAGS, MAX_DESC_CHARS } from '../constants';

/** Truncate description to MAX_DESC_CHARS, appending ellipsis if cut. */
function truncateDesc(text: string): string {
  if (text.length <= MAX_DESC_CHARS) return text;
  return `${text.slice(0, MAX_DESC_CHARS).trimEnd()}…`;
}

export function DAppCard({
  dapp,
  searchQuery,
  liked,
  disliked,
  onLike,
  onDislike,
  t,
}: DAppCardProps) {
  const displayedTags = dapp.tags.slice(0, MAX_TAGS);
  const likes = dapp.likes + (liked ? 1 : 0);
  const dislikes = dapp.dislikes + (disliked ? 1 : 0);

  const rawDesc = dapp.isUserAdded
    ? dapp.description
    : (t.dapps_page.items as Record<string, { description: string }>)?.[String(dapp.id)]?.description || dapp.description;
  const description = truncateDesc(rawDesc);

  return (
    <Card
      className="p-0 shadow-md hover:shadow-xl hover:border-[var(--color-primary)]/30 group overflow-hidden"
      hoverEffect
    >
      <div className="flex flex-row h-full">
        {/* Logo sidebar */}
        <div className="w-[100px] sm:w-[130px] shrink-0 border-r border-[var(--color-card-border)] bg-[var(--color-surface)] flex flex-col items-center justify-between gap-3 p-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-gradient-to-b from-[var(--color-primary)] to-transparent pointer-events-none" />

          <div className="flex-1 flex items-center justify-center">
            <SafeImage
              src={dapp.logoUrl}
              alt={dapp.name}
              fallbackName={dapp.name}
              className="size-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-[var(--color-card-border)] shadow-lg z-10 group-hover:border-[var(--color-primary)]/40 transition-all"
            />
          </div>

          {/* Like / Dislike */}
          <div className="flex flex-row items-center gap-2 z-10 mt-auto">
            <StatButton
              onClick={onLike}
              title={t.dapps_page.like}
              icon={<Heart className={`size-3.5 ${liked ? 'fill-red-500' : ''}`} />}
              count={likes}
              isActive={liked}
            />
            <StatButton
              onClick={onDislike}
              title={t.dapps_page.dislike}
              icon={<ArrowUp className={`size-3.5 rotate-180 ${disliked ? 'fill-red-500' : ''}`} />}
              count={dislikes}
              isActive={disliked}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col p-4 sm:p-5 min-w-0">
          {/* Name + sponsored badge */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="text-base sm:text-lg font-bold text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors leading-snug truncate">
              <HighlightText text={dapp.name} query={searchQuery} />
            </h3>
            {dapp.isSponsored && (
              <span className="shrink-0 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-[var(--color-primary)]/15 text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                {t.dapps_page.sponsored}
              </span>
            )}
          </div>

          {/* Description — hard-limited to MAX_DESC_CHARS chars */}
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed line-clamp-3 flex-1 mb-3" title={rawDesc}>
            <HighlightText text={description} query={searchQuery} />
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--color-card-border)] mt-auto flex-wrap">
            {/* Website link */}
            <a
              href={dapp.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors font-medium min-w-0 truncate"
              title={dapp.websiteUrl}
            >
              <Globe className="size-3.5 shrink-0" />
              <span className="truncate">
                {dapp.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
              </span>
              <ExternalLink className="size-3 shrink-0 opacity-60" />
            </a>

            {/* Tags — CSS grid for uniform alignment */}
            <div
              className={`grid gap-1.5 shrink-0 ${displayedTags.length > 1 ? 'grid-cols-2' : 'grid-cols-1'
                }`}
            >
              {displayedTags.map((tag: string) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
