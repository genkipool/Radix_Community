'use client';

/**
 * SourceBadge
 *
 * Universal "Received/Sent via: METHOD" badge used across all asset transfer
 * rows. Single source of truth for style — change here, updates everywhere.
 *
 * Vertical alignment: py-1 + mt-[1px] on text spans keeps the label perfectly
 * centred regardless of font metrics or browser rendering quirks.
 */
import { LabelBadge } from '@/components/ui/LabelBadge';

export function SourceBadge({
    method,
    color,
    bg,
    title,
    label,
}: {
    method: string;
    color?: string;
    bg?: string;
    title?: string;
    label?: string;
}) {
    if (!method) return null;
    return (
        <LabelBadge
            label={label ?? 'via:'}
            value={method}
            colorClass={color ?? 'text-amber-700 dark:text-amber-400'}
            bgClass={bg ?? 'bg-amber-100 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30'}
            title={title ?? method}
        />
    );
}
