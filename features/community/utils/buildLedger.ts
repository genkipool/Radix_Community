import type {
    Area,
    LedgerRow,
    FundingSource,
    LegalExpense
} from '../types/data.types';
import type { CommunityDictionary } from '../types/i18n.types';
import { GLOBAL_PROJECT_ADDRESS } from '../data/communityData';

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
        area.tasks.forEach(task => {
            if (task.type !== 'voluntary' && task.cost > 0) {
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
            }
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
    const chronLedger = rows.toSorted((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
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
