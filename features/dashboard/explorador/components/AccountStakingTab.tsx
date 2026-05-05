'use client';

import React from 'react';
import { ExpandableEntityBadge } from './ExpandableEntityBadge';
import type { StakingEntry } from '../types/models.types';
import type { TranslationsT, MarketData, Network, DashboardDict } from '@/features/dashboard/types';
import type { AccountRewardsCsvModalDict } from '../types/components.types';

interface AccountStakingTabProps {
    stakingRows: StakingEntry[];
    tt?: Partial<TranslationsT['dashboard']['transactions']> & { account_summary?: AccountRewardsCsvModalDict };
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    network: Network;
    locale: string;
    marketData?: MarketData | null;
    dt?: Partial<DashboardDict>;
}

/**
 * AccountStakingTab
 * 
 * Displays a list of validators where the account is staking.
 * Uses ExpandableEntityBadge to maintain UI consistency with Affected Entities.
 */
export function AccountStakingTab({
    stakingRows,
    tt,
    onCopy,
    copiedAddress,
    network,
    locale,
    marketData,
    dt,
}: AccountStakingTabProps) {
    if (stakingRows.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <p className="text-xs text-[var(--color-text-muted)] italic">
                    {tt?.account_summary?.no_staking || 'No active staking found for this account.'}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h4 className="text-[11px] font-black uppercase mb-3 tracking-wider text-[var(--color-text-muted)] mt-4">
                {tt?.account_summary?.staking_validators_title || 'Validators'} <span className="ml-1 opacity-50">({stakingRows.length})</span>
            </h4>
            <div className="grid grid-cols-1 gap-2 items-stretch">
            {stakingRows.map((row) => (
                <ExpandableEntityBadge
                    key={row.validatorAddress}
                    address={row.validatorAddress}
                    stakeAmount={row.xrdInStake}
                    unstakeAmount={row.xrdInUnstake}
                    claimAmount={row.xrdInClaim}
                    tt={tt}
                    onCopy={onCopy}
                    copiedAddress={copiedAddress}
                    network={network}
                    locale={locale}
                    marketData={marketData}
                    dt={dt}
                    variant="resource-card"
                />
            ))}
            </div>
        </div>
    );
}
