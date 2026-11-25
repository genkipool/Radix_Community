'use client';

import React from 'react';

interface ExplorerTableProps {
    title?: string;
    icon?: React.ReactNode;
    headers: (string | { label: string; className?: string })[];
    compact?: boolean;
    children: React.ReactNode;
}

/**
 * A reusable table component that follows the minimalist design of the dashboard's transaction tables.
 * It removes the "box" design and uses clear, consistent spacing and typography.
 */
export function ExplorerTable({ title, icon, headers, compact = false, children }: ExplorerTableProps) {
    return (
        <div className="w-full min-w-0">
            {title && (
                <h4 className={`${compact ? 'px-1 py-2 text-[10px] font-bold' : 'px-4 py-3 text-[11px] font-black'} uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-1.5`}>
                    {icon}
                    {title}
                </h4>
            )}
            <div className={compact ? 'w-full' : 'overflow-x-auto'}>
                <table className={`w-full border-collapse ${compact ? 'table-fixed' : ''}`}>
                    <thead>
                        <tr className="border-b border-[var(--color-card-border)] bg-[var(--color-surface)]/30">
                            {headers.map((header, idx) => {
                                const label = typeof header === 'string' ? header : header.label;
                                const customClass = typeof header === 'object' ? header.className : '';
                                return (
                                    <th
                                        key={`th-${label}`}
                                        className={`${compact ? 'py-2 px-2 text-[9px]' : 'py-3 px-4 text-[10px]'} uppercase tracking-wider font-semibold text-[var(--color-text-muted)] ${idx === headers.length - 1 ? 'text-right' : 'text-left'} ${customClass}`}
                                    >
                                        {label}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className={compact ? 'text-xs' : 'text-sm'}>
                        {children}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
