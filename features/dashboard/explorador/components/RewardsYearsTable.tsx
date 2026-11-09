'use client';
/**
 * The staking rewards of an account or validator as a table: one row per
 * year with its figures and that year's CSV downloads in the row itself, and
 * a total row when there is more than one year. Only the look: Babylon
 * accounts and Olympia accounts and validators fill it with their own
 * columns.
 */
import React from 'react';
import { Check, Download, Loader2 } from 'lucide-react';

export interface RewardsYearsColumn<R> {
    label: string;
    value: (r: R) => string;
    /** Colour and weight of the figure. */
    tone: string;
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
}

export const rewardsCellText = 'text-xs text-[var(--color-text-muted)]';

export function RewardsYearsTable<R>({ title, desc, yearLabel, downloadLabel, totalLabel, columns, rows, total, footer }: {
    title: string;
    desc?: string;
    yearLabel: string;
    downloadLabel: string;
    totalLabel: string;
    columns: RewardsYearsColumn<R>[];
    rows: RewardsYearsRow<R>[];
    /** The sum of every year, shown once all are known and there is more than one. */
    total?: R | null;
    /** A line under the table. */
    footer?: React.ReactNode;
}) {
    const th = 'py-2.5 px-3 first:pl-0 last:pr-0 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] whitespace-nowrap';
    const num = 'py-3 px-3 text-right font-mono text-xs whitespace-nowrap';

    return (
        <section className="space-y-3" onClick={(e) => e.stopPropagation()} role="presentation">
            <div className="space-y-1">
                <h4 className="text-[11px] uppercase font-black tracking-widest text-[var(--color-text-main)]">{title}</h4>
                {desc && <p className="text-xs text-[var(--color-text-muted)]">{desc}</p>}
            </div>
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="border-b border-[var(--color-card-border)]">
                        <tr>
                            <th className={th}>{yearLabel}</th>
                            {columns.map((c) => <th key={c.label} className={`${th} text-right`}>{c.label}</th>)}
                            <th className={`${th} text-right`}>{downloadLabel}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ year, row, status, downloads }) => (
                            <tr key={year} className="border-b border-[var(--color-card-border)]/50 last:border-b-0 hover:bg-white/[0.03] transition-colors">
                                <td className="py-3 pr-3 text-sm font-bold text-[var(--color-text-main)]">{year}</td>
                                {!row ? (
                                    <td colSpan={columns.length} className={`py-3 px-4 text-right ${rewardsCellText}`}>
                                        {status ?? <Loader2 className="size-3.5 animate-spin inline" />}
                                    </td>
                                ) : (
                                    columns.map((c) => <td key={c.label} className={`${num} ${c.tone}`}>{c.value(row)}</td>)
                                )}
                                <td className="py-2 pl-3">
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
                        ))}
                    </tbody>
                    {rows.length > 1 && total && (
                        <tfoot className="border-t border-[var(--color-card-border)]">
                            <tr>
                                <td className="py-3 pr-3 text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{totalLabel}</td>
                                {columns.map((c) => <td key={c.label} className={`${num} ${c.tone}`}>{c.value(total)}</td>)}
                                <td />
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
            {footer}
        </section>
    );
}
