import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import logger from '@/lib/logger';

const REDIS_REWARDS_ALL = 'validator_rewards_all';

interface ValidatorRewardData {
    dailyDelegants?: Record<string, number>;
    dailyStake?: Record<string, number>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getRedisClient(): Redis | null {
    try {
        if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
            return new Redis({
                url: process.env.KV_REST_API_URL,
                token: process.env.KV_REST_API_TOKEN,
            });
        }
    } catch (e) {
        logger.error({ err: e }, '[AccountRewardsData] Failed to initialize Redis');
    }
    return null;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    if (!year) {
        return NextResponse.json({ error: 'Year parameter is required' }, { status: 400 });
    }

    const redis = getRedisClient();
    if (!redis) {
        return NextResponse.json({ error: 'Redis client not available' }, { status: 500 });
    }

    try {
        // Read all rewards data from Redis
        const allDataRaw = await redis.get(REDIS_REWARDS_ALL);
        if (!allDataRaw) {
            return NextResponse.json({ error: 'No rewards data found' }, { status: 404 });
        }

        const allData = (typeof allDataRaw === 'string' ? JSON.parse(allDataRaw) : allDataRaw) as Record<string, ValidatorRewardData>;
        
        // Filter data to only include the requested year to reduce payload size
        const filteredData: Record<string, ValidatorRewardData> = {};
        
        for (const [valAddr, valData] of Object.entries(allData)) {
            const dailyDelegants: Record<string, number> = {};
            const dailyStake: Record<string, number> = {};
            
            let hasData = false;
            
            if (valData.dailyDelegants) {
                for (const [date, reward] of Object.entries(valData.dailyDelegants)) {
                    if (date.startsWith(year)) {
                        dailyDelegants[date] = reward;
                        hasData = true;
                    }
                }
            }
            
            if (valData.dailyStake) {
                for (const [date, stake] of Object.entries(valData.dailyStake)) {
                    if (date.startsWith(year)) {
                        dailyStake[date] = stake;
                    }
                }
            }
            
            if (hasData) {
                filteredData[valAddr] = {
                    dailyDelegants,
                    dailyStake
                };
            }
        }

        return NextResponse.json({ rewardsData: filteredData });
    } catch (error) {
        logger.error({ err: error, year }, '[AccountRewardsData] Error fetching from Redis');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
