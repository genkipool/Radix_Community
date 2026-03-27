import { Area } from '../../../types/data.types';

export const INFRASTRUCTURE_DATA: Area = {
    id: 'infrastructure', icon: 'Server', gradient: 'from-emerald-500 to-teal-400', accentRgb: '16,185,129',
    totalBudget: 95000, spentBudget: 72600, spentBudgetUsd: 4356,
    radixAddress: 'account_rdx1cx8inf5wkq3rfmr5xpvhf9ztf8e4skr9y3zv0u0mw5knq9dpx2dd',
    members: [
        { id: 'inf-1', name: 'Marcos Delgado', roleKey: 'role_infra_lead', isVolunteer: false, joinedDate: '2024-11-15', socialHandle: '@marcos_validator' },
        { id: 'inf-2', name: 'Elena Ramírez', roleKey: 'role_devops', isVolunteer: false, joinedDate: '2025-01-08', socialHandle: '@elena_devops' },
        { id: 'inf-3', name: 'Antonio Díaz', roleKey: 'role_node_operator', isVolunteer: true, joinedDate: '2025-02-20', socialHandle: '@tony_xrd_node' },
    ],
    tasks: [
        { id: 'inf-t1', titleKey: 'task_inf_validator_title', descriptionKey: 'task_inf_validator_desc', type: 'service', status: 'in_progress', cost: 36000, costUsd: 2160, assignedTo: ['inf-1', 'inf-3'], startDate: '2025-01-01', tags: ['validator', 'mainnet', 'staking'], deliverableKey: 'task_inf_validator_deliverable' },
        { id: 'inf-t2', titleKey: 'task_inf_staging_title', descriptionKey: 'task_inf_staging_desc', type: 'service', status: 'in_progress', cost: 18600, costUsd: 1116, assignedTo: ['inf-2'], startDate: '2025-02-01', tags: ['cloud', 'ci-cd', 'devops'], deliverableKey: 'task_inf_staging_deliverable' },
        { id: 'inf-t3', titleKey: 'task_inf_api_title', descriptionKey: 'task_inf_api_desc', type: 'personnel', status: 'completed', cost: 18000, costUsd: 1080, assignedTo: ['inf-1', 'inf-2'], startDate: '2025-03-01', endDate: '2025-05-15', tags: ['api', 'public', 'open-data'], deliverableKey: 'task_inf_api_deliverable' },
    ],
};
