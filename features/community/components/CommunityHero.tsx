
'use client';

import { useState } from 'react';
import {
    Info, Users, CheckCircle2, Coins, Globe, ShieldAlert, TrendingUp, AlertCircle, ExternalLink, Download
} from 'lucide-react';
import { ContentHero } from '@/components/layout/ContentHero';
import { CollapsibleHeroSection } from '@/components/layout/CollapsibleHeroSection';
import { RadixInfoModal } from './RadixInfoModal';
import { LedgerTable } from './LedgerTable';
import { buildLedger } from '../utils/buildLedger';
import { useLanguage } from '@/context/LanguageContext';
import {
    TOTAL_RAISED,
    TOTAL_LEGAL,
    TOTAL_LEGAL_USD,
    TOTAL_RAISED_USD,
    FUNDING_SOURCES,
    AREAS,
    LEGAL_EXPENSES,
    GLOBAL_PROJECT_ADDRESS
} from '../data/communityData';
import { CommunityDictionary } from '../types/i18n.types';
import { CommunityHeroProps } from '../types/components.types';
import { fmtXrd, fmtXrdShort, fmtUsd } from '../utils/formatters';
import { calculateGlobalStats, calculateUtilization } from '../utils/calculations';
import { ExplorerButton } from './shared/ExplorerButton';
import { FundingSourceRow } from './hero/FundingSourceRow';
import { LegalRow } from './hero/LegalRow';
import { CopyButton } from '@/components/ui/CopyButton';

/* ─── Sub-components ─────────────────────────────────────────────────────── */

/** Unified address row that syncs copy animation for text and button */
function AddressCopyRow({ address }: { address: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (copied) return;
        try {
            await navigator.clipboard.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* noop */ }
    };

    return (
        <div className="mt-2 flex items-center justify-between gap-2 overflow-hidden">
            <button
                type="button"
                className="text-[10px] font-mono truncate cursor-pointer hover:text-[var(--color-text-main)] transition-colors text-left"
                style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', padding: 0 }}
                onClick={handleCopy}
                title="Click to copy"
            >
                {address.length > 24 ? `${address.slice(0, 12)}…${address.slice(-6)}` : address}
            </button>
            <CopyButton
                value={address}
                size="xs"
                variant="minimal"
                forceCopied={copied}
                onClick={handleCopy}
            />
        </div>
    );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export function CommunityHero({ collapsed, onSelectArea, areas: propAreas, onShowExplorer }: CommunityHeroProps) {
    const [isInfoOpen, setIsInfoOpen] = useState(false);

    const handleDownloadCsv = () => {
        const areaNames = dict.community_transparency?.area_names ?? {};
        const ledger = buildLedger(dict.community_transparency as unknown as CommunityDictionary, areaNames, propAreas ?? AREAS, FUNDING_SOURCES, LEGAL_EXPENSES);
        const headers = ['Type', 'Buy Amount', 'Buy Currency', 'Sell Amount', 'Sell Currency', 'Fee', 'Fee Currency', 'Exchange', 'Trade-Group', 'Comment', 'Date', 'Tx-ID'];
        const rows = ledger.map(r => {
            const isIncome = r.type === 'in';
            return [
                isIncome ? 'Deposit' : 'Withdrawal', // Type
                isIncome ? r.xrdAmount : '',        // Buy Amount
                isIncome ? 'XRD' : '',               // Buy Currency
                !isIncome ? r.xrdAmount : '',       // Sell Amount
                !isIncome ? 'XRD' : '',              // Sell Currency
                '',                                  // Fee
                'XRD',                               // Fee Currency
                'Radix Ecosystem',                   // Exchange
                'Community',                         // Trade-Group
                `${r.category}: ${r.description}`,   // Comment
                `${r.date} 12:00:00`,                // Date (CoinTracking likes time)
                r.txHash ?? ''                       // Tx-ID
            ];
        });
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `radix_cointracking_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // In a real app, t would come from props. For now, we still fetch it here 
    // but the sub-components will receive it as a prop.
    const { t: dict } = useLanguage();
    const t = dict.community_transparency as unknown as CommunityDictionary;
    const areaNames = t.area_names;

    // Use dynamic areas when provided (admin changes), fallback to static
    const areas = propAreas ?? AREAS;

    const stats = calculateGlobalStats(areas);

    const AVAILABLE = TOTAL_RAISED - stats.spentBudget - TOTAL_LEGAL;
    const AVAILABLE_USD = TOTAL_RAISED_USD - stats.spentBudgetUsd - TOTAL_LEGAL_USD;

    const utilizationPct = calculateUtilization(stats.spentBudget, TOTAL_RAISED);
    const taxesPct = calculateUtilization(TOTAL_LEGAL, TOTAL_RAISED);
    const totalSpentPct = calculateUtilization(stats.spentBudget + TOTAL_LEGAL, TOTAL_RAISED);

    const hero = (
        <ContentHero
            brandName="Radix"
            title={t.heroTitle ?? 'Community Transparency'}
            gradient="from-[var(--color-primary)] via-[var(--color-secondary)] to-[var(--color-accent)]"
            heroPadding="pt-12 pb-16"
            subtitle={
                <div className="space-y-4">
                    <p className="" style={{ color: 'var(--color-text-muted)' }}>
                        {t.heroDescription}
                    </p>
                    <button
                        type="button"
                        onClick={() => setIsInfoOpen(true)}
                        className="inline-flex items-center gap-2 text-sm font-semibold"
                        style={{ color: 'var(--color-primary)' }}
                    >
                        <Info className="size-4" />
                        {t.more_info_link ?? 'More information'}
                    </button>
                </div>
            }
        />
    );

    const grid = (
        <div className="space-y-12">

            {/* ── Global stats ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {([
                    {
                        labelKey: 'total_raised',
                        value: fmtXrdShort(TOTAL_RAISED),
                        sub: `≈ ${fmtUsd(TOTAL_RAISED_USD)}`,
                        Icon: Coins,
                        color: 'var(--color-accent)',
                    },
                    {
                        labelKey: 'total_spent',
                        value: fmtXrdShort(stats.spentBudget + TOTAL_LEGAL),
                        sub: `≈ ${fmtUsd(stats.spentBudgetUsd + TOTAL_LEGAL_USD)}`,
                        Icon: TrendingUp,
                        color: 'var(--color-primary)',
                    },
                    {
                        labelKey: 'active_members',
                        value: String(stats.totalMembers),
                        sub: `${stats.totalVolunteers} volunteers`,
                        Icon: Users,
                        color: '#f59e0b',
                    },
                    {
                        labelKey: 'total_tasks',
                        value: String(stats.totalTasks),
                        sub: `${stats.completedTasks} completed`,
                        Icon: CheckCircle2,
                        color: '#10b981',
                    },
                ] as const).map(s => (
                    <div
                        key={s.labelKey}
                        className="rounded-2xl p-5 relative overflow-hidden"
                        style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
                    >
                        <div className="absolute top-0 right-0 size-20 rounded-full -translate-y-6 translate-x-6 opacity-10"
                            style={{ background: s.color }} />
                        <s.Icon className="size-5 mb-3 relative z-10" style={{ color: s.color }} />
                        <p className="text-2xl font-bold mb-0.5 relative z-10 tabular-nums" style={{ color: 'var(--color-text-main)' }}>
                            {s.value}
                        </p>
                        <p className="text-sm font-semibold relative z-10" style={{ color: 'var(--color-text-main)' }}>
                            {t[s.labelKey as keyof CommunityDictionary] as string ?? s.labelKey}
                        </p>
                        <p className="text-xs mt-0.5 relative z-10" style={{ color: 'var(--color-text-muted)' }}>{s.sub}</p>
                    </div>
                ))}
            </div>

            {/* ── Utilization bar ───────────────────────────────────────── */}
            <div
                className="rounded-2xl p-6"
                style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
            >
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>
                            {t.budget_utilization ?? 'Utilización del proyecto'}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {fmtXrd(stats.spentBudget + TOTAL_LEGAL)} / {fmtXrd(TOTAL_RAISED)}
                        </p>
                    </div>
                    <span className="text-3xl font-black tabular-nums" style={{ color: 'var(--color-primary)' }}>
                        {totalSpentPct}%
                    </span>
                </div>

                {/* Stacked bar: Gastos + Impuestos + Disponible */}
                <div className="w-full h-4 rounded-full overflow-hidden mb-2 flex" style={{ background: 'var(--color-surface)' }}>
                    <div
                        className="h-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] transition-all duration-500"
                        style={{ width: `${utilizationPct}%` }}
                        title={`${t.total_spent ?? 'Gastado'}: ${utilizationPct}%`}
                    />
                    <div
                        className="h-full bg-gradient-to-r from-red-500 to-rose-400 transition-all duration-500"
                        style={{ width: `${taxesPct}%` }}
                        title={`${t.util_taxes ?? 'Impuestos'}: ${taxesPct}%`}
                    />
                </div>
                {/* Legend */}
                <div className="flex flex-wrap gap-3 mb-5 text-[10px] font-semibold">
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-2 rounded-sm bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)]" />
                        <span style={{ color: 'var(--color-text-muted)' }}>{t.total_spent ?? 'Gastos'} ({utilizationPct}%)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-2 rounded-sm bg-gradient-to-r from-red-500 to-rose-400" />
                        <span style={{ color: 'var(--color-text-muted)' }}>{t.util_taxes ?? 'Impuestos'} ({taxesPct}%)</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-2 rounded-sm" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)' }} />
                        <span style={{ color: 'var(--color-text-muted)' }}>{t.budget_available ?? 'Disponible'} ({100 - utilizationPct - taxesPct}%)</span>
                    </span>
                </div>

                {/* 3-column summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                    {/* Gastado */}
                    <div className="rounded-xl p-4" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-primary)' }}>
                            {t.total_spent ?? 'Total gastado'}
                        </p>
                        <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-text-main)' }}>{fmtXrd(stats.spentBudget + TOTAL_LEGAL)}</p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>≈ {fmtUsd(stats.spentBudgetUsd + TOTAL_LEGAL_USD)}</p>
                    </div>
                    {/* Impuestos */}
                    <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#ef4444' }}>
                            {t.util_taxes ?? 'Impuestos & Legal'}
                        </p>
                        <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-text-main)' }}>{fmtXrd(TOTAL_LEGAL)}</p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>≈ {fmtUsd(TOTAL_LEGAL_USD)}</p>
                    </div>
                    {/* Disponible real */}
                    <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#10b981' }}>
                            {t.util_available_label ?? 'Saldo disponible real'}
                        </p>
                        <p className="text-lg font-bold tabular-nums" style={{ color: '#10b981' }}>{fmtXrd(AVAILABLE)}</p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>≈ {fmtUsd(AVAILABLE_USD)}</p>
                    </div>
                </div>

                {/* Per-area bars */}
                <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text-muted)' }}>
                    {t.areas_title ?? 'Áreas de trabajo'}
                </p>
                <div className="flex w-full gap-3 pb-2 no-scrollbar">
                    {areas.map(area => {
                        const pct = calculateUtilization(area.spentBudget, area.totalBudget);
                        return (
                            <button
                                type="button"
                                key={area.id}
                                onClick={() => onSelectArea(area.id)}
                                className="text-left group flex-1 min-w-[120px]"
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-semibold truncate group-hover:underline"
                                        style={{ color: 'var(--color-text-muted)' }}
                                        title={areaNames[area.id] ?? area.id}
                                    >
                                        {areaNames[area.id] ?? area.id}
                                    </span>
                                    <span className="text-[10px] font-bold tabular-nums" style={{ color: 'var(--color-text-main)' }}>
                                        {pct}%
                                    </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface)' }}>
                                    <div className={`h-full rounded-full bg-gradient-to-r ${area.gradient} transition-all duration-500`}
                                        style={{ width: `${pct}%` }} />
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Global project address ────────────────────────────────── */}
            <div className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--color-card-bg)', border: '1px solid rgba(99,102,241,0.25)' }}>
                <div className="px-6 py-4 flex items-center gap-3"
                    style={{ borderBottom: '1px solid rgba(99,102,241,0.15)', background: 'rgba(99,102,241,0.04)' }}>
                    <Globe className="size-4 shrink-0" style={{ color: 'var(--color-primary)' }} />
                    <div>
                        <p className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>
                            {t.global_address_label ?? 'Global Project Address'}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {t.global_address_desc ?? 'Main address distributing funds to areas'}
                        </p>
                    </div>
                </div>
                <div className="px-6 py-4">
                    <div className="flex items-center gap-3 flex-wrap p-3 rounded-xl"
                        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)' }}>
                        <code className="flex-1 text-xs font-mono break-all" style={{ color: 'var(--color-text-main)' }}>
                            {GLOBAL_PROJECT_ADDRESS}
                        </code>
                        <div className="flex gap-2 shrink-0">
                            <CopyButton value={GLOBAL_PROJECT_ADDRESS} label={t.copy_address} />
                            <ExplorerButton
                                target={{ kind: 'address', address: GLOBAL_PROJECT_ADDRESS }}
                                label={t.explorer_view ?? 'Explorer'}
                                onClick={onShowExplorer}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Areas overview ────────────────────────────────────────── */}
            <div>
                <h2 className="text-xl font-bold mb-5 flex items-center gap-2" style={{ color: 'var(--color-text-main)' }}>
                    <TrendingUp className="size-5" style={{ color: 'var(--color-primary)' }} />
                    {t.areas_title ?? 'Work areas'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {areas.map(area => {
                        const spentPct = calculateUtilization(area.spentBudget, area.totalBudget);
                        const voluntaryTasks = area.tasks.filter(tk => tk.type === 'voluntary').length;

                        return (
                            <button
                                type="button"
                                key={area.id}
                                onClick={() => onSelectArea(area.id)}
                                className="text-left rounded-2xl overflow-hidden group transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                                style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-primary)';
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-card-border)';
                                }}
                            >
                                <div className={`h-1 w-full bg-gradient-to-r ${area.gradient}`} />
                                <div className="p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <p className="font-bold text-sm" style={{ color: 'var(--color-text-main)' }}>
                                                {areaNames[area.id] ?? area.id}
                                            </p>
                                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                                {area.members.length} {t.sidebar_members_label ?? 'members'} · {area.tasks.length} tasks
                                            </p>
                                        </div>
                                        <ExternalLink className="size-4 opacity-0 group-hover:opacity-100 transition-opacity"
                                            style={{ color: 'var(--color-primary)' }} />
                                    </div>
                                    <div className="mb-1 flex items-center justify-between">
                                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                            {fmtXrdShort(area.spentBudget)} {t.sidebar_spent_label ?? 'spent'}
                                        </span>
                                        <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--color-text-main)' }}>
                                            {spentPct}%
                                        </span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface)' }}>
                                        <div className={`h-full rounded-full bg-gradient-to-r ${area.gradient}`}
                                            style={{ width: `${spentPct}%` }} />
                                    </div>
                                    {/* Allocated budget */}
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                                            {t.area_total_budget_label ?? 'Presupuesto'}
                                        </span>
                                        <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--color-text-main)' }}>
                                            {fmtXrdShort(area.totalBudget)}
                                        </span>
                                    </div>
                                    {/* USD equivalent */}
                                    <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        ≈ {fmtUsd(area.spentBudgetUsd)} · {t.budget_available ?? 'available'}: <strong style={{ color: 'var(--color-text-main)' }}>{fmtXrdShort(area.totalBudget - area.spentBudget)}</strong>
                                    </p>
                                    {voluntaryTasks > 0 && (
                                        <p className="mt-1 text-[10px]" style={{ color: '#10b981' }}>
                                            ✓ {voluntaryTasks} {voluntaryTasks > 1 ? t.voluntary_tasks_suffix_plural : t.voluntary_tasks_suffix}
                                        </p>
                                    )}
                                    <AddressCopyRow address={area.radixAddress} />
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Funding sources ───────────────────────────────────────── */}
            <div>
                <h2 className="text-xl font-bold mb-5 flex items-center gap-2" style={{ color: 'var(--color-text-main)' }}>
                    <Coins className="size-5" style={{ color: 'var(--color-accent)' }} />
                    {t.funding_title ?? 'Funding sources'}
                </h2>
                <div className="rounded-2xl overflow-hidden"
                    style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}>
                    <div className="px-6 py-4 flex items-center justify-between"
                        style={{ borderBottom: '1px solid var(--color-card-border)', background: 'var(--color-surface)' }}>
                        <p className="text-sm font-semibold" style={{ color: 'var(--color-text-main)' }}>
                            {FUNDING_SOURCES.length} {t.funding_entries ?? 'entries recorded'}
                        </p>
                        <div className="text-right">
                            <p className="text-sm font-bold" style={{ color: 'var(--color-accent)' }}>
                                {t.funding_total_label ?? 'Total:'} {fmtXrd(TOTAL_RAISED)}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>≈ {fmtUsd(TOTAL_RAISED_USD)}</p>
                        </div>
                    </div>
                    <div className="px-6">
                        {FUNDING_SOURCES.map(source => (
                            <FundingSourceRow key={source.id} source={source} t={t} onShowExplorer={onShowExplorer} />
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Legal expenses & taxes ────────────────────────────────── */}
            <div>
                <h2 className="text-xl font-bold mb-5 flex items-center gap-2" style={{ color: 'var(--color-text-main)' }}>
                    <ShieldAlert className="size-5" style={{ color: '#ef4444' }} />
                    {t.legal_title ?? 'Legal Expenses & Taxes'}
                </h2>
                <div className="rounded-2xl overflow-hidden"
                    style={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)' }}>
                    <div className="px-6 py-4 flex items-center justify-between"
                        style={{ borderBottom: '1px solid var(--color-card-border)', background: 'var(--color-surface)' }}>
                        <div className="flex items-center gap-2">
                            <AlertCircle className="size-4" style={{ color: '#ef4444' }} />
                            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-main)' }}>
                                {LEGAL_EXPENSES.length} entries
                            </p>
                        </div>
                        <p className="text-sm font-bold" style={{ color: '#ef4444' }}>
                            {t.legal_total_label ?? 'Total:'} {fmtXrd(TOTAL_LEGAL)}
                        </p>
                    </div>
                    <div className="px-6">
                        {LEGAL_EXPENSES.map(expense => (
                            <LegalRow key={expense.id} expense={expense} t={t} />
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Detailed ledger ───────────────────────────────────────── */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-main)' }}>
                        {t.ledger_title ?? 'Ledger — all movements'}
                    </h2>
                    <button
                        type="button"
                        onClick={handleDownloadCsv}
                        className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full transition-all hover:bg-[var(--color-primary)]/10"
                        style={{
                            background: 'var(--color-card-bg)',
                            border: '1px solid var(--color-card-border)',
                            color: 'var(--color-primary)'
                        }}
                    >
                        <Download className="size-3" />
                        {t.ledger_download_csv ?? 'Download CSV'}
                    </button>
                </div>
                <LedgerTable
                    t={t}
                    areas={areas}
                    fundingSources={FUNDING_SOURCES}
                    legalExpenses={LEGAL_EXPENSES}
                    onShowExplorer={onShowExplorer}
                />
            </div>

        </div>
    );

    return (
        <>
            <RadixInfoModal isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
            <CollapsibleHeroSection collapsed={collapsed} hero={hero} grid={grid} />
        </>
    );
}
