'use client';
import React, { useSyncExternalStore, useEffect } from 'react';
import {
    subscribeToLiveData,
    subscribeToEpochChange,
    getLiveSnapshot,
    getLastKnownEpoch,
    registerAddressForPolling,
} from '@/services/liveDataStore';
import { type Validator } from '@/types/radix';

/* ─────────────────────────────────────────
   HOOKS
───────────────────────────────────────── */

export function useCurrentEpoch(): number | null {
    return useSyncExternalStore(subscribeToEpochChange, getLastKnownEpoch, getLastKnownEpoch);
}

/**
 * useLiveProposals
 *
 * Reads epoch-scoped proposal counts directly from the live store.
 * The store gets them from ConsensusManagerFieldCurrentProposalStatistic,
 * updated every round — no baseline subtraction needed here.
 *
 * Falls back to SSR-computed values until the first poll arrives.
 */
export function useLiveProposals(validator: Validator) {
    const snap = useSyncExternalStore(subscribeToLiveData, getLiveSnapshot, getLiveSnapshot);

    useEffect(() => {
        if (validator.address) registerAddressForPolling(validator.address);
    }, [validator.address]);

    // Live epoch-scoped data (real-time)
    const live = snap.epochProposals.get(validator.address);
    const epochMade   = live?.made   ?? validator.serverLiveProposalsMade;
    const epochMissed = live?.missed ?? validator.serverLiveProposalsMissed;

    // Is the current on-chain epoch newer than the SSR snapshot?
    const serverLiveEpoch = validator.epochPerformance.find(e => e.isLive)?.epoch ?? null;
    const isNewEpoch =
        snap.currentEpoch !== null &&
        serverLiveEpoch !== null &&
        snap.currentEpoch > serverLiveEpoch;

    // Final counts are now tracked in bridgedEpochs buffer

    const liveEpoch = isNewEpoch ? snap.currentEpoch : serverLiveEpoch;

    const bridgedEpochs = snap.finalizedEpochs.map(fe => {
        const stats = fe.data.get(validator.address);
        return {
            epoch:              fe.epoch,
            completedProposals: stats?.made   ?? 0,
            missedProposals:    stats?.missed ?? 0,
            isLive:             false
        };
    });

    const unifiedRows = (() => {
        // 1. Live Row
        const liveRow = {
            epoch:              liveEpoch ?? 0,
            completedProposals: epochMade,
            missedProposals:    epochMissed,
            isLive:             true
        };

        // 2. Combine with client-side history (bridged)
        // 3. Optional: Fallback to server data ONLY if we have very few rows in client memory
        const serverRows = validator.epochPerformance
            .filter(e => !e.isLive)
            .map(e => ({ ...e, isLive: false }));

        const combined = [
            liveRow,
            ...bridgedEpochs,
            ...serverRows
        ];

        // 4. De-duplicate and Sanitize (Remove non-live 0/0 rows)
        const unique = Array.from(
            combined.reduce((map, row) => {
                const existing = map.get(row.epoch);
                const hasData = row.completedProposals > 0 || row.missedProposals > 0;
                
                if (!existing) {
                    if (row.isLive || hasData) map.set(row.epoch, row);
                } else {
                    const existingHasData = existing.completedProposals > 0 || existing.missedProposals > 0;
                    if (!existingHasData && hasData) {
                        map.set(row.epoch, row);
                    }
                }
                return map;
            }, new Map<number, typeof liveRow>()).values()
        );

        // 5. Sort and Slice
        return unique
            .sort((a, b) => b.epoch - a.epoch)
            .slice(0, 6);
    })();

    return {
        epochMade,
        epochMissed,
        recentMade:    validator.recentProposalsMade   - validator.serverLiveProposalsMade   + epochMade,
        recentMissed:  validator.recentProposalsMissed - validator.serverLiveProposalsMissed + epochMissed,
        totalMade:     validator.totalProposalsMade    - validator.serverLiveProposalsMade   + epochMade,
        totalMissed:   validator.totalProposalsMissed  - validator.serverLiveProposalsMissed + epochMissed,
        liveEpoch,
        isNewEpoch,
        unifiedRows
    };
}

/* ─────────────────────────────────────────
   UTILITY COMPONENTS
───────────────────────────────────────── */

import { type LiveProposalsTextProps } from '../types';

export const LiveProposalsText: React.FC<LiveProposalsTextProps> = ({ validator, type, className }) => {
    const data = useLiveProposals(validator);
    return <span className={className}>{data[type].toLocaleString()}</span>;
};