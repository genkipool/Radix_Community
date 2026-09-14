'use client';

import React from 'react';
import { Shield, Activity, Coins, Lock, Hourglass, Percent } from 'lucide-react';
import { RadixIcon } from '@/components/shared/RadixIcon';
import { formatXRD, formatNumber, formatPercent } from '@/utils/formatters';
import { StatCard } from './StatCard';

import type { DashboardStatsRowProps } from '../types';

/**
 * Compact formatter: shows value in M (millions) or K (thousands)
 * depending on magnitude.
 */
const formatCompact = (value: number, locale: string): string => {
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K`;
    }
    return value.toLocaleString(locale, { maximumFractionDigits: 2 });
};

/** Both views lay six cards out the same way. */
const GRID = 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-8';

type SharedStatProps = Pick<DashboardStatsRowProps, 'stats' | 'dt' | 'locale' | 'isLoading'>;

/* ─── Cards shared by the staking and explorer views ─── */

/** Epoch and round of the ledger the figures were read at. */
const EpochRoundStat = ({ stats, dt, isLoading }: SharedStatProps) => (
    <StatCard
        icon={<Hourglass className="size-5" />}
        label={dt?.explorer?.ledger_epoch_round || 'Epoch / Round'}
        value={stats.epoch ? `${stats.epoch} / ${stats.round ?? '---'}` : '---'}
        description={dt?.explorer?.desc_epoch_round}
        isLoading={isLoading}
    />
);

/** Share of the stake delegated to validators in the active set. */
const ActiveStakeStat = ({ stats, dt, locale, isLoading }: SharedStatProps) => {
    const { activeStaked, totalStaked } = stats;
    const known = activeStaked !== undefined && totalStaked > 0;

    return (
        <StatCard
            icon={<Percent className="size-5" />}
            label={dt?.network?.active_stake ?? 'Active Stake'}
            value={known ? formatPercent((activeStaked / totalStaked) * 100, 2, locale) : '---'}
            description={dt?.network?.desc_active_stake}
            fullValue={known
                ? `${formatXRD(activeStaked, locale)} / ${formatXRD(totalStaked, locale)} ${dt?.network?.xrd ?? 'XRD'}`
                : undefined}
            isLoading={isLoading}
        />
    );
};

export const DashboardStatsRow = ({
    activeView, stats, marketData, isLoading = false, dt, locale,
}: DashboardStatsRowProps) => {
    const shared = { stats, dt, locale, isLoading };

    if (activeView === 'staking') {
        return (
            <div className={GRID}>
                <StatCard
                    icon={<Coins className="size-5" />}
                    label={dt?.network?.total_staked ?? ''}
                    value={`${formatXRD(stats.totalStaked, locale)} ${dt?.network?.xrd ?? 'XRD'}`}
                    accent
                    fullValue={`${stats.totalStaked.toLocaleString(locale)} XRD`}
                    isLoading={isLoading}
                />
                <ActiveStakeStat {...shared} />
                <StatCard
                    icon={<Shield className="size-5" />}
                    label={dt?.network?.active_validators ?? ''}
                    value={`${stats.activeValidators} / ${stats.totalValidators}`}
                    fullValue={`${stats.activeValidators} active out of ${stats.totalValidators} total validators`}
                    isLoading={isLoading}
                />
                <StatCard
                    icon={<RadixIcon className="size-5 text-[var(--color-primary)]" strokeColor="currentColor" animate={false} />}
                    label={dt?.network?.avg_apy ?? ''}
                    value={`${formatNumber(stats.avgApy, 2, locale)}%`}
                    accent
                    fullValue={`${stats.avgApy.toLocaleString(locale)}%`}
                    isLoading={isLoading}
                />
                <StatCard
                    icon={<Activity className="size-5" />}
                    label={dt?.network?.avg_uptime ?? ''}
                    value={`${formatNumber(stats.avgUptime, 2, locale)}%`}
                    fullValue={`${stats.avgUptime.toLocaleString(locale)}%`}
                    isLoading={isLoading}
                />
                <EpochRoundStat {...shared} />
            </div>
        );
    }

    const isPositive = (marketData?.priceChange24h ?? 0) >= 0;
    const isEur = locale === 'es';
    const symbol = isEur ? '€' : '$';
    const price = isEur ? (marketData?.priceEur ?? 0) : (marketData?.priceUsd ?? 0);
    const cap = isEur ? (marketData?.marketCapEur ?? 0) : (marketData?.marketCapUsd ?? 0);
    const tvl = isEur ? (marketData?.totalValueLockedEur ?? 0) : (marketData?.totalValueLockedUsd ?? 0);

    return (
        <div className={GRID}>
            <StatCard
                icon={<Activity className="size-5" />}
                label={dt?.explorer?.ledger_txs || 'Total Transactions'}
                value={stats.stateVersion ? stats.stateVersion.toLocaleString(locale) : '---'}
                accent
                description={dt?.explorer?.desc_txs}
                fullValue={stats.stateVersion ? stats.stateVersion.toLocaleString(locale) : undefined}
                isLoading={isLoading}
            />
            <EpochRoundStat {...shared} />
            <StatCard
                icon={
                    <RadixIcon
                        className={`size-5 ${!isPositive ? 'scale-y-[-1]' : ''}`}
                        strokeColor={isPositive ? 'var(--color-accent)' : '#ef4444'}
                        animate={false}
                    />
                }
                label={dt?.explorer?.price || 'XRD Price'}
                value={
                    marketData
                        ? (
                            <div className="flex items-baseline gap-1.5 overflow-hidden">
                                <span className="truncate">
                                    {price.toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 6 })} {symbol}
                                </span>
                                <span className={`text-[10px] font-bold shrink-0 ${isPositive ? 'text-[var(--color-accent)]' : 'text-red-500'}`}>
                                    {isPositive ? '+' : ''}{(marketData.priceChange24h ?? 0).toFixed(2)}%
                                </span>
                            </div>
                        )
                        : '---'
                }
                accent
                description={dt?.explorer?.desc_price}
                fullValue={marketData ? `${price.toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 12 })} ${symbol} (${isPositive ? '+' : ''}${marketData.priceChange24h}%)` : undefined}
                isLoading={isLoading}
            />
            <StatCard
                icon={<Coins className="size-5" />}
                label={dt?.explorer?.market_cap || 'Market Cap'}
                value={marketData ? `${formatCompact(cap, locale)} ${symbol}` : '---'}
                description={dt?.explorer?.desc_market_cap}
                fullValue={marketData ? `${cap.toLocaleString(locale)} ${symbol}` : undefined}
                isLoading={isLoading}
            />
            <StatCard
                icon={<RadixIcon className="size-5" strokeColor="currentColor" animate={false} />}
                label={dt?.explorer?.circulating_supply || 'Suministro'}
                value={marketData ? `${(marketData.circulatingSupply / 1_000_000_000).toLocaleString(locale, { maximumFractionDigits: 1 })}B XRD` : '---'}
                accent
                description={dt?.explorer?.desc_circulating_supply}
                fullValue={marketData ? `${marketData.circulatingSupply.toLocaleString(locale)} XRD` : undefined}
                isLoading={isLoading}
            />
            <StatCard
                icon={<Lock className="size-5" />}
                label={dt?.explorer?.ledger_tvl || 'TVL'}
                value={marketData ? `${formatCompact(tvl, locale)} ${symbol}` : '---'}
                description={dt?.explorer?.desc_tvl}
                fullValue={marketData ? `${tvl.toLocaleString(locale)} ${symbol}` : undefined}
                isLoading={isLoading}
            />
        </div>
    );
};
