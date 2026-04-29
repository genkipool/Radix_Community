import { Redis } from '@upstash/redis';
import logger from '@/lib/logger';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ValidatorRewardData {
    lastSyncedEpoch: number;
    daily: Record<string, number>;
    yearly: Record<string, number>;
    dailyDelegants?: Record<string, number>;
    yearlyDelegants?: Record<string, number>;
    dailyStake?: Record<string, number>;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const REDIS_REWARDS_ALL = 'validator_rewards_all';

// ── Redis Helper ───────────────────────────────────────────────────────────────

function getRedisClient(): Redis | null {
    try {
        if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
            return new Redis({
                url: process.env.KV_REST_API_URL,
                token: process.env.KV_REST_API_TOKEN,
            });
        }
    } catch (e) {
        logger.error({ err: e }, '[AccountRewards] Failed to initialize Redis');
    }
    return null;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns the list of years that have reward data in the system.
 */
export async function getAvailableYearsForAccount(accountAddress: string): Promise<string[]> {
    const redis = getRedisClient();
    if (!redis) {
        logger.error({ accountAddress }, '[AccountRewards] Redis client not available');
        return [];
    }

    try {
        const allDataRaw = await redis.get(REDIS_REWARDS_ALL);
        if (!allDataRaw) {
            logger.warn({ accountAddress }, '[AccountRewards] No rewards data found in Redis');
            return [];
        }

        // Handle both stringified and object responses from Redis
        const allData = (typeof allDataRaw === 'string' ? JSON.parse(allDataRaw) : allDataRaw) as Record<string, ValidatorRewardData>;
        
        const systemYears = new Set<string>();
        for (const valAddr of Object.keys(allData)) {
            const valData = allData[valAddr];
            // Check both yearly (validator fees) and yearlyDelegants (staker rewards)
            if (valData.yearly) {
                for (const yr of Object.keys(valData.yearly)) {
                    if (yr.length === 4) systemYears.add(yr);
                }
            }
            if (valData.yearlyDelegants) {
                for (const yr of Object.keys(valData.yearlyDelegants)) {
                    if (yr.length === 4) systemYears.add(yr);
                }
            }
        }

        const sortedYears = [...systemYears]
            .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));

        logger.info({ accountAddress, count: sortedYears.length, years: sortedYears }, '[AccountRewards] Found available years');
        return sortedYears;
    } catch (e) {
        logger.error({ err: e, accountAddress }, '[AccountRewards] Failed to get available years');
        return [];
    }
}
