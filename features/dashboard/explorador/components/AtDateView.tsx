'use client';
/**
 * The frame of an "On a date" tab (Babylon and Olympia accounts alike): the
 * day picker with what the tab shows, then, once a day is chosen, its loading
 * or error state, or a section titled with the day and the ledger state
 * version it was read at, holding the caller's content.
 */
import React from 'react';
import type { CalendarTranslations } from '@/components/ui/CalendarDropdown';
import { Empty, ErrorText, Loading, Section } from '../olympia/OlympiaParts';
import { DayPicker, dayLabel } from './DayPicker';

export function AtDateView({
    day, onPick, calendarT, locale, minDate, maxDate, text, status, stateVersion, children,
}: {
    day: string;
    onPick: (day: string) => void;
    calendarT?: CalendarTranslations;
    locale: string;
    minDate: string;
    maxDate: string;
    text: {
        pick?: string;
        /** What the tab shows, with `{from}` and `{to}` for the range. */
        desc?: string;
        empty?: string;
        loading?: string;
        error?: string;
        /** The section title, with `{date}`. */
        state?: string;
        stateVersion?: string;
    };
    status: 'loading' | 'error' | 'ready';
    stateVersion?: number;
    children?: React.ReactNode;
}) {
    const fill = (template: string | undefined, values: Record<string, string>) =>
        (template ?? '').replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? '');
    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <DayPicker day={day} onPick={onPick} calendarT={calendarT} placeholder={text.pick ?? ''} locale={locale} minDate={minDate} maxDate={maxDate} />
                <p className="text-[11px] text-[var(--color-text-muted)]">{fill(text.desc, { from: dayLabel(minDate, locale), to: dayLabel(maxDate, locale) })}</p>
            </div>
            {!day ? (
                <Empty text={text.empty} />
            ) : status === 'loading' ? (
                <Loading text={text.loading} />
            ) : status === 'error' ? (
                <ErrorText text={text.error} />
            ) : (
                <Section
                    title={fill(text.state, { date: dayLabel(day, locale) })}
                    aside={stateVersion !== undefined && <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{text.stateVersion} {stateVersion.toLocaleString(locale)}</span>}
                >
                    {children}
                </Section>
            )}
        </div>
    );
}
