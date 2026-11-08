'use client';
/**
 * A plain button with the chosen day that opens the explorer's calendar (the
 * one that filters transactions by date) to pick one day between `minDate`
 * and `maxDate`. Opens in the flow of the content, so a card that clips its
 * overflow does not cut it.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { CalendarDropdown, type CalendarTranslations } from '@/components/ui/CalendarDropdown';

/** A YYYY-MM-DD day as the locale writes it, in UTC. */
export const dayLabel = (day: string, locale: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

export function DayPicker({ day, onPick, calendarT, placeholder, locale, minDate, maxDate }: {
  day: string;
  onPick: (day: string) => void;
  calendarT?: CalendarTranslations;
  /** The button text before a day is chosen. */
  placeholder: string;
  locale: string;
  minDate: string;
  maxDate: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${open || day ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-primary)]'}`}
      >
        <Calendar className="size-4" />
        {day ? `${dayLabel(day, locale)} (UTC)` : placeholder}
      </button>
      {calendarT && (
        <CalendarDropdown
          key={String(open)}
          open={open}
          calendarT={calendarT}
          dateRange={{ start: day || null, end: day || null }}
          // One day: the first click picks it.
          onSelectRange={(r) => { if (r.start) { onPick(r.start); setOpen(false); } }}
          onReset={() => { onPick(''); setOpen(false); }}
          minDate={minDate}
          maxDate={maxDate}
          inline
        />
      )}
    </div>
  );
}
