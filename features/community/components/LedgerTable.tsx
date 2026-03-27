'use client';

import { useState } from 'react';
import {
    ArrowUpRight, ArrowDownLeft, Copy, Check, ExternalLink,
    ChevronDown, ChevronUp,
} from 'lucide-react';
import { 
    Area, 
    LedgerRow,
    FundingSource,
    LegalExpense
} from '../types/data.types';
import { CommunityDictionary } from '../types/i18n.types';
import { LedgerTableProps } from '../types/components.types';
import {
    GLOBAL_PROJECT_ADDRESS,
} from '../data/communityData';
import { fmtXrd, fmtUsd, fmtDate, truncateHash } from '../utils/formatters';

/* ─── Build sorted ledger ─────────────────────────────────────────────────── */
export function buildLedger(
    t: CommunityDictionary, 
    areaNames: Record<string, string>, 
    dynamicAreas: Area[],
    fundingSources: FundingSource[],
    legalExpenses: LegalExpense[]
): LedgerRow[] {
    const rows: Omit<LedgerRow, 'runningBalance' | 'runningBalanceUsd'>[] = [];

    const labels = t.funding_labels as Record<string, string>;
    const contributors = t.funding_contributors as Record<string, string>;
    const descs = t.legal_descriptions as Record<string, string>;
    const typeLabels: Record<string, string> = {
        donation: t.funding_type_donation ?? 'Donation',
        grant: t.funding_type_grant ?? 'Grant',
        treasury: t.funding_type_treasury ?? 'Treasury',
        event: t.funding_type_event ?? 'Event',
        tax: t.legal_type_tax ?? 'Tax',
        legal: t.legal_type_legal ?? 'Legal',
        accounting: t.legal_type_accounting ?? 'Accounting',
        compliance: t.legal_type_compliance ?? 'Compliance',
    };

    fundingSources.forEach(fs => {
        rows.push({
            id: fs.id,
            date: fs.date,
            type: 'in',
            category: typeLabels[fs.type] ?? fs.type,
            description: `${labels[fs.labelKey] ?? fs.labelKey} — ${contributors[fs.contributorKey] ?? fs.contributorKey}`,
            xrdAmount: fs.amount,
            usdAmount: fs.usdValueAtDelivery,
            xrdPrice: fs.xrdPriceAtDelivery,
            txHash: fs.txHash,
            address: GLOBAL_PROJECT_ADDRESS,
        });
    });

    dynamicAreas.forEach(area => {
        area.tasks.filter(tk => tk.type !== 'voluntary' && tk.cost > 0).forEach(task => {
            rows.push({
                id: `expense-${task.id}`,
                date: task.endDate ?? task.startDate,
                type: 'out',
                category: areaNames[area.id] ?? area.id,
                description: task.titleDirect ?? ((t.task_titles as Record<string, string>)[task.titleKey] ?? task.titleKey),
                xrdAmount: task.cost,
                usdAmount: task.costUsd ?? 0,
                xrdPrice: 0, 
                txHash: task.txHash,
                address: area.radixAddress,
            });
        });
    });

    legalExpenses.forEach(le => {
        rows.push({
            id: le.id,
            date: le.date,
            type: 'out',
            category: typeLabels[le.type] ?? le.type,
            description: descs[le.descriptionKey] ?? le.descriptionKey,
            xrdAmount: le.amount,
            usdAmount: le.amountUsd,
            xrdPrice: 0,
            txHash: le.txHash,
            address: GLOBAL_PROJECT_ADDRESS,
        });
    });

    // Real implementation: Start from 0 for running balance
    // First sort by date ASC to calculate balance
    const chronLedger = [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let balXrd = 0;
    let balUsd = 0;
    const finalLedger = chronLedger.map(row => {
        if (row.type === 'in') {
            balXrd += row.xrdAmount;
            balUsd += row.usdAmount;
        } else {
            balXrd -= row.xrdAmount;
            balUsd -= row.usdAmount;
        }
        return {
            ...row,
            runningBalance: balXrd,
            runningBalanceUsd: balUsd,
        } as LedgerRow;
    }).reverse(); // Back to DESC for display

    return finalLedger;
}

export function LedgerTable({ t, areas, fundingSources, legalExpenses, onShowExplorer }: LedgerTableProps) {
    const areaNames = t.area_names;

    const [isExpanded, setIsExpanded] = useState(false);
    const [copyId, setCopyId] = useState<string | null>(null);

    const ledger = buildLedger(t, areaNames, areas, fundingSources, legalExpenses);
    
    const displayed = isExpanded ? ledger : ledger.slice(0, 10);

    const handleCopy = (val: string, id: string) => {
        navigator.clipboard.writeText(val);
        setCopyId(id);
        setTimeout(() => setCopyId(null), 2000);
    };

    return (
        <div className="rounded-2xl overflow-hidden border" style={{ background: 'var(--color-card-bg)', borderColor: 'var(--color-card-border)' }}>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                    <thead>
                        <tr style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-card-border)' }}>
                            <th className="px-6 py-4 font-bold text-center" style={{ color: 'var(--color-text-muted)' }}>{t.ledger_col_date ?? 'Date'}</th>
                            <th className="px-6 py-4 font-bold text-center" style={{ color: 'var(--color-text-muted)' }}>{t.ledger_col_type ?? 'Concept'}</th>
                            <th className="px-6 py-4 font-bold text-center" style={{ color: 'var(--color-text-muted)' }}>{t.ledger_col_amount ?? 'Amount'}</th>
                            <th className="px-6 py-4 font-bold text-center" style={{ color: 'var(--color-text-muted)' }}>{t.ledger_col_balance ?? 'Balance'}</th>
                            <th className="px-6 py-4 font-bold text-center" style={{ color: 'var(--color-text-muted)' }}>TX</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--color-card-border)' }}>
                        {displayed.map((row) => (
                            <tr key={row.id} className="hover:bg-[var(--color-surface)] transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap text-center" style={{ color: 'var(--color-text-muted)' }}>
                                    {fmtDate(row.date)}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex items-center justify-center gap-2 mb-0.5">
                                        {row.type === 'in' ? (
                                            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" />
                                        ) : (
                                            <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
                                        )}
                                        <span className="font-semibold" style={{ color: 'var(--color-text-main)' }} title={row.category}>
                                            {row.category}
                                        </span>
                                    </div>
                                    <p className="text-xs truncate max-w-[200px] mx-auto" style={{ color: 'var(--color-text-muted)' }} title={row.description}>
                                        {row.description}
                                    </p>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <p className={`font-bold tabular-nums ${row.type === 'in' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {row.type === 'in' ? '+' : '-'}{fmtXrd(row.xrdAmount)}
                                    </p>
                                    <p className="text-[10px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                                        ≈ {fmtUsd(row.usdAmount)}
                                    </p>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    <p className="font-semibold tabular-nums" style={{ color: 'var(--color-text-main)' }}>
                                        {fmtXrd(row.runningBalance)}
                                    </p>
                                    <p className="text-[10px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                                        ≈ {fmtUsd(row.runningBalanceUsd)}
                                    </p>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {row.txHash ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <code className="text-[10px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                                                {truncateHash(row.txHash, 6)}
                                            </code>
                                            <button
                                                onClick={() => handleCopy(row.txHash!, row.id)}
                                                className="p-1 hover:bg-[var(--color-card-bg)] rounded transition-colors"
                                                style={{ color: 'var(--color-text-muted)' }}
                                            >
                                                {copyId === row.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                            </button>
                                            <button
                                                onClick={() => onShowExplorer({ kind: 'tx', hash: row.txHash! })}
                                                className="p-1 hover:bg-[var(--color-card-bg)] rounded transition-colors"
                                                style={{ color: 'var(--color-primary)' }}
                                                title={row.txHash}
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>—</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {ledger.length > 10 && (
                <div className="p-4 flex flex-col items-end gap-3" style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-card-border)' }}>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full transition-all"
                        style={{ 
                            background: 'var(--color-card-bg)', 
                            border: '1px solid var(--color-card-border)',
                            color: 'var(--color-text-main)'
                        }}
                    >
                        {isExpanded ? (
                            <>
                                <ChevronUp className="w-3 h-3" />
                                {t.ledger_show_less ?? 'Show less'}
                            </>
                        ) : (
                            <>
                                <ChevronDown className="w-3 h-3" />
                                {t.ledger_show_more ?? 'Show more'} ({ledger.length - 10})
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
