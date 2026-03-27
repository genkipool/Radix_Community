'use client';

import { Plus, Pencil, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { AdminView } from '../../../types/data.types';
import { CommunityDictionary } from '../../../types/i18n.types';
import { AdminPanelProps } from '../../../types/components.types';

// Sub-components
import { StatsSummary } from './StatsSummary';
import { CreateTaskView } from './CreateTaskView';
import { UpdateTasksView } from './UpdateTasksView';

export function AdminPanel({ areas, onUpdateAreas, initialView, onViewChange, onClose }: AdminPanelProps) {
    const { t: dict } = useLanguage();
    const t = dict.community_transparency as unknown as CommunityDictionary;

    return (
        <div className="px-4 md:px-8 py-8 space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
                        <ShieldCheck className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5"
                            style={{ color: 'var(--color-primary)' }}>
                            {t.admin_card_title ?? 'Administrator'}
                        </p>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-main)' }}>
                            {t.admin_panel_title ?? 'Administration Panel'}
                        </h1>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                            {t.admin_panel_description ?? 'Manage tasks and budgets'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 shrink-0"
                    style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-card-border)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)'; }}>
                    <ArrowLeft className="w-4 h-4" />
                    {t.admin_back ?? '← Volver'}
                </button>
            </div>

            {/* Stats */}
            <StatsSummary areas={areas} t={t} />

            {/* Tabs */}
            <div className="flex gap-2 p-1 rounded-2xl"
                style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}>
                {([
                    { id: 'create' as NonNullable<AdminView>, label: t.admin_tab_create ?? 'Create task', icon: Plus },
                    { id: 'update' as NonNullable<AdminView>, label: t.admin_tab_update ?? 'Update tasks', icon: Pencil },
                ]).map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => onViewChange(id)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
                        style={{
                            background: initialView === id ? 'var(--color-primary)' : 'transparent',
                            color: initialView === id ? '#fff' : 'var(--color-text-muted)',
                        }}
                        onMouseEnter={e => { if (initialView !== id) (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface)'; }}
                        onMouseLeave={e => { if (initialView !== id) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
                        <Icon className="w-4 h-4" />
                        {label}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="rounded-2xl p-6"
                style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}>
                {initialView === 'create' && (
                    <CreateTaskView areas={areas} onUpdateAreas={onUpdateAreas} t={t} />
                )}
                {initialView === 'update' && (
                    <UpdateTasksView areas={areas} onUpdateAreas={onUpdateAreas} t={t} />
                )}
            </div>
        </div>
    );
}
