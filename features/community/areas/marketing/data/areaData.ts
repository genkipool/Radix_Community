import { Area } from '../../../types/data.types';

export const MARKETING_DATA: Area = {
    id: 'marketing', icon: 'Megaphone', gradient: 'from-rose-500 to-pink-400', accentRgb: '244,63,94',
    totalBudget: 120000, spentBudget: 94200, spentBudgetUsd: 5652,
    radixAddress: 'account_rdx1cx4mkt9wkq1pfmr3xpvhf7ztf8e2skr5y1zv6u8mw3knq7dpx0bb',
    members: [
        { id: 'mkt-1', name: 'Isabella Torres', roleKey: 'role_marketing_lead', isVolunteer: false, joinedDate: '2024-12-01', socialHandle: '@isa_radixes' },
        { id: 'mkt-2', name: 'Javier Hernández', roleKey: 'role_content_creator', isVolunteer: false, joinedDate: '2025-01-20', socialHandle: '@javi_xrd' },
        { id: 'mkt-3', name: 'Lucía Fernández', roleKey: 'role_social_media', isVolunteer: true, joinedDate: '2025-02-01', socialHandle: '@lucia_defi' },
    ],
    tasks: [
        { id: 'mkt-t1', titleKey: 'task_mkt_campaign_title', descriptionKey: 'task_mkt_campaign_desc', type: 'personnel', status: 'completed', cost: 35000, costUsd: 2100, assignedTo: ['mkt-1', 'mkt-2'], startDate: '2025-01-01', endDate: '2025-03-31', tags: ['social media', 'video', 'content'], deliverableKey: 'task_mkt_campaign_deliverable' },
        { id: 'mkt-t2', titleKey: 'task_mkt_branding_title', descriptionKey: 'task_mkt_branding_desc', type: 'service', status: 'completed', cost: 18500, costUsd: 1110, assignedTo: ['mkt-1'], startDate: '2025-01-10', endDate: '2025-02-28', tags: ['design', 'branding', 'graphics'], deliverableKey: 'task_mkt_branding_deliverable' },
        { id: 'mkt-t3', titleKey: 'task_mkt_newsletter_title', descriptionKey: 'task_mkt_newsletter_desc', type: 'voluntary', status: 'in_progress', cost: 0, costUsd: 0, assignedTo: ['mkt-3'], startDate: '2025-02-01', tags: ['newsletter', 'content', 'community'], deliverableKey: 'task_mkt_newsletter_deliverable' },
        { id: 'mkt-t4', titleKey: 'task_mkt_podcast_title', descriptionKey: 'task_mkt_podcast_desc', type: 'service', status: 'completed', cost: 40700, costUsd: 2442, assignedTo: ['mkt-1', 'mkt-2'], startDate: '2025-03-01', endDate: '2025-05-31', tags: ['podcast', 'sponsorship', 'awareness'], deliverableKey: 'task_mkt_podcast_deliverable' },
    ],
};
