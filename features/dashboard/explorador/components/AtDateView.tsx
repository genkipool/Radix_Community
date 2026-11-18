'use client';
/**
 * The frame of an "On a date" tab (Babylon and Olympia accounts alike):
 * a directly-visible calendar panel on the left (sticky on desktop, compact
 * and collapsible on mobile once a day is chosen), paired with the account's
 * snapshot on the right.
 */
import React from 'react';
import { Calendar } from 'lucide-react';
import type { CalendarTranslations } from '@/components/ui/CalendarDropdown';
import { ErrorText, Loading, Section } from '../olympia/OlympiaParts';
import { dayLabel } from './DayPicker';
import { InlineDateCalendar, type InlineDateCalendarLabels } from './InlineDateCalendar';

export function AtDateView({
    day, onPick, calendarT, locale, minDate, maxDate, timezoneLabel = 'UTC', useLocalTime = false, text, status, stateVersion, children,
}: {
    day: string;
    onPick: (day: string) => void;
    calendarT?: CalendarTranslations;
    locale: string;
    minDate: string;
    maxDate: string;
    /** Timezone label shown next to the selected date (e.g. 'CET' or 'UTC'). */
    timezoneLabel?: string;
    /** Use the browser's local date for "today" and shortcuts instead of UTC. */
    useLocalTime?: boolean;
    text: {
        pick?: string;
        /** What the tab shows, with `{from}` and `{to}` for the range. */
        desc?: string;
        empty?: string;
        loading?: string;
        error?: string;
        /** The section title, with `{date}` (and optional `{tz}`). */
        state?: string;
        stateVersion?: string;
        today?: string;
        yesterday?: string;
        lastDay?: string;
        firstDay?: string;
        yearEndPrefix?: string;
    };
    status: 'loading' | 'error' | 'ready';
    stateVersion?: number;
    children?: React.ReactNode;
}) {
    const fill = (template: string | undefined, values: Record<string, string>) =>
        (template ?? '').replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? '');

    const fromLabel = dayLabel(minDate, locale);
    const toLabel = dayLabel(maxDate, locale);
    const description = fill(text.desc, { from: fromLabel, to: toLabel });
    const tzSuffix = timezoneLabel ? ` (${timezoneLabel})` : '';
    const stateTitle = day ? fill(text.state, { date: dayLabel(day, locale), tz: tzSuffix }) : '';

    const calendarLabels: InlineDateCalendarLabels = {
        today: text.today,
        yesterday: text.yesterday,
        lastDay: text.lastDay,
        firstDay: text.firstDay,
        yearEndPrefix: text.yearEndPrefix,
    };

    return (
        <div className={`grid grid-cols-1 lg:grid-cols-[296px_minmax(0,1fr)] gap-5 ${day ? 'items-start' : 'items-stretch'}`}>
            {/* Directly-visible calendar column */}
            <div className={day ? 'lg:sticky lg:top-4 space-y-2.5' : 'space-y-2.5'}>
                <InlineDateCalendar
                    day={day}
                    onPick={onPick}
                    calendarT={calendarT}
                    placeholder={text.pick ?? ''}
                    locale={locale}
                    minDate={minDate}
                    maxDate={maxDate}
                    rangeHint={`${fromLabel} – ${toLabel}`}
                    timezoneLabel={timezoneLabel}
                    useLocalTime={useLocalTime}
                    labels={calendarLabels}
                />
                {day && description && (
                    <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)] px-1">
                        {description}
                    </p>
                )}
            </div>

            {/* Snapshot column */}
            <div className={`min-w-0 ${day ? 'space-y-4' : 'flex flex-col'}`}>
                {!day ? (
                    <div className="flex-1 rounded-xl border border-dashed border-[var(--color-card-border)] bg-[var(--color-surface)]/40 px-6 py-8 flex flex-col items-center justify-center text-center gap-3">
                        <div className="size-11 rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center">
                            <Calendar className="size-5" />
                        </div>
                        <p className="text-sm font-bold text-[var(--color-text-main)]">
                            {text.empty}
                        </p>
                        {description && (
                            <p className="text-xs text-[var(--color-text-muted)] max-w-md leading-relaxed">
                                {description}
                            </p>
                        )}
                    </div>
                ) : status === 'loading' ? (
                    <Section title={stateTitle}>
                        <Loading text={text.loading} />
                    </Section>
                ) : status === 'error' ? (
                    <Section title={stateTitle}>
                        <ErrorText text={text.error} />
                    </Section>
                ) : (
                    <Section
                        title={stateTitle}
                        aside={stateVersion !== undefined && (
                            <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                                {text.stateVersion} {stateVersion.toLocaleString(locale)}
                            </span>
                        )}
                    >
                        {children}
                    </Section>
                )}
            </div>
        </div>
    );
}
