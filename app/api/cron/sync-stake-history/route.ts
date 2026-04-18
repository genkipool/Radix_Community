import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { getValidatorsCached } from '@/services/gateway/validators';
import { fetchStakeHistoryRaw } from '@/services/gateway/transactions';
import logger from '@/lib/logger';
import type { Validator } from '@/types/radix';

export const maxDuration = 55; // Vercel maximum execution time on Hobby/Pro for standard functions.

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    const url = new URL(request.url);
    const secretFromUrl = url.searchParams.get('secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
        return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
    }

    const isValidCron = authHeader === `Bearer ${expectedSecret}` || secretFromUrl === expectedSecret;
    if (!isValidCron) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const redisUrl = process.env.KV_REST_API_URL;
    const redisToken = process.env.KV_REST_API_TOKEN;
    if (!redisUrl || !redisToken) {
        return NextResponse.json({ error: 'Redis configuration missing' }, { status: 500 });
    }

    const redis = new Redis({ url: redisUrl, token: redisToken });
    const BATCH_SIZE = 5; // Stake history requests up to 20 pages per validator, meaning 5 = ~100 requests. Safe buffer below 160rq/min limit.
    const HISTORY_ZSET = 'stake_history_queue';
    const HISTORY_HASH = 'stake_history_map';
    
    const network = (url.searchParams.get('network') as 'mainnet' | 'stokenet') || 'mainnet';

    try {
        // 1. Fetch current validators safely from Next.js Vercel Cache
        const cachedData = await getValidatorsCached(network);
        const validatorsList = cachedData?.validators || [];

        // 2. Extract valid active addresses
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

        // 3. Ensure all active validators are in the ZSET
        for (const address of activeArray) {
            const score = await redis.zscore(HISTORY_ZSET, address);
            if (score === null) {
                await redis.zadd(HISTORY_ZSET, { score: 0, member: address });
            }
        }

        // 4. Fetch the N oldest updated validators from the Queue
        const oldestValidators = await redis.zrange(HISTORY_ZSET, 0, BATCH_SIZE - 1);
        
        if (!oldestValidators || oldestValidators.length === 0) {
            return NextResponse.json({ success: true, message: 'Queue is empty' });
        }

        logger.info({ network, count: oldestValidators.length }, '[SyncStakeHistoryCron] Processing batch of Stake Histories');

        const updatedHistories: Record<string, string> = {};

        // 5. Build histories throttling each one slightly if it spans multiple pages
        for (const addr of oldestValidators) {
            try {
                // fetchStakeHistoryRaw will sequentially fetch up to 20 pages.
                // Throttling internally per page isn't easy natively without rewriting the method,
                // but since it parses one page at a time (awaits sequentially), it's naturally distributed.
                const history = await fetchStakeHistoryRaw(addr as string, network);
                
                updatedHistories[addr as string] = JSON.stringify(history);

                // Additional safe delay between each validator to avoid sudden overlapping bursts
                await new Promise(r => setTimeout(r, 1000));

            } catch (err) {
                // If it hits a rate limit or page error, Log but continue processing others
                logger.error({ err, addr }, '[SyncStakeHistoryCron] Failed to fetch stake history for validator');
            }
        }

        const processedCount = Object.keys(updatedHistories).length;

        // 6. Update Hash counts and ZSET scores atomically in Pipeline
        if (processedCount > 0) {
            const pipeline = redis.pipeline();
            const now = Date.now();

            pipeline.hmset(HISTORY_HASH, updatedHistories);
            
            for (const addr of Object.keys(updatedHistories)) {
                pipeline.zadd(HISTORY_ZSET, { score: now, member: addr });
            }

            await pipeline.exec();
        }

        return NextResponse.json({ 
            success: true, 
            message: `Processed ${processedCount} Validator Stake Histories`,
            updated: Object.keys(updatedHistories)
        });

    } catch (err) {
        logger.error({ err }, '[SyncStakeHistoryCron] Fatal error in sync task');
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
