'use client';
import React from 'react';
import { Activity } from 'lucide-react';
import { XPBar } from '@/components/ui/XPBar';
import { Pill } from '@/components/ui/Pill';
import { type Validator } from '@/types/radix';
import { getStatusColor, getUptimeColor, getUptimeTooltipText } from '@/utils/validators';
import { formatPercent } from '@/utils/formatters';
import { useLiveProposals } from './LiveProposals';
import { sanitizeText } from '@/utils/sanitize';
import type { TranslationsT, DashboardDict } from '@/features/dashboard/types';

/* ─────────────────────────────────────────
   SHARED DISPLAY PRIMITIVES
   (exported so ValidatorCard & ValidatorDetailView
    can import without circular dependency)
───────────────────────────────────────── */

/** Animated uptime progress bar */
export const UptimeBar = ({ percent, size = 'md', t, locale = 'en' }: { percent: number; size?: 'sm' | 'md' | 'lg'; t?: Partial<TranslationsT>; locale?: string }) => {
    const color = getUptimeColor(percent);
    const label = formatPercent(percent, 1, locale);
    const title = getUptimeTooltipText(percent, false, t?.dashboard?.details);

    return (
        <XPBar
            progress={percent}
            color={color}
            size={size}
            label={label}
            title={title}
            className="w-full"
            showDots={size !== 'sm'}
        />
    );
};
UptimeBar.displayName = 'UptimeBar';

/** Glowing status pill badge */
export const StatusLabel = ({ status, t, compact = false }: { status: Validator['status']; t?: Partial<TranslationsT>; compact?: boolean }) => {
    const color = getStatusColor(status);
    const label = t?.dashboard?.status?.[status as keyof NonNullable<NonNullable<typeof t>["dashboard"]>["status"]] ?? status;
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full border font-bold tracking-wider transition-all duration-300 align-middle box-border leading-none ${compact ? 'px-1.5 py-1 text-[9px]' : 'px-2 py-1 text-[10px]'
                }`}
            style={{
                color,
                borderColor: `${color}45`,
                backgroundColor: `${color}15`,
            }}
            title={label}
        >
            <Activity size={compact ? 10 : 12} className="shrink-0" />
            {!compact && <span className="mt-[1px] hidden sm:inline">{sanitizeText(label)}</span>}
        </span>
    );
};
StatusLabel.displayName = 'StatusLabel';

/** Live proposals bar (made vs missed) */
export const ProposalsBar = ({ validator, locale }: { validator: Validator; locale?: string }) => {
    const { recentMade: made, recentMissed: missed } = useLiveProposals(validator);
    const total = made + missed;
    const pct = total > 0 ? (made / total) * 100 : 100;
    return (
        <div className="w-full">
            <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mb-1">
                <span>{made.toLocaleString(locale)}</span>
                <span className="text-red-700 dark:text-red-400 font-bold">{missed.toLocaleString(locale)}</span>
            </div>
            <XPBar progress={pct} color="var(--color-primary)" size="sm" showDots={false} />
        </div>
    );
};
ProposalsBar.displayName = 'ProposalsBar';


export const DetailSection = ({
    title,
    icon: Icon,
    children,
    className = '',
}: {
    title: string;
    icon: React.ElementType;
    children: React.ReactNode;
    className?: string;
}) => (
    <div className={`space-y-4 ${className}`}>
        <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-card-border)]">
            <Icon className="size-5 text-[var(--color-primary)]" />
            <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-main)]">{title}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {children}
        </div>
    </div>
);

export const DetailItem = ({
    label,
    value,
    subValue,
    color,
    className = '',
}: {
    label: string;
    value: string | number;
    subValue?: string | number;
    color?: string;
    className?: string;
}) => (
    <div className={`p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-card-border)] transition-colors ${className}`}>
        <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold mb-1">{label}</div>
        <div className="flex items-baseline gap-2">
            <div className={`text-sm font-bold truncate ${color ?? 'text-[var(--color-text-main)]'}`}>{value}</div>
            {subValue !== undefined && (
                <div className="text-[10px] text-[var(--color-text-muted)] font-medium">{subValue}</div>
            )}
        </div>
    </div>
);

import { CopyButton } from '@/components/ui/CopyButton';

export const AddressItem = ({
    label,
    address,
    onCopy,
    isCopied,
    allowStack: _allowStack = false,
    className = '',
    brackets = false,
}: {
    label: string;
    address: string;
    onCopy: (a: string) => void;
    isCopied: boolean;
    allowStack?: boolean;
    className?: string;
    brackets?: boolean;
}) => (
    <button type="button"
        className={`col-span-full group/addr cursor-pointer flex flex-col justify-between gap-1 p-2.5 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] transition-colors w-full text-left ${className}`}
        onClick={() => onCopy(brackets ? `[${address}]` : address)}
    >
        <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-bold shrink-0">{label}</div>
        <div className="flex items-center gap-2 p-2 rounded-xl bg-[var(--color-bg)] border border-[var(--color-card-border)] transition-colors">
            <code className={`text-[10px] truncate font-mono flex-1 transition-colors ${isCopied ? 'text-green-700 dark:text-green-400' : 'text-[var(--color-text-muted)]'}`}>
                {brackets ? `[${address}]` : address}
            </code>
            <CopyButton value={brackets ? `[${address}]` : address} variant="minimal" size="sm" forceCopied={isCopied} className="pointer-events-none" />
        </div>
    </button>
);

/* ─────────────────────────────────────────
   EPOCH PERFORMANCE TABLE

   Logic:
   - The live row always shows real-time epoch proposals via useLiveProposals.
   - When a new epoch starts mid-session:
     · A new live row is prepended for the new epoch (starts at 0, counts up live).
     · The previous epoch's row shows the final delta saved at transition time
       (prevEpochFinal), so it never shows 0 or stale SSR data.
   - All older finalized rows show their SSR-computed deltas unchanged.
───────────────────────────────────────── */

const EMPTY_EPOCH_REWARDS: Record<number, { fee: number; pool: number }> = {};

export const EpochPerformanceTable = ({
    validator,
    dt,
    epochRewards = EMPTY_EPOCH_REWARDS,
    locale,
}: {
    validator: Validator;
    dt?: Partial<DashboardDict>;
    epochRewards?: Record<number, { fee: number; pool: number }>;
    locale?: string;
}) => {
    const { unifiedRows } = useLiveProposals(validator);

    return (
        <div className="rounded-xl border border-[var(--color-card-border)] overflow-hidden bg-[var(--color-bg)] w-full">
            <table className="w-full text-left text-[10px] sm:text-xs">
                <thead className="bg-[var(--color-surface-hover)] border-b border-[var(--color-card-border)]">
                    <tr>
                        <th className="px-3 py-2 font-black uppercase tracking-tighter text-[8px] text-[var(--color-text-muted)]">
                            {dt?.details?.epoch ?? 'Epoch'}
                        </th>
                        <th className="px-3 py-2 font-black uppercase tracking-tighter text-[8px] text-green-700 dark:text-green-400">
                            {dt?.details?.proposals_made ?? 'Proposals Made'}
                        </th>
                        <th className="px-3 py-2 font-black uppercase tracking-tighter text-[8px] text-red-700 dark:text-red-400">
                            {dt?.details?.proposals_missed ?? 'Proposals Missed'}
                        </th>
                        <th className="px-3 py-2 font-black uppercase tracking-tighter text-[8px] text-[var(--color-primary)]" title={dt?.details?.xrd_reward_fee_tooltip ?? 'Total XRD earned by the validator'}>
                            {dt?.details?.xrd_reward_fee ?? 'Validator'}
                        </th>
                        <th className="px-3 py-2 font-black uppercase tracking-tighter text-[8px] text-[var(--color-text-main)]" title={dt?.details?.xrd_reward_pool_tooltip ?? 'Total XRD distributed to delegators'}>
                            {dt?.details?.xrd_reward_pool ?? 'Delegators'}
                        </th>
                        <th className="px-3 py-2 font-black uppercase tracking-tighter text-[8px] text-[var(--color-text-muted)] text-right">
                            {dt?.details?.epoch_status ?? 'Status'}
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-card-border)]">
                    {unifiedRows.map((ep) => (
                        <tr
                            key={ep.epoch}
                            className={`transition-colors ${ep.isLive
                                ? 'bg-green-600/5 hover:bg-green-600/10'
                                : 'hover:bg-[var(--color-surface-hover)]/50'
                                }`}
                        >
                            <td className="px-3 py-2 font-mono font-bold">
                                {ep.epoch}
                            </td>

                            <td className="px-3 py-2 font-bold text-green-700 dark:text-green-400 tabular-nums">
                                {ep.completedProposals.toLocaleString(locale)}
                            </td>

                            <td className="px-3 py-2 font-bold text-red-700 dark:text-red-400 tabular-nums">
                                {ep.missedProposals.toLocaleString(locale)}
                            </td>

                            <td className="px-3 py-2 font-bold text-[var(--color-primary)] tabular-nums">
                                {epochRewards[ep.epoch] !== undefined
                                    ? epochRewards[ep.epoch].fee.toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
                                    : '—'}
                            </td>

                            <td className="px-3 py-2 font-bold text-[var(--color-text-main)] tabular-nums">
                                {epochRewards[ep.epoch] !== undefined
                                    ? epochRewards[ep.epoch].pool.toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
                                    : '—'}
                            </td>

                            <td className="px-3 py-2 text-right">
                                {ep.isLive ? (
                                    <Pill color="green">
                                        {dt?.details?.live_label ?? 'LIVE'}
                                    </Pill>
                                ) : (
                                    <span className="text-[7px] font-bold text-[var(--color-text-muted)] opacity-50 uppercase tracking-tighter">
                                        {dt?.details?.finalized_label ?? 'Finalized'}
                                    </span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};