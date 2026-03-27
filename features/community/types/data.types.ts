
/* ─── Base Types ─────────────────────────────────────────────────────────── */

export type TaskType = 'service' | 'personnel' | 'voluntary';
export type TaskStatus = 'completed' | 'in_progress' | 'planned' | 'paused' | 'cancelled';
export type LegalExpenseType = 'tax' | 'legal' | 'accounting' | 'compliance';

/* ─── Data Interfaces ────────────────────────────────────────────────────── */

export interface Member {
    id: string;
    name: string;
    roleKey: string;
    isVolunteer: boolean;
    joinedDate: string;
    socialHandle?: string;
}

export interface Task {
    id: string;
    titleKey: string;
    descriptionKey: string;
    deliverableKey?: string;
    titleDirect?: string;
    descriptionDirect?: string;
    deliverableDirect?: string;
    type: TaskType;
    status: TaskStatus;
    cost: number;
    costUsd?: number;
    startDate: string;
    endDate?: string;
    tags: string[];
    githubUrl?: string;
    assignedTo?: string[];
    isDynamic?: boolean;
    txHash?: string;
}

export interface Area {
    id: string;
    icon: string;
    gradient: string;
    accentRgb: string;
    radixAddress: string;
    totalBudget: number;
    spentBudget: number;
    spentBudgetUsd: number;
    members: Member[];
    tasks: Task[];
}

export interface FundingSource {
    id: string;
    amount: number;
    usdValueAtDelivery: number;
    xrdPriceAtDelivery: number;
    date: string;
    type: 'donation' | 'grant' | 'treasury' | 'event';
    labelKey: string;
    contributorKey: string;
    txHash?: string;
}

export interface LegalExpense {
    id: string;
    amount: number;
    amountUsd: number;
    date: string;
    type: LegalExpenseType;
    descriptionKey: string;
    paid: boolean;
    txHash?: string;
}

/* ─── UI / State Types ───────────────────────────────────────────────────── */

export type ExplorerTarget =
    | { kind: 'tx'; hash: string }
    | { kind: 'address'; address: string };

export type AdminView = 'create' | 'update' | null;

export interface TaskFormData {
    areaId: string;
    titleDirect: string;
    descriptionDirect: string;
    deliverableDirect: string;
    type: TaskType;
    status: TaskStatus;
    costXrd: string;
    costUsd: string;
    startDate: string;
    endDate: string;
    tags: string;
    githubUrl: string;
    assignedMembers: string;
}

export interface LedgerRow {
    id: string;
    date: string;
    type: 'in' | 'out';
    category: string;
    description: string;
    xrdAmount: number;
    usdAmount: number;
    xrdPrice?: number;
    txHash?: string;
    address?: string;
    runningBalance: number;
    runningBalanceUsd: number;
}
