import { getRedis } from '@/lib/redis';
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

const REDIS_REWARDS_YEAR_PREFIX = 'validator_rewards_';
const REDIS_REWARDS_ALL = 'validator_rewards_all';
const MAX_YEARS_TO_KEEP = 5;

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns the list of years that have reward data in the system.
 * Prefers year-indexed keys for efficiency; falls back to legacy monolithic key.
 */
export async function getAvailableYearsForAccount(_accountAddress: string): Promise<string[]> {
    const redis = getRedis();
    if (!redis) {
        logger.error({ _accountAddress }, '[AccountRewards] Redis client not available');
        return [];
    }

    try {
        // Try year-indexed keys first (much smaller payloads)
        const currentYear = new Date().getFullYear();
        const candidateYears: string[] = [];
        for (let y = currentYear; y >= currentYear - MAX_YEARS_TO_KEEP; y--) {
            candidateYears.push(y.toString());
        }

        const checks = await Promise.all(
            candidateYears.map(async (yr) => {
                const data = await redis.get<Record<string, ValidatorRewardData>>(`${REDIS_REWARDS_YEAR_PREFIX}${yr}`);
                // If the year bucket exists and has at least one validator, it's available
                return data && Object.keys(data).length > 0 ? yr : null;
            })
        );

        const years = checks.filter((yr): yr is string => yr !== null);
        if (years.length > 0) {
            logger.info({ _accountAddress, count: years.length, years }, '[AccountRewards] Found available years via indexed keys');
            return years.sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
        }

        // Fallback to legacy monolithic key
        const allDataRaw = await redis.get(REDIS_REWARDS_ALL);
        if (!allDataRaw) {
            logger.warn({ _accountAddress }, '[AccountRewards] No rewards data found in Redis');
            return [];
        }

        const allData = (typeof allDataRaw === 'string' ? JSON.parse(allDataRaw) : allDataRaw) as Record<string, ValidatorRewardData>;
        
        const systemYears = new Set<string>();
        for (const valAddr of Object.keys(allData)) {
            const valData = allData[valAddr];
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
            .toSorted((a, b) => parseInt(b, 10) - parseInt(a, 10));

        logger.info({ _accountAddress, count: sortedYears.length, years: sortedYears }, '[AccountRewards] Found available years via legacy key');
        return sortedYears;
    } catch (e) {
        logger.error({ err: e, _accountAddress }, '[AccountRewards] Failed to get available years');
        return [];
    }
}
