import { Area } from '../../../types/data.types';

export const SECURITY_DATA: Area = {
    id: 'security',
    icon: 'Shield',
    gradient: 'from-emerald-600 to-teal-500',
    accentRgb: '16, 185, 129',
    totalBudget: 45000,
    spentBudget: 12500,
    spentBudgetUsd: 750,
    radixAddress: 'account_rdx1cx0sec7wkq4sfmr6xpvhf0ztf8e5skr1y4zv2u1mw6knq0dpx3ee',
    members: [
        { id: 'sec-1', name: 'Marco Valerio', roleKey: 'role_security_lead', isVolunteer: false, joinedDate: '2025-01-10', socialHandle: '@marco_sec' },
        { id: 'sec-2', name: 'Elena Bosch', roleKey: 'role_auditor', isVolunteer: false, joinedDate: '2025-02-15', socialHandle: '@elena_audit' },
        { id: 'sec-3', name: 'Lucas Thorne', roleKey: 'role_bug_hunter', isVolunteer: true, joinedDate: '2025-03-01' },
    ],
    tasks: [
        { 
            id: 'sec-t1', 
            titleKey: 'task_sec_audit_v2_title', 
            descriptionKey: 'task_sec_audit_v2_desc', 
            type: 'service', 
            status: 'completed', 
            cost: 8500, 
            costUsd: 510, 
            assignedTo: ['sec-1', 'sec-2'], 
            startDate: '2025-01-15', 
            endDate: '2025-03-10', 
            tags: ['audit', 'protocol', 'security'], 
            deliverableKey: 'task_sec_audit_v2_deliverable' 
        },
        { 
            id: 'sec-t2', 
            titleKey: 'task_sec_mfa_title', 
            descriptionKey: 'task_sec_mfa_desc', 
            type: 'voluntary', 
            status: 'in_progress', 
            cost: 0, 
            costUsd: 0, 
            assignedTo: ['sec-1', 'sec-3'], 
            startDate: '2025-03-15', 
            tags: ['mfa', 'wallet', 'ux'], 
            deliverableKey: 'task_sec_mfa_deliverable' 
        },
        { 
            id: 'sec-t3', 
            titleKey: 'task_sec_bounty_title', 
            descriptionKey: 'task_sec_bounty_desc', 
            type: 'service', 
            status: 'planned', 
            cost: 4000, 
            costUsd: 240, 
            assignedTo: ['sec-1'], 
            startDate: '2025-05-01', 
            tags: ['bounty', 'rewards', 'security'], 
            deliverableKey: 'task_sec_bounty_deliverable' 
        },
    ],
};
