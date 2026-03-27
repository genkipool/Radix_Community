import { Area } from '../../../types/data.types';

export const GOVERNANCE_DATA: Area = {
    id: 'governance', icon: 'Scale', gradient: 'from-blue-600 to-cyan-500', accentRgb: '37,99,235',
    totalBudget: 60000, spentBudget: 31800, spentBudgetUsd: 1908,
    radixAddress: 'account_rdx1cx0gov7wkq4sfmr6xpvhf0ztf8e5skr1y4zv2u1mw6knq0dpx3ee',
    members: [
        { id: 'gov-1', name: 'Patricia Moreno', roleKey: 'role_governance_lead', isVolunteer: false, joinedDate: '2025-01-01', socialHandle: '@pati_governance' },
        { id: 'gov-2', name: 'Diego Sánchez', roleKey: 'role_legal_advisor', isVolunteer: false, joinedDate: '2025-02-01', socialHandle: '@diego_legal_xrd' },
        { id: 'gov-3', name: 'Carmen Flores', roleKey: 'role_community_rep', isVolunteer: true, joinedDate: '2025-01-15', socialHandle: '@carmen_radvocate' },
        { id: 'gov-4', name: 'Miguel Ortiz', roleKey: 'role_voting_coordinator', isVolunteer: true, joinedDate: '2025-03-01' },
    ],
    tasks: [
        { id: 'gov-t1', titleKey: 'task_gov_constitution_title', descriptionKey: 'task_gov_constitution_desc', type: 'voluntary', status: 'completed', cost: 0, costUsd: 0, assignedTo: ['gov-1', 'gov-3', 'gov-4'], startDate: '2025-01-15', endDate: '2025-03-20', tags: ['governance', 'constitution', 'legal'], deliverableKey: 'task_gov_constitution_deliverable' },
        { id: 'gov-t2', titleKey: 'task_gov_voting_title', descriptionKey: 'task_gov_voting_desc', type: 'service', status: 'in_progress', cost: 22000, costUsd: 1320, assignedTo: ['gov-1', 'gov-2'], startDate: '2025-04-01', tags: ['voting', 'scrypto', 'governance'], deliverableKey: 'task_gov_voting_deliverable' },
        { id: 'gov-t3', titleKey: 'task_gov_rfp_title', descriptionKey: 'task_gov_rfp_desc', type: 'personnel', status: 'completed', cost: 9800, costUsd: 588, assignedTo: ['gov-1', 'gov-2'], startDate: '2025-02-15', endDate: '2025-04-10', tags: ['process', 'rfp', 'selection'], deliverableKey: 'task_gov_rfp_deliverable' },
    ],
};
