'use client';

import { useEffect } from 'react';
import { X, ArrowUpRight, ArrowDownLeft, Hash, Globe, Calendar, Tag, Coins, DollarSign } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { useLanguage } from '@/context/LanguageContext';
import { 
    FUNDING_SOURCES, 
    AREAS, 
    LEGAL_EXPENSES as _LEGAL_EXPENSES, 
    GLOBAL_PROJECT_ADDRESS 
} from '../data/communityData';
import { 
    ExplorerModalProps 
} from '../types/components.types';
import { CommunityDictionary } from '../types/i18n.types';

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function fmtXrd(n: number) {
    return new Intl.NumberFormat('es-ES').format(n) + ' XRD';
}
function fmtUsd(n: number) {
    return '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function fmtDate(s: string) {
    return new Date(s).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
}

/* ─── Row helper ─────────────────────────────────────────────────────────── */
function InfoRow({ icon: Icon, label, value, mono = false, color }: {
    icon: React.ElementType; label: string; value: React.ReactNode; mono?: boolean; color?: string;
}) {
    return (
        <div className="flex items-start gap-4 py-3" style={{ borderBottom: '1px solid var(--color-card-border)' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'var(--color-surface)' }}>
                <Icon className="w-4 h-4" style={{ color: color ?? 'var(--color-text-muted)' }} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-0.5"
                    style={{ color: 'var(--color-text-muted)' }}>{label}</p>
                <p className={`text-sm leading-relaxed break-all ${mono ? 'font-mono' : 'font-medium'}`}
                    style={{ color: 'var(--color-text-main)' }}>{value}</p>
            </div>
        </div>
    );
}

/* ─── TX detail ──────────────────────────────────────────────────────────── */
function TxDetail({ hash, t }: { hash: string; t: CommunityDictionary }) {
    // Find in funding sources
    const fs = FUNDING_SOURCES.find(f => f.txHash === hash);
    if (fs) {
        return (
            <div>
                <div className="flex items-center gap-3 mb-6 p-4 rounded-2xl"
                    style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                    <ArrowUpRight className="w-6 h-6 shrink-0" style={{ color: '#10b981' }} />
                    <div>
                        <p className="font-bold text-lg" style={{ color: '#10b981' }}>
                            +{fmtXrd(fs.amount)}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>≈ {fmtUsd(fs.usdValueAtDelivery)}</p>
                    </div>
                </div>
                <InfoRow icon={Hash} label={t.explorer_tx_hash ?? 'Hash'} value={hash} mono />
                <InfoRow icon={Calendar} label={t.explorer_tx_date ?? 'Date'} value={fmtDate(fs.date)} />
                <InfoRow icon={Tag} label={t.explorer_tx_type ?? 'Type'} value={fs.type.toUpperCase()} color="var(--color-accent)" />
                <InfoRow icon={Tag} label={t.explorer_tx_category ?? 'Category'}
                    value={(t.funding_labels as Record<string, string>)[fs.labelKey] ?? fs.labelKey} />
                <InfoRow icon={Tag} label={t.explorer_tx_description ?? 'Description'}
                    value={(t.funding_contributors as Record<string, string>)[fs.contributorKey] ?? fs.contributorKey} />
                <InfoRow icon={Coins} label={t.explorer_tx_price ?? 'XRD price'}
                    value={`$${fs.xrdPriceAtDelivery.toFixed(4)}`} />
                <InfoRow icon={DollarSign} label={t.explorer_tx_usd ?? 'USD value'}
                    value={fmtUsd(fs.usdValueAtDelivery)} color="#10b981" />
            </div>
        );
    }

    return (
        <div className="py-8 text-center">
            <Hash className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: 'var(--color-text-muted)' }} />
            <p style={{ color: 'var(--color-text-muted)' }}>{t.explorer_not_found ?? 'Transaction not found'}</p>
            <p className="text-xs mt-2 font-mono break-all px-4" style={{ color: 'var(--color-text-muted)' }}>{hash}</p>
        </div>
    );
}

/* ─── Address detail ─────────────────────────────────────────────────────── */
function AddressDetail({ address, t }: { address: string; t: CommunityDictionary }) {
    const areaNames = t.area_names;

    // Global address?
    const isGlobal = address === GLOBAL_PROJECT_ADDRESS;
    // Area address?
    const area = AREAS.find(a => a.radixAddress === address);

    // All transactions touching this address
    const relatedFunding = FUNDING_SOURCES.filter(f => f.txHash); // global receives all funding
    const relatedTasks = area ? area.tasks.filter(tk => tk.type !== 'voluntary' && tk.cost > 0) : [];

    return (
        <div>
            <div className="flex items-center gap-3 mb-6 p-4 rounded-2xl"
                style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <Globe className="w-6 h-6 shrink-0" style={{ color: 'var(--color-primary)' }} />
                <div className="min-w-0">
                    <p className="font-bold text-sm" style={{ color: 'var(--color-primary)' }}>
                        {isGlobal ? (t.ledger_global_address ?? 'Global Project Address')
                            : area ? areaNames[area.id] ?? area.id
                                : t.explorer_addr_label ?? 'Address'}
                    </p>
                    <p className="text-xs font-mono break-all mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        {address}
                    </p>
                </div>
            </div>

            {isGlobal && (
                <>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-muted)' }}>
                        {t.explorer_tx_category ?? 'Transactions'} ({relatedFunding.length})
                    </p>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {relatedFunding.map(fs => {
                            const labels = t.funding_labels as Record<string, string>;
                            return (
                                <div key={fs.id} className="flex items-center gap-3 p-3 rounded-xl"
                                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)' }}>
                                    <ArrowUpRight className="w-4 h-4 shrink-0" style={{ color: '#10b981' }} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-main)' }}>
                                            {labels[fs.labelKey] ?? fs.labelKey}
                                        </p>
                                        <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{fmtDate(fs.date)}</p>
                                    </div>
                                    <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: '#10b981' }}>
                                        +{fmtXrd(fs.amount)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {area && (
                <>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-muted)' }}>
                        {t.explorer_tx_category ?? 'Expenses'} ({relatedTasks.length})
                    </p>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {relatedTasks.map(task => {
                            const taskTitles = t.task_titles as Record<string, string>;
                            return (
                                <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl"
                                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-card-border)' }}>
                                    <ArrowDownLeft className="w-4 h-4 shrink-0" style={{ color: '#ef4444' }} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-main)' }}>
                                            {task.titleDirect ?? taskTitles[task.titleKey] ?? task.titleKey}
                                        </p>
                                        <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                                            {fmtDate(task.endDate ?? task.startDate)}
                                        </p>
                                    </div>
                                    <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: '#ef4444' }}>
                                        −{fmtXrd(task.cost)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export function ExplorerModal({ target, onClose }: ExplorerModalProps) {
    const { t: dict } = useLanguage();
    const t = dict.community_transparency as unknown as CommunityDictionary;

    // Close on Escape
    useEffect(() => {
        if (!target) return;
        const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handle);
        return () => window.removeEventListener('keydown', handle);
    }, [target, onClose]);

    const isTx = target?.kind === 'tx';
    const title = isTx
        ? (t.explorer_tx_title ?? 'Transaction detail')
        : (t.explorer_addr_title ?? 'Address detail');

    return (
        <AnimatePresence>
            {target && (
                <>
                    <ModalOverlay onClose={onClose} blur="md" />
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        style={{ pointerEvents: 'none' }}
                    >
                        <div
                            className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl"
                            style={{
                                background: 'var(--color-card-bg)',
                                border: '1px solid var(--color-card-border)',
                                pointerEvents: 'auto',
                            }}
                        >
                            {/* Header */}
                            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5"
                                style={{ background: 'var(--color-card-bg)', borderBottom: '1px solid var(--color-card-border)' }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                                        style={{ background: 'var(--color-primary)', opacity: 0.12 }}>
                                        {isTx
                                            ? <Hash className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                                            : <Globe className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                                        }
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-widest"
                                            style={{ color: 'var(--color-primary)' }}>
                                            {t.explorer_modal_title ?? 'Project Explorer'}
                                        </p>
                                        <p className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>
                                            {title}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200"
                                    style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-card-border)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface)'; }}
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="px-6 py-4 pb-6">
                                {isTx
                                    ? <TxDetail hash={(target as { kind: 'tx'; hash: string }).hash} t={t} />
                                    : <AddressDetail address={(target as { kind: 'address'; address: string }).address} t={t} />
                                }
                            </div>
                        </div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
