
'use client';
import { useSyncExternalStore } from 'react';
import {
    subscribeToLiveData,
    getLiveSnapshot } from '@/services/liveDataStore';
import { type Validator } from '@/types/radix';



export interface EpochRow {
    epoch: number;
    completedProposals: number;
    missedProposals: number;
    isLive: boolean;
}

/** As the server sends it: `isLive` marks the epoch current at render time. */
type ServerEpochRow = Omit<EpochRow, 'isLive'> & { isLive?: boolean };

/**
 * The six rows of the epoch-history table, newest first and without holes.
 *
 * Three sources feed it: the live epoch, the epochs this browser watched
 * finalize, and the contiguous range the server rendered with. Keeping them
 * contiguous is the whole job — a missing row reads as if the epoch never
 * happened.
 */
export function unifyEpochRows({
    liveEpoch,
    epochMade,
    epochMissed,
    bridgedEpochs,
    serverPerformance,
}: {
    liveEpoch: number | null;
    epochMade: number;
    epochMissed: number;
    bridgedEpochs: EpochRow[];
    serverPerformance: ServerEpochRow[];
}): EpochRow[] {
    const normalised = serverPerformance.map((e) => ({ ...e, isLive: e.isLive ?? false }));

    // No live epoch known yet: the server's own table is all there is, and
    // inventing a live row for epoch 0 would head it with a row for an epoch
    // that never existed.
    if (liveEpoch === null) {
        return normalised.sort((a, b) => b.epoch - a.epoch).slice(0, 6);
    }

    const liveRow: EpochRow = {
        epoch: liveEpoch,
        completedProposals: epochMade,
        missedProposals: epochMissed,
        isLive: true,
    };

    // The server marks the epoch that was current WHEN IT RENDERED. Once the
    // chain moves on, that epoch is simply the most recent finalized one, and
    // dropping it left a hole right under the live row: the table read
    // "329450, 329448…". Only the row for the epoch that is live RIGHT NOW is
    // redundant, because the row above already carries it with fresher counts.
    const serverRows = normalised.flatMap((e) =>
        e.epoch === liveEpoch ? [] : [{ ...e, isLive: false }],
    );

    // Every epoch that reached this point is one we have data for, so all of
    // them are kept. Dropping rows whose counts were 0/0 is what produced an
    // earlier round of gaps: a validator that simply was not selected to
    // propose during an epoch legitimately scores 0 made and 0 missed.
    //
    // On a conflict the row carrying actual counts wins, since the server
    // falls back to zeros when a snapshot is missing, and a bridged row holds
    // the final tally where the server could only see a partial one.
    const unique = Array.from(
        [liveRow, ...bridgedEpochs, ...serverRows]
            .reduce((map, row) => {
                const existing = map.get(row.epoch);
                if (!existing) {
                    map.set(row.epoch, row);
                    return map;
                }
                const hasData = row.completedProposals > 0 || row.missedProposals > 0;
                const existingHasData =
                    existing.completedProposals > 0 || existing.missedProposals > 0;
                if (!existingHasData && hasData) map.set(row.epoch, row);
                return map;
            }, new Map<number, EpochRow>())
            .values(),
    );

    return unique.sort((a, b) => b.epoch - a.epoch).slice(0, 6);
}

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

    const unifiedRows = unifyEpochRows({
        liveEpoch,
        epochMade,
        epochMissed,
        bridgedEpochs,
        serverPerformance: validator.epochPerformance,
    });

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

