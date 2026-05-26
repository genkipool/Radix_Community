'use client';
import React from 'react';

interface TagFilterBarProps {
    tags: string[];
    /** Can be a single tag (string), null (All), or an array of tags (multi-select) */
    activeTag: string | string[] | null;
    onSelect: (tag: string | null) => void;
    allLabel: string;
    /** Optional map from tag key → translated label */
    tagLabels?: Record<string, string>;
    hideAll?: boolean;
}

/**
 * Reusable row of filter pill buttons used in Blog, Forum, and Ecosistema.
 * Supports both single-select (passing string/null) and multi-select (passing string[]).
 */
export function TagFilterBar({ tags, activeTag, onSelect, allLabel, tagLabels, hideAll }: TagFilterBarProps) {
    const btnBase = 'px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-200';
    const btnActive = 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]';
    const btnInactive = 'text-[var(--color-text-muted)] border-[var(--color-card-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/40';

    const isActive = (tag: string | null) => {
        if (tag === null) {
            return activeTag === null || (Array.isArray(activeTag) && activeTag.includes('All'));
        }
        if (Array.isArray(activeTag)) {
            return activeTag.includes(tag);
        }
        return activeTag === tag;
    };

    return (
        <div className="flex flex-wrap gap-2 flex-1 justify-center">
            {!hideAll && (
                <button
                    onClick={() => onSelect(null)}
                    className={`${btnBase} ${isActive(null) ? btnActive : btnInactive}`}
                >
                    {allLabel}
                </button>
            )}
            {tags.map(tag => (
                <button
                    key={tag}
                    onClick={() => {
                        if (Array.isArray(activeTag)) {
                            onSelect(tag);
                        } else {
                            isActive(tag) ? onSelect(null) : onSelect(tag);
                        }
                    }}
                    className={`${btnBase} ${isActive(tag) ? btnActive : btnInactive}`}
                >
                    {tagLabels?.[tag] ?? tag}
                </button>
            ))}
        </div>
    );
}
