import { Redis } from '@upstash/redis';
import logger from '@/lib/logger';

// ── Types ──────────────────────────────────────────────────────────────────────

/** Single epoch reward event parsed from ValidatorEmissionAppliedEvent */
export interface EpochRewardEntry {
    epoch: number;
    validatorAddress: string;
    stakePoolAddedXrd: number;
    validatorFeeXrd: number;
    totalRewardXrd: number;
    proposalsMade: number;
    proposalsMissed: number;
}

/** Daily breakdown stored per validator in Redis */
export interface ValidatorRewardData {
    lastSyncedEpoch: number;
    /** Mapping: "YYYY-MM-DD" → total XRD rewarded that day */
    daily: Record<string, number>;
    /** Mapping: "YYYY" → total XRD rewarded that year */
    yearly: Record<string, number>;
}

/** Metadata for the sync process */
interface RewardsSyncMeta {
    lastProcessedEpoch: number;
    lastRunTimestamp: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const REDIS_REWARDS_ALL = 'validator_rewards_all';
const REDIS_REWARDS_META = 'validator_rewards_meta';
const REDIS_EPOCH_REWARDS = 'validator_epoch_rewards';
const GATEWAY_URL = 'https://mainnet.radixdlt.com';
const MAX_YEARS_TO_KEEP = 5;

// ── Redis Helper ───────────────────────────────────────────────────────────────

export const getRewardsRedisClient = (): Redis | null => {
    try {
        if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
            return new Redis({
                url: process.env.KV_REST_API_URL,
                token: process.env.KV_REST_API_TOKEN,
            });
        }
    } catch (e) {
        logger.error({ err: e }, '[ValidatorRewards] Failed to initialize Redis');
    }
    return null;
};

// ── Gateway API ────────────────────────────────────────────────────────────────

/**
 * Fetches the latest EpochChange transactions from the Gateway API and
 * extracts ValidatorEmissionAppliedEvent data for all 100 active validators.
 *
 * @param afterStateVersion - If provided, fetches epochs after this state version (for pagination)
 * @param limit - Number of epoch changes to fetch (default 1 = latest only)
 */
export async function fetchEpochRewardEvents(
    afterStateVersion?: number,
    limit = 1,
): Promise<{ events: EpochRewardEntry[]; latestStateVersion: number; epochs: number[] }> {
    const body: Record<string, unknown> = {
        limit_per_page: limit,
        opt_ins: { receipt_events: true },
        kind_filter: 'EpochChange',
    };

    if (afterStateVersion) {
        body.from_state_version = afterStateVersion + 1;
        body.order = 'Asc';
    }

    const res = await fetch(`${GATEWAY_URL}/stream/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
    });

    if (!res.ok) {
        throw new Error(`Gateway API returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const items = data.items ?? [];
    const allEvents: EpochRewardEntry[] = [];
    const epochs: number[] = [];
    let latestStateVersion = 0;

    for (const item of items) {
        const sv = item.state_version ?? 0;
        if (sv > latestStateVersion) latestStateVersion = sv;

        const receiptEvents = item.receipt?.events ?? [];
        for (const ev of receiptEvents) {
            if (ev.name !== 'ValidatorEmissionAppliedEvent') continue;

            const validatorAddress =
                ev.emitter?.entity?.entity_address ?? '';
            const fields = ev.data?.fields ?? [];

            const getValue = (name: string): string =>
                fields.find((f: { field_name: string }) => f.field_name === name)?.value ?? '0';

            const epoch = parseInt(getValue('epoch'), 10);
            const stakePoolAddedXrd = parseFloat(getValue('stake_pool_added_xrd'));
            const validatorFeeXrd = parseFloat(getValue('validator_fee_xrd'));
            const proposalsMade = parseInt(getValue('proposals_made'), 10);
            const proposalsMissed = parseInt(getValue('proposals_missed'), 10);

            if (!epochs.includes(epoch)) epochs.push(epoch);

            allEvents.push({
                epoch,
                validatorAddress,
                stakePoolAddedXrd,
                validatorFeeXrd,
                totalRewardXrd: stakePoolAddedXrd + validatorFeeXrd,
                proposalsMade,
                proposalsMissed,
            });
        }
    }

    return { events: allEvents, latestStateVersion, epochs };
}

// ── Redis Sync ─────────────────────────────────────────────────────────────────

/**
 * Accumulates epoch reward data into the daily/yearly breakdown in Redis.
 * Idempotent: skips epochs already processed (tracked via lastSyncedEpoch).
 */
export async function syncRewardsToRedis(
    events: EpochRewardEntry[],
    _latestStateVersion: number,
): Promise<{ processedValidators: number; processedEpochs: number[] }> {
    const redis = getRewardsRedisClient();
    if (!redis) throw new Error('Redis not available');

    // Group events by validator
    const byValidator = new Map<string, EpochRewardEntry[]>();
    for (const ev of events) {
        const list = byValidator.get(ev.validatorAddress) ?? [];
        list.push(ev);
        byValidator.set(ev.validatorAddress, list);
    }

    const pipeline = redis.pipeline();
    const processedEpochs = new Set<number>();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const currentYear = new Date().getFullYear().toString();
    const cutoffYear = new Date().getFullYear() - MAX_YEARS_TO_KEEP;

    // Read all existing data once
    let allData: Record<string, ValidatorRewardData> = {};
    try {
        allData = (await redis.get<Record<string, ValidatorRewardData>>(REDIS_REWARDS_ALL)) ?? {};
    } catch {
        // Initial setup
    }

    for (const [address, validatorEvents] of byValidator) {
        const data: ValidatorRewardData = allData[address] ?? {
            lastSyncedEpoch: 0,
            daily: {},
            yearly: {},
        };

        for (const ev of validatorEvents) {
            // Skip already processed epochs
            if (ev.epoch <= data.lastSyncedEpoch) continue;

            processedEpochs.add(ev.epoch);

            // Accumulate daily
            data.daily[today] = (data.daily[today] ?? 0) + ev.validatorFeeXrd;

            // Accumulate yearly
            data.yearly[currentYear] = (data.yearly[currentYear] ?? 0) + ev.validatorFeeXrd;

            // Track highest epoch
            if (ev.epoch > data.lastSyncedEpoch) {
                data.lastSyncedEpoch = ev.epoch;
            }
        }
        
        allData[address] = data;
    }

    // Prune old years
    for (const address of Object.keys(allData)) {
        const data = allData[address];
        for (const year of Object.keys(data.daily)) {
            if (parseInt(year.substring(0, 4), 10) < cutoffYear) {
                delete data.daily[year];
            }
        }
        for (const year of Object.keys(data.yearly)) {
            if (parseInt(year, 10) < cutoffYear) {
                delete data.yearly[year];
            }
        }
    }

    pipeline.set(REDIS_REWARDS_ALL, allData);

    // Store last 6 epochs reward data for the epoch history table
    const epochNumbers = [...processedEpochs].sort((a, b) => b - a);
    if (epochNumbers.length > 0) {
        // Build per-epoch map: { epoch -> { address -> { fee, pool } } }
        const epochMap: Record<number, Record<string, { fee: number; pool: number }>> = {};
        for (const ev of events) {
            if (!epochMap[ev.epoch]) epochMap[ev.epoch] = {};
            epochMap[ev.epoch][ev.validatorAddress] = { fee: ev.validatorFeeXrd, pool: ev.stakePoolAddedXrd };
        }

        // Read existing epoch rewards and merge
        let existingEpochRewards: Record<string, Record<string, { fee: number; pool: number }>> | null = null;
        try {
            existingEpochRewards = await redis.get(REDIS_EPOCH_REWARDS);
        } catch {
            // First time
        }

        const merged = existingEpochRewards ?? {};
        for (const [epoch, rewards] of Object.entries(epochMap)) {
            merged[epoch] = rewards;
        }

        // Keep only last 10 epochs (buffer beyond the 6 displayed)
        const sortedKeys = Object.keys(merged)
            .map(Number)
            .sort((a, b) => b - a)
            .slice(0, 10);
        const pruned: Record<string, Record<string, { fee: number; pool: number }>> = {};
        for (const k of sortedKeys) {
            pruned[k.toString()] = merged[k.toString()];
        }

        pipeline.set(REDIS_EPOCH_REWARDS, pruned);
    }

    // Update sync metadata
    const meta: RewardsSyncMeta = {
        lastProcessedEpoch: Math.max(...epochNumbers, 0),
        lastRunTimestamp: new Date().toISOString(),
    };
    pipeline.set(REDIS_REWARDS_META, meta);

    await pipeline.exec();

    return {
        processedValidators: byValidator.size,
        processedEpochs: epochNumbers,
    };
}

// ── Read Helpers (for API routes / UI) ─────────────────────────────────────────

/**
 * Returns the XRD rewards for the last N epochs for a specific validator.
 * Used by the epoch history table.
 */
export async function getEpochRewardsForTable(
    validatorAddress: string,
): Promise<Record<number, { fee: number; pool: number }>> {
    const redis = getRewardsRedisClient();
    if (!redis) return {};

    try {
        const data = await redis.get<Record<string, Record<string, { fee: number; pool: number }>>>(REDIS_EPOCH_REWARDS);
        if (!data) return {};

        const result: Record<number, { fee: number; pool: number }> = {};
        for (const [epoch, rewards] of Object.entries(data)) {
            const xrd = rewards[validatorAddress];
            // Make sure xrd is an object (it could be a number if reading old cache)
            if (xrd !== undefined && typeof xrd === 'object' && 'fee' in xrd) {
                result[parseInt(epoch, 10)] = xrd;
            }
        }
        return result;
    } catch (e) {
        logger.error({ err: e }, '[ValidatorRewards] Failed to read epoch rewards from Redis');
        return {};
    }
}

/**
 * Returns the list of years that have reward data for a validator.
 */
export async function getAvailableYears(
    validatorAddress: string,
): Promise<string[]> {
    const redis = getRewardsRedisClient();
    if (!redis) return [];

    try {
        const allData = await redis.get<Record<string, ValidatorRewardData>>(REDIS_REWARDS_ALL);
        const data = allData?.[validatorAddress];
        if (!data?.yearly) return [];
        return Object.keys(data.yearly).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
    } catch (e) {
        logger.error({ err: e }, '[ValidatorRewards] Failed to read available years');
        return [];
    }
}

/**
 * Generates a CoinTracking-compatible CSV for a given validator and year.
 *
 * CoinTracking CSV format:
 * "Type","Buy","Cur.","Sell","Cur.","Fee","Cur.","Exchange","Group","Comment","Date"
 */
export async function generateRewardsCsv(
    validatorAddress: string,
    year: string,
): Promise<string | null> {
    const redis = getRewardsRedisClient();
    if (!redis) return null;

    try {
        const allData = await redis.get<Record<string, ValidatorRewardData>>(REDIS_REWARDS_ALL);
        const data = allData?.[validatorAddress];
        if (!data?.daily) return null;

        // Filter daily entries for the requested year  
        const entries = Object.entries(data.daily)
            .filter(([date]) => date.startsWith(year))
            .sort(([a], [b]) => a.localeCompare(b));

        if (entries.length === 0) return null;

        const header = '"Type","Buy","Cur.","Sell","Cur.","Fee","Cur.","Exchange","Group","Comment","Date"';
        const rows = entries.map(([date, xrd]) => {
            const formattedDate = `${date} 00:00:00`;
            const shortAddr = `${validatorAddress.substring(0, 20)}...`;
            return `"Staking","${xrd.toFixed(8)}","XRD","","","","","Radix Network","Staking","Daily reward - ${shortAddr}","${formattedDate}"`;
        });

        return [header, ...rows].join('\n');
    } catch (e) {
        logger.error({ err: e }, '[ValidatorRewards] Failed to generate CSV');
        return null;
    }
}

/**
 * Returns the sync metadata (lastProcessedEpoch, lastRunTimestamp).
 */
export async function getRewardsSyncMeta(): Promise<RewardsSyncMeta | null> {
    const redis = getRewardsRedisClient();
    if (!redis) return null;

    try {
        return await redis.get<RewardsSyncMeta>(REDIS_REWARDS_META);
    } catch {
        return null;
    }
}
