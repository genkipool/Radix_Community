'use client';
/**
 * Expanded detail panel inside a year row of `RewardsYearsTable`: follows the
 * same minimalist borderless table design as the transactions table (opaque
 * surface header row, `px-4` padding, left primary inset highlight on hover),
 * defaulting to monthly breakdown with click-to-drill into daily rows, plus
 * percentage gain/loss if sold today with explanatory tooltips on every column.
 */
import React, { useState } from 'react';
import { CalendarDays, Layers, X } from 'lucide-react';
import { formatCurrency, formatFiatPrecise, type FiatCurrency } from '@/utils/currencyUtils';
import { formatNumber } from '@/utils/formatters';
import {
    computeFiatChangePct,
    fiatChangeTone,
    formatRewardDay,
    formatRewardMonth,
    formatSignedCurrency,
    formatSignedPercent,
    formatXrdUnitPrice,
    type RewardsValuationMode,
    type YearRewardsBreakdown,
} from '../utils/rewardsBreakdown';

export interface RewardsBreakdownLabels {
    byMonth: string;
    byMonthTooltip?: string;
    byDay: string;
    byDayTooltip?: string;
    month: string;
    monthTooltip?: string;
    monthRowHint?: string;
    date: string;
    dateTooltip?: string;
    days: string;
    daysTooltip?: string;
    delegator: string;
    delegatorTooltip?: string;
    fee: string;
    feeTooltip?: string;
    delegators: string;
    delegatorsTooltip?: string;
    total: string;
    totalTooltip?: string;
    unitPrice: string;
    unitPriceTooltip?: string;
    fiatAtReceipt: string;
    fiatAtReceiptTooltip?: string;
    fiatCurrent: string;
    fiatCurrentTooltip?: string;
    fiatChange: string;
    fiatChangeTooltip?: string;
    fiatChangeCellTooltip?: string;
    allMonths: string;
    empty: string;
    fiatNote: string;
}

export function RewardsYearBreakdown({
    breakdown,
    currency,
    locale,
    showFee,
    mode = 'account',
    labels,
}: {
    breakdown: YearRewardsBreakdown;
    currency: FiatCurrency;
    locale: string;
    showFee: boolean;
    mode?: RewardsValuationMode;
    labels: RewardsBreakdownLabels;
}) {
    const [view, setView] = useState<'monthly' | 'daily'>('monthly');
    const [monthFilter, setMonthFilter] = useState<string | null>(null);

    const visibleDays = monthFilter
        ? breakdown.days.filter((d) => d.date.startsWith(monthFilter))
        : breakdown.days;

    if (breakdown.days.length === 0) {
        return (
            <p className="py-4 px-6 text-xs text-[var(--color-text-muted)]">
                {labels.empty}
            </p>
        );
    }

    const fmtXrd = (n: number) => `${formatNumber(n, 2, locale)} XRD`;
    const fmtFiat = (n: number | null) => (n === null ? '—' : formatCurrency(n, currency, locale));
    const fmtDayFiat = (n: number | null) => (n === null ? '—' : formatFiatPrecise(n, currency, locale));
    const isAccount = mode === 'account';

    const changeCellTooltip = (atReceipt: number | null, current: number | null): string | undefined => {
        if (atReceipt === null || current === null) return undefined;
        const delta = formatSignedCurrency(current - atReceipt, currency, locale);
        return (labels.fiatChangeCellTooltip ?? '{delta}').replace('{delta}', delta);
    };

    const th = 'py-2.5 px-4 font-semibold whitespace-nowrap bg-[var(--color-surface)]';
    const num = 'py-2.5 px-4 text-right font-mono text-xs whitespace-nowrap';

    const openMonthDays = (month: string) => {
        setMonthFilter(month);
        setView('daily');
    };

    return (
        <div className="w-full">
            {/* Minimalist controls bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-[var(--color-card-border)]/50 bg-[var(--color-surface)]">
                <div className="flex flex-wrap items-center gap-2">
                    <div
                        role="tablist"
                        className="inline-grid grid-cols-2 rounded-lg border border-[var(--color-card-border)] bg-[var(--color-bg)] p-0.5"
                    >
                        <button
                            type="button"
                            role="tab"
                            aria-selected={view === 'monthly'}
                            title={labels.byMonthTooltip}
                            onClick={() => { setView('monthly'); setMonthFilter(null); }}
                            className={`inline-flex items-center justify-center gap-1.5 min-w-[126px] px-3 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors ${
                                view === 'monthly'
                                    ? 'bg-[var(--color-primary)] text-white'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                            }`}
                        >
                            <Layers className="size-3 shrink-0" />
                            <span>{labels.byMonth}</span>
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={view === 'daily'}
                            title={labels.byDayTooltip}
                            onClick={() => setView('daily')}
                            className={`inline-flex items-center justify-center gap-1.5 min-w-[126px] px-3 py-1 rounded-md text-[11px] font-bold whitespace-nowrap tabular-nums transition-colors ${
                                view === 'daily'
                                    ? 'bg-[var(--color-primary)] text-white'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                            }`}
                        >
                            <CalendarDays className="size-3 shrink-0" />
                            <span>{labels.byDay} ({visibleDays.length})</span>
                        </button>
                    </div>

                    {view === 'daily' && monthFilter && (
                        <button
                            type="button"
                            onClick={() => setMonthFilter(null)}
                            title={labels.allMonths}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/25 hover:bg-[var(--color-primary)]/15 transition-colors capitalize"
                        >
                            {formatRewardMonth(monthFilter, locale)}
                            <X className="size-3" />
                        </button>
                    )}
                </div>

                <span className="text-[10px] text-[var(--color-text-muted)]">
                    {labels.fiatNote}
                </span>
            </div>

            {/* Borderless breakdown table matching the transactions table */}
            <div className={`overflow-x-auto custom-scrollbar ${view === 'daily' ? 'max-h-[360px] overflow-y-auto' : ''}`}>
                <table className="w-full text-left border-collapse">
                    <thead className={view === 'daily' ? 'sticky top-0 z-10' : undefined}>
                        <tr className="border-b border-[var(--color-card-border)]/70 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                            <th
                                className={`${th} pl-8`}
                                title={view === 'monthly' ? labels.monthTooltip : labels.dateTooltip}
                            >
                                {view === 'monthly' ? labels.month : labels.date}
                            </th>
                            {view === 'monthly' && (
                                <th className={`${th} text-right`} title={labels.daysTooltip}>
                                    {labels.days}
                                </th>
                            )}
                            <th
                                className={`${th} text-right`}
                                title={isAccount ? labels.delegatorTooltip : labels.feeTooltip}
                            >
                                {isAccount ? labels.delegator : labels.fee}
                            </th>
                            {showFee && (
                                <th
                                    className={`${th} text-right`}
                                    title={isAccount ? labels.feeTooltip : labels.delegatorsTooltip}
                                >
                                    {isAccount ? labels.fee : labels.delegators}
                                </th>
                            )}
                            {isAccount && showFee && (
                                <th className={`${th} text-right`} title={labels.totalTooltip}>
                                    {labels.total}
                                </th>
                            )}
                            {view === 'daily' && (
                                <th className={`${th} text-right`} title={labels.unitPriceTooltip}>
                                    {labels.unitPrice}
                                </th>
                            )}
                            <th className={`${th} text-right`} title={labels.fiatAtReceiptTooltip}>
                                {labels.fiatAtReceipt}
                            </th>
                            <th className={`${th} text-right`} title={labels.fiatCurrentTooltip}>
                                {labels.fiatCurrent}
                            </th>
                            <th className={`${th} text-right`} title={labels.fiatChangeTooltip}>
                                {labels.fiatChange}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {view === 'monthly'
                            ? breakdown.months.map((m) => {
                                const pct = computeFiatChangePct(m.fiatAtReceipt, m.fiatCurrent);
                                return (
                                    <tr
                                        key={m.month}
                                        onClick={() => openMonthDays(m.month)}
                                        title={labels.monthRowHint}
                                        className="border-b border-[var(--color-card-border)]/45 last:border-b-0 hover:bg-white/[0.03] hover:shadow-[inset_2px_0_0_0_var(--color-primary)] transition-all duration-200 cursor-pointer group"
                                    >
                                        <td className="py-2.5 pl-8 pr-4 text-xs font-semibold text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors capitalize whitespace-nowrap">
                                            {formatRewardMonth(m.month, locale)}
                                        </td>
                                        <td className={`${num} text-[var(--color-text-muted)]`}>
                                            {m.days.toLocaleString(locale)}
                                        </td>
                                        <td className={`${num} font-semibold text-[var(--color-accent)]`}>
                                            {fmtXrd(isAccount ? m.delegatorXrd : m.feeXrd)}
                                        </td>
                                        {showFee && (
                                            <td className={`${num} text-[var(--color-text-main)]`}>
                                                {fmtXrd(isAccount ? m.feeXrd : m.delegatorXrd)}
                                            </td>
                                        )}
                                        {isAccount && showFee && (
                                            <td className={`${num} font-bold text-[var(--color-text-main)]`}>
                                                {fmtXrd(m.primaryXrd)}
                                            </td>
                                        )}
                                        <td className={`${num} text-[var(--color-text-main)]`}>
                                            {fmtFiat(m.fiatAtReceipt)}
                                        </td>
                                        <td className={`${num} text-[var(--color-text-muted)]`}>
                                            {fmtFiat(m.fiatCurrent)}
                                        </td>
                                        <td
                                            className={`${num} ${fiatChangeTone(pct)}`}
                                            title={changeCellTooltip(m.fiatAtReceipt, m.fiatCurrent)}
                                        >
                                            {formatSignedPercent(pct, locale)}
                                        </td>
                                    </tr>
                                );
                            })
                            : visibleDays.map((d) => {
                                const pct = computeFiatChangePct(d.fiatAtReceipt, d.fiatCurrent);
                                return (
                                    <tr
                                        key={d.date}
                                        className="border-b border-[var(--color-card-border)]/40 last:border-b-0 hover:bg-white/[0.03] hover:shadow-[inset_2px_0_0_0_var(--color-primary)] transition-all duration-200"
                                    >
                                        <td className="py-2 pl-8 pr-4 font-mono text-xs text-[var(--color-text-main)] whitespace-nowrap">
                                            {formatRewardDay(d.date, locale)}
                                        </td>
                                        <td className={`${num} font-semibold text-[var(--color-accent)]`}>
                                            {fmtXrd(isAccount ? d.delegatorXrd : d.feeXrd)}
                                        </td>
                                        {showFee && (
                                            <td className={`${num} text-[var(--color-text-main)]`}>
                                                {fmtXrd(isAccount ? d.feeXrd : d.delegatorXrd)}
                                            </td>
                                        )}
                                        {isAccount && showFee && (
                                            <td className={`${num} font-bold text-[var(--color-text-main)]`}>
                                                {fmtXrd(d.primaryXrd)}
                                            </td>
                                        )}
                                        <td className={`${num} text-[var(--color-text-muted)]`}>
                                            {formatXrdUnitPrice(d.unitFiatAtReceipt, currency, locale)}
                                        </td>
                                        <td className={`${num} text-[var(--color-text-main)]`}>
                                            {fmtDayFiat(d.fiatAtReceipt)}
                                        </td>
                                        <td className={`${num} text-[var(--color-text-muted)]`}>
                                            {fmtDayFiat(d.fiatCurrent)}
                                        </td>
                                        <td
                                            className={`${num} ${fiatChangeTone(pct)}`}
                                            title={changeCellTooltip(d.fiatAtReceipt, d.fiatCurrent)}
                                        >
                                            {formatSignedPercent(pct, locale)}
                                        </td>
                                    </tr>
                                );
                            })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
