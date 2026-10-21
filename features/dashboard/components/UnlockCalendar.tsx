'use client';

import React, { useState } from 'react';
import { Table2, BarChart3 } from 'lucide-react';
import { formatShortXRD } from '@/utils/formatters';
import type { NetworkUnstakingData } from '../services/apiClient';
import type { TranslationsT } from '../types';

interface UnlockCalendarProps {
    schedule: NetworkUnstakingData['schedule'];
    dt?: Partial<TranslationsT['dashboard']>;
    locale: string;
}

/** The plot grows with its column, down to this height; the x-axis labels sit below it. */
const MIN_PLOT_HEIGHT = 200;
/** Room above the plot for the label of a bar that reaches the top. */
const TOP_ROOM = 20;
const MAX_BAR_WIDTH = 24;
/** Height of the x-axis labels below the plot. */
const X_AXIS = 22;

/** The next "round" figure at or above `value` (1, 2, 5 × 10ⁿ), so the axis ends on a clean number. */
function niceCeil(value: number): number {
    if (value <= 0) return 1;
    const magnitude = 10 ** Math.floor(Math.log10(value));
    const unit = value / magnitude;
    return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * magnitude;
}

const utcDay = (date: string) => new Date(`${date}T00:00:00Z`);

/**
 * When the XRD that is unlocking now becomes claimable, by day.
 *
 * One series, so one colour and no legend: the title says what is plotted. Bars
 * rise from a single baseline and stop at 24 px; only the largest carries its
 * value, the axis and the tooltip carry the rest, and the table twin carries
 * them all. Every bar is a hover and focus target as wide as its whole column.
 */
export function UnlockCalendar({ schedule, dt, locale }: UnlockCalendarProps) {
    const t = dt?.insights;
    const [asTable, setAsTable] = useState(false);
    const [active, setActive] = useState<number | null>(null);

    const max = Math.max(0, ...schedule.map(d => d.xrd));
    const top = niceCeil(max);
    const peak = max > 0 ? schedule.findIndex(d => d.xrd === max) : -1;
    const dayName = (date: string, long = false) =>
        utcDay(date).toLocaleDateString(locale, long
            ? { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }
            : { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
    const total = schedule.reduce((sum, d) => sum + d.xrd, 0);
    const summary = `${t?.calendar_title ?? 'Unlock calendar'}: ${schedule.map(d => `${dayName(d.date, true)} ${formatShortXRD(d.xrd, locale)} XRD`).join(', ')}`;

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-black uppercase tracking-wider text-[var(--color-text-main)]">
                        {t?.calendar_title ?? 'Unlock calendar'}
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{t?.calendar_subtitle}</p>
                </div>
                <button
                    type="button"
                    onClick={() => setAsTable(v => !v)}
                    aria-pressed={asTable}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-card-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/40 transition-colors"
                >
                    {asTable ? <BarChart3 className="size-3.5" /> : <Table2 className="size-3.5" />}
                    {asTable ? (t?.calendar_chart ?? 'Chart') : (t?.calendar_table ?? 'Table')}
                </button>
            </div>

            {asTable ? (
                <table className="w-full max-w-md text-sm">
                    <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
                            <th className="py-1.5 font-bold">{t?.calendar_date ?? 'Date (UTC)'}</th>
                            <th className="py-1.5 font-bold text-right">XRD</th>
                        </tr>
                    </thead>
                    <tbody>
                        {schedule.map((d, i) => (
                            <tr key={d.date} className="border-t border-[var(--color-card-border)]">
                                <td className="py-1.5 text-[var(--color-text-main)]">{i === 0 ? `${t?.calendar_today ?? 'Today'} · ` : ''}{dayName(d.date, true)}</td>
                                <td className="py-1.5 text-right font-bold text-[var(--color-text-main)] tabular-nums">{Math.round(d.xrd).toLocaleString(locale)}</td>
                            </tr>
                        ))}
                        <tr className="border-t border-[var(--color-card-border)]">
                            <td className="py-1.5 font-bold text-[var(--color-text-main)]">{t?.calendar_total ?? 'Total'}</td>
                            <td className="py-1.5 text-right font-black text-[var(--color-text-main)] tabular-nums">{Math.round(total).toLocaleString(locale)}</td>
                        </tr>
                    </tbody>
                </table>
            ) : (
                <div className="flex flex-1 gap-2" role="img" aria-label={summary} style={{ minHeight: MIN_PLOT_HEIGHT + TOP_ROOM }}>
                    {/* Y axis: compact ticks, aligned with the hairlines */}
                    <div className="relative w-10 shrink-0 text-right text-[10px] text-[var(--color-text-muted)] tabular-nums" style={{ paddingTop: TOP_ROOM, paddingBottom: X_AXIS }}>
                        <div className="relative h-full">
                            {[1, 0.5, 0].map(share => (
                                <span key={share} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - share) * 100}%` }}>
                                    {share === 0 ? '0' : formatShortXRD(top * share, locale)}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="relative flex min-w-0 flex-1 flex-col" style={{ paddingTop: TOP_ROOM }}>
                        <div className="relative flex-1">
                            {/* Hairlines, solid and one step off the surface */}
                            <div className="absolute inset-0" aria-hidden="true">
                                {[0, 50, 100].map(pct => (
                                    <div key={pct} className="absolute inset-x-0 border-t border-[var(--color-card-border)]" style={{ top: `${pct}%` }} />
                                ))}
                            </div>

                            <div className="absolute inset-x-0 -top-5 bottom-0 grid" style={{ gridTemplateColumns: `repeat(${schedule.length}, minmax(0, 1fr))` }}>
                                {schedule.map((d, i) => {
                                    const share = d.xrd / top;
                                    // Bars are a share of the plot, which sits TOP_ROOM below this column's top.
                                    const barHeight = `calc((100% - ${TOP_ROOM}px) * ${Math.max(share, d.xrd > 0 ? 0.01 : 0)})`;
                                    const edge = i < 2 ? 'left-0' : i > schedule.length - 3 ? 'right-0' : 'left-1/2 -translate-x-1/2';
                                    return (
                                        <div
                                            key={d.date}
                                            tabIndex={0}
                                            aria-label={`${dayName(d.date, true)}: ${Math.round(d.xrd).toLocaleString(locale)} XRD`}
                                            onPointerEnter={() => setActive(i)}
                                            onPointerLeave={() => setActive(null)}
                                            onFocus={() => setActive(i)}
                                            onBlur={() => setActive(null)}
                                            className="relative flex items-end justify-center outline-none"
                                        >
                                            {d.xrd > 0 && (
                                                <div
                                                    className={`w-full rounded-t-[4px] bg-[var(--color-primary)] transition-opacity ${active !== null && active !== i ? 'opacity-50' : ''}`}
                                                    style={{ height: barHeight, minHeight: 2, maxWidth: MAX_BAR_WIDTH }}
                                                />
                                            )}
                                            {i === peak && (
                                                <span
                                                    className="absolute left-1/2 -translate-x-1/2 text-[10px] font-bold text-[var(--color-text-main)] whitespace-nowrap"
                                                    style={{ bottom: `calc(${barHeight} + 3px)` }}
                                                >
                                                    {formatShortXRD(d.xrd, locale)}
                                                </span>
                                            )}
                                            {active === i && (
                                                <div className={`pointer-events-none absolute z-10 ${edge} rounded-lg border border-[var(--color-card-border)] bg-[var(--color-surface)] px-2.5 py-1.5 shadow-lg whitespace-nowrap`} style={{ bottom: `calc(${barHeight} + 22px)` }}>
                                                    <div className="text-sm font-black text-[var(--color-text-main)]">{Math.round(d.xrd).toLocaleString(locale)} XRD</div>
                                                    <div className="text-[11px] text-[var(--color-text-muted)]">{dayName(d.date, true)}</div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* X axis */}
                        <div className="grid mt-1.5" style={{ gridTemplateColumns: `repeat(${schedule.length}, minmax(0, 1fr))`, height: X_AXIS - 6 }} aria-hidden="true">
                            {schedule.map((d, i) => (
                                <span key={d.date} className={`text-center text-[10px] truncate ${i === 0 ? 'font-bold text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)]'}`}>
                                    {i === 0 ? (t?.calendar_today ?? 'Today') : dayName(d.date)}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
