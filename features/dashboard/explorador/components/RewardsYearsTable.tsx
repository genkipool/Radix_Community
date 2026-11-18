'use client';
/**
 * The staking rewards of an account or validator as a table matching the
 * minimalist design of the explorer's transactions table: `bg-[var(--color-surface)]`
 * header band, `py-3 px-4` cells, left primary inset bar on hover/expanded,
 * and one row per year that expands on click to show its monthly/daily breakdown.
 */
import React, { useState } from 'react';
import { Check, ChevronRight, Download, Loader2 } from 'lucide-react';

export interface RewardsYearsColumn<R> {
    label: string;
    value: (r: R) => string;
    /** Colour and weight of the figure (static or derived from the row). */
    tone: string | ((r: R) => string);
    tooltip?: string;
    /** Optional per-cell tooltip derived from the row. */
    cellTooltip?: (r: R) => string | undefined;
}

export interface RewardsYearsDownload {
    key: string;
    label: string;
    tooltip?: string;
    enabled: boolean;
    /** Just saved: a check instead of the download icon. */
    done: boolean;
    onClick: () => void;
}

export interface RewardsYearsRow<R> {
    year: number | string;
    /** The year's figures, or null while they are not known. */
    row: R | null;
    /** What shows in place of the figures while there are none; a spinner by default. */
    status?: React.ReactNode;
    downloads: RewardsYearsDownload[];
    /** Optional expandable detail rendered below the year row when clicked. */
    renderExpanded?: () => React.ReactNode;
}

export const rewardsCellText = 'text-xs text-[var(--color-text-muted)]';

/** What one download button gives, for the lines above the table. */
export interface RewardsYearsLegendItem { label: string; text: string }

export function RewardsYearsTable<R>({ title, desc, legend, yearLabel, yearTooltip, downloadLabel, downloadTooltip, totalLabel, expandHint, columns, rows, total, footer }: {
    title: string;
    desc?: string;
    /** One line per download button, above the table: what each one gives. */
    legend?: RewardsYearsLegendItem[];
    yearLabel: string;
    yearTooltip?: string;
    downloadLabel: string;
    downloadTooltip?: string;
    totalLabel: string;
    /** Accessible tooltip on expandable year rows. */
    expandHint?: string;
    columns: RewardsYearsColumn<R>[];
    rows: RewardsYearsRow<R>[];
    /** The sum of every year, shown once all are known and there is more than one. */
    total?: R | null;
    /** A line under the table. */
    footer?: React.ReactNode;
}) {
    const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});
    const toggleYear = (key: string) =>
        setExpandedYears((prev) => ({ ...prev, [key]: !prev[key] }));

    const th = 'py-3 px-4 font-semibold whitespace-nowrap';
    const num = 'py-3 px-4 text-right font-mono text-xs whitespace-nowrap';
    const totalColSpan = columns.length + 2;
    const resolveTone = (c: RewardsYearsColumn<R>, r: R) => (typeof c.tone === 'function' ? c.tone(r) : c.tone);

    return (
        <section className="space-y-3" onClick={(e) => e.stopPropagation()} role="presentation">
            <div className="space-y-1">
                <h4 className="text-[11px] uppercase font-black tracking-widest text-[var(--color-text-main)]">{title}</h4>
                {desc && <p className="text-xs text-[var(--color-text-muted)]">{desc}</p>}
            </div>
            {legend && legend.length > 0 && (
                <ul className="space-y-1">
                    {legend.map((l) => (
                        <li key={l.label} className="flex items-start gap-2 text-xs text-[var(--color-text-muted)]">
                            <span className="inline-flex items-center gap-1 shrink-0 min-w-[6.5rem] font-bold text-[var(--color-text-main)]">
                                <Download className="size-3.5" />
                                {l.label}
                            </span>
                            <span>{l.text}</span>
                        </li>
                    ))}
                </ul>
            )}
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-[var(--color-card-border)] text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] bg-[var(--color-surface)]">
                            <th className={th} title={yearTooltip}>{yearLabel}</th>
                            {columns.map((c) => (
                                <th key={c.label} className={`${th} text-right`} title={c.tooltip}>
                                    {c.label}
                                </th>
                            ))}
                            <th className={`${th} text-right`} title={downloadTooltip}>{downloadLabel}</th>
                        </tr>
                    </thead>
                    {rows.map(({ year, row, status, downloads, renderExpanded }) => {
                        const key = String(year);
                        const expandable = !!row && !!renderExpanded;
                        const isExpanded = expandable && !!expandedYears[key];

                        return (
                            <tbody
                                key={key}
                                className={`border-b border-[var(--color-card-border)] last:border-b-0 transition-all duration-200 ${
                                    isExpanded
                                        ? 'shadow-[inset_2px_0_0_0_var(--color-primary)] bg-[var(--color-surface)]/25'
                                        : 'hover:bg-white/[0.03] hover:shadow-[inset_2px_0_0_0_var(--color-primary)]'
                                }`}
                            >
                                <tr
                                    onClick={expandable ? () => toggleYear(key) : undefined}
                                    title={expandable ? expandHint : undefined}
                                    className={expandable ? 'cursor-pointer' : undefined}
                                >
                                    <td className="py-3 px-4 text-xs font-bold text-[var(--color-text-main)] whitespace-nowrap">
                                        {expandable ? (
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); toggleYear(key); }}
                                                aria-expanded={isExpanded}
                                                className="inline-flex items-center gap-1.5 text-left font-bold text-[var(--color-text-main)] hover:text-[var(--color-primary)] transition-colors"
                                            >
                                                <ChevronRight
                                                    className={`size-3.5 text-[var(--color-text-muted)] transition-transform duration-200 ${
                                                        isExpanded ? 'rotate-90 text-[var(--color-primary)]' : ''
                                                    }`}
                                                />
                                                <span className="font-mono text-sm">{year}</span>
                                            </button>
                                        ) : (
                                            <span className="font-mono text-sm">{year}</span>
                                        )}
                                    </td>
                                    {!row ? (
                                        <td colSpan={columns.length} className={`py-3 px-4 text-right ${rewardsCellText}`}>
                                            {status ?? <Loader2 className="size-3.5 animate-spin inline" />}
                                        </td>
                                    ) : (
                                        columns.map((c) => (
                                            <td key={c.label} className={`${num} ${resolveTone(c, row)}`} title={c.cellTooltip?.(row)}>
                                                {c.value(row)}
                                            </td>
                                        ))
                                    )}
                                    <td className="py-2.5 px-4">
                                        <div className="flex justify-end flex-wrap gap-x-3 gap-y-1">
                                            {downloads.map((d) => (
                                                <button
                                                    key={d.key}
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); d.onClick(); }}
                                                    disabled={!d.enabled}
                                                    title={d.tooltip}
                                                    className="inline-flex items-center gap-1 px-1.5 py-1 text-[11px] font-bold transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[var(--color-text-muted)]"
                                                >
                                                    {d.done ? <Check className="size-3.5 text-[var(--color-accent)]" /> : <Download className="size-3.5" />}
                                                    {d.label}
                                                </button>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                                {isExpanded && renderExpanded && (
                                    <tr className="border-t border-[var(--color-card-border)]/50 bg-[var(--color-bg)]/50">
                                        <td colSpan={totalColSpan} className="p-0">
                                            {renderExpanded()}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        );
                    })}
                    {rows.length > 1 && total && (
                        <tfoot>
                            <tr className="border-t border-[var(--color-card-border)] bg-[var(--color-surface)]">
                                <td className="py-3 px-4 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] whitespace-nowrap">{totalLabel}</td>
                                {columns.map((c) => (
                                    <td key={c.label} className={`${num} ${resolveTone(c, total)}`} title={c.cellTooltip?.(total)}>
                                        {c.value(total)}
                                    </td>
                                ))}
                                <td className="py-3 px-4" />
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
            {footer}
        </section>
    );
}
