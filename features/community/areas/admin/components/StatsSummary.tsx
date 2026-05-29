'use client';

import { Area } from '../../../types/data.types';
import { CommunityDictionary } from '../../../types/i18n.types';
import { fmtXrd } from '../../../utils/formatters';

interface StatsSummaryProps {
    areas: Area[];
    t: CommunityDictionary;
}

export function StatsSummary({ areas, t }: StatsSummaryProps) {
    const totalBudget = areas.reduce((s, a) => s + a.totalBudget, 0);
    const totalSpent = areas.reduce((s, a) => s + a.spentBudget, 0);
    const totalTasks = areas.reduce((s, a) => s + a.tasks.length, 0);
    const completedTasks = areas.reduce((s, a) => s + a.tasks.filter(tk => tk.status === 'completed').length, 0);

    const stats = [
        { label: t.area_total_budget_label ?? 'Allocated budget', value: fmtXrd(totalBudget), color: 'var(--color-accent)' },
        { label: t.total_spent ?? 'Total spent', value: fmtXrd(totalSpent), color: 'var(--color-primary)' },
        { label: t.budget_available ?? 'Available', value: fmtXrd(totalBudget - totalSpent), color: '#10b981' },
        { label: t.total_tasks ?? 'Tasks', value: `${totalTasks} (${completedTasks} ✓)`, color: '#f59e0b' },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
                <div key={`stat-${i}`} className="rounded-xl p-4 relative overflow-hidden"
                    style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}>
                    <div className="absolute top-0 right-0 size-16 rounded-full -translate-y-4 translate-x-4 opacity-10"
                        style={{ background: stat.color }} />
                    <p className="text-[10px] font-semibold uppercase tracking-wide mb-1 relative z-10"
                        style={{ color: 'var(--color-text-muted)' }}>{stat.label}</p>
                    <p className="text-sm font-bold tabular-nums relative z-10"
                        style={{ color: stat.color }}>{stat.value}</p>
                </div>
            ))}
        </div>
    );
}
