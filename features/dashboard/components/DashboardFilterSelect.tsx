'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ListFilter, ChevronDown } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { SelectPopup, SelectPopupEmpty, SelectPopupRow } from '@/components/ui/SelectPopup';
import { StarIcon } from '@/components/ui/StarIcon';

export interface FilterSelectOption {
    key: string;
    label: string;
    active: boolean;
    onToggle: () => void;
    disabled?: boolean;
    title?: string;
    /** A switch beside the choice (the wallet), not one of the choices: it is not counted in the summary. */
    independent?: boolean;
    /** Starred: the toolbar also shows it as a button of its own. */
    favorite?: boolean;
    onFavoriteToggle?: () => void;
}

export interface FilterFavoriteLabels {
    add: string;
    remove: string;
    /** Shown on a star that cannot be added because the limit is reached. */
    limit: string;
}

interface DashboardFilterSelectProps {
    /** The "no filter" row, shown first; active when nothing else is. */
    allOption: { label: string; onSelect: () => void };
    options: FilterSelectOption[];
    placeholder: string;
    closeLabel?: string;
    /** Whether one more filter can be starred. */
    canAddFavorite?: boolean;
    favoriteLabels?: FilterFavoriteLabels;
    emptyLabel?: string;
    width?: string;
    className?: string;
}

/**
 * Every filter of the toolbar in one select — the stand-in for the row of
 * filter buttons where it does not fit. Picking a row applies it at once and
 * the popup stays open, so several can be combined.
 */
export function DashboardFilterSelect({
    allOption,
    options,
    placeholder,
    closeLabel = 'Close',
    canAddFavorite = true,
    favoriteLabels = { add: 'Add to favourites', remove: 'Remove from favourites', limit: 'Favourites limit reached' },
    emptyLabel = 'No results',
    width = 'w-[220px]',
    className = '',
}: DashboardFilterSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // The summary speaks for the choices; switches only show when nothing else is picked.
    const choices = options.filter(o => o.active && !o.independent);
    const active = choices.length > 0 ? choices : options.filter(o => o.active);
    const summary = active.length === 0
        ? allOption.label
        : active.length === 1 ? active[0].label : `${active[0].label} +${active.length - 1}`;

    const needle = query.trim().toLowerCase();
    const visible = options.filter(o => o.label.toLowerCase().includes(needle));
    const showAll = allOption.label.toLowerCase().includes(needle);

    return (
        <div className={`relative ${width} shrink-0 ${className}`} ref={containerRef}>
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                title={placeholder}
                onClick={() => { setIsOpen(open => !open); setQuery(''); }}
                className={`flex items-center gap-2 h-9 w-full px-3 rounded-full border bg-[var(--color-bg)] shadow-sm transition-colors ${isOpen || active.length > 0 ? 'border-[var(--color-primary)]/50' : 'border-[var(--color-card-border)]'}`}
            >
                <ListFilter className={`size-4 shrink-0 ${active.length > 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`} aria-hidden="true" />
                <span className={`flex-1 truncate text-center text-[13px] font-bold ${active.length > 0 ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-main)]'}`}>
                    {summary}
                </span>
                <ChevronDown className={`size-4 shrink-0 text-[var(--color-text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <SelectPopup
                        title={placeholder}
                        onClose={() => setIsOpen(false)}
                        closeLabel={closeLabel}
                        search={{ value: query, onChange: setQuery, placeholder }}
                        listClassName="max-h-60"
                        className="absolute right-0 top-full mt-2 w-64 z-50"
                    >
                        {showAll && (
                            <SelectPopupRow
                                selected={choices.length === 0}
                                onClick={allOption.onSelect}
                                label={allOption.label}
                            />
                        )}
                        {visible.map(o => {
                            const starDisabled = !o.favorite && !canAddFavorite;
                            return (
                                <div key={o.key} className="flex items-center gap-1">
                                    <div className="min-w-0 flex-1">
                                        <SelectPopupRow
                                            selected={o.active}
                                            onClick={o.onToggle}
                                            label={o.label}
                                            disabled={o.disabled}
                                            title={o.title}
                                        />
                                    </div>
                                    {o.onFavoriteToggle && (
                                        <button
                                            type="button"
                                            onClick={o.onFavoriteToggle}
                                            disabled={starDisabled}
                                            aria-pressed={!!o.favorite}
                                            aria-label={o.favorite ? favoriteLabels.remove : favoriteLabels.add}
                                            title={starDisabled ? favoriteLabels.limit : o.favorite ? favoriteLabels.remove : favoriteLabels.add}
                                            className={`size-7 shrink-0 flex items-center justify-center rounded-lg transition-colors ${o.favorite ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-primary)]'} ${starDisabled ? 'opacity-40 cursor-not-allowed hover:text-[var(--color-text-muted)]' : ''}`}
                                        >
                                            <StarIcon filled={!!o.favorite} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                        {!showAll && visible.length === 0 && <SelectPopupEmpty>{emptyLabel}</SelectPopupEmpty>}
                    </SelectPopup>
                )}
            </AnimatePresence>
        </div>
    );
}
