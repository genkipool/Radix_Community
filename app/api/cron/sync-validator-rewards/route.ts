import { NextResponse } from 'next/server';
import {
    fetchEpochRewardEvents,
    syncRewardsToRedis,
    getRewardsSyncMeta,
} from '@/services/validatorRewards';
import logger from '@/lib/logger';

export const maxDuration = 30;

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

        // Fetch latest epoch change(s) from Gateway API
        // On first run (lastEpoch=0) we fetch just the latest epoch
        // On subsequent runs we fetch only new epochs
        const { events, latestStateVersion, epochs } = await fetchEpochRewardEvents(
            undefined,
            3, // Fetch last 3 epoch changes to cover any gaps
        );

        if (events.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No new epoch events found',
                lastEpoch,
            });
        }

        // Filter out already processed epochs
        const newEvents = lastEpoch > 0
            ? events.filter((ev) => ev.epoch > lastEpoch)
            : events;

        if (newEvents.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'All epochs already processed',
                lastEpoch,
                fetchedEpochs: epochs,
            });
        }

        // Sync to Redis
        const result = await syncRewardsToRedis(newEvents, latestStateVersion);

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
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        logger.error({ err }, '[SyncValidatorRewards] Fatal error in sync');
        return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
    }
}
