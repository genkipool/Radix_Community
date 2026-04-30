import React from 'react';
import {
    Shield, Users, ShieldCheck, Globe, Building, Tag, type LucideIcon,
} from 'lucide-react';
import { sanitizeText } from '@/utils/sanitize';
import type { TranslationsT } from '@/features/dashboard/types';

/**
 * All badge components use the py-1 + leading-none + mt-[1px] pattern
 * for correct vertical text centering across all browsers.
 * Same technique as Pill, TokenBadge, and SourceBadge.
 */

const baseCls = (compact: boolean) =>
    `inline-flex items-center gap-1 rounded-full border font-bold whitespace-nowrap align-middle box-border leading-none ${
        compact ? 'px-1.5 py-1 text-[9px]' : 'px-2 py-1 text-[10px]'
    }`;

/* ─────────────────────────────────────────
   OnlineBadge
───────────────────────────────────────── */
export const OnlineBadge = ({
    online, labelOn, labelOff, compact = false,
}: {
    online: boolean; labelOn: string; labelOff: string; compact?: boolean;
}) => {
    const color = online ? '#16a34a' : '#d97706';
    return (
        <span
            className={baseCls(compact)}
            style={{ color, borderColor: `${color}45`, backgroundColor: `${color}15` }}
            title={sanitizeText(online ? labelOn : labelOff)}
        >
            <ShieldCheck className={compact ? 'w-2.5 h-2.5 shrink-0' : 'w-3 h-3 shrink-0'} />
            {!compact && <span className="mt-[1px] hidden sm:inline">{sanitizeText(online ? labelOn : labelOff)}</span>}
        </span>
    );
};

/* ─────────────────────────────────────────
   ConnectBadge
───────────────────────────────────────── */
export const ConnectBadge = ({
    accepts, labelYes, labelNo, compact = false, icon: Icon = Users,
}: {
    accepts: boolean; labelYes: string; labelNo: string; compact?: boolean; icon?: LucideIcon;
}) => {
    const color = accepts ? '#16a34a' : '#d97706';
    return (
        <span
            className={baseCls(compact)}
            style={{ color, borderColor: `${color}45`, backgroundColor: `${color}15` }}
            title={sanitizeText(accepts ? labelYes : labelNo)}
        >
            <Icon className={compact ? 'w-2.5 h-2.5 shrink-0' : 'w-3 h-3 shrink-0'} />
            {!compact && <span className="mt-[1px] hidden sm:inline">{sanitizeText(accepts ? labelYes : labelNo)}</span>}
        </span>
    );
};

/* ─────────────────────────────────────────
   VoteBadge
───────────────────────────────────────── */
export const VoteBadge = ({
    vote, label, compact = false,
}: {
    vote: string; label: string; compact?: boolean;
}) => {
    const safeVote = sanitizeText(vote);
    const isSignaled = safeVote && safeVote.toLowerCase() !== 'none';
    const color = isSignaled ? 'var(--color-primary)' : '#71717a';
    return (
        <span
            className={`${baseCls(compact)} overflow-hidden`}
            style={{ color, borderColor: `${color}45`, backgroundColor: `${color}15` }}
            title={`${label}: ${safeVote}`}
        >
            <Shield className={`shrink-0 ${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
            {!compact && <span className="mt-[1px] truncate max-w-[80px] hidden sm:inline">{safeVote || '—'}</span>}
        </span>
    );
};

/* ─────────────────────────────────────────
   TagBadge
───────────────────────────────────────── */
export const TagBadge = ({ tag, t, compact = false }: { tag: string; t?: TranslationsT; compact?: boolean }) => {
    const lowerTag = tag.toLowerCase();
    const isCommunity  = lowerTag.includes('community') || lowerTag.includes('comunidad');
    const isFoundation = lowerTag.includes('foundation') || lowerTag.includes('fundacion');
    const isHispanic   = lowerTag.includes('hispanic')   || lowerTag.includes('hispana');

    const label = t?.dashboard?.tags?.[tag as keyof NonNullable<typeof t.dashboard>["tags"]] ?? (
        isHispanic   ? (t?.dashboard?.tags?.['Hispanic Community'] ?? tag)
        : isCommunity  ? (t?.dashboard?.tags?.Community  ?? tag)
        : isFoundation ? (t?.dashboard?.tags?.Foundation ?? tag)
        : tag
    );

    let bgColor     = 'bg-sky-500/15';
    let textColor   = 'text-sky-700 dark:text-sky-400';
    let borderColor = 'border-sky-500/25';
    let Icon = Tag;

    if (isHispanic) {
        bgColor     = 'bg-amber-500/15';
        textColor   = 'text-amber-700 dark:text-amber-400';
        borderColor = 'border-amber-500/25';
        Icon = Globe;
    } else if (isFoundation) {
        bgColor     = 'bg-violet-500/15';
        textColor   = 'text-violet-600 dark:text-violet-400';
        borderColor = 'border-violet-500/25';
        Icon = Building;
    } else if (isCommunity) {
        Icon = Users;
    } else {
        bgColor     = 'bg-[var(--color-bg)]';
        textColor   = 'text-[var(--color-text-muted)]';
        borderColor = 'border-[var(--color-card-border)]';
    }

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full border font-bold tracking-wider transition-colors align-middle box-border leading-none ${bgColor} ${textColor} ${borderColor} ${
                compact ? 'p-1' : 'px-2 py-1 text-[9px]'
            }`}
            title={label}
        >
            <Icon size={compact ? 10 : 12} className="shrink-0" />
            {!compact && <span className="mt-[1px] hidden sm:inline">{label}</span>}
        </span>
    );
};

/* ─────────────────────────────────────────
   EntityTagsGrid
───────────────────────────────────────── */
export const EntityTagsGrid = ({ tags, t, compact = false }: { tags: string[]; t?: TranslationsT; compact?: boolean }) => {
    if (!tags || tags.length === 0) return null;
    return (
        <div className="flex flex-wrap items-center justify-start gap-1.5 min-w-0">
            {tags.slice(0, compact ? 3 : 2).map(tag => (
                <TagBadge key={tag} tag={tag} t={t} compact={compact} />
            ))}
        </div>
    );
};
