import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import logger from '@/lib/logger';

const REDIS_REWARDS_YEAR_PREFIX = 'validator_rewards_';
const REDIS_REWARDS_ALL = 'validator_rewards_all';

interface ValidatorRewardData {
    dailyDelegants?: Record<string, number>;
    dailyStake?: Record<string, number>;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    if (!year || !/^\d{4}$/.test(year)) {
        return NextResponse.json({ error: 'Year parameter is required (YYYY format)' }, { status: 400 });
    }

    const redis = getRedis();
    if (!redis) {
        return NextResponse.json({ error: 'Redis client not available' }, { status: 500 });
    }

    try {
        // Try year-indexed key first (small payload, no filtering needed)
        const yearData = await redis.get<Record<string, ValidatorRewardData>>(`${REDIS_REWARDS_YEAR_PREFIX}${year}`);
        if (yearData && Object.keys(yearData).length > 0) {
            return NextResponse.json({ rewardsData: yearData }, {
                headers: {
                    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
                },
            });
        }

        // Fallback to legacy monolithic key (will be removed after full migration)
        const allDataRaw = await redis.get(REDIS_REWARDS_ALL);
        if (!allDataRaw) {
            return NextResponse.json({ error: 'No rewards data found' }, { status: 404 });
        }

        const allData = (typeof allDataRaw === 'string' ? JSON.parse(allDataRaw) : allDataRaw) as Record<string, ValidatorRewardData>;
        
        // Filter data to only include the requested year
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

        return NextResponse.json({ rewardsData: filteredData }, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
        });
    } catch (error) {
        logger.error({ err: error, year }, '[AccountRewardsData] Error fetching from Redis');
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
