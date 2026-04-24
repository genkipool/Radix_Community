import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { getValidatorsCached } from '@/services/gateway/validators';
import {
    fetchStakeHistoryIncremental,
    type StakeHistoryRecord,
} from '@/services/gateway/transactions';
import logger from '@/lib/logger';
import type { Validator } from '@/types/radix';

export const maxDuration = 55;

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

    const redisUrl = process.env.KV_REST_API_URL;
    const redisToken = process.env.KV_REST_API_TOKEN;
    if (!redisUrl || !redisToken) {
        return NextResponse.json({ error: 'Redis configuration missing' }, { status: 500 });
    }

    const redis = new Redis({ url: redisUrl, token: redisToken });

    // With incremental sync, most executions only need 1–2 pages
    // per validator, so we can safely increase the batch size from 5 to 10.
    const BATCH_SIZE = 10;
    const HISTORY_ZSET = 'stake_history_queue';
    const HISTORY_HASH = 'stake_history_map';

    const network =
        (url.searchParams.get('network') as 'mainnet' | 'stokenet') || 'mainnet';

    try {
        // ── 1. Get list of active validators ──────────────────────────────────
        const cachedData = await getValidatorsCached(network);
        const validatorsList = cachedData?.validators || [];

        const activeAddresses = new Set<string>();
        validatorsList.forEach((v: Validator) => {
            if (v.status === 'active' && v.address) {
                activeAddresses.add(v.address);
            }
        });

        const activeArray = Array.from(activeAddresses);
        if (activeArray.length === 0) {
            return NextResponse.json({ success: true, message: 'No active validators found' });
        }

        // ── 2. Register new validators in the ZSET using ZADD NX ──────────────
        // A single pipeline removes the N×ZSCORE + N×ZADD loop from the previous code.
        const seedPipeline = redis.pipeline();
        for (const address of activeArray) {
            seedPipeline.zadd(HISTORY_ZSET, { nx: true }, { score: 0, member: address });
        }
        await seedPipeline.exec();

        // ── 3. Select the batch of most outdated validators ───────────────────
        const oldestValidators = await redis.zrange(HISTORY_ZSET, 0, BATCH_SIZE - 1);
        if (!oldestValidators || oldestValidators.length === 0) {
            return NextResponse.json({ success: true, message: 'Queue is empty' });
        }

        logger.info(
            { network, count: oldestValidators.length },
            '[SyncStakeHistoryCron] Processing batch',
        );

        // ── 4. Read existing histories from Redis in a single HMGET ───────────
        // This allows fetchStakeHistoryIncremental to decide whether to perform
        // a full refresh or incremental without additional round trips to Redis.
        const existingRaws = await redis.hmget<Record<string, StakeHistoryRecord | string | null>>(
            HISTORY_HASH,
            ...(oldestValidators as string[]),
        );

        // hmget returns an object { addr: value } or null per position
        // Upstash returns it as an object indexed by key
        const existingMap = new Map<string, StakeHistoryRecord | null>();
        for (const addr of oldestValidators as string[]) {
            const raw = existingRaws?.[addr] ?? null;
            if (!raw) {
                existingMap.set(addr, null);
            } else if (typeof raw === 'string') {
                // Old format (flat JSON array) → convert to StakeHistoryRecord
                try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) {
                        // Infer lastSyncedDate from the most recent day in the array
                        const lastEntry = parsed[parsed.length - 1];
                        existingMap.set(addr, {
                            data: parsed,
                            lastSyncedDate: lastEntry?.date ?? '',
                            lastSyncedAt: 0, // will force full refresh if too old
                        });
                    } else {
                        existingMap.set(addr, parsed as StakeHistoryRecord);
                    }
                } catch {
                    existingMap.set(addr, null);
                }
            } else if (typeof raw === 'object' && 'data' in raw) {
                existingMap.set(addr, raw as StakeHistoryRecord);
            } else {
                existingMap.set(addr, null);
            }
        }

        // ── 5. Incremental fetch per validator ────────────────────────────────
        const updatedRecords: Record<string, string> = {};

        for (const addr of oldestValidators as string[]) {
            try {
                const existing = existingMap.get(addr) ?? null;
                const record = await fetchStakeHistoryIncremental(addr, existing, network);
                updatedRecords[addr] = JSON.stringify(record);

                logger.info(
                    {
                        addr: addr.slice(0, 20) + '...',
                        days: record.data.length,
                        lastSyncedDate: record.lastSyncedDate,
                        wasIncremental: existing !== null,
                    },
                    '[SyncStakeHistoryCron] Fetched',
                );

                // Delay between validators to respect Gateway rate limits
                await new Promise(r => setTimeout(r, 500));

            } catch (err) {
                logger.error({ err, addr }, '[SyncStakeHistoryCron] Failed to fetch history');
            }
        }

        const processedCount = Object.keys(updatedRecords).length;

        // ── 6. Save to Redis with atomic pipeline ─────────────────────────────
        if (processedCount > 0) {
            const pipeline = redis.pipeline();
            const now = Date.now();

            pipeline.hmset(HISTORY_HASH, updatedRecords);

            for (const addr of Object.keys(updatedRecords)) {
                pipeline.zadd(HISTORY_ZSET, { score: now, member: addr });
            }

            await pipeline.exec();
        }

        return NextResponse.json({
            success: true,
            message: `Processed ${processedCount} validators`,
            updated: Object.keys(updatedRecords),
        });

    } catch (err) {
        logger.error({ err }, '[SyncStakeHistoryCron] Fatal error');
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}