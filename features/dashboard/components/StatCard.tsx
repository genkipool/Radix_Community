'use client';

import React from 'react';
import { Info, Copy, Check } from 'lucide-react';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';

import type { StatCardProps } from '../types';

/* ═══════ STAT MINI CARD ═══════ */
const StatCard = ({
    icon, label, value, accent = false, description, fullValue, copyText, isLoading = false,
}: StatCardProps) => {
    const { copiedText, copy } = useCopyToClipboard(2000);
    const copied = copiedText === copyText && copyText !== undefined;

    const handleCopy = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (copyText) {
            copy(copyText);
        }
    };

    const tooltip = [description, fullValue ? `(Valor exacto: ${fullValue})` : null]
        .filter(Boolean)
        .join('\n\n');

    return (
        <div
            title={tooltip}
            className={`flex items-center gap-3 p-4 rounded-2xl border transition-[border-color,background-color,box-shadow] duration-300 ${accent
                ? 'bg-gradient-to-br from-[var(--color-primary)]/10 to-[var(--color-secondary)]/10 border-[var(--color-primary)]/20'
                : 'bg-[var(--color-surface)] border-[var(--color-card-border)]'} ${tooltip ? 'cursor-help' : ''}`}
        >
            <div className="p-2 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex-shrink-0">
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-[11px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold flex items-center gap-1.5">
                    <span className="truncate">{label}</span>
                    {description && <Info className="w-3 h-3 opacity-60 flex-shrink-0" />}
                </div>
                <div className="flex items-center justify-between gap-2">
                    {isLoading && (!value || value === '---') ? (
                        /* Skeleton pulse — only shown when no value is available yet */
                        <div className="h-6 w-28 rounded-md bg-[var(--color-card-border)] animate-pulse mt-0.5" />
                    ) : (
                        <div className="text-[15px] font-black text-[var(--color-text-main)] truncate">{value}</div>
                    )}
                    {copyText && !isLoading && (
                        <button
                            onClick={handleCopy}
                            className="p-1.5 -mr-1.5 hover:bg-[var(--color-primary)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] rounded-lg transition-colors flex-shrink-0"
                            title="Copy Hash"
                        >
                            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

StatCard.displayName = 'StatCard';
export { StatCard };
