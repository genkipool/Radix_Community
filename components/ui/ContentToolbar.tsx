'use client';
import React, { useEffect, useRef } from 'react';
import { useMounted } from '@/hooks/useMounted';
import {
    SortAsc, SortDesc, BookOpen,
    FoldVertical, UnfoldVertical,
    Calendar,
} from 'lucide-react';
import { AutoCollapseToggle } from './AutoCollapseToggle';
import { CalendarDropdown, type CalendarTranslations, type DateRange } from './CalendarDropdown';

// Types

interface ContentToolbarTranslations {
    newest?: string;
    oldest?: string;
    by_date?: string;
    reading_mode?: string;
    expand_all?: string;
    collapse_all?: string;
    auto_collapse?: string;
    disabled_reading_mode?: string;
    disabled_grid_density?: string;
}

export interface ContentToolbarProps {
    sortMode: 'newest' | 'oldest' | 'date' | 'random';
    setSortMode: (mode: 'newest' | 'oldest' | 'date' | 'random') => void;
    readingMode: boolean;
    setReadingMode: (v: boolean) => void;
    expandedCount: number;
    filteredCount: number;
    onToggleAll: () => void;
    autoCollapse: boolean;
    setAutoCollapse: (v: boolean) => void;
    toolbarT?: ContentToolbarTranslations;
    showSortButtons?: boolean;
    /** Calendar date-range props (use these for full range support) */
    calendarOpen?: boolean;
    setCalendarOpen?: (v: boolean) => void;
    dateRange?: DateRange;
    onSelectRange?: (range: DateRange) => void;
    onResetRange?: () => void;
    calendarT?: CalendarTranslations;
    columns: number;
    isReadingModeManual?: boolean;
    showCalendar?: boolean;
    calendarButtonTitle?: string;
}

// Shared button styles

const btnBase = 'p-2 rounded-full border transition-all';
const btnActive = 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]';
const btnInactive =
    'border-[var(--color-card-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/40';

// Component

export function ContentToolbar({
    sortMode,
    setSortMode,
    readingMode,
    setReadingMode,
    expandedCount,
    filteredCount,
    onToggleAll,
    autoCollapse,
    setAutoCollapse,
    toolbarT,
    showSortButtons,
    calendarOpen,
    setCalendarOpen,
    dateRange,
    onSelectRange,
    onResetRange,
    calendarT,
    columns,
    isReadingModeManual,
    showCalendar = true,
    calendarButtonTitle,
}: ContentToolbarProps) {
    const isCollapseDisabled = columns >= 5 || readingMode;
    const isReadingModeDisabled = columns >= 5;

    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const mounted = useMounted();

    // ── Alignment: open left or right depending on available space ───────────
    const [calendarAlign, setCalendarAlign] = React.useState<'left' | 'right'>('left');

    useEffect(() => {
        if (calendarOpen && buttonRef.current && mounted) {
            const { left } = buttonRef.current.getBoundingClientRect();
            // 280 px = calendar width; if not enough space to the right → open left
            const alignment = left + 280 > window.innerWidth ? 'right' : 'left';
            setCalendarAlign(alignment);
        }
    }, [calendarOpen, mounted]);

    const handleToggleCalendar = () => {
        setCalendarOpen?.(!calendarOpen);
    };

    // ── Click-outside: if exactly start is set (no end), treat as single-day ─
    useEffect(() => {
        if (!calendarOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current?.contains(event.target as Node)) return;

            // Single-day selection: close and auto-complete the range
            if (dateRange?.start && !dateRange.end && onSelectRange) {
                onSelectRange({ start: dateRange.start, end: dateRange.start });
            }
            setCalendarOpen?.(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [calendarOpen, setCalendarOpen, dateRange, onSelectRange]);

    const hasDateFilter = Boolean(dateRange?.start);

    return (
        <div className="flex items-center gap-1.5 shrink-0">
            {/* Sort newest button (with previously "menor stake" icon/position) */}
            {showSortButtons !== false && (
                <button
                    onClick={() => setSortMode(sortMode === 'newest' ? 'random' : 'newest')}
                    title={toolbarT?.newest || 'Sort Newest'}
                    className={`${btnBase} ${sortMode === 'newest' ? btnActive : btnInactive}`}
                >
                    <SortAsc className="w-4 h-4" />
                </button>
            )}

            {/* Sort oldest button (with previously "mayor stake" icon/position) */}
            {showSortButtons !== false && (
                <button
                    onClick={() => setSortMode(sortMode === 'oldest' ? 'random' : 'oldest')}
                    title={toolbarT?.oldest || 'Sort Oldest'}
                    className={`${btnBase} ${sortMode === 'oldest' ? btnActive : btnInactive}`}
                >
                    <SortDesc className="w-4 h-4" />
                </button>
            )}

            {/* Calendar filter */}
            {showCalendar && setCalendarOpen && calendarT && (
                <div className="relative calendar-dropdown-container" ref={containerRef}>
                    <button
                        ref={buttonRef}
                        onClick={handleToggleCalendar}
                        title={calendarButtonTitle || toolbarT?.by_date || 'By Date'}
                        className={`${btnBase} ${calendarOpen || hasDateFilter ? btnActive : btnInactive}`}
                    >
                        <Calendar className="w-4 h-4" />
                    </button>

                    {onSelectRange && (
                        <CalendarDropdown
                            open={!!calendarOpen}
                            align={calendarAlign}
                            calendarT={calendarT}
                            dateRange={dateRange ?? { start: null, end: null }}
                            onSelectRange={onSelectRange}
                            onReset={() => {
                                onResetRange?.();
                                setCalendarOpen?.(false);
                            }}
                        />
                    )}
                </div>
            )}

            {/* Reading mode */}
            <button
                onClick={isReadingModeDisabled ? undefined : () => setReadingMode(!readingMode)}
                title={toolbarT?.reading_mode || 'Reading Mode'}
                disabled={isReadingModeDisabled}
                className={`${btnBase} ${readingMode ? btnActive : btnInactive} ${isReadingModeDisabled ? (readingMode ? 'cursor-default' : 'cursor-default opacity-80') : ''}`}
            >
                <BookOpen className="w-4 h-4" />
            </button>

            {/* Expand / Collapse all */}
            <button
                onClick={isCollapseDisabled ? undefined : onToggleAll}
                title={isCollapseDisabled 
                    ? (isReadingModeManual && readingMode ? toolbarT?.disabled_reading_mode : toolbarT?.disabled_grid_density)
                    : (expandedCount > 0 ? (toolbarT?.collapse_all || 'Collapse All') : (toolbarT?.expand_all || 'Expand All'))
                }
                disabled={isCollapseDisabled}
                className={`${btnBase} ${expandedCount === filteredCount && filteredCount > 0 ? btnActive : btnInactive} ${isCollapseDisabled ? 'opacity-30 cursor-default border-dashed' : ''}`}
            >
                {expandedCount > 0
                    ? <FoldVertical className="w-4 h-4" />
                    : <UnfoldVertical className="w-4 h-4" />}
            </button>

            <AutoCollapseToggle
                autoCollapse={autoCollapse}
                onToggle={setAutoCollapse}
                activeTitle={toolbarT?.auto_collapse}
                inactiveTitle={toolbarT?.auto_collapse}
                disabledTitle={isReadingModeManual && readingMode ? toolbarT?.disabled_reading_mode : toolbarT?.disabled_grid_density}
                size="md"
                disabled={isCollapseDisabled}
            />
        </div>
    );
}
