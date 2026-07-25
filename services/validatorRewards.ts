import { getRedis } from '@/lib/redis';
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
    /** Total stake at emission time: starting_stake_pool_xrd + stake_pool_added_xrd */
    totalStakeXrd: number;
}

export interface ValidatorRewardData {
    lastSyncedEpoch: number;
    /** Mapping: "YYYY-MM-DD" → total validator fee XRD rewarded that day */
    daily: Record<string, number>;
    /** Mapping: "YYYY" → total validator fee XRD rewarded that year */
    yearly: Record<string, number>;
    /** Mapping: "YYYY-MM-DD" → total delegator XRD rewarded that day */
    dailyDelegants?: Record<string, number>;
    /** Mapping: "YYYY" → total delegator XRD rewarded that year */
    yearlyDelegants?: Record<string, number>;
    /** Mapping: "YYYY-MM-DD" → total stake of the validator that day (starting_stake + pool_added) */
    dailyStake?: Record<string, number>;
}

/** Metadata for the sync process */
interface RewardsSyncMeta {
    lastProcessedEpoch: number;
    lastRunTimestamp: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const REDIS_REWARDS_ALL = 'validator_rewards_all';
const REDIS_REWARDS_YEAR_PREFIX = 'validator_rewards_';
const REDIS_REWARDS_META = 'validator_rewards_meta';
const REDIS_EPOCH_REWARDS = 'validator_epoch_rewards';

/**
 * How many finished epochs of per-epoch rewards are kept, and therefore how far
 * back a sync can still repair. The epoch-history table shows 6, so this leaves
 * margin. The sync window is derived from this so the two cannot drift: a run
 * that fetched fewer epochs than are retained would leave permanent holes.
 */
export const EPOCH_REWARDS_RETENTION = 10;

/**
 * Cache tag for the per-epoch rewards read path. Exported so the sync can
 * invalidate exactly what it just rewrote: the reader caches for minutes, so
 * without this a freshly synced epoch stayed invisible and its reward columns
 * looked empty even though the data was already in Redis.
 */
export const EPOCH_REWARDS_CACHE_TAG = 'all_validator_epoch_rewards_cache';

/**
 * How many FINISHED epochs the history table must be able to fill in.
 *
 * The table draws 6 rows: the live epoch, which has no rewards yet by
 * definition, plus the 5 that closed before it. Every one of those 5 has to
 * carry its v XRD / d XRD figures, so the sync treats any of them missing from
 * Redis as damage to repair rather than as history.
 */
export const EPOCH_REWARDS_MIN_COVERAGE = 5;

const GATEWAY_URL = 'https://mainnet.radixdlt.com';
const MAX_YEARS_TO_KEEP = 5;


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
        next: { revalidate: 300 },
    });

    if (!res.ok) {
        throw new Error(`Gateway API returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    const items = data.items ?? [];
    const allEvents: EpochRewardEntry[] = [];
    const epochs: number[] = [];
    const _epochsSeen = new Set<number>();
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
            const startingStakePoolXrd = parseFloat(getValue('starting_stake_pool_xrd'));
            const proposalsMade = parseInt(getValue('proposals_made'), 10);
            const proposalsMissed = parseInt(getValue('proposals_missed'), 10);

            if (!_epochsSeen.has(epoch)) { _epochsSeen.add(epoch); epochs.push(epoch); }

            allEvents.push({
                epoch,
                validatorAddress,
                stakePoolAddedXrd,
                validatorFeeXrd,
                totalRewardXrd: stakePoolAddedXrd + validatorFeeXrd,
                proposalsMade,
                proposalsMissed,
                totalStakeXrd: startingStakePoolXrd + stakePoolAddedXrd,
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
    const redis = getRedis();
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
            dailyDelegants: {},
            yearlyDelegants: {},
        };

        // Ensure new fields exist for existing records
        if (!data.dailyDelegants) data.dailyDelegants = {};
        if (!data.yearlyDelegants) data.yearlyDelegants = {};
        if (!data.dailyStake) data.dailyStake = {};

        for (const ev of validatorEvents) {
            // Skip already processed epochs
            if (ev.epoch <= data.lastSyncedEpoch) continue;

            processedEpochs.add(ev.epoch);

            // Accumulate daily
            data.daily[today] = (data.daily[today] ?? 0) + ev.validatorFeeXrd;
            data.dailyDelegants[today] = (data.dailyDelegants[today] ?? 0) + ev.stakePoolAddedXrd;

            // Accumulate yearly
            data.yearly[currentYear] = (data.yearly[currentYear] ?? 0) + ev.validatorFeeXrd;
            data.yearlyDelegants[currentYear] = (data.yearlyDelegants[currentYear] ?? 0) + ev.stakePoolAddedXrd;

            // Track total stake (use latest epoch's value for that day)
            data.dailyStake![today] = ev.totalStakeXrd;

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
        const prune = (map?: Record<string, number>) => {
            if (!map) return;
            for (const key of Object.keys(map)) {
                const year = key.length === 4 ? key : key.substring(0, 4);
                if (parseInt(year, 10) < cutoffYear) {
                    delete map[key];
                }
            }
        };

        prune(data.daily);
        prune(data.yearly);
        prune(data.dailyDelegants);
        prune(data.yearlyDelegants);
        prune(data.dailyStake);
    }

    pipeline.set(REDIS_REWARDS_ALL, allData);

    // Write year-indexed keys for efficient per-year reads
    const yearBuckets = new Map<string, Record<string, ValidatorRewardData>>();
    for (const [address, data] of Object.entries(allData)) {
        // Collect all years this validator has data for
        const years = new Set<string>();
        if (data.daily) Object.keys(data.daily).forEach(d => years.add(d.substring(0, 4)));
        if (data.dailyDelegants) Object.keys(data.dailyDelegants).forEach(d => years.add(d.substring(0, 4)));
        if (data.dailyStake) Object.keys(data.dailyStake).forEach(d => years.add(d.substring(0, 4)));

        for (const yr of years) {
            if (!yearBuckets.has(yr)) yearBuckets.set(yr, {});
            const bucket = yearBuckets.get(yr)!;

            // Extract only entries for this year
            const filterByYear = (map?: Record<string, number>) => {
                if (!map) return undefined;
                const filtered: Record<string, number> = {};
                for (const [key, val] of Object.entries(map)) {
                    if (key.startsWith(yr)) filtered[key] = val;
                }
                return Object.keys(filtered).length > 0 ? filtered : undefined;
            };

            bucket[address] = {
                lastSyncedEpoch: data.lastSyncedEpoch,
                daily: filterByYear(data.daily) ?? {},
                yearly: data.yearly[yr] !== undefined ? { [yr]: data.yearly[yr] } : {},
                dailyDelegants: filterByYear(data.dailyDelegants),
                yearlyDelegants: data.yearlyDelegants?.[yr] !== undefined ? { [yr]: data.yearlyDelegants[yr] } : {},
                dailyStake: filterByYear(data.dailyStake),
            };
        }
    }

    for (const [yr, bucket] of yearBuckets) {
        pipeline.set(`${REDIS_REWARDS_YEAR_PREFIX}${yr}`, bucket);
    }

    // Per-epoch rewards for the history table.
    //
    // This is deliberately NOT gated on `processedEpochs`. That set only holds
    // epochs that passed the per-validator accumulation guard above, which
    // exists to stop daily/yearly totals being counted twice — a different
    // question from "does the table have this epoch". Gating both on it meant a
    // re-fetched epoch could never be repaired: the guard skipped it, the set
    // came back empty, and the whole block was skipped with it. Backfilling a
    // hole here is idempotent, because each epoch is assigned, not added.
    const epochNumbers = Array.from(processedEpochs).sort((a, b) => b - a);
    const fetchedEpochs = Array.from(new Set(events.map((ev) => ev.epoch)));

    if (events.length > 0) {
        // Build per-epoch map: { epoch -> { address -> { fee, pool } } }
        const epochMap: Record<number, Record<string, { fee: number; pool: number }>> = {};
        for (const ev of events) {
            if (!epochMap[ev.epoch]) epochMap[ev.epoch] = {};
            epochMap[ev.epoch][ev.validatorAddress] = { fee: ev.validatorFeeXrd, pool: ev.stakePoolAddedXrd };
        }

        // Read existing epoch rewards and merge.
        //
        // A failed read must not be mistaken for "there was nothing": falling
        // back to {} would rewrite the key with only this run's epochs and wipe
        // every epoch already stored. So a read error aborts the merge instead.
        let existingEpochRewards: Record<string, Record<string, { fee: number; pool: number }>> | null = null;
        let readFailed = false;
        try {
            existingEpochRewards = await redis.get(REDIS_EPOCH_REWARDS);
        } catch (e) {
            readFailed = true;
            logger.error({ err: e }, '[ValidatorRewards] Could not read epoch rewards; skipping epoch-map write to avoid destroying stored epochs');
        }

        if (!readFailed) {
            const merged = existingEpochRewards ?? {};
            for (const [epoch, rewards] of Object.entries(epochMap)) {
                merged[epoch] = rewards;
            }

            // Keep only the retained window (buffer beyond the 6 displayed).
            const sortedKeys = Object.keys(merged)
                .map(Number)
                .sort((a, b) => b - a)
                .slice(0, EPOCH_REWARDS_RETENTION);
            const pruned: Record<string, Record<string, { fee: number; pool: number }>> = {};
            for (const k of sortedKeys) {
                pruned[k.toString()] = merged[k.toString()];
            }

            pipeline.set(REDIS_EPOCH_REWARDS, pruned);
        }
    }

    // Update sync metadata.
    //
    // The high-water mark must never move backwards. `Math.max(...[], 0)` reset
    // it to zero whenever every event was skipped by the accumulation guard,
    // which made the next run treat all of history as new.
    const previousMeta = await getRewardsSyncMeta().catch(() => null);
    const meta: RewardsSyncMeta = {
        lastProcessedEpoch: Math.max(
            ...epochNumbers,
            ...fetchedEpochs,
            previousMeta?.lastProcessedEpoch ?? 0,
        ),
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

import { cacheLife, cacheTag } from 'next/cache';

/**
 * Cached getter for all epoch rewards down from Redis to minimize commands.
 * Cached for 5 minutes (300 seconds).
 */
async function getCachedAllEpochRewards() {
    "use cache";
    cacheLife("minutes");
    cacheTag(EPOCH_REWARDS_CACHE_TAG);

    const redis = getRedis();
    if (!redis) return null;
    try {
        return await redis.get<Record<string, Record<string, { fee: number; pool: number }>>>(REDIS_EPOCH_REWARDS);
    } catch (e) {
        logger.error({ err: e }, '[ValidatorRewards] Failed to read epoch rewards from Redis');
        return null;
    }
}

/**
 * Returns the XRD rewards for the last N epochs for a specific validator.
 * Used by the epoch history table.
 */
export async function getEpochRewardsForTable(
    validatorAddress: string,
): Promise<Record<number, { fee: number; pool: number }>> {
    const data = await getCachedAllEpochRewards();
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
}

/**
 * Returns the list of years that have reward data for a validator.
 */
export async function getAvailableYears(
    validatorAddress: string,
): Promise<string[]> {
    const redis = getRedis();
    if (!redis) return [];

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
                if (data && data[validatorAddress]) return yr;
                return null;
            })
        );

        const years = checks.filter((yr): yr is string => yr !== null);
        if (years.length > 0) {
            return years.sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
        }

        // Fallback to legacy monolithic key
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
): Promise<{ csv: string; totalXrd: number } | null> {
    const redis = getRedis();
    if (!redis) return null;

    try {
        // Try year-indexed key first (efficient)
        const yearData = await redis.get<Record<string, ValidatorRewardData>>(`${REDIS_REWARDS_YEAR_PREFIX}${year}`);
        const yearEntry = yearData?.[validatorAddress];
        if (yearEntry?.daily) {
            const entries = Object.entries(yearEntry.daily)
                .filter(([date]) => date.startsWith(year))
                .sort(([a], [b]) => a.localeCompare(b));

            if (entries.length > 0) {
                const header = '"Type","Buy","Cur.","Sell","Cur.","Fee","Cur.","Exchange","Group","Comment","Date"';
                const rows = entries.map(([date, xrd]) => {
                    const formattedDate = `${date} 00:00:00`;
                    const shortAddr = `${validatorAddress.substring(0, 20)}...`;
                    return `"Staking","${xrd.toFixed(8)}","XRD","","","","","Radix Network","Staking","Daily reward - ${shortAddr}","${formattedDate}"`;
                });
                const totalXrd = entries.reduce((acc, [_, xrd]) => acc + xrd, 0);
                return { csv: [header, ...rows].join('\n'), totalXrd };
            }
        }

        // Fallback to legacy monolithic key
        const allData = await redis.get<Record<string, ValidatorRewardData>>(REDIS_REWARDS_ALL);
        const data = allData?.[validatorAddress];
        if (!data?.daily) return null;

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

        const totalXrd = entries.reduce((acc, [_, xrd]) => acc + xrd, 0);

        return {
            csv: [header, ...rows].join('\n'),
            totalXrd
        };
    } catch (e) {
        logger.error({ err: e }, '[ValidatorRewards] Failed to generate CSV');
        return null;
    }
}

/**
 * Returns the sync metadata (lastProcessedEpoch, lastRunTimestamp).
 */
export async function getRewardsSyncMeta(): Promise<RewardsSyncMeta | null> {
    const redis = getRedis();
    if (!redis) return null;

    try {
        return await redis.get<RewardsSyncMeta>(REDIS_REWARDS_META);
    } catch {
        return null;
    }
}

/**
 * Which epochs currently hold per-epoch reward data.
 *
 * Read straight from Redis rather than through the cached getter: the sync uses
 * this to decide what to repair, and a cached answer would have it repairing
 * epochs it already fixed, or missing ones it just lost.
 */
export async function getStoredEpochRewardEpochs(): Promise<number[]> {
    const redis = getRedis();
    if (!redis) return [];

    try {
        const data = await redis.get<Record<string, unknown>>(REDIS_EPOCH_REWARDS);
        if (!data) return [];
        return Object.keys(data)
            .map(Number)
            .filter(Number.isFinite)
            .sort((a, b) => b - a);
    } catch (e) {
        logger.error({ err: e }, '[ValidatorRewards] Failed to read stored epoch list');
        return [];
    }
}

/**
 * Records that a sync ran, without claiming it processed anything.
 *
 * Most runs of a five-minute cron find nothing new, because epochs also last
 * about five minutes. Those runs returned success and wrote nothing at all, so
 * `lastRunTimestamp` went stale while the job was perfectly healthy — leaving
 * no way to tell a quiet cron from a dead one. This marks the run as alive and
 * leaves the high-water mark untouched.
 */
export async function touchSyncRun(): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    try {
        const previous = await redis.get<RewardsSyncMeta>(REDIS_REWARDS_META);
        await redis.set(REDIS_REWARDS_META, {
            lastProcessedEpoch: previous?.lastProcessedEpoch ?? 0,
            lastRunTimestamp: new Date().toISOString(),
        } satisfies RewardsSyncMeta);
    } catch (e) {
        logger.error({ err: e }, '[ValidatorRewards] Failed to record sync heartbeat');
    }
}
