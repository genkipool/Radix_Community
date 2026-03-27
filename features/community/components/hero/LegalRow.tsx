'use client';

import { LegalExpense, LegalExpenseType } from '../../types/data.types';
import { CommunityDictionary } from '../../types/i18n.types';
import { fmtXrd, fmtUsd, fmtDate } from '../../utils/formatters';

interface LegalRowProps {
    expense: LegalExpense;
    t: CommunityDictionary;
}

export function LegalRow({ expense, t }: LegalRowProps) {
    const descriptions = t.legal_descriptions;

    const typeColors: Record<LegalExpenseType, { bg: string; text: string; label: string }> = {
        tax: { bg: 'rgba(239,68,68,0.10)', text: '#ef4444', label: t.legal_type_tax ?? 'Tax' },
        legal: { bg: 'rgba(99,102,241,0.10)', text: '#6366f1', label: t.legal_type_legal ?? 'Legal' },
        accounting: { bg: 'rgba(245,158,11,0.10)', text: '#f59e0b', label: t.legal_type_accounting ?? 'Accounting' },
        compliance: { bg: 'rgba(16,185,129,0.10)', text: '#10b981', label: t.legal_type_compliance ?? 'Compliance' },
    };
    const style = typeColors[expense.type];

    return (
        <div className="flex items-center gap-3 py-3" style={{ borderBottom: '1px solid var(--color-card-border)' }}>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-main)' }}>
                        {descriptions[expense.descriptionKey] ?? expense.descriptionKey}
                    </p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: style.bg, color: style.text }}>
                        {style.label}
                    </span>
                    {!expense.paid && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                            Pendiente
                        </span>
                    )}
                </div>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{fmtDate(expense.date)}</p>
            </div>
            <div className="text-right shrink-0">
                <p className="text-sm font-bold tabular-nums" style={{ color: expense.paid ? 'var(--color-text-main)' : '#f59e0b' }}>
                    {fmtXrd(expense.amount)}
                </p>
                <p className="text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                    ≈ {fmtUsd(expense.amountUsd)}
                </p>
            </div>
        </div>
    );
}
