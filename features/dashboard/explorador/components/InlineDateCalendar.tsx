'use client';
/**
 * Directly-visible UTC day picker for the "On a date" account tabs (Babylon &
 * Olympia): month/year jump selects, prev/next arrows, Mon-first day grid,
 * and quick-date shortcuts bounded strictly to `[minDate, maxDate]`.
 */
import React, { useState } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import type { CalendarTranslations } from '@/components/ui/CalendarDropdown';
import { dayLabel } from './DayPicker';

function toDateStr(year: number, monthIndex: number, day: number): string {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseYm(day: string): { year: number; month: number } {
    const [y, m] = day.split('-');
    return { year: Number(y) || 2024, month: (Number(m) || 1) - 1 };
}

function clampYm(year: number, month: number, minDate: string, maxDate: string): { year: number; month: number } {
    const min = parseYm(minDate);
    const max = parseYm(maxDate);
    const val = year * 12 + month;
    const lo = min.year * 12 + min.month;
    const hi = max.year * 12 + max.month;
    const clamped = Math.min(hi, Math.max(lo, val));
    return { year: Math.floor(clamped / 12), month: clamped % 12 };
}

export interface QuickShortcut {
    day: string;
    label: string;
}

export interface InlineDateCalendarLabels {
    today?: string;
    yesterday?: string;
    lastDay?: string;
    firstDay?: string;
    reset?: string;
    prevMonth?: string;
    nextMonth?: string;
    yearEndPrefix?: string;
    toggleCalendar?: string;
}

function localTodayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function InlineDateCalendar({
    day,
    onPick,
    calendarT,
    placeholder,
    locale,
    minDate,
    maxDate,
    rangeHint,
    timezoneLabel = 'UTC',
    useLocalTime = false,
    labels,
}: {
    day: string;
    onPick: (day: string) => void;
    calendarT?: CalendarTranslations;
    placeholder: string;
    locale: string;
    minDate: string;
    maxDate: string;
    rangeHint?: string;
    timezoneLabel?: string;
    useLocalTime?: boolean;
    labels?: InlineDateCalendarLabels;
}) {
    const todayStr = useLocalTime ? localTodayStr() : new Date().toISOString().slice(0, 10);

    const [view, setView] = useState<{ year: number; month: number }>(() => {
        if (day) return clampYm(parseYm(day).year, parseYm(day).month, minDate, maxDate);
        const initial = todayStr <= maxDate && todayStr >= minDate ? todayStr : maxDate;
        return parseYm(initial);
    });
    const [mobileCollapsed, setMobileCollapsed] = useState(false);

    const { year: currentYear, month: currentMonth } = view;
    const minYm = parseYm(minDate);
    const maxYm = parseYm(maxDate);

    const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' });

    const years: number[] = [];
    for (let y = maxYm.year; y >= minYm.year; y--) years.push(y);

    const startM = currentYear === minYm.year ? minYm.month : 0;
    const endM = currentYear === maxYm.year ? maxYm.month : 11;
    const monthsForYear: { index: number; name: string }[] = [];
    for (let m = startM; m <= endM; m++) {
        monthsForYear.push({ index: m, name: monthFormatter.format(new Date(Date.UTC(currentYear, m, 1))) });
    }

    const daysInMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();
    // Sunday=0 → shift so Monday=0
    const rawFirstDay = new Date(Date.UTC(currentYear, currentMonth, 1)).getUTCDay();
    const firstDayOfMonth = (rawFirstDay + 6) % 7;

    const canPrev = currentYear * 12 + currentMonth > minYm.year * 12 + minYm.month;
    const canNext = currentYear * 12 + currentMonth < maxYm.year * 12 + maxYm.month;

    const stepMonth = (delta: number) => {
        setView((v) => clampYm(v.year, v.month + delta, minDate, maxDate));
    };

    const handleYearChange = (nextYear: number) => {
        setView((v) => clampYm(nextYear, v.month, minDate, maxDate));
    };

    const handleMonthChange = (nextMonth: number) => {
        setView((v) => clampYm(v.year, nextMonth, minDate, maxDate));
    };

    const selectDay = (nextDay: string) => {
        onPick(nextDay);
        const ym = parseYm(nextDay);
        setView(clampYm(ym.year, ym.month, minDate, maxDate));
    };

    const shortcuts: QuickShortcut[] = (() => {
        const out: QuickShortcut[] = [];
        const pushIfValid = (d: string, label: string) => {
            if (d >= minDate && d <= maxDate && !out.some((s) => s.day === d)) {
                out.push({ day: d, label });
            }
        };
        if (maxDate === todayStr) {
            pushIfValid(todayStr, labels?.today ?? '');
            const yest = new Date(Date.parse(`${todayStr}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
            pushIfValid(yest, labels?.yesterday ?? '');
            const prevYear = Number(todayStr.slice(0, 4)) - 1;
            pushIfValid(`${prevYear}-12-31`, `${labels?.yearEndPrefix ?? ''} ${prevYear}`.trim());
        } else {
            pushIfValid(maxDate, labels?.lastDay ?? '');
            for (let y = maxYm.year - 1; y >= minYm.year; y--) {
                pushIfValid(`${y}-12-31`, `${labels?.yearEndPrefix ?? ''} ${y}`.trim());
            }
            pushIfValid(minDate, labels?.firstDay ?? '');
        }
        return out.slice(0, 4);
    })();

    const weekdaysSunFirst = calendarT?.weekdays?.length === 7
        ? calendarT.weekdays
        : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const weekdaysMonFirst = [...weekdaysSunFirst.slice(1), weekdaysSunFirst[0]];

    return (
        <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)]/80 p-3.5 space-y-3 shadow-sm">
            {/* Header: selected day + mobile collapse toggle / clear */}
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--color-card-border)]/60">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="size-7 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center shrink-0">
                        <Calendar className="size-3.5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--color-text-main)] truncate">
                            {day ? `${dayLabel(day, locale)}${timezoneLabel ? ` (${timezoneLabel})` : ''}` : placeholder}
                        </p>
                        {rangeHint && (
                            <p className="text-[10px] text-[var(--color-text-muted)] truncate">
                                {rangeHint}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {day && (
                        <button
                            type="button"
                            onClick={() => onPick('')}
                            title={labels?.reset ?? calendarT?.reset_button ?? 'Reset'}
                            aria-label={labels?.reset ?? calendarT?.reset_button ?? 'Reset'}
                            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"
                        >
                            <RotateCcw className="size-3.5" />
                        </button>
                    )}
                    {day && (
                        <button
                            type="button"
                            onClick={() => setMobileCollapsed((v) => !v)}
                            aria-expanded={!mobileCollapsed}
                            aria-label={labels?.toggleCalendar ?? placeholder}
                            className="lg:hidden p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors"
                        >
                            <ChevronDown className={`size-4 transition-transform duration-200 ${mobileCollapsed ? '' : 'rotate-180'}`} />
                        </button>
                    )}
                </div>
            </div>

            {/* Calendar body: always visible on lg+, collapsible on mobile once a day is picked */}
            <div className={day && mobileCollapsed ? 'hidden lg:block space-y-3' : 'space-y-3'}>
                {/* Month & Year selectors + Prev/Next */}
                <div className="flex items-center justify-between gap-1.5">
                    <button
                        type="button"
                        onClick={() => stepMonth(-1)}
                        disabled={!canPrev}
                        aria-label={labels?.prevMonth ?? '<'}
                        className="size-[30px] shrink-0 rounded-lg flex items-center justify-center text-[var(--color-text-main)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft className="size-4" />
                    </button>

                    <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-center">
                        <select
                            name="calendar-month"
                            aria-label={calendarT?.month ?? 'Month'}
                            value={currentMonth}
                            onChange={(e) => handleMonthChange(Number(e.target.value))}
                            className="calendar-select text-[var(--color-text-main)] capitalize min-w-[104px] flex-1"
                        >
                            {monthsForYear.map((m) => (
                                <option key={m.index} value={m.index} className="capitalize">
                                    {m.name}
                                </option>
                            ))}
                        </select>
                        <select
                            name="calendar-year"
                            aria-label={calendarT?.year ?? 'Year'}
                            value={currentYear}
                            onChange={(e) => handleYearChange(Number(e.target.value))}
                            className="calendar-select text-[var(--color-primary)] min-w-[62px] shrink-0"
                        >
                            {years.map((y) => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={() => stepMonth(1)}
                        disabled={!canNext}
                        aria-label={labels?.nextMonth ?? '>'}
                        className="size-[30px] shrink-0 rounded-lg flex items-center justify-center text-[var(--color-text-main)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                    >
                        <ChevronRight className="size-4" />
                    </button>
                </div>

                {/* Weekday headers (Mon-first) */}
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">
                    {weekdaysMonFirst.map((wd) => (
                        <div key={wd} className="py-1">{wd}</div>
                    ))}
                </div>

                {/* Day grid */}
                <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square" />
                    ))}

                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const d = i + 1;
                        const dateStr = toDateStr(currentYear, currentMonth, d);
                        const disabled = dateStr < minDate || dateStr > maxDate;
                        const selected = dateStr === day;
                        const isToday = dateStr === todayStr;

                        return (
                            <button
                                key={d}
                                type="button"
                                disabled={disabled}
                                aria-pressed={selected}
                                aria-current={isToday ? 'date' : undefined}
                                aria-label={dayLabel(dateStr, locale)}
                                onClick={() => selectDay(dateStr)}
                                className={[
                                    'relative aspect-square flex items-center justify-center text-xs rounded-lg transition-all duration-150 font-mono',
                                    disabled
                                        ? 'text-[var(--color-text-muted)] opacity-25 cursor-not-allowed'
                                        : selected
                                            ? 'bg-[var(--color-primary)] text-white font-bold shadow-sm shadow-[var(--color-primary)]/25'
                                            : 'text-[var(--color-text-main)] hover:bg-[var(--color-primary)]/12 hover:text-[var(--color-primary)] cursor-pointer',
                                    isToday && !selected && !disabled ? 'ring-1 ring-[var(--color-primary)]/60 font-bold' : '',
                                ].join(' ')}
                            >
                                {d}
                            </button>
                        );
                    })}
                </div>

                {/* Quick date shortcuts */}
                {shortcuts.length > 0 && (
                    <div className="pt-2.5 border-t border-[var(--color-card-border)]/50 flex flex-wrap gap-1.5">
                        {shortcuts.map((s) => {
                            const active = day === s.day;
                            return (
                                <button
                                    key={s.day}
                                    type="button"
                                    onClick={() => selectDay(s.day)}
                                    className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors border ${
                                        active
                                            ? 'bg-[var(--color-primary)]/15 border-[var(--color-primary)]/40 text-[var(--color-primary)]'
                                            : 'bg-[var(--color-bg)] border-[var(--color-card-border)]/70 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:border-[var(--color-primary)]/35'
                                    }`}
                                >
                                    {s.label}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
