import { Area } from '../../../types/data.types';

export const DEVELOPER_DATA: Area = {
    id: 'developer', icon: 'Code', gradient: 'from-violet-600 to-fuchsia-500', accentRgb: '139,92,246',
    totalBudget: 210000, spentBudget: 178500, spentBudgetUsd: 10710,
    radixAddress: 'account_rdx1cx2dev8wkq0nfmr2xpvhf6ztf8e9skr3y0zv4u7mw2knq6dpx9aa',
    members: [
        { id: 'dev-1', name: 'Alejandro Ruiz', roleKey: 'role_lead_developer', isVolunteer: false, joinedDate: '2024-11-01', socialHandle: '@alex_scrypto' },
        { id: 'dev-2', name: 'Sofia Martínez', roleKey: 'role_scrypto_developer', isVolunteer: false, joinedDate: '2025-01-10', socialHandle: '@sofia_radix' },
        { id: 'dev-3', name: 'Carlos Vega', roleKey: 'role_frontend_developer', isVolunteer: true, joinedDate: '2025-02-15', socialHandle: '@carlosvega_dev' },
        { id: 'dev-4', name: 'Marta López', roleKey: 'role_qa_testing', isVolunteer: true, joinedDate: '2025-03-01' },
    ],
    tasks: [
        { id: 'dev-t1', titleKey: 'task_dev_portal_title', descriptionKey: 'task_dev_portal_desc', type: 'service', status: 'in_progress', cost: 45000, costUsd: 2700, assignedTo: ['dev-1', 'dev-3'], startDate: '2025-04-01', tags: ['web', 'next.js', 'typescript'], deliverableKey: 'task_dev_portal_deliverable', githubUrl: 'https://github.com/radix-community-es/transparency-portal' },
        { id: 'dev-t2', titleKey: 'task_dev_gateway_title', descriptionKey: 'task_dev_gateway_desc', type: 'service', status: 'completed', cost: 28000, costUsd: 1680, assignedTo: ['dev-1', 'dev-2'], startDate: '2025-03-01', endDate: '2025-04-15', tags: ['api', 'blockchain', 'radix'], deliverableKey: 'task_dev_gateway_deliverable', githubUrl: 'https://github.com/radix-community-es/gateway-api-integration' },
        { id: 'dev-t3', titleKey: 'task_dev_governance_title', descriptionKey: 'task_dev_governance_desc', type: 'personnel', status: 'in_progress', cost: 62000, costUsd: 3720, assignedTo: ['dev-2'], startDate: '2025-03-15', tags: ['scrypto', 'governance', 'defi'], deliverableKey: 'task_dev_governance_deliverable', githubUrl: 'https://github.com/radix-community-es/governance-contracts' },
        { id: 'dev-t4', titleKey: 'task_dev_maintenance_title', descriptionKey: 'task_dev_maintenance_desc', type: 'voluntary', status: 'in_progress', cost: 0, costUsd: 0, assignedTo: ['dev-3', 'dev-4'], startDate: '2025-01-01', tags: ['maintenance', 'security'], deliverableKey: 'task_dev_maintenance_deliverable', githubUrl: 'https://github.com/radix-community-es/community-web' },
        { id: 'dev-t5', titleKey: 'task_dev_sdk_title', descriptionKey: 'task_dev_sdk_desc', type: 'service', status: 'completed', cost: 43500, costUsd: 2610, assignedTo: ['dev-1', 'dev-2'], startDate: '2025-01-15', endDate: '2025-03-30', tags: ['sdk', 'typescript', 'open-source'], deliverableKey: 'task_dev_sdk_deliverable', githubUrl: 'https://github.com/radix-community-es/radix-typescript-sdk' },
    ],
};
