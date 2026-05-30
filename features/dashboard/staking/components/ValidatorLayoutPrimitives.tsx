'use client';

import React from 'react';

/* ─────────────────────────────────────────
   StatDivider — horizontal stat row separated by faint vertical lines
───────────────────────────────────────── */
import {
    type StatDividerProps,
    type BizRowProps,
    type PremiumStatProps,
    type SectionHeaderProps
} from '../types/components.types';

export const StatDivider = ({ items, textCenter = false }: StatDividerProps) => (
    <div className="flex items-stretch">
        {items.map((item, i) => (
            <div
                key={item.label}
                title={item.tooltip}
                className={`flex-1 flex flex-col py-2 group transition-colors hover:bg-[var(--color-primary)]/[0.03] ${i > 0 ? 'pl-4 border-l border-[var(--color-card-border)]' : ''
                    } ${i < items.length - 1 ? 'pr-4' : ''} ${textCenter ? 'items-center text-center' : ''}`}
            >
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-0.5 leading-none group-hover:text-[var(--color-primary)] transition-colors">
                    {item.label}
                </span>
                <span
                    className="text-sm font-black leading-tight"
                    style={item.accent ? { color: item.accent } : { color: 'var(--color-text-main)' }}
                >
                    {item.value}
                </span>
            </div>
        ))}
    </div>
);

/* ─────────────────────────────────────────
   BizRow — label / value row with thin bottom divider
───────────────────────────────────────── */
export const BizRow = ({
    label, value, accent, tooltip, vertical = false
}: BizRowProps) => (
    <div
        className={`flex ${vertical ? 'flex-col gap-0.5' : 'items-baseline justify-between'} py-1.5 border-b border-[var(--color-card-border)] last:border-0 group transition-colors hover:bg-[var(--color-primary)]/[0.03] px-1 -mx-1`}
        title={tooltip}
    >
        <span className={`text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider shrink-0 group-hover:text-[var(--color-primary)] transition-colors ${vertical ? '' : 'mr-3'}`}>
            {label}
        </span>
        <span
            className={`${vertical ? 'text-[12px] self-end text-right' : 'text-[13px]'} font-black truncate`}
            style={accent ? { color: accent } : { color: 'var(--color-text-main)' }}
        >
            {value}
        </span>
    </div>
);

/* ─────────────────────────────────────────
   PremiumStat — stat card for expanded view
───────────────────────────────────────── */
const _PremiumStat = ({
    label, value, sub, accent, glow = false, flexRow = false, tooltip
}: PremiumStatProps) => (
    <div
        className={`p-3 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] group transition-colors hover:bg-[var(--color-primary)]/[0.03] ${flexRow ? 'flex items-center justify-between' : ''}`}
        style={glow && accent ? { boxShadow: `0 0 20px ${accent}15, inset 0 0 12px ${accent}08` } : undefined}
        title={tooltip}
    >
        <div className={flexRow ? '' : 'mb-1'}>
            <div className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] truncate group-hover:text-[var(--color-primary)] transition-colors">
                {label}
            </div>
            {sub && (
                <div className="text-[10px] text-[var(--color-text-muted)] font-medium mt-0.5">{sub}</div>
            )}
        </div>
        <div
            className={`text-sm font-black truncate ${flexRow ? 'text-right' : ''}`}
            style={accent ? { color: accent } : { color: 'var(--color-text-main)' }}
        >
            {value}
        </div>
    </div>
);

/* ─────────────────────────────────────────
   SectionHeader
───────────────────────────────────────── */
const _SectionHeader = ({
    title, icon: Icon,
}: SectionHeaderProps) => (
    <div className="flex items-center gap-2 pb-2 relative mb-3">
        <div className="absolute bottom-0 left-0 w-10 h-px bg-gradient-to-r from-[var(--color-primary)] to-transparent" />
        <Icon className="size-4 text-[var(--color-primary)]" />
        <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-main)]">
            {title}
        </h4>
    </div>
);
