'use client';

import React from 'react';
import { formatNumber } from '@/utils/formatters';

interface StakingMetricsBarProps {
    balanceXrd?: number;
    stakeXrd: number;
    unstakeXrd: number;
    claimXrd: number;
    locale: string;
    balanceLabel?: string;
    stakeLabel: string;
    unstakeLabel: string;
    claimLabel: string;
    unstakeTooltip?: string;
    claimTooltip?: string;
    /** Adds border-t (row card) or border-b (top of distributed section). */
    borderPosition?: 'top' | 'bottom';
}

/**
 * 3-column (wallet profile modal) or 4-column (console, with BALANCE XRD)
 * staking metrics bar shared by Distributed staking and each Validator row.
 */
export function StakingMetricsBar({
    balanceXrd,
    stakeXrd,
    unstakeXrd,
    claimXrd,
    locale,
    balanceLabel = 'BALANCE XRD',
    stakeLabel,
    unstakeLabel,
    claimLabel,
    unstakeTooltip,
    claimTooltip,
    borderPosition = 'top',
}: StakingMetricsBarProps) {
    const showBalance = balanceXrd !== undefined;
    const borderClass =
        borderPosition === 'bottom'
            ? 'border-b border-[var(--color-card-border)]/50'
            : 'border-t border-[var(--color-card-border)]/50';

    return (
        <div className={`grid ${showBalance ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-4 py-2 ${borderClass}`}>
            {showBalance && (
                <div className="flex flex-col items-center text-center">
                    <span className="text-[10px] uppercase font-black text-[var(--color-text-muted)] tracking-widest mb-1">
                        {balanceLabel}
                    </span>
                    <span className="text-sm font-mono font-black text-[var(--color-text-main)]">
                        {formatNumber(balanceXrd, 2, locale)} XRD
                    </span>
                </div>
            )}
            <div className="flex flex-col items-center text-center">
                <span className="text-[10px] uppercase font-black text-[var(--color-text-muted)] tracking-widest mb-1">
                    {stakeLabel}
                </span>
                <span className="text-sm font-mono font-black text-[var(--color-primary)]">
                    {formatNumber(stakeXrd, 2, locale)} XRD
                </span>
            </div>
            <div className="flex flex-col items-center text-center" title={unstakeTooltip}>
                <span className="text-[10px] uppercase font-black text-[var(--color-text-muted)] tracking-widest mb-1">
                    {unstakeLabel}
                </span>
                <span className="text-sm font-mono font-black text-[var(--color-secondary)]">
                    {formatNumber(unstakeXrd, 2, locale)} XRD
                </span>
            </div>
            <div className="flex flex-col items-center text-center" title={claimTooltip}>
                <span className="text-[10px] uppercase font-black text-[var(--color-text-muted)] tracking-widest mb-1">
                    {claimLabel}
                </span>
                <span className="text-sm font-mono font-black text-[var(--color-accent)]">
                    {formatNumber(claimXrd, 2, locale)} XRD
                </span>
            </div>
        </div>
    );
}
