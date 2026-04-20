'use client';

import React from 'react';
import { TrendingUp, Shield, Activity, Coins } from 'lucide-react';
import { formatXRD, formatNumber } from '@/utils/formatters';
import { StatCard } from './StatCard';

import type { DashboardStatsRowProps } from '../types';

export const DashboardStatsRow = ({
    activeView, stats, explorerStats, isLoading = false, dt, locale,
}: DashboardStatsRowProps) => {
    if (activeView === 'staking') {
        return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                <StatCard
                    icon={<Coins className="w-5 h-5" />}
                    label={dt?.network?.total_staked ?? ''}
                    value={`${formatXRD(stats.totalStaked, locale)} ${dt?.network?.xrd ?? 'XRD'}`}
                    accent
                    isLoading={isLoading}
                />
                <StatCard
                    icon={<Shield className="w-5 h-5" />}
                    label={dt?.network?.active_validators ?? ''}
                    value={`${stats.activeValidators} / ${stats.totalValidators}`}
                    isLoading={isLoading}
                />
                <StatCard
                    icon={<TrendingUp className="w-5 h-5" />}
                    label={dt?.network?.avg_apy ?? ''}
                    value={`${formatNumber(stats.avgApy, 2, locale)}%`}
                    accent
                    isLoading={isLoading}
                />
                <StatCard
                    icon={<Activity className="w-5 h-5" />}
                    label={dt?.network?.avg_uptime ?? ''}
                    value={`${formatNumber(stats.avgUptime, 2, locale)}%`}
                    isLoading={isLoading}
                />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <StatCard
                icon={<Activity className="w-5 h-5" />}
                label={dt?.explorer?.ledger_txs || 'Total Transactions'}
                value={stats.stateVersion ? stats.stateVersion.toLocaleString(locale) : '---'}
                accent
                description={dt?.explorer?.desc_txs}
                isLoading={isLoading}
            />
            <StatCard
                icon={<Coins className="w-5 h-5" />}
                label={dt?.explorer?.ledger_epoch || 'Current Epoch'}
                value={stats.epoch ? stats.epoch.toLocaleString(locale) : '---'}
                description={dt?.explorer?.desc_epoch}
                isLoading={isLoading}
            />
            <StatCard
                icon={<Shield className="w-5 h-5" />}
                label={dt?.explorer?.ledger_round || 'Current Round'}
                value={stats.round ? stats.round.toLocaleString(locale) : '---'}
                accent
                description={dt?.explorer?.desc_round}
                isLoading={isLoading}
            />
            <StatCard
                icon={<TrendingUp className="w-5 h-5" />}
                label={dt?.explorer?.largest_purchase || 'Largest Purchase'}
                value={
                    explorerStats && explorerStats.maxSending > 0
                        ? `${formatXRD(explorerStats.maxSending, locale)} XRD`
                        : '---'
                }
                description={dt?.explorer?.desc_purchase}
                copyText={explorerStats?.maxSendingHash || undefined}
                isLoading={isLoading}
            />
        </div>
    );
};