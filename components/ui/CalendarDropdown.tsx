'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface CalendarTranslations {
    month: string;
    year: string;
    weekdays: string[];
    reset_button: string;
    apply_button: string;
    start_date: string;
    end_date: string;
    range_placeholder: string;
}

export interface DateRange {
    start: string | null;
    end: string | null;
}

interface CalendarDropdownProps {
    open: boolean;
    /** 'left' anchors to the left edge of the trigger, 'right' to the right edge. */
    align?: 'left' | 'right';
    calendarT: CalendarTranslations;
    dateRange: DateRange;
    onSelectRange: (range: DateRange) => void;
    onReset: () => void;
}

// Helpers

const _monthFmt = new Intl.DateTimeFormat(undefined, { month: 'long' });

function toDateStr(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isBeforeOrEqual(a: string, b: string): boolean {
    return a <= b;
}

// -----------------------------------------------------------------------------
/**
 * CalendarDropdown — Date Range Picker
 *
 * Supports selecting a start and end date.
 * `align` controls which edge the dropdown is anchored to so it never
 * overflows the viewport (the parent ContentToolbar computes this).
 */
export function CalendarDropdown({
    open,
    align = 'left',
    calendarT,
    dateRange,
    onSelectRange,
    onReset,
}: CalendarDropdownProps) {
    // Initialize viewDate to the start date if provided, otherwise today
    const [viewDate, setViewDate] = useState(() => {
        if (dateRange?.start) {
            const [y, m, d] = dateRange.start.split('-');
            if (y && m && d) return new Date(Number(y), Number(m) - 1, Number(d));
        }
        return new Date();
    });

    const currentMonth = viewDate.getMonth();
    const currentYear = viewDate.getFullYear();

    const monthName = _monthFmt.format(viewDate);
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    // Sunday=0 → shift so Monday=0 for a Mon-first grid
    const rawFirstDay = new Date(currentYear, currentMonth, 1).getDay();
    const firstDayOfMonth = (rawFirstDay + 6) % 7; // Mon-first offset

    const handlePrevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));

    const handleDayClick = (day: number) => {
        const dateStr = toDateStr(currentYear, currentMonth, day);

        if (!dateRange.start || (dateRange.start && dateRange.end)) {
            // Begin a new selection
            onSelectRange({ start: dateStr, end: null });
        } else {
            // Complete the range
            if (isBeforeOrEqual(dateStr, dateRange.start)) {
                onSelectRange({ start: dateStr, end: dateRange.start });
            } else {
                onSelectRange({ start: dateRange.start, end: dateStr });
            }
        }
    };

    const isStartOrEnd = (day: number): boolean => {
        const dateStr = toDateStr(currentYear, currentMonth, day);
        return dateRange.start === dateStr || dateRange.end === dateStr;
    };

    const isInRange = (day: number): boolean => {
        if (!dateRange.start || !dateRange.end) return false;
        const dateStr = toDateStr(currentYear, currentMonth, day);
        return dateStr > dateRange.start && dateStr < dateRange.end;
    };

    const isToday = (day: number): boolean => {
        const today = new Date();
        return (
            currentYear === today.getFullYear() &&
            currentMonth === today.getMonth() &&
            day === today.getDate()
        );
    };

    // Weekday headers: Mon-first order derived from translations
    // translations provide Sun-first [Su,Mo,Tu,We,Th,Fr,Sa]
    const weekdaysSunFirst = calendarT.weekdays.length === 7
        ? calendarT.weekdays
        : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const weekdaysMonFirst = [...weekdaysSunFirst.slice(1), weekdaysSunFirst[0]];

    const positionClass = align === 'right' ? 'right-0' : 'left-0';

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className={`absolute ${positionClass} top-full mt-2 p-4 w-[280px] rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] shadow-2xl z-[60]`}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Month navigation */}
                    <div className="flex items-center justify-between mb-4 px-1">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="text-[var(--color-text-main)] hover:text-[var(--color-primary)] transition-colors text-lg font-bold"
                        >
                            &lt;
                        </button>
                        <div className="text-[var(--color-primary)] font-bold text-base capitalize">
                            {monthName} {currentYear}
                        </div>
                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className="text-[var(--color-text-main)] hover:text-[var(--color-primary)] transition-colors text-lg font-bold"
                        >
                            &gt;
                        </button>
                    </div>

                    {/* Weekday headers (Mon-first) */}
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[var(--color-text-muted)] mb-3">
                        {weekdaysMonFirst.map((d) => (
                            <div key={d} className="py-1">{d}</div>
                        ))}
                    </div>

                    {/* Day grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                            <div key={`empty-${i}`} className="aspect-square" />
                        ))}

                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const selected = isStartOrEnd(day);
                            const inRange = isInRange(day);
                            const today = isToday(day);

                            return (
                                <button
                                    type="button"
                                    key={day}
                                    onClick={() => handleDayClick(day)}
                                    className={[
                                        'relative aspect-square flex items-center justify-center text-[13px] rounded-lg transition-all duration-150',
                                        selected
                                            ? 'border border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/10 font-bold'
                                            : inRange
                                                ? 'bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
                                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-primary)]/5',
                                        today && !selected ? 'border-b-2 border-[var(--color-primary)]' : '',
                                    ].join(' ')}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>

                    {/* Reset */}
                    <div className="mt-4 pt-3 border-t border-[var(--color-card-border)]/30 flex justify-center">
                        <button
                            type="button"
                            onClick={onReset}
                            className="text-red-500 hover:text-red-400 text-[13px] font-semibold transition-colors px-2"
                        >
                            {calendarT.reset_button}
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
