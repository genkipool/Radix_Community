'use client';

import React from 'react';

interface ExplorerTableProps {
    title?: string;
    icon?: React.ReactNode;
    headers: (string | { label: string; className?: string })[];
    children: React.ReactNode;
}

/**
 * A reusable table component that follows the minimalist design of the dashboard's transaction tables.
 * It removes the "box" design and uses clear, consistent spacing and typography.
 */
export function ExplorerTable({ title, icon, headers, children }: ExplorerTableProps) {
    return (
        <div className="w-full">
            {title && (
                <h4 className="px-4 py-3 text-[9px] uppercase font-black tracking-widest text-[var(--color-text-muted)] flex items-center gap-1.5">
                    {icon}
                    {title}
                </h4>
            )}
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b border-[var(--color-card-border)] bg-[var(--color-surface)]/30">
                            {headers.map((header, idx) => {
                                const label = typeof header === 'string' ? header : header.label;
                                const customClass = typeof header === 'object' ? header.className : '';
                                return (
                                    <th
                                        key={`header-${idx}`}
                                        className={`py-3 px-4 text-[9px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)] ${idx === headers.length - 1 ? 'text-right' : 'text-left'} ${customClass}`}
                                    >
                                        {label}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {children}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
