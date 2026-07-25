import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getValidatorsCached } from '@/services/gateway/validators';
import {
    fetchEpochRewardEvents,
    syncRewardsToRedis,
    getRewardsSyncMeta,
    getStoredEpochRewardEpochs,
    touchSyncRun,
    EPOCH_REWARDS_RETENTION,
    EPOCH_REWARDS_MIN_COVERAGE,
    EPOCH_REWARDS_CACHE_TAG,
} from '@/services/validatorRewards';
import logger from '@/lib/logger';

export const maxDuration = 30;

/** Always look a little past the last processed epoch, to absorb jitter. */
const MIN_EPOCH_FETCH = 3;

/**
 * The oldest epoch the history table still needs filled in.
 *
 * The table shows the live epoch plus the 5 that closed before it, so anything
 * from `currentEpoch - EPOCH_REWARDS_MIN_COVERAGE` onwards is on screen right
 * now and must carry its reward figures.
 */
function oldestVisibleEpoch(currentEpoch: number): number {
    return currentEpoch > 0 ? currentEpoch - EPOCH_REWARDS_MIN_COVERAGE : 0;
}

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    const url = new URL(request.url);
    const secretFromUrl = url.searchParams.get('secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
        return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
    }

    const isValidCron =
        authHeader === `Bearer ${expectedSecret}` || secretFromUrl === expectedSecret;
    if (!isValidCron) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Check what was last processed
        const meta = await getRewardsSyncMeta();
        const lastEpoch = meta?.lastProcessedEpoch ?? 0;

        logger.info(
            { lastEpoch },
            '[SyncValidatorRewards] Starting reward sync',
        );

        // How far behind are we? Epochs last about five minutes, so a fixed
        // window of three covered barely fifteen: any run that was late, failed
        // or timed out left the epochs in between unprocessed FOREVER, because
        // the next run only looked at the newest changes and then advanced
        // `lastProcessedEpoch` past the hole. Those epochs then showed up in the
        // history table with empty reward columns.
        //
        // The window is therefore sized to the actual gap instead of guessed.
        // It matters that it stays small on the happy path: each epoch change
        // carries every validator's emission events, so asking for the full
        // retention window every run pulled megabytes and blew past the fetch
        // cache's 2 MB ceiling, making it uncacheable.
        //
        // Advancing the high-water mark is not enough on its own, because a
        // hole left BEHIND it is never revisited: the mark has already moved
        // past it. So the window also has to cover any epoch the table still
        // shows but Redis is missing, and the run repairs it in place.
        const validators = await getValidatorsCached('mainnet');
        const currentEpoch = validators?.networkStats?.epoch ?? 0;
        const storedEpochs = await getStoredEpochRewardEpochs();
        const stored = new Set(storedEpochs);

        const missing: number[] = [];
        for (let epoch = oldestVisibleEpoch(currentEpoch); epoch < currentEpoch; epoch++) {
            if (epoch > 0 && !stored.has(epoch)) missing.push(epoch);
        }

        // Reach back to whichever is further: the last epoch processed, or the
        // oldest hole still on screen.
        const reachBackTo = Math.min(
            lastEpoch > 0 ? lastEpoch : currentEpoch,
            missing.length > 0 ? Math.min(...missing) : currentEpoch,
        );
        const gap = currentEpoch > 0 && reachBackTo > 0 ? currentEpoch - reachBackTo : 0;
        const window = Math.min(Math.max(gap + 1, MIN_EPOCH_FETCH), EPOCH_REWARDS_RETENTION);

        logger.info({ currentEpoch, lastEpoch, missing, window }, '[SyncValidatorRewards] Sync window');

        const { events, latestStateVersion, epochs } = await fetchEpochRewardEvents(
            undefined,
            window,
        );

        if (events.length === 0) {
            await touchSyncRun();
            return NextResponse.json({
                success: true,
                message: 'No new epoch events found',
                lastEpoch,
            });
        }

        // Keep an epoch if it is genuinely new, OR if it is a hole the table is
        // showing empty. Filtering on the high-water mark alone was what made
        // the damage permanent.
        const missingSet = new Set(missing);
        const newEvents = lastEpoch > 0
            ? events.filter((ev) => ev.epoch > lastEpoch || missingSet.has(ev.epoch))
            : events;

        if (newEvents.length === 0) {
            await touchSyncRun();
            return NextResponse.json({
                success: true,
                message: 'All epochs already processed',
                lastEpoch,
                fetchedEpochs: epochs,
            });
        }

        // Sync to Redis
        const result = await syncRewardsToRedis(newEvents, latestStateVersion);

        // The read path caches for minutes, so without this the epochs just
        // written stay hidden and their reward columns read as empty.
        revalidateTag(EPOCH_REWARDS_CACHE_TAG, 'max');

        logger.info(
            {
                validators: result.processedValidators,
                epochs: result.processedEpochs,
            },
            '[SyncValidatorRewards] Sync complete',
        );

        return NextResponse.json({
            success: true,
            message: `Processed ${result.processedValidators} validators across ${result.processedEpochs.length} epochs`,
            processedEpochs: result.processedEpochs,
            repairedEpochs: missing,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        logger.error({ err }, '[SyncValidatorRewards] Fatal error in sync');
        return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
    }
}
