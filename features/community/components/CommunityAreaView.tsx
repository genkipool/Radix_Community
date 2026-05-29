'use client';


import {
    Code, Megaphone, GraduationCap, Server, Scale,
    CheckCircle2, Clock, Calendar, Users, Wrench,
    Coins, Tag, DollarSign, BarChart3, UserCheck, Globe, ExternalLink, Github,
    PauseCircle, XCircle, Shield,
} from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import Link from 'next/link';
import { CopyButton } from '@/components/ui/CopyButton';
import {
    Task,
    TaskType,
    TaskStatus,
    ExplorerTarget
} from '../types/data.types';
import { CommunityDictionary } from '../types/i18n.types';
import { CommunityAreaViewProps } from '../types/components.types';

/* ─── Icons map ─────────────────────────────────────────────────────────── */
const ICON_MAP: Record<string, React.ElementType> = {
    Code, Megaphone, GraduationCap, Server, Scale, Shield,
};

/* ─── Formatters ─────────────────────────────────────────────────────────── */
const _xrdFmt = new Intl.NumberFormat('es-ES');
const _usdFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
function fmtXrd(n: number) { return _xrdFmt.format(n) + ' XRD'; }
function fmtUsd(n: number) {
    return '$' + _usdFmt.format(n);
}
function fmtDate(s: string) {
    return new Date(s).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
}

/* ─── ExplorerButton ─────────────────────────────────────────────────────── */
function ExplorerButton({ target, label, size = 'sm', onClick }: {
    target: ExplorerTarget; label: string; size?: 'xs' | 'sm'; onClick?: (t: ExplorerTarget) => void;
}) {
    const px = size === 'xs' ? 'px-2 py-1' : 'px-3 py-1.5';
    const textSize = size === 'xs' ? 'text-[10px]' : 'text-xs';

    return (
        <button
            type="button"
            onClick={() => onClick?.(target)}
            className={`inline-flex items-center gap-1.5 ${px} rounded-lg font-semibold ${textSize} transition-all duration-200 shrink-0`}
            style={{
                background: 'rgba(99,102,241,0.08)',
                color: 'var(--color-primary)',
                border: '1px solid rgba(99,102,241,0.2)',
            }}
        >
            <ExternalLink className="size-3" />
            {label}
        </button>
    );
}

/* ─── TaskCard ───────────────────────────────────────────────────────────── */
function TaskCard({ task, t }: { task: Task; t: CommunityDictionary }) {
    const statusColors: Record<TaskStatus, string> = {
        completed: '#10b981',
        in_progress: 'var(--color-primary)',
        planned: 'var(--color-text-muted)',
        paused: '#9ca3af',
        cancelled: '#ef4444',
    };
    const typeColors: Record<TaskType, { bg: string; text: string; border: string }> = {
        service: { bg: 'rgba(37,99,235,0.12)', text: '#3b82f6', border: 'rgba(37,99,235,0.25)' },
        personnel: { bg: 'rgba(139,92,246,0.12)', text: '#8b5cf6', border: 'rgba(139,92,246,0.25)' },
        voluntary: { bg: 'rgba(16,185,129,0.12)', text: '#10b981', border: 'rgba(16,185,129,0.25)' },
    };
    const statusLabels: Record<TaskStatus, string | undefined> = {
        completed: t.status_completed,
        in_progress: t.status_in_progress,
        planned: t.status_planned,
        paused: t.status_paused,
        cancelled: t.status_cancelled,
    };
    const typeLabels: Record<TaskType, string | undefined> = {
        service: t.task_type_service,
        personnel: t.task_type_personnel,
        voluntary: t.task_type_voluntary,
    };

    const statusColor = statusColors[task.status] ?? 'var(--color-text-muted)';
    const typeStyle = typeColors[task.type];
    const { task_titles: taskTitles, task_descriptions: taskDescs, task_deliverables: taskDeliverables } = t;

    // Support dynamically-created tasks
    const displayTitle = task.titleDirect ?? taskTitles[task.titleKey as keyof typeof taskTitles] ?? task.titleKey;
    const displayDesc = task.descriptionDirect ?? taskDescs[task.descriptionKey as keyof typeof taskDescs] ?? task.descriptionKey;
    const displayDeliverable = task.deliverableDirect
        ?? (task.deliverableKey ? (taskDeliverables[task.deliverableKey as keyof typeof taskDeliverables] ?? task.deliverableKey) : null);
    const StatusIconComp = task.status === 'completed' ? CheckCircle2
        : task.status === 'in_progress' ? Clock
            : task.status === 'paused' ? PauseCircle
                : task.status === 'cancelled' ? XCircle
                    : Calendar;

    return (
        <div className="rounded-2xl p-5"
            style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}>
            {/* Title + desc */}
            <div className="mb-3">
                <div className="flex items-start justify-between gap-3 mb-1">
                    <h3 className="font-semibold text-sm leading-tight" style={{ color: 'var(--color-text-main)' }}>
                        {displayTitle}
                    </h3>
                    {/* GitHub link for dev tasks */}
                    {task.githubUrl && (
                        <Link
                            href={task.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-200"
                            style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-card-border)' }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(99,102,241,0.08)';
                                (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-primary)';
                                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(99,102,241,0.2)';
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLAnchorElement).style.background = 'var(--color-surface)';
                                (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-muted)';
                                (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--color-card-border)';
                            }}
                        >
                            <Github className="size-3.5" />
                            GitHub
                        </Link>
                    )}
                </div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                    {displayDesc}
                </p>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}30` }}>
                    <StatusIconComp className="size-3" />
                    {statusLabels[task.status] ?? task.status}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: typeStyle.bg, color: typeStyle.text, border: `1px solid ${typeStyle.border}` }}>
                    {task.type === 'service' ? <Wrench className="size-3" />
                        : task.type === 'personnel' ? <Users className="size-3" />
                            : <UserCheck className="size-3" />}
                    {typeLabels[task.type]}
                </span>
                {task.tags.slice(0, 2).map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                        style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-card-border)' }}>
                        <Tag className="size-2.5" />{tag}
                    </span>
                ))}
            </div>

            {/* Cost + dates */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2">
                <div className="flex items-center gap-1.5">
                    <Coins className="size-3.5" style={{ color: task.cost === 0 ? '#10b981' : 'var(--color-primary)' }} />
                    <span className="text-xs font-semibold" style={{ color: task.cost === 0 ? '#10b981' : 'var(--color-text-main)' }}>
                        {task.cost === 0 ? (t.voluntary_free ?? 'Voluntary (free)') : fmtXrd(task.cost)}
                    </span>
                    {task.costUsd && task.costUsd > 0 && (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            (≈ {fmtUsd(task.costUsd)})
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    <Calendar className="size-3" style={{ color: 'var(--color-text-muted)' }} />
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {fmtDate(task.startDate)}{task.endDate ? ` → ${fmtDate(task.endDate)}` : ` → ${t.ongoing_label ?? 'Ongoing'}`}
                    </span>
                </div>
            </div>

            {/* Deliverable */}
            {displayDeliverable && (
                <div className="px-3 py-2 rounded-xl text-xs leading-relaxed"
                    style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-card-border)' }}>
                    <span className="font-semibold" style={{ color: 'var(--color-text-main)' }}>
                        {t.deliverable_label ?? 'Deliverable'}:{' '}
                    </span>
                    {displayDeliverable}
                </div>
            )}
        </div>
    );
}

/* ─── Main component ─────────────────────────────────────────────────────── */

export function CommunityAreaView({ area, onShowExplorer }: CommunityAreaViewProps) {
    const { t: dict } = useLanguage();
    const t = dict.community_transparency as unknown as CommunityDictionary;
    const { area_names: areaNames, roles } = t;

    const Icon = ICON_MAP[area.icon] ?? Code;
    const spentPct = area.totalBudget > 0 ? (area.spentBudget / area.totalBudget) * 100 : 0;
    const remainingBudget = area.totalBudget - area.spentBudget;
    const completedTasks = area.tasks.filter(tk => tk.status === 'completed').length;
    const inProgressTasks = area.tasks.filter(tk => tk.status === 'in_progress').length;
    // Fix: voluntary contributions = number of volunteer members, not voluntary tasks
    const voluntaryMembers = area.members.filter(m => m.isVolunteer).length;

    return (
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 py-12 w-full">

            {/* Area hero */}
            <div
                className="rounded-3xl overflow-hidden mb-8"
                style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
            >
                <div className={`h-1 w-full bg-gradient-to-r ${area.gradient}`} />
                <div className="p-8">
                    <div className="flex items-center gap-4 mb-5">
                        <div className={`size-12 rounded-2xl flex items-center justify-center bg-gradient-to-br ${area.gradient} shadow-lg`}>
                            <Icon className="size-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--color-text-main)' }}>
                                {areaNames[area.id] ?? area.id}
                            </h1>
                            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                {area.members.length} {t.sidebar_members_label ?? 'members'} · {area.tasks.length} tasks
                            </p>
                        </div>
                    </div>

                    {/* Area Radix address */}
                    <div className="mb-6 rounded-xl overflow-hidden"
                        style={{ border: '1px solid var(--color-card-border)' }}>
                        <div className="px-4 py-2.5 flex items-center gap-2"
                            style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-card-border)' }}>
                            <Globe className="size-3.5 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                            <span className="text-xs font-semibold uppercase tracking-wide"
                                style={{ color: 'var(--color-text-muted)' }}>
                                {t.area_address_label ?? 'Area XRD Address'}
                            </span>
                        </div>
                        <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
                            <code className="flex-1 text-xs font-mono break-all" style={{ color: 'var(--color-text-main)' }}>
                                {area.radixAddress}
                            </code>
                            <div className="flex gap-2 shrink-0">
                                <CopyButton value={area.radixAddress} label={t.copy_address} />
                                <ExplorerButton
                                    target={{ kind: 'address', address: area.radixAddress }}
                                    label={t.explorer_view ?? 'Explorer'}
                                    onClick={onShowExplorer}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Budget progress */}
                    <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                            {t.budget_spent_label ?? 'Budget executed'}
                        </span>
                        <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--color-text-main)' }}>
                            {spentPct.toFixed(1)}%
                        </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface)' }}>
                        <div
                            className={`h-full rounded-full bg-gradient-to-r ${area.gradient}`}
                            style={{ width: `${spentPct}%` }}
                        />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        <span>
                            {t.sidebar_spent_label ?? 'Spent'}: <strong style={{ color: 'var(--color-text-main)' }}>{fmtXrd(area.spentBudget)}</strong>
                            <span className="ml-1">(≈ {fmtUsd(area.spentBudgetUsd)})</span>
                        </span>
                        <span>Total: <strong style={{ color: 'var(--color-text-main)' }}>{fmtXrd(area.totalBudget)}</strong></span>
                    </div>
                </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                {([
                    { labelKey: 'tasks_completed_label', value: `${completedTasks}/${area.tasks.length}`, Icon: CheckCircle2, color: '#10b981' },
                    { labelKey: 'in_progress_label', value: String(inProgressTasks), Icon: Clock, color: 'var(--color-primary)' },
                    // Fixed: voluntary contributions = volunteer members count
                    { labelKey: 'voluntary_contributions', value: String(voluntaryMembers), Icon: UserCheck, color: '#f59e0b' },
                    { labelKey: 'remaining_budget', value: fmtXrd(remainingBudget), Icon: DollarSign, color: '#6366f1' },
                ] as const).map((s) => (
                    <div key={`stats-${s.labelKey}`} className="rounded-2xl p-5"
                        style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}>
                        <s.Icon className="size-4 mb-2" style={{ color: s.color }} />
                        <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--color-text-main)' }}>{s.value}</p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {t[s.labelKey as keyof CommunityDictionary] as string ?? s.labelKey}
                        </p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Tasks (2/3) */}
                <div className="lg:col-span-2">
                    <h2 className="text-lg font-bold mb-5 flex items-center gap-2" style={{ color: 'var(--color-text-main)' }}>
                        <BarChart3 className="size-5" style={{ color: 'var(--color-primary)' }} />
                        {t.tasks_and_expenses ?? 'Tasks & Expenses'}
                    </h2>
                    <div className="space-y-4">
                        {area.tasks.map(task => (
                            <TaskCard key={task.id} task={task} t={t} />
                        ))}
                    </div>
                </div>

                {/* Members (1/3) */}
                <div>
                    <h2 className="text-lg font-bold mb-5 flex items-center gap-2" style={{ color: 'var(--color-text-main)' }}>
                        <Users className="size-5" style={{ color: 'var(--color-primary)' }} />
                        {t.team_title ?? 'Team'} ({area.members.length})
                    </h2>
                    <div className="space-y-3">
                        {area.members.map(member => (
                            <div
                                key={member.id}
                                className="rounded-2xl p-4 flex items-center gap-3"
                                style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
                            >
                                <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${area.gradient} text-white font-bold text-sm shadow-sm`}>
                                    {member.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-main)' }}>
                                        {member.name}
                                    </p>
                                    <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                                        {roles[member.roleKey] ?? member.roleKey}
                                    </p>
                                    {member.socialHandle && (
                                        <p className="text-xs font-medium" style={{ color: 'var(--color-primary)' }}>
                                            {member.socialHandle}
                                        </p>
                                    )}
                                </div>
                                {member.isVolunteer ? (
                                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                        style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>
                                        {t.volunteer_badge ?? 'Volunteer'}
                                    </span>
                                ) : (
                                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                        style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--color-primary)', border: '1px solid rgba(99,102,241,0.25)' }}>
                                        {t.team_badge ?? 'Team'}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Team composition summary */}
                    <div className="mt-4 rounded-2xl p-4"
                        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)' }}>
                        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text-main)' }}>
                            {t.team_composition ?? 'Team composition'}
                        </p>
                        <div className="space-y-2">
                            {[
                                { labelKey: 'paid_team', count: area.members.filter(m => !m.isVolunteer).length, color: 'var(--color-primary)', Icon: Users },
                                { labelKey: 'volunteers', count: voluntaryMembers, color: '#10b981', Icon: UserCheck },
                            ].map(s => (
                                <div key={s.labelKey} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <s.Icon className="size-3.5" style={{ color: s.color }} />
                                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                            {t[s.labelKey as keyof CommunityDictionary] as string ?? s.labelKey}
                                        </span>
                                    </div>
                                    <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--color-text-main)' }}>
                                        {s.count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
