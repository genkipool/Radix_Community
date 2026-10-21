import logger from '@/lib/logger';
import { getRedis } from '@/lib/redis';
import { readBlob, writeBlob } from '@/lib/redisBlob';
import { gatewayPost } from './bases';
import { getValidatorsCached } from './validators';
import type { Network } from './client';

/*
 * How much XRD the network has waiting to be withdrawn from staking.
 *
 * Every validator keeps the XRD of unstakes in a vault of its own
 * (`pending_xrd_withdraw_vault`): what is still in the unlocking period plus
 * what has unlocked and not been claimed yet. Adding those vaults up answers
 * "how much is leaving staking" exactly, without crawling a single claim NFT.
 *
 * That total is NOT the coming wave, though: on mainnet most of it is XRD that
 * unlocked long ago and was never claimed. What is still locked is exactly what
 * was unstaked in the last 2,016 epochs (7 days), since the delay is the same
 * for every unstake. That is read from the per-validator stake history the
 * `sync-stake-history` cron already keeps in Redis, so it costs the Gateway
 * nothing — only a Redis read, every few hours, summed into a small daily series.
 *
 * The vaults cost the Gateway ~15 requests of 20 addresses per refresh (their
 * addresses never change, so they are found once and kept), and a refresh is
 * done at most every 15 minutes, by whoever asks first. Readers only ever get
 * what Redis holds. A sample is kept per hour for a week so the panel can say
 * whether the figures are growing or shrinking.
 */

const BATCH = 20;
/** Pause between requests; the Gateway allows ~160 a minute and the whole site shares it. */
const REQUEST_GAP_MS = 500;
const REFRESH_AFTER_MS = 15 * 60 * 1000;
const LOCK_SECONDS = 60;
const SAMPLE_EVERY_MS = 60 * 60 * 1000;
const KEEP_SAMPLES = 24 * 7 + 1;
/** The history is summed again after this long; reading it is what costs Redis bandwidth. */
const HISTORY_EVERY_MS = 3 * 60 * 60 * 1000;
const KEEP_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
/** The unlock delay is 2,016 epochs of ~5 minutes: exactly 7 days. */
const UNLOCK_DAYS = 7;

/** [time in ms, XRD in the vaults, XRD still locked or null when unknown] */
export type PendingSample = [number, number, number | null];

/** The whole network's activity on one UTC day, in XRD (unstake: LSU burned at today's redemption rate). */
export interface DayFlow {
    date: string;
    stake: number;
    unstake: number;
    claim: number;
}

interface UnstakingState {
    /** Validator address → address of its pending-withdraw vault. Never changes. */
    vaults: Record<string, string>;
    /** XRD waiting to be withdrawn, across every validator whose vault could be read. */
    pending: number;
    /** Validators counted in `pending`. */
    validators: number;
    updatedAt?: number;
    samples: PendingSample[];
    /** The last days of network-wide stake / unstake / claim, from the stake history. */
    days: DayFlow[];
    historyAt?: number;
}

export interface NetworkUnstaking {
    /** XRD in the validators' pending-withdraw vaults: locked, plus unlocked and unclaimed. */
    pending: number;
    /** Of it, the part still in the unlocking period (an estimate); null when the history is not there. */
    unbonding: number | null;
    validators: number;
    updatedAt: number | null;
    samples: PendingSample[];
    days: DayFlow[];
}

const stateKey = (network: Network) => `network_unstaking_${network}`;
const lockKey = (network: Network) => `network_unstaking_lock_${network}`;

const memory = new Map<string, UnstakingState>();
const memoryLocks = new Map<string, number>();

const emptyState = (): UnstakingState => ({ vaults: {}, pending: 0, validators: 0, samples: [], days: [] });

async function readState(network: Network): Promise<UnstakingState | null> {
    const redis = getRedis();
    if (!redis) return memory.get(stateKey(network)) ?? null;
    return readBlob<UnstakingState>(redis, stateKey(network));
}

async function writeState(network: Network, state: UnstakingState) {
    const redis = getRedis();
    if (!redis) {
        memory.set(stateKey(network), state);
        return;
    }
    await writeBlob(redis, stateKey(network), state);
}

async function takeLock(network: Network, seconds: number): Promise<boolean> {
    const redis = getRedis();
    if (!redis) {
        if ((memoryLocks.get(lockKey(network)) ?? 0) > Date.now()) return false;
        memoryLocks.set(lockKey(network), Date.now() + seconds * 1000);
        return true;
    }
    return (await redis.set(lockKey(network), '1', { nx: true, ex: seconds })) === 'OK';
}

async function extendLock(network: Network, seconds: number) {
    const redis = getRedis();
    if (!redis) {
        memoryLocks.set(lockKey(network), Date.now() + seconds * 1000);
        return;
    }
    await redis.set(lockKey(network), '1', { ex: seconds });
}

const isStale = (state: UnstakingState | null, now = Date.now()) =>
    !state?.updatedAt || now - state.updatedAt > REFRESH_AFTER_MS;

/** What Redis holds, and whether a refresh should be asked for. Never calls the Gateway. */
export async function readNetworkUnstaking(network: Network): Promise<NetworkUnstaking & { wantsRefresh: boolean }> {
    const state = await readState(network);
    const days = state?.days ?? [];
    return {
        pending: state?.pending ?? 0,
        unbonding: days.length > 0 ? unbondingFrom(days, state?.historyAt ?? Date.now()) : null,
        validators: state?.validators ?? 0,
        updatedAt: state?.updatedAt ?? null,
        samples: state?.samples ?? [],
        days,
        wantsRefresh: isStale(state),
    };
}

/**
 * XRD unstaked in the last 7 days — all of it still in the unlocking period,
 * since every unstake waits the same 7 days. Whole UTC days are summed, plus the
 * share of the day 7 days ago that has not yet passed (activity is assumed even
 * through a day), so the window is 7 days and not "7 calendar days".
 */
export function unbondingFrom(days: DayFlow[], at: number): number {
    const byDate = new Map(days.map(d => [d.date, d.unstake]));
    const dayStart = Math.floor(at / DAY_MS) * DAY_MS;
    const dateOf = (offset: number) => new Date(dayStart - offset * DAY_MS).toISOString().slice(0, 10);
    let total = 0;
    for (let offset = 0; offset < UNLOCK_DAYS; offset++) total += byDate.get(dateOf(offset)) ?? 0;
    const elapsed = (at - dayStart) / DAY_MS;
    return total + (1 - elapsed) * (byDate.get(dateOf(UNLOCK_DAYS)) ?? 0);
}

interface StakeHistoryRecord {
    data?: { date: string; stake: number; unstake: number; claim: number }[];
}

/**
 * The network's daily flow, summed from the per-validator history the
 * stake-history cron keeps. Needs no Gateway: one read of that hash. The
 * history counts unstakes in LSU, so each validator's is converted at its
 * current redemption rate. Null when the history is not there (no Redis, or the
 * cron has not run).
 */
async function sumStakeHistory(network: Network, rates: Map<string, number>): Promise<DayFlow[] | null> {
    const redis = getRedis();
    if (!redis) return null;
    const hash = await redis.hgetall<Record<string, StakeHistoryRecord | string>>(`stake_history_map_${network}`);
    if (!hash || Object.keys(hash).length === 0) return null;

    const byDate = new Map<string, DayFlow>();
    for (const [validator, raw] of Object.entries(hash)) {
        let record: StakeHistoryRecord | null = null;
        try {
            record = typeof raw === 'string' ? (JSON.parse(raw) as StakeHistoryRecord | unknown[]) as StakeHistoryRecord : raw;
            if (Array.isArray(record)) record = { data: record };
        } catch {
            continue;
        }
        const rate = rates.get(validator) ?? 1;
        for (const day of record?.data ?? []) {
            const total = byDate.get(day.date) ?? { date: day.date, stake: 0, unstake: 0, claim: 0 };
            total.stake += day.stake || 0;
            total.unstake += (day.unstake || 0) * rate;
            total.claim += day.claim || 0;
            byDate.set(day.date, total);
        }
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-KEEP_DAYS);
}

interface EntityItem {
    address: string;
    details?: {
        state?: { pending_xrd_withdraw_vault?: { entity_address?: string } };
        balance?: { amount?: string };
    };
}

const chunks = <T,>(items: T[], size: number) =>
    Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

async function entityDetails(network: Network, addresses: string[]): Promise<EntityItem[]> {
    const data = await gatewayPost<{ items?: EntityItem[] }>(network, '/state/entity/details', { addresses });
    return data.items ?? [];
}

/**
 * Refreshes the figure when it is older than 15 minutes. Safe to call from
 * anywhere, any number of times: one refresh runs at a time (a lock), a fresh
 * figure costs one Redis read, and a Gateway 429 postpones the next try by the
 * Gateway's own Retry-After while the last figure keeps being served.
 */
export async function refreshNetworkUnstaking(network: Network): Promise<'fresh' | 'busy' | 'refreshed' | 'rate-limited' | 'failed'> {
    const before = await readState(network);
    if (!isStale(before)) return 'fresh';
    if (!(await takeLock(network, LOCK_SECONDS))) return 'busy';

    const state = before ?? emptyState();
    const pause = () => new Promise(resolve => setTimeout(resolve, REQUEST_GAP_MS));

    try {
        const { validators } = await getValidatorsCached(network);
        const addresses = validators.map(v => v.address);

        // 1. Vault addresses of validators not seen before (once per validator, ever).
        const unknown = addresses.filter(address => !state.vaults[address]);
        for (const [i, batch] of chunks(unknown, BATCH).entries()) {
            if (i > 0) await pause();
            for (const item of await entityDetails(network, batch)) {
                const vault = item.details?.state?.pending_xrd_withdraw_vault?.entity_address;
                if (vault) state.vaults[item.address] = vault;
            }
        }

        // 2. Their balances. The figure is only replaced when every vault was read,
        //    so a partial read can never look like XRD leaving the queue.
        const vaultByAddress = new Map(Object.entries(state.vaults).filter(([validator]) => addresses.includes(validator)));
        let pending = 0;
        for (const [i, batch] of chunks([...vaultByAddress.values()], BATCH).entries()) {
            if (i > 0 || unknown.length > 0) await pause();
            for (const item of await entityDetails(network, batch)) {
                pending += parseFloat(item.details?.balance?.amount ?? '0') || 0;
            }
        }

        const now = Date.now();

        // 3. The daily flow, from the stake history already in Redis (no Gateway).
        let { days, historyAt } = state;
        if (!historyAt || now - historyAt > HISTORY_EVERY_MS) {
            try {
                const summed = await sumStakeHistory(network, new Map(validators.map(v => [v.address, v.lsu2xrdFactor || 1])));
                if (summed) {
                    days = summed;
                    historyAt = now;
                }
            } catch (err) {
                logger.warn({ err, network }, '[NetworkUnstaking] Could not read the stake history');
            }
        }
        const unbonding = days.length > 0 ? unbondingFrom(days, historyAt ?? now) : null;

        const sample: PendingSample = [now, pending, unbonding];
        const last = state.samples.at(-1);
        const samples = !last || now - last[0] >= SAMPLE_EVERY_MS
            ? [...state.samples, sample].slice(-KEEP_SAMPLES)
            : [...state.samples.slice(0, -1), [last[0], ...sample.slice(1)] as PendingSample];

        await writeState(network, { vaults: state.vaults, pending, validators: vaultByAddress.size, updatedAt: now, samples, days, historyAt });
        logger.info({ network, validators: vaultByAddress.size, pending, unbonding }, '[NetworkUnstaking] Refreshed');
        return 'refreshed';
    } catch (err) {
        const status = (err as { status?: number }).status;
        // Whatever vault addresses were found are kept for the next try.
        await writeState(network, state).catch(() => undefined);
        if (status === 429) {
            const retryAfter = Number((err as { headers?: Record<string, string> }).headers?.['retry-after']);
            await extendLock(network, (Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 30) + 5);
            logger.warn({ network, retryAfter }, '[NetworkUnstaking] Gateway asked to slow down');
            return 'rate-limited';
        }
        logger.error({ err, network }, '[NetworkUnstaking] Refresh failed');
        return 'failed';
    }
}
