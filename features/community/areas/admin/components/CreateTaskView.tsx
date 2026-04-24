'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Check, Users, Github } from 'lucide-react';
import { Area, Task, TaskType, TaskStatus } from '../../../types/data.types';
import { CommunityDictionary } from '../../../types/i18n.types';
import { taskSchema, TaskFormValues } from '../../../schemas/taskSchema';
import { AdminFormField, AdminSelectInput, AdminTextInput, AdminTextArea } from './AdminUI';

interface CreateTaskViewProps {
    areas: Area[];
    onUpdateAreas: (areas: Area[]) => void;
    t: CommunityDictionary;
}

const generateTaskId = () => `dyn-${Date.now()}`;

export function CreateTaskView({ areas, onUpdateAreas, t }: CreateTaskViewProps) {
    const [success, setSuccess] = useState(false);
    const [lastCreated, setLastCreated] = useState('');

    const {
        register,
        handleSubmit,
        reset,
        control,
        formState: { errors }
    } = useForm<TaskFormValues>({
        resolver: zodResolver(taskSchema),
        defaultValues: {
            areaId: '',
            titleDirect: '',
            descriptionDirect: '',
            deliverableDirect: '',
            type: 'service',
            status: 'in_progress',
            costXrd: '0',
            costUsd: '0',
            startDate: new Date().toISOString().split('T')[0],
            endDate: '',
            tags: '',
            githubUrl: '',
            assignedMembers: '',
        }
    });

    const selectedAreaId = useWatch({ control, name: 'areaId' });
    const taskType = useWatch({ control, name: 'type' });
    const selectedAreaObj = areas.find(a => a.id === selectedAreaId);

    const onSubmit = (data: TaskFormValues) => {
        const costXrd = parseFloat(data.costXrd) || 0;
        const costUsd = parseFloat(data.costUsd) || 0;
        const isVoluntary = data.type === 'voluntary';

        const newTask: Task = {
            id: generateTaskId(),
            titleKey: '',
            descriptionKey: '',
            titleDirect: data.titleDirect.trim(),
            descriptionDirect: data.descriptionDirect.trim(),
            deliverableDirect: data.deliverableDirect?.trim() || undefined,
            type: isVoluntary ? 'voluntary' : data.type,
            status: data.status,
            cost: isVoluntary ? 0 : costXrd,
            costUsd: isVoluntary ? 0 : costUsd,
            startDate: data.startDate,
            endDate: data.endDate || undefined,
            tags: data.tags?.split(',').map(s => s.trim()).filter(Boolean) || [],
            githubUrl: data.githubUrl?.trim() || undefined,
            assignedTo: data.assignedMembers?.split(',').map(s => s.trim()).filter(Boolean) || [],
            isDynamic: true,
        };

        onUpdateAreas(areas.map(area => {
            if (area.id !== data.areaId) return area;
            return {
                ...area,
                spentBudget: area.spentBudget + (isVoluntary ? 0 : costXrd),
                spentBudgetUsd: area.spentBudgetUsd + (isVoluntary ? 0 : costUsd),
                tasks: [...area.tasks, newTask],
            };
        }));

        setLastCreated(data.titleDirect.trim());
        setSuccess(true);
        reset();
        setTimeout(() => { setSuccess(false); setLastCreated(''); }, 3000);
    };

    const typeOptions: { value: TaskType; label: string }[] = [
        { value: 'service', label: t.task_type_service ?? 'Service' },
        { value: 'personnel', label: t.task_type_personnel ?? 'Personnel' },
        { value: 'voluntary', label: t.task_type_voluntary ?? 'Voluntary' },
    ];
    
    const statusOptions: { value: TaskStatus; label: string }[] = [
        { value: 'in_progress', label: t.status_in_progress ?? 'In progress' },
        { value: 'planned', label: t.status_planned ?? 'Planned' },
        { value: 'completed', label: t.status_completed ?? 'Completed' },
        { value: 'paused', label: t.status_paused ?? 'On hold' },
        { value: 'cancelled', label: t.status_cancelled ?? 'Cancelled' },
    ];

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {success && (
                <div className="flex items-center gap-3 p-4 rounded-2xl"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
                    <Check className="w-5 h-5 shrink-0" style={{ color: '#10b981' }} />
                    <div>
                        <p className="text-sm font-semibold" style={{ color: '#10b981' }}>
                            {t.admin_form_success ?? 'Task created successfully!'}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                            {lastCreated}
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left column */}
                <div className="space-y-5">
                    <AdminFormField label={t.admin_form_area ?? 'Work area'} required error={errors.areaId?.message}>
                        <AdminSelectInput {...register('areaId')}>
                            <option value="">{t.admin_form_area_placeholder ?? 'Select area...'}</option>
                            {areas.map(area => (
                                <option key={area.id} value={area.id}>{area.id}</option>
                            ))}
                        </AdminSelectInput>
                        {selectedAreaObj && (
                            <div className="mt-1.5 px-3 py-2 rounded-xl text-xs flex items-center justify-between"
                                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)' }}>
                                <span style={{ color: 'var(--color-text-muted)' }}>
                                    {t.area_total_budget_label ?? 'Budget'}: <strong style={{ color: 'var(--color-text-main)' }}>{new Intl.NumberFormat().format(selectedAreaObj.totalBudget)} XRD</strong>
                                </span>
                                <span style={{ color: '#10b981' }}>
                                    {t.budget_available ?? 'Avail.'}: <strong>{new Intl.NumberFormat().format(selectedAreaObj.totalBudget - selectedAreaObj.spentBudget)} XRD</strong>
                                </span>
                            </div>
                        )}
                    </AdminFormField>

                    <AdminFormField label={t.admin_form_title ?? 'Task title'} required error={errors.titleDirect?.message}>
                        <AdminTextInput 
                            {...register('titleDirect')}
                            placeholder={t.admin_form_title_placeholder ?? 'E.g.: Radix API Integration'} 
                        />
                    </AdminFormField>

                    <AdminFormField label={t.admin_form_description ?? 'Description'} required error={errors.descriptionDirect?.message}>
                        <AdminTextArea
                            {...register('descriptionDirect')}
                            placeholder={t.admin_form_description_placeholder ?? 'Detailed description...'}
                            rows={4}
                        />
                    </AdminFormField>

                    <AdminFormField label={t.admin_form_deliverable ?? 'Deliverable'}>
                        <AdminTextArea
                            {...register('deliverableDirect')}
                            placeholder={t.admin_form_deliverable_placeholder ?? 'Expected outcome...'}
                            rows={3}
                        />
                    </AdminFormField>
                </div>

                {/* Right column */}
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <AdminFormField label={t.admin_form_type ?? 'Type'}>
                            <AdminSelectInput {...register('type')}>
                                {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </AdminSelectInput>
                        </AdminFormField>
                        <AdminFormField label={t.admin_form_status ?? 'Status'}>
                            <AdminSelectInput {...register('status')}>
                                {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </AdminSelectInput>
                        </AdminFormField>
                    </div>

                    {taskType !== 'voluntary' && (
                        <div className="grid grid-cols-2 gap-4">
                            <AdminFormField label={t.admin_form_cost_xrd ?? 'Cost (XRD)'} error={errors.costXrd?.message}>
                                <AdminTextInput type="number" {...register('costXrd')} placeholder="0" />
                            </AdminFormField>
                            <AdminFormField label={t.admin_form_cost_usd ?? 'Cost (USD)'} error={errors.costUsd?.message}>
                                <AdminTextInput type="number" {...register('costUsd')} placeholder="0" />
                            </AdminFormField>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <AdminFormField label={t.admin_form_start_date ?? 'Start date'} required error={errors.startDate?.message}>
                            <AdminTextInput type="date" {...register('startDate')} />
                        </AdminFormField>
                        <AdminFormField label={t.admin_form_end_date ?? 'End date (optional)'}>
                            <AdminTextInput type="date" {...register('endDate')} />
                        </AdminFormField>
                    </div>

                    <AdminFormField label={t.admin_form_tags ?? 'Tags (comma separated)'}
                        hint={t.admin_form_tags_placeholder ?? 'E.g.: api, blockchain, radix'}>
                        <AdminTextInput {...register('tags')} placeholder="api, blockchain, radix" />
                    </AdminFormField>

                    <AdminFormField label={t.admin_form_assigned ?? 'Assign members (IDs)'}
                        hint={t.admin_form_assigned_placeholder ?? 'E.g.: dev-1, dev-2'}>
                        <AdminTextInput 
                            {...register('assignedMembers')}
                            placeholder="dev-1, dev-2" 
                            prefix={<Users className="w-4 h-4" />} 
                        />
                    </AdminFormField>

                    <AdminFormField label={t.admin_form_github ?? 'GitHub URL (optional)'} error={errors.githubUrl?.message}>
                        <AdminTextInput 
                            type="text" 
                            {...register('githubUrl')}
                            placeholder={t.admin_form_github_placeholder ?? 'https://github.com/...'}
                            prefix={<Github className="w-4 h-4" />} 
                        />
                    </AdminFormField>
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t" style={{ borderColor: 'var(--color-card-border)' }}>
                <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200"
                    style={{ background: 'var(--color-primary)', color: '#fff' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.9'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                >
                    <Plus className="w-4 h-4" />
                    {t.admin_form_submit ?? 'Create task'}
                </button>
            </div>
        </form>
    );
}
