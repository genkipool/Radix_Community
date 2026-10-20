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
    DAILY_TOTALS_EVERY_MS,
} from '@/services/validatorRewards';
import logger from '@/lib/logger';

export const maxDuration = 30;

/** Always look a little past the last processed epoch, to absorb jitter. */
const MIN_EPOCH_FETCH = 3;

/**
 * Epoch changes read per run when following the cursor. Each is about 400 KB,
 * so 25 keeps a run near 10 MB, and still catches up two hours a run after
 * downtime while a new epoch only closes every five minutes.
 */
const CURSOR_PAGE = 25;

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

/** Finished epochs the history table shows that Redis does not hold. */
async function missingTableEpochs(): Promise<number[]> {
    const validators = await getValidatorsCached('mainnet');
    const currentEpoch = validators?.networkStats?.epoch ?? 0;
    const stored = new Set(await getStoredEpochRewardEpochs());
    const missing: number[] = [];
    for (let epoch = oldestVisibleEpoch(currentEpoch); epoch < currentEpoch; epoch++) {
        if (epoch > 0 && !stored.has(epoch)) missing.push(epoch);
    }
    return missing;
}

/**
 * How many of the newest epoch changes to read when there is no cursor yet
 * (the first run after it was introduced): back to the last epoch processed,
 * the oldest hole on screen, or the last epoch the totals include.
 */
async function legacyWindow(lastEpoch: number, missing: number[], totalsFrom: number): Promise<number> {
    const validators = await getValidatorsCached('mainnet');
    const currentEpoch = validators?.networkStats?.epoch ?? 0;
    const reachBackTo = Math.min(
        lastEpoch > 0 ? lastEpoch : currentEpoch,
        missing.length > 0 ? Math.min(...missing) : currentEpoch,
        totalsFrom > 0 ? totalsFrom : currentEpoch,
    );
    const gap = currentEpoch > 0 && reachBackTo > 0 ? currentEpoch - reachBackTo : 0;
    return Math.min(Math.max(gap + 1, MIN_EPOCH_FETCH), EPOCH_REWARDS_RETENTION);
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

        // The daily totals are written every half hour rather than every
        // epoch (see DAILY_TOTALS_EVERY_MS). Until the first such write they
        // stand where every run used to leave them: at the last epoch processed.
        const totalsFrom = meta?.dailyTotalsEpoch ?? lastEpoch;
        // Also due straight away while they are catching up after downtime.
        const totalsDue = !meta?.dailyTotalsAt
            || !!meta.totalsBehind
            || Date.now() - Date.parse(meta.dailyTotalsAt) >= DAILY_TOTALS_EVERY_MS;

        // Follow the ledger: read every epoch change after the last one read,
        // oldest first. Sizing a window from the cached validator list's epoch,
        // which lags, lost every epoch that fell outside it whenever runs were
        // late or rare (about 60 % of 2026's rewards), and nothing looked back.
        // The totals keep a cursor of their own, so the runs that only feed the
        // table never carry them past epochs they have not added.
        const cursor = totalsDue ? meta?.dailyTotalsStateVersion : meta?.lastStateVersion;
        const followed = cursor !== undefined;
        const missing = followed ? [] : await missingTableEpochs();

        const { events, latestStateVersion, epochs } = followed
            ? await fetchEpochRewardEvents(cursor, CURSOR_PAGE)
            : await fetchEpochRewardEvents(undefined, await legacyWindow(lastEpoch, missing, totalsDue ? totalsFrom : 0));

        logger.info({ followed, cursor, epochs, missing, totalsDue }, '[SyncValidatorRewards] Sync window');

        if (events.length === 0) {
            await touchSyncRun();
            return NextResponse.json({
                success: true,
                message: 'No new epoch events found',
                lastEpoch,
            });
        }

        // Following the cursor, everything read is new. Without it, keep an
        // epoch if it is newer than the mark, OR a hole the table shows empty.
        const missingSet = new Set(missing);
        const newEvents = followed || lastEpoch <= 0
            ? events
            : events.filter((ev) => ev.epoch > lastEpoch || missingSet.has(ev.epoch));

        // The per-validator mark in the totals stops an epoch being added twice.
        const dailyEvents = totalsDue
            ? (followed ? events : events.filter((ev) => totalsFrom <= 0 || ev.epoch > totalsFrom))
            : null;

        if (newEvents.length === 0 && !dailyEvents?.length) {
            await touchSyncRun();
            return NextResponse.json({
                success: true,
                message: 'All epochs already processed',
                lastEpoch,
                fetchedEpochs: epochs,
            });
        }

        // Sync to Redis
        // A full page means the ledger is further ahead than this run read.
        const result = await syncRewardsToRedis(newEvents, latestStateVersion, dailyEvents, {
            totalsBehind: followed && epochs.length >= CURSOR_PAGE,
        });

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
