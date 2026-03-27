'use client';

import { useState } from 'react';
import { Search, Trash2, Save, Check, Clock, CheckCircle2, Calendar, PauseCircle, XCircle } from 'lucide-react';
import { Area, Task, TaskType, TaskStatus } from '../../../types/data.types';
import { CommunityDictionary } from '../../../types/i18n.types';
import { AdminSelectInput, AdminTextInput, AdminTextArea, inputStyle } from './AdminUI';

interface UpdateTasksViewProps {
    areas: Area[];
    onUpdateAreas: (areas: Area[]) => void;
    t: CommunityDictionary;
}

const STATUS_COLORS: Record<TaskStatus, { bg: string; text: string; border: string }> = {
    completed: { bg: 'rgba(16,185,129,0.10)', text: '#10b981', border: 'rgba(16,185,129,0.25)' },
    in_progress: { bg: 'rgba(99,102,241,0.10)', text: '#6366f1', border: 'rgba(99,102,241,0.25)' },
    planned: { bg: 'rgba(245,158,11,0.10)', text: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
    paused: { bg: 'rgba(156,163,175,0.10)', text: '#9ca3af', border: 'rgba(156,163,175,0.25)' },
    cancelled: { bg: 'rgba(239,68,68,0.10)', text: '#ef4444', border: 'rgba(239,68,68,0.25)' },
};

const STATUS_ICONS: Record<TaskStatus, React.ElementType> = {
    completed: CheckCircle2,
    in_progress: Clock,
    planned: Calendar,
    paused: PauseCircle,
    cancelled: XCircle,
};

export function UpdateTasksView({ areas, onUpdateAreas, t }: UpdateTasksViewProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterArea, setFilterArea] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [editedTasks, setEditedTasks] = useState<Record<string, Partial<Task>>>({});
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const statusOptions: { value: TaskStatus; label: string }[] = [
        { value: 'in_progress', label: t.status_in_progress ?? 'In progress' },
        { value: 'planned', label: t.status_planned ?? 'Planned' },
        { value: 'completed', label: t.status_completed ?? 'Completed' },
        { value: 'paused', label: t.status_paused ?? 'On hold' },
        { value: 'cancelled', label: t.status_cancelled ?? 'Cancelled' },
    ];
    
    const typeOptions: { value: TaskType; label: string }[] = [
        { value: 'service', label: t.task_type_service ?? 'Service' },
        { value: 'personnel', label: t.task_type_personnel ?? 'Personnel' },
        { value: 'voluntary', label: t.task_type_voluntary ?? 'Voluntary' },
    ];

    const allTasks = areas.flatMap(area => area.tasks.map(task => ({ ...task, areaId: area.id })));
    const filtered = allTasks.filter(task => {
        const matchArea = filterArea === 'all' || task.areaId === filterArea;
        const matchStatus = filterStatus === 'all' || task.status === filterStatus;
        const title = task.titleDirect ?? task.titleKey;
        const matchSearch = !searchQuery || title.toLowerCase().includes(searchQuery.toLowerCase());
        return matchArea && matchSearch && matchStatus;
    });

    const updateField = (taskId: string, field: keyof Task, value: unknown) => {
        setEditedTasks(prev => ({ ...prev, [taskId]: { ...(prev[taskId] ?? {}), [field]: value } }));
    };

    const recomputeArea = (area: Area) => {
        const newSpent = area.tasks.filter(tk => tk.type !== 'voluntary').reduce((s, tk) => s + tk.cost, 0);
        const newSpentUsd = area.tasks.filter(tk => tk.type !== 'voluntary').reduce((s, tk) => s + (tk.costUsd ?? 0), 0);
        return { ...area, spentBudget: newSpent, spentBudgetUsd: newSpentUsd };
    };

    const handleSave = (taskId: string, areaId: string) => {
        const edits = editedTasks[taskId];
        if (!edits || Object.keys(edits).length === 0) return;
        onUpdateAreas(areas.map(area => {
            if (area.id !== areaId) return area;
            const updated = { ...area, tasks: area.tasks.map(t => t.id === taskId ? { ...t, ...edits } : t) };
            return recomputeArea(updated);
        }));
        setSavedIds(prev => new Set([...prev, taskId]));
        setTimeout(() => setSavedIds(prev => { const n = new Set(prev); n.delete(taskId); return n; }), 2000);
        setEditedTasks(prev => { const n = { ...prev }; delete n[taskId]; return n; });
    };

    const handleDelete = (taskId: string, areaId: string) => {
        onUpdateAreas(areas.map(area => {
            if (area.id !== areaId) return area;
            const updated = { ...area, tasks: area.tasks.filter(t => t.id !== taskId) };
            return recomputeArea(updated);
        }));
        setConfirmDeleteId(null);
    };

    return (
        <div className="space-y-5">
            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                        style={{ color: 'var(--color-text-muted)' }} />
                    <AdminTextInput
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder={t.admin_update_search ?? 'Search tasks...'}
                        className="pl-10"
                    />
                </div>
                <AdminSelectInput value={filterArea} onChange={e => setFilterArea(e.target.value)} className="w-auto">
                    <option value="all">{t.admin_update_all_areas ?? 'All areas'}</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.id}</option>)}
                </AdminSelectInput>
                <AdminSelectInput value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-auto">
                    <option value="all">Todos los estados</option>
                    {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </AdminSelectInput>
            </div>

            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {filtered.length} {t.ledger_entries ?? 'tareas'}
            </p>

            {filtered.length === 0 && (
                <div className="py-12 text-center">
                    <Search className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--color-text-muted)' }} />
                    <p style={{ color: 'var(--color-text-muted)' }}>{t.admin_no_tasks ?? 'No tasks found'}</p>
                </div>
            )}

            <div className="space-y-4">
                {filtered.map(task => {
                    const edits = editedTasks[task.id] ?? {};
                    const isSaved = savedIds.has(task.id);
                    const hasEdits = Object.keys(edits).length > 0;
                    const isConfirmingDelete = confirmDeleteId === task.id;

                    const currentTitle = edits.titleDirect !== undefined ? edits.titleDirect : (task.titleDirect ?? task.titleKey);
                    const currentDesc = edits.descriptionDirect !== undefined ? edits.descriptionDirect : (task.descriptionDirect ?? task.descriptionKey);
                    
                    const currentDeliverable = (edits as Record<string, string | undefined>).deliverableDirect !== undefined 
                        ? (edits as Record<string, string | undefined>).deliverableDirect 
                        : (task.deliverableDirect ?? '');
                    
                    const currentType = (edits.type ?? task.type) as TaskType;
                    const currentStatus = (edits.status ?? task.status) as TaskStatus;
                    const currentCost = edits.cost !== undefined ? edits.cost : task.cost;
                    const currentCostUsd = edits.costUsd !== undefined ? edits.costUsd : task.costUsd;

                    const area = areas.find(a => a.id === task.areaId);
                    const statusStyle = STATUS_COLORS[currentStatus] ?? STATUS_COLORS.planned;
                    const StatusIcon = STATUS_ICONS[currentStatus] ?? Calendar;

                    return (
                        <div key={task.id} className="rounded-2xl overflow-hidden transition-all duration-200"
                            style={{
                                border: hasEdits ? '2px solid rgba(99,102,241,0.5)' : '1px solid var(--color-card-border)',
                                background: 'var(--color-card-bg)',
                            }}>
                            {/* Header */}
                            <div className="px-4 py-2.5 flex items-center justify-between"
                                style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-card-border)' }}>
                                <div className="flex items-center gap-2.5">
                                    <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${area?.gradient ?? 'from-gray-400 to-gray-500'}`} />
                                    <span className="text-[11px] font-semibold uppercase tracking-wide"
                                        style={{ color: 'var(--color-text-muted)' }}>
                                        {task.areaId}
                                    </span>
                                    {task.isDynamic && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                            style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(99,102,241,0.25)' }}>
                                            Dynamic
                                        </span>
                                    )}
                                </div>
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                    style={{ background: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.border}` }}>
                                    <StatusIcon className="w-2.5 h-2.5" />
                                    {statusOptions.find(s => s.value === currentStatus)?.label ?? currentStatus}
                                </span>
                            </div>

                            <div className="p-4 space-y-3">
                                <AdminTextInput value={currentTitle}
                                    onChange={e => updateField(task.id, 'titleDirect', e.target.value)}
                                    style={{ ...inputStyle, fontWeight: 600 }} />
                                
                                <AdminTextArea value={currentDesc}
                                    onChange={e => updateField(task.id, 'descriptionDirect', e.target.value)}
                                    rows={2} placeholder="Descripción..."
                                    style={{ ...inputStyle, fontSize: '12px' }} />
                                
                                <AdminTextArea value={currentDeliverable}
                                    onChange={e => updateField(task.id, 'deliverableDirect' as keyof Task, e.target.value)}
                                    rows={2} placeholder={t.admin_form_deliverable ?? 'Deliverable...'}
                                    style={{ ...inputStyle, fontSize: '12px' }} />
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <AdminSelectInput value={currentType} onChange={e => updateField(task.id, 'type', e.target.value)} style={{ ...inputStyle, fontSize: '12px' }}>
                                        {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </AdminSelectInput>
                                    <AdminSelectInput value={currentStatus} onChange={e => updateField(task.id, 'status', e.target.value)} style={{ ...inputStyle, fontSize: '12px' }}>
                                        {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </AdminSelectInput>
                                </div>
                                
                                {currentType !== 'voluntary' && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <AdminTextInput type="number" min="0" value={currentCost}
                                            onChange={e => updateField(task.id, 'cost', parseFloat(e.target.value) || 0)}
                                            placeholder="XRD" style={{ ...inputStyle, fontSize: '12px' }} />
                                        <AdminTextInput type="number" min="0" value={currentCostUsd ?? ''}
                                            onChange={e => updateField(task.id, 'costUsd', parseFloat(e.target.value) || 0)}
                                            placeholder="USD" style={{ ...inputStyle, fontSize: '12px' }} />
                                    </div>
                                )}

                                <div className="flex items-center justify-between pt-1">
                                    {isConfirmingDelete ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs" style={{ color: '#ef4444' }}>
                                                {t.admin_delete_confirm ?? '¿Eliminar?'}
                                            </span>
                                            <button onClick={() => handleDelete(task.id, task.areaId)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                                                style={{ background: '#ef4444', color: '#fff' }}>
                                                {t.admin_delete_task ?? 'Eliminar'}
                                            </button>
                                            <button onClick={() => setConfirmDeleteId(null)}
                                                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                                                style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-card-border)' }}>
                                                {t.admin_form_cancel ?? 'Cancel'}
                                            </button>
                                        </div>
                                    ) : (
                                        <button onClick={() => setConfirmDeleteId(task.id)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                                            style={{ background: 'rgba(239,68,68,0.06)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.14)'; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.06)'; }}>
                                            <Trash2 className="w-3 h-3" />
                                            {t.admin_delete_task ?? 'Eliminar'}
                                        </button>
                                    )}

                                    {(hasEdits || isSaved) && (
                                        <button onClick={() => handleSave(task.id, task.areaId)}
                                            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200"
                                            style={{
                                                background: isSaved ? 'rgba(16,185,129,0.1)' : 'var(--color-primary)',
                                                color: isSaved ? '#10b981' : '#fff',
                                                border: isSaved ? '1px solid rgba(16,185,129,0.3)' : 'none',
                                            }}>
                                            {isSaved
                                                ? <><Check className="w-3.5 h-3.5" />{t.admin_update_saved ?? 'Saved!'}</>
                                                : <><Save className="w-3.5 h-3.5" />{t.admin_update_save ?? 'Save'}</>}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
