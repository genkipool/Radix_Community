import { Area } from '../../../types/data.types';

export const EDUCATION_DATA: Area = {
    id: 'education', icon: 'BookOpen', gradient: 'from-amber-400 to-orange-500', accentRgb: '251,191,36',
    totalBudget: 120000, spentBudget: 45000, spentBudgetUsd: 2700,
    radixAddress: 'account_rdx1cx7edueucat1onxpvhf9ztf8e4skr9y3zv0u0mw5knq9dpx2dd',
    members: [
        { id: 'edu-1', name: 'Laura Gómez', roleKey: 'role_education_lead', isVolunteer: false, joinedDate: '2024-10-01', socialHandle: '@laura_scrypto' },
        { id: 'edu-2', name: 'Miguel Santisteban', roleKey: 'role_content_creator', isVolunteer: true, joinedDate: '2025-01-20', socialHandle: '@miguel_academy' },
    ],
    tasks: [
        { id: 'edu-t1', titleKey: 'task_edu_scrypto_course_title', descriptionKey: 'task_edu_scrypto_course_desc', type: 'service', status: 'completed', cost: 25000, costUsd: 1500, assignedTo: ['edu-1'], startDate: '2024-12-01', endDate: '2025-02-15', tags: ['course', 'scrypto', 'rust'], deliverableKey: 'task_edu_scrypto_course_deliverable' },
        { id: 'edu-t2', titleKey: 'task_edu_tutorials_title', descriptionKey: 'task_edu_tutorials_desc', type: 'service', status: 'in_progress', cost: 20000, costUsd: 1200, assignedTo: ['edu-1', 'edu-2'], startDate: '2025-03-01', tags: ['tutorial', 'video', 'youtube'], deliverableKey: 'task_edu_tutorials_deliverable' },
    ],
};
