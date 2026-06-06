import type { AccountRewardsCsvModalDict } from '../types/components.types';
import React from 'react';
import { useEntityBadge } from './EntityBadgeContext';
import type { StakingEntry } from '../types/models.types';
import type { MarketData, Network, DashboardDict , TranslationsT} from '@/features/dashboard/types';

export interface AccountStakingTabProps {
    stakingRows: StakingEntry[];
    network: Network;
    tt?: Partial<TranslationsT['dashboard']['transactions']> & { account_summary?: AccountRewardsCsvModalDict };
    locale: string;
    marketData: MarketData | undefined;
    dt?: DashboardDict;
    currentEpoch?: number;
}

export function AccountStakingTab({
    stakingRows,
    network,
    tt,
    locale,
    marketData,
    dt,
}: AccountStakingTabProps) {
    const badgeComp = useEntityBadge();
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
            <div className="grid grid-cols-1 gap-2 items-start">
                {stakingRows.map((row, idx) => (
                    React.createElement(badgeComp, {
                        key: `staking-row-${row.validatorAddress}-${idx}`,
                        entityAddress: row.validatorAddress,
                        network: network,
                        tt: tt,
                        locale: locale,
                        marketData: marketData,
                        dt: dt,
                        startExpanded: false,
                        forcedOpenTab: "summary",
                        variant: 'resource-card',
                        stakeAmount: row.xrdInStake,
                        unstakeAmount: row.xrdInUnstake,
                        claimAmount: row.xrdInClaim,
                        unstakes: row.unstakes
                    })
                ))}
            </div>
        </div>
    );
}
