import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { getValidatorsCached } from '@/services/gateway/validators';
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
    const BATCH_SIZE = 15; // Number of LSUs to sync per execution to avoid Vercel timeouts and API rate limit bursts
    
    // Using Stokenet vs Mainnet based on an env or fixed to mainnet if not specified.
    const network = (url.searchParams.get('network') as 'mainnet' | 'stokenet') || 'mainnet';
    
    const HOLDER_ZSET = `lsu_sync_queue_${network}`;
    const HOLDER_HASH = `lsu_holders_${network}`;
    const gatewayBaseUrl = network === 'stokenet'
        ? 'https://stokenet.radixdlt.com'
        : 'https://mainnet.radixdlt.com';

    try {
        // 1. Fetch current validators safely from Next.js Vercel Cache (instantly, doesn't hit Gateway if cached)
        const cachedData = await getValidatorsCached(network);
        const validatorsList = cachedData?.validators || [];

        // 2. Extract valid addresses
        const lsuAddressesSet = new Set<string>();
        validatorsList.forEach((v: Validator) => {
            const isActive = v.status === 'active';
            const lsuResourceAddress = v.lsuResource;
            
            if (isActive && typeof lsuResourceAddress === 'string') {
                lsuAddressesSet.add(lsuResourceAddress);
            }
        });

        const activeLsuAddresses = Array.from(lsuAddressesSet);
        if (activeLsuAddresses.length === 0) {
            return NextResponse.json({ success: true, message: 'No active LSUs found' });
        }

        // 3. Ensure all active LSUs are in the ZSET (with score 0 if missing, strictly to process them ASAP)
        for (const address of activeLsuAddresses) {
            const score = await redis.zscore(HOLDER_ZSET, address);
            if (score === null) {
                await redis.zadd(HOLDER_ZSET, { score: 0, member: address });
            }
        }

        // 4. Fetch the N oldest updated LSUs from the Queue (score = timestamp)
        const oldestLsus = await redis.zrange(HOLDER_ZSET, 0, BATCH_SIZE - 1);
        
        if (!oldestLsus || oldestLsus.length === 0) {
            return NextResponse.json({ success: true, message: 'Queue is empty' });
        }

        logger.info({ network, count: oldestLsus.length }, '[SyncHoldersCron] Processing batch of LSUs');

        const updatedCounts: Record<string, number> = {};

        // 5. Throttled processing to respect the 160rq/min global restriction
        for (const addr of oldestLsus) {
            try {
                const res = await fetch(`${gatewayBaseUrl}/extensions/resource-holders/page`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ resource_address: addr, limit_per_page: 100 }),
                });

                if (res.status === 429) {
                    logger.warn({ addr, network }, '[SyncHoldersCron] Hit 429 Rate Limit. Pausing batch execution.');
                    break; // Abort this run immediately if we hit a limit to save the server IP
                }

                if (!res.ok) continue;

                const data = await res.json().catch(() => ({})) as Record<string, unknown>;
                const totalCount = (data.total_count as number) || 0;

                const items = data.items || [];
                const nonAccountHoldersCount = (items as Record<string, string>[]).filter(
                    (h) => h.address && !h.address.startsWith('account_')
                ).length;

                const finalCount = Math.max(0, totalCount - nonAccountHoldersCount);
                updatedCounts[addr as string] = finalCount;

                // Throttling: Enforce a strict 1-second delay between requests to remain well below 160 rq/minute
                await new Promise(r => setTimeout(r, 1000));

            } catch (err) {
                logger.error({ err, addr }, '[SyncHoldersCron] Failed to fetch holders for LSU');
            }
        }

        const lsusProcessedCount = Object.keys(updatedCounts).length;

        // 6. Update Hash counts and ZSET scores atomically in Pipeline
        if (lsusProcessedCount > 0) {
            const pipeline = redis.pipeline();
            const now = Date.now();

            pipeline.hmset(HOLDER_HASH, updatedCounts);
            
            for (const addr of Object.keys(updatedCounts)) {
                pipeline.zadd(HOLDER_ZSET, { score: now, member: addr });
            }

            await pipeline.exec();
        }

        return NextResponse.json({ 
            success: true, 
            message: `Processed ${lsusProcessedCount} LSUs`,
            updated: Object.keys(updatedCounts)
        });

    } catch (err) {
        logger.error({ err }, '[SyncHoldersCron] Fatal error in sync task');
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
