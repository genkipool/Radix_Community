'use client';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
// import removed
import { apiFetchStakeHistory } from '@/features/dashboard/services/apiClient';
import { Button } from '@/components/ui/Button';
import { useLiveProposals } from './LiveProposals';
import { useLanguage } from '@/context/LanguageContext';
// import removed
import { useLayout } from '@/context/LayoutContext';
import { VEB_STYLES } from './ValidatorExpandedPrimitives';
import {
    ProfileBlock,
    DelegationBlock,
    PerformanceBlock,
    EvolutionBlock,
    ActivityBlock,
    HistoryBlock,
} from './ValidatorExpandedBlocks';


import { type ValidatorExpandedBodyProps } from '../types';

export const ValidatorExpandedBody = ({
    validator, t, onCopy, copiedAddress,
    network = 'mainnet', columns, hideCta = false,
}: ValidatorExpandedBodyProps) => {
    const { language } = useLanguage();
    const { setShowUnderConstruction } = useLayout();
    const dt = t?.dashboard;
    const live = useLiveProposals(validator);


    /* ── Data fetching ───────────────────────── */
    const cacheKey = `stake-history-${network}-${validator.address}`;

    const { data, isLoading: loadingStakes } = useQuery({
        queryKey: ['stake-history', network, validator.address],
        queryFn: async () => {
            const data = await apiFetchStakeHistory(validator.address, network);
            if (data?.length) {
                // Keep localStorage as a secondary cache for future offline use
                localStorage.setItem(cacheKey, JSON.stringify(data));
            }
            return data;
        },
        staleTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        placeholderData: (prev: unknown) => {
            if (prev) return prev;
            if (typeof window === 'undefined') return undefined;
            const stored = localStorage.getItem(cacheKey);
            if (!stored) return undefined;
            try { return JSON.parse(stored); } catch { return undefined; }
        },
    });

    // CRITICAL: Robust fallback to empty array to prevent .slice() TypeError
    const stakeHistory: StakeHistoryEntry[] = Array.isArray(data) ? data : [];

    const threeMonthEvolution = (() => {
        if (!stakeHistory || stakeHistory.length === 0) return [];
        let total = validator.totalStakeXRD || 0;
        const result = [];
        // Walk backwards through history
        for (let i = stakeHistory.length - 1; i >= 0; i--) {
            const day = stakeHistory[i];
            if (!day) continue;
            result.unshift({ date: day.date, totalStake: total });
            total = Math.max(0, total - ((day.stake || 0) - (day.unstake || 0)));
        }
        return result;
    })();

    const thirtyDayHistory = stakeHistory.length > 0 ? stakeHistory.slice(-30) : [];

    /* ── Shared block props ──────────────────── */
    const profileProps = { validator, dt, t, onCopy, copiedAddress };
    const delegationProps = { validator, dt };
    const perfProps = { validator, dt, live };
    const evolutionProps = { loading: loadingStakes, data: threeMonthEvolution, t, locale: language };
    const activityProps = { loading: loadingStakes, allHistory: stakeHistory, thirtyDays: thirtyDayHistory, t, locale: language };
    const historyProps = { live, dt };

    /* ── Layouts ─────────────────────────────── */
    const grid1 = (
        <div className="veb-classic-grid">
            <div className="veb-top">
                <ProfileBlock    {...profileProps} />
                <DelegationBlock {...delegationProps} />
                <PerformanceBlock {...perfProps} />
            </div>
            <div className="veb-history-grid">
                <EvolutionBlock {...evolutionProps} />
                <ActivityBlock  {...activityProps} />
                <HistoryBlock   {...historyProps} />
            </div>
        </div>
    );

    const grid2 = (
        <div className="veb-main-grid veb-grid-2">
            <ProfileBlock    {...profileProps} className="col-span-2" />
            <DelegationBlock {...delegationProps} />
            <PerformanceBlock {...perfProps} />
            <HistoryBlock    {...historyProps} className="col-span-2" />
            <EvolutionBlock  {...evolutionProps} />
            <ActivityBlock   {...activityProps} />
        </div>
    );

    const gridN = (
        <div className={`veb-main-grid veb-grid-${columns}`}>
            <ProfileBlock    {...profileProps} />
            <DelegationBlock {...delegationProps} />
            <PerformanceBlock {...perfProps} />
            <HistoryBlock    {...historyProps} />
            <EvolutionBlock  {...evolutionProps} />
            <ActivityBlock   {...activityProps} />
        </div>
    );

    return (
        <div className="veb">
            {columns === 1 ? grid1 : columns === 2 ? grid2 : gridN}

            {!hideCta && (
                <div className="veb-cta">
                    <p className="veb-cta-hint">
                        {dt?.card?.stake_hint ?? 'Delegate your XRD to this validator and start earning rewards.'}
                    </p>
                    <Button
                        variant="primary"
                        className="veb-cta-btn"
                        onClick={e => {
                            e.stopPropagation();
                            setShowUnderConstruction(true);
                        }}
                    >
                        {dt?.card?.stake_button ?? 'Stake'}
                    </Button>
                </div>
            )}

            <style>{VEB_STYLES}</style>
        </div>
    );
};