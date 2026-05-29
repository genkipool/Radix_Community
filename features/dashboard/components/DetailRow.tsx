'use client';

import React from 'react';
import { Check, Copy } from 'lucide-react';

import type { DetailRowProps } from '../types';

/* ═══════ DETAIL ROW ═══════ */
const DetailRow = ({ label, value, copyable, onCopy, copiedAddress }: DetailRowProps) => (
    <div className="flex flex-col sm:flex-row sm:items-center py-3 border-b border-[var(--color-card-border)] last:border-0 gap-1 sm:gap-4 group/row">
        <div className="w-full sm:w-1/3 text-[11px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider shrink-0 flex items-center">
            {label}
        </div>
        <div className="w-full sm:w-2/3 text-sm text-[var(--color-text-main)] font-mono break-all flex items-center justify-between group">
            <span className="mr-2">{value}</span>
            {copyable && onCopy && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onCopy(copyable); }}
                    className={`p-1.5 rounded-md transition-colors shrink-0 ${copiedAddress === copyable ? 'text-green-500 bg-green-500/10' : 'text-[var(--color-text-muted)] opacity-0 group-hover/row:opacity-100 hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface)]'}`}
                    title="Copy"
                >
                    {copiedAddress === copyable ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </button>
            )}
        </div>
    </div>
);

export { DetailRow };
