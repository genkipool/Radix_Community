/**
 * services/accountRewards.ts
 *
 * What a Babylon account's rewards CSV needs from the server: which years have
 * validator reward data, and one year of it. The account's own figures are
 * worked out in the browser from its history (clientCsvExport.ts).
 *
 * Both answers are the same for every account and change at most once per
 * epoch, so they are bounded by time, never by traffic: each instance asks
 * Redis at most once per window, and requests that arrive together share that
 * one read. The years come from the yearly keys' stamps (a few bytes each, one
 * MGET); a year's data is read through readBlob, compressed, and downloaded
 * only when its stamp changed.
 */
import 'server-only';
import { getRedis } from '@/lib/redis';
import logger from '@/lib/logger';
import { readBlob, stampKey } from '@/lib/redisBlob';

interface ValidatorRewardData {
    lastSyncedEpoch: number;
    daily: Record<string, number>;
    yearly: Record<string, number>;
    dailyDelegants?: Record<string, number>;
    yearlyDelegants?: Record<string, number>;
    dailyStake?: Record<string, number>;
}

/** What the browser uses of each validator's data: its delegators' daily reward and its daily stake. */
export type AccountRewardsYearData = Record<string, { dailyDelegants: Record<string, number>; dailyStake: Record<string, number> }>;

const REDIS_REWARDS_YEAR_PREFIX = 'validator_rewards_';
/** Same window the sync keeps (services/validatorRewards.ts). */
const MAX_YEARS_TO_KEEP = 5;
/** Babylon's first year. */
const FIRST_YEAR = 2023;
/** How long an instance answers from what it read: rewards are daily figures. */
export const ACCOUNT_REWARDS_MAX_AGE_MS = 60 * 60_000;

/** The years an account rewards CSV can be asked for, newest first, before anything is read. */
export function candidateYears(now = new Date()): string[] {
    const current = now.getUTCFullYear();
    const out: string[] = [];
    for (let y = current; y >= Math.max(FIRST_YEAR, current - MAX_YEARS_TO_KEEP); y--) out.push(String(y));
    return out;
}

let yearsCache: { years: string[]; at: number } | null = null;
let yearsInflight: Promise<string[]> | null = null;

/**
 * The years with reward data, newest first. One MGET of the yearly stamps per
 * instance and hour, whatever the traffic.
 */
export async function getAvailableRewardYears(): Promise<string[]> {
    const now = Date.now();
    if (yearsCache && now - yearsCache.at < ACCOUNT_REWARDS_MAX_AGE_MS) return yearsCache.years;
    if (yearsInflight) return yearsInflight;

    const redis = getRedis();
    if (!redis) {
        logger.error('[AccountRewards] Redis client not available');
        return [];
    }
    const candidates = candidateYears();
    yearsInflight = redis
        .mget<(string | null)[]>(...candidates.map((y) => stampKey(`${REDIS_REWARDS_YEAR_PREFIX}${y}`)))
        .then((stamps) => {
            const years = candidates.filter((_, i) => !!stamps[i]);
            yearsCache = { years, at: Date.now() };
            return years;
        })
        .catch((err) => {
            logger.error({ err }, '[AccountRewards] Failed to read the available years');
            return yearsCache?.years ?? [];
        })
        .finally(() => { yearsInflight = null; });
    return yearsInflight;
}

/** A validator owner's fee per day ("YYYY-MM-DD" → XRD). */
export type ValidatorFeesYearData = Record<string, Record<string, number>>;

/**
 * The daily fee of the given validators in a year, from the same stored value
 * as getAccountRewardsYearData (so no further Redis read): what the owner of
 * each validator earned. Unknown validators are left out; null when the year
 * is not kept.
 */
export async function getValidatorFeesYearData(year: string, validators: string[]): Promise<ValidatorFeesYearData | null> {
    const redis = getRedis();
    if (!redis) return null;
    const source = await readBlob<Record<string, ValidatorRewardData>>(redis, `${REDIS_REWARDS_YEAR_PREFIX}${year}`, { maxAgeMs: ACCOUNT_REWARDS_MAX_AGE_MS });
    if (!source) return null;
    const out: ValidatorFeesYearData = {};
    for (const v of validators) {
        const daily = source[v]?.daily;
        if (daily) out[v] = daily;
    }
    return out;
}

const trimmed = new Map<string, { source: unknown; data: AccountRewardsYearData }>();

/**
 * One year of every validator's delegator rewards and stake, or null when the
 * year is not kept. The year must already be one of `candidateYears()`.
 */
export async function getAccountRewardsYearData(year: string): Promise<AccountRewardsYearData | null> {
    const redis = getRedis();
    if (!redis) return null;
    const source = await readBlob<Record<string, ValidatorRewardData>>(redis, `${REDIS_REWARDS_YEAR_PREFIX}${year}`, { maxAgeMs: ACCOUNT_REWARDS_MAX_AGE_MS });
    if (!source) return null;

    // Only the two series the browser reads: about half of the stored value.
    const hit = trimmed.get(year);
    if (hit?.source === source) return hit.data;
    const data: AccountRewardsYearData = {};
    for (const [validator, v] of Object.entries(source)) {
        if (!v.dailyDelegants || Object.keys(v.dailyDelegants).length === 0) continue;
        data[validator] = { dailyDelegants: v.dailyDelegants, dailyStake: v.dailyStake ?? {} };
    }
    trimmed.set(year, { source, data });
    return data;
}
