import { 
    FundingSource, 
    LegalExpense 
} from '../types/data.types';

/* ─── GLOBAL PROJECT ADDRESS ─────────────────────────────────────────────── */
export const GLOBAL_PROJECT_ADDRESS =
    'account_rdx1cx8wnhpq5a0wkqz9nfmr2xpvhf6ztf8e9skr3y0zv4u7mw2knq6dp';

/* ─── DATA ───────────────────────────────────────────────────────────────── */

/* ─── FUNDING SOURCES ────────────────────────────────────────────────────── */
export const FUNDING_SOURCES: FundingSource[] = [
    { id: 'fs-1', labelKey: 'funding_community_donation', amount: 150000, date: '2025-01-15', type: 'donation', contributorKey: 'contributor_multiple', txHash: 'txid_1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b', xrdPriceAtDelivery: 0.068, usdValueAtDelivery: 10200 },
    { id: 'fs-2', labelKey: 'funding_foundation_grant_q1', amount: 200000, date: '2025-02-01', type: 'grant', contributorKey: 'contributor_foundation', txHash: 'txid_2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c', xrdPriceAtDelivery: 0.054, usdValueAtDelivery: 10800 },
    { id: 'fs-3', labelKey: 'funding_madrid_event', amount: 25000, date: '2025-03-10', type: 'event', contributorKey: 'contributor_event', txHash: 'txid_3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d', xrdPriceAtDelivery: 0.047, usdValueAtDelivery: 1175 },
    { id: 'fs-4', labelKey: 'funding_individual_radvocate', amount: 30000, date: '2025-04-05', type: 'donation', contributorKey: 'contributor_radvocate', txHash: 'txid_4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e', xrdPriceAtDelivery: 0.041, usdValueAtDelivery: 1230 },
    { id: 'fs-5', labelKey: 'funding_foundation_grant_q2', amount: 180000, date: '2025-05-01', type: 'grant', contributorKey: 'contributor_foundation', txHash: 'txid_5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f', xrdPriceAtDelivery: 0.038, usdValueAtDelivery: 6840 },
    { id: 'fs-6', labelKey: 'funding_community_treasury', amount: 90000, date: '2025-06-20', type: 'treasury', contributorKey: 'contributor_treasury', txHash: 'txid_6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a', xrdPriceAtDelivery: 0.033, usdValueAtDelivery: 2970 },
];

/* ─── LEGAL EXPENSES ─────────────────────────────────────────────────────── */
export const LEGAL_EXPENSES: LegalExpense[] = [
    { id: 'leg-1', descriptionKey: 'legal_tax_q1_2025', type: 'tax', amount: 12400, amountUsd: 744, date: '2025-03-31', paid: true },
    { id: 'leg-2', descriptionKey: 'legal_contract_review', type: 'legal', amount: 8500, amountUsd: 510, date: '2025-02-20', paid: true },
    { id: 'leg-3', descriptionKey: 'legal_accounting', type: 'accounting', amount: 6200, amountUsd: 372, date: '2025-04-15', paid: true },
    { id: 'leg-4', descriptionKey: 'legal_gdpr', type: 'compliance', amount: 4800, amountUsd: 288, date: '2025-05-10', paid: true },
    { id: 'leg-5', descriptionKey: 'legal_tax_q2_2025', type: 'tax', amount: 14100, amountUsd: 846, date: '2025-06-30', paid: false },
];

import { AREAS } from './areas';
export { AREAS };

/* ─── COMPUTED TOTALS ────────────────────────────────────────────────────── */
export const TOTAL_RAISED = FUNDING_SOURCES.reduce((s, f) => s + f.amount, 0);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TOTAL_SPENT = AREAS.reduce((s, a) => s + a.spentBudget, 0);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TOTAL_SPENT_USD = AREAS.reduce((s, a) => s + a.spentBudgetUsd, 0);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TOTAL_BUDGET = AREAS.reduce((s, a) => s + a.totalBudget, 0);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TOTAL_MEMBERS = AREAS.reduce((s, a) => s + a.members.length, 0);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TOTAL_TASKS = AREAS.reduce((s, a) => s + a.tasks.length, 0);
export const TOTAL_LEGAL = LEGAL_EXPENSES.reduce((s, l) => s + l.amount, 0);
export const TOTAL_RAISED_USD = FUNDING_SOURCES.reduce((s, f) => s + f.usdValueAtDelivery, 0);
export const TOTAL_LEGAL_USD = LEGAL_EXPENSES.reduce((s, l) => s + l.amountUsd, 0);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TOTAL_VOLUNTEERS = AREAS.reduce((s, a) => s + a.members.filter(m => m.isVolunteer).length, 0);
