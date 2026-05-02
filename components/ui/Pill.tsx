/**
 * Pill — universal tag/badge pill component.
 *
 * Vertical alignment technique (same as SourceBadge / TokenBadge):
 *   - py-1 + leading-none on the container → correct padding without fixed height
 *   - mt-[1px] on the inner text span → compensates font descender offset
 *   - align-middle box-border → correct inline-block baseline alignment
 *
 * This replaces the old h-[18px] fixed-height approach which caused
 * misalignment across different browsers and font metrics.
 */

import React from 'react';

type PillColor = 'primary' | 'green' | 'red' | 'amber' | 'muted' | 'custom' | 'accent';

interface PillProps {
    children: React.ReactNode;
    color?: PillColor;
    /** Extra classes — use when you need a one-off color not in the preset list */
    className?: string;
    /** Inline styles for dynamic colors (e.g. status badges with hex colors) */
    style?: React.CSSProperties;
    title?: string;
    onClick?: (e: React.MouseEvent) => void;
}

const COLOR_CLASSES: Record<PillColor, string> = {
    primary: 'text-[var(--color-primary)] border-[var(--color-primary)]/30 bg-[var(--color-primary)]/10',
    green:   'text-green-700 dark:text-green-400  border-green-600/20  bg-green-600/10',
    red:     'text-red-500    border-red-500/20    bg-red-500/10',
    amber:   'text-amber-400  border-amber-400/20  bg-amber-400/10',
    muted:   'text-[var(--color-text-muted)] border-[var(--color-card-border)] bg-[var(--color-surface)]',
    accent:  'text-[var(--color-accent)] border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10',
    custom:  '',
};

export function Pill({ children, color = 'primary', className = '', style, title, onClick }: PillProps) {
    return (
        <span
            className={`
                inline-flex items-center justify-center
                px-2 py-1 leading-none
                rounded-full border
                text-[9px] font-bold tracking-wider
                whitespace-nowrap shrink-0
                align-middle box-border
                ${COLOR_CLASSES[color]}
                ${className}
            `.replace(/\s+/g, ' ').trim()}
            style={style}
            title={title}
            onClick={onClick}
        >
            <span className="mt-[1px]">{children}</span>
        </span>
    );
}
