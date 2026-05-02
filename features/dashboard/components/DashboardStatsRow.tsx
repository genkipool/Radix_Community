'use client';

import React from 'react';
import { Shield, Activity, Coins, Lock } from 'lucide-react';
import { RadixIcon } from '@/components/shared/RadixIcon';
import { formatXRD, formatNumber } from '@/utils/formatters';
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

export const DashboardStatsRow = ({
    activeView, stats, marketData, isLoading = false, dt, locale,
}: DashboardStatsRowProps) => {
    if (activeView === 'staking') {
        return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                <StatCard
                    icon={<Coins className="w-5 h-5" />}
                    label={dt?.network?.total_staked ?? ''}
                    value={`${formatXRD(stats.totalStaked, locale)} ${dt?.network?.xrd ?? 'XRD'}`}
                    accent
                    fullValue={`${stats.totalStaked.toLocaleString(locale)} XRD`}
                    isLoading={isLoading}
                />
                <StatCard
                    icon={<Shield className="w-5 h-5" />}
                    label={dt?.network?.active_validators ?? ''}
                    value={`${stats.activeValidators} / ${stats.totalValidators}`}
                    fullValue={`${stats.activeValidators} active out of ${stats.totalValidators} total validators`}
                    isLoading={isLoading}
                />
                <StatCard
                    icon={<RadixIcon className="w-5 h-5 text-[var(--color-primary)]" strokeColor="currentColor" animate={false} />}
                    label={dt?.network?.avg_apy ?? ''}
                    value={`${formatNumber(stats.avgApy, 2, locale)}%`}
                    accent
                    fullValue={`${stats.avgApy.toLocaleString(locale)}%`}
                    isLoading={isLoading}
                />
                <StatCard
                    icon={<Activity className="w-5 h-5" />}
                    label={dt?.network?.avg_uptime ?? ''}
                    value={`${formatNumber(stats.avgUptime, 2, locale)}%`}
                    fullValue={`${stats.avgUptime.toLocaleString(locale)}%`}
                    isLoading={isLoading}
                />
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
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
            <StatCard
                icon={<Activity className="w-5 h-5" />}
                label={dt?.explorer?.ledger_txs || 'Transacciones Totales'}
                value={stats.stateVersion ? stats.stateVersion.toLocaleString(locale) : '---'}
                accent
                description={dt?.explorer?.desc_txs}
                fullValue={stats.stateVersion ? stats.stateVersion.toLocaleString(locale) : undefined}
                isLoading={isLoading}
            />
            <StatCard
                icon={<Shield className="w-5 h-5" />}
                label={dt?.explorer?.ledger_epoch_round || 'Época / Ronda'}
                value={stats.epoch ? `${stats.epoch} / ${stats.round}` : '---'}
                description={dt?.explorer?.desc_epoch_round}
                isLoading={isLoading}
            />
            <StatCard
                icon={
                    <RadixIcon
                        className={`w-5 h-5 ${!isPositive ? 'scale-y-[-1]' : ''}`}
                        strokeColor={isPositive ? 'var(--color-accent)' : '#ef4444'}
                        animate={false}
                    />
                }
                label={dt?.explorer?.price || 'Precio XRD'}
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
                icon={<Coins className="w-5 h-5" />}
                label={dt?.explorer?.market_cap || 'Capitalización'}
                value={marketData ? `${formatCompact(cap, locale)} ${symbol}` : '---'}
                description={dt?.explorer?.desc_market_cap}
                fullValue={marketData ? `${cap.toLocaleString(locale)} ${symbol}` : undefined}
                isLoading={isLoading}
            />
            <StatCard
                icon={<RadixIcon className="w-5 h-5" strokeColor="currentColor" animate={false} />}
                label={dt?.explorer?.circulating_supply || 'Suministro'}
                value={marketData ? `${(marketData.circulatingSupply / 1_000_000_000).toLocaleString(locale, { maximumFractionDigits: 1 })}B XRD` : '---'}
                accent
                description={dt?.explorer?.desc_circulating_supply}
                fullValue={marketData ? `${marketData.circulatingSupply.toLocaleString(locale)} XRD` : undefined}
                isLoading={isLoading}
            />
            <StatCard
                icon={<Lock className="w-5 h-5" />}
                label={dt?.explorer?.ledger_tvl || 'TVL'}
                value={marketData ? `${formatCompact(tvl, locale)} ${symbol}` : '---'}
                description={dt?.explorer?.desc_tvl}
                fullValue={marketData ? `${tvl.toLocaleString(locale)} ${symbol}` : undefined}
                isLoading={isLoading}
            />
        </div>
    );
};