
'use client';
import { useSyncExternalStore } from 'react';
import {
    subscribeToLiveData,
    getLiveSnapshot } from '@/services/liveDataStore';
import { type Validator } from '@/types/radix';


export function useLiveProposals(validator: Validator) {
    const snap = useSyncExternalStore(subscribeToLiveData, getLiveSnapshot, getLiveSnapshot);

    // Live epoch-scoped data (real-time)
    const live = snap.epochProposals.get(validator.address);
    const epochMade = live?.made ?? validator.serverLiveProposalsMade;
    const epochMissed = live?.missed ?? validator.serverLiveProposalsMissed;

    // Is the current on-chain epoch newer than the SSR snapshot?
    const serverLiveEpoch = validator.epochPerformance.find(e => e.isLive)?.epoch ?? null;
    const isNewEpoch =
        snap.currentEpoch !== null &&
        serverLiveEpoch !== null &&
        snap.currentEpoch > serverLiveEpoch;

    // Final counts are now tracked in bridgedEpochs buffer

    const liveEpoch = isNewEpoch ? snap.currentEpoch : serverLiveEpoch;

    // Only epochs this validator actually has a record for. Emitting a 0/0 row
    // when the live buffer holds nothing for it would be indistinguishable from
    // a genuine "proposed nothing" epoch, and it was those placeholder rows
    // that the de-duplication below used to strip.
    const bridgedEpochs = snap.finalizedEpochs.flatMap(fe => {
        const stats = fe.data.get(validator.address);
        if (!stats) return [];
        return [{
            epoch: fe.epoch,
            completedProposals: stats.made,
            missedProposals: stats.missed,
            isLive: false
        }];
    });

    const unifiedRows = (() => {
        // 1. Live Row
        const liveRow = {
            epoch: liveEpoch ?? 0,
            completedProposals: epochMade,
            missedProposals: epochMissed,
            isLive: true
        };

        // 2. Combine with client-side history (bridged)
        // 3. Optional: Fallback to server data ONLY if we have very few rows in client memory
        const serverRows = validator.epochPerformance
            .flatMap(e => e.isLive ? [] : [{ ...e, isLive: false }]);

        const combined = [
            liveRow,
            ...bridgedEpochs,
            ...serverRows
        ];

        // 4. De-duplicate.
        //
        // Every epoch that reached this point is one we have data for, so all of
        // them are kept. Dropping rows whose counts were 0/0 is what produced
        // the gaps in the table (…329121, 329116…): a validator that simply was
        // not selected to propose during an epoch legitimately scores 0 made and
        // 0 missed, and its row vanished as if the epoch had never happened.
        //
        // The server already emits a CONTIGUOUS range (see cleanEpochPerformance
        // in services/gateway/validators.ts), so keeping every row restores the
        // unbroken sequence. On a conflict the row carrying actual counts wins,
        // since the server falls back to zeros when a snapshot is missing.
        const unique = Array.from(
            combined.reduce((map, row) => {
                const existing = map.get(row.epoch);
                if (!existing) {
                    map.set(row.epoch, row);
                    return map;
                }
                const hasData = row.completedProposals > 0 || row.missedProposals > 0;
                const existingHasData = existing.completedProposals > 0 || existing.missedProposals > 0;
                if (!existingHasData && hasData) map.set(row.epoch, row);
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
        recentMade: validator.recentProposalsMade - validator.serverLiveProposalsMade + epochMade,
        recentMissed: validator.recentProposalsMissed - validator.serverLiveProposalsMissed + epochMissed,
        totalMade: validator.totalProposalsMade - validator.serverLiveProposalsMade + epochMade,
        totalMissed: validator.totalProposalsMissed - validator.serverLiveProposalsMissed + epochMissed,
        liveEpoch,
        isNewEpoch,
        unifiedRows
    };
}

