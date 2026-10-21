import logger from '@/lib/logger';
import { getRedis } from '@/lib/redis';
import { readBlob, writeBlob } from '@/lib/redisBlob';
import { GATEWAY_BASES } from './bases';
import { getValidatorsCached } from './validators';
import type { Network } from './client';

/*
 * The "top LSU positions" ranking: the biggest stake positions on the network,
 * one per account, worth ordered in XRD.
 *
 * Every validator has an LSU of its own and the Gateway lists holders per
 * resource, so the ranking is assembled validator by validator. Done in one go
 * that is ~120 requests (measured on mainnet: 119, a minute) — a burst the
 * public Gateway's ~160/min limit, which the rest of the site shares, cannot
 * afford. So the work is spread out and nothing waits for it:
 *
 *  - It is a SCAN that advances a few validators at a time (`advanceTopLsu`),
 *    its progress kept in one small Redis blob. A step takes a lock that also
 *    spaces steps out, and a 429 postpones the next one by the Gateway's own
 *    Retry-After.
 *  - Readers never touch the Gateway. They get what the blob holds: the last
 *    complete ranking, or — on the very first scan — the partial one so far,
 *    which is already nearly right because validators are visited biggest first.
 *  - A reader that finds the ranking old or the scan unfinished asks for one
 *    more step in the background; the cron ping is the safety net.
 *
 * Fewer requests still: a position can never exceed its validator's total
 * stake, so once the next validator is smaller than the 100th position found the
 * scan is complete — about a third of the validators on mainnet.
 */

/** Distinct accounts the ranking keeps. */
export const TOP_POSITIONS = 100;
/** Holders per request, and how many requests one validator may take (its top 50 holders). */
const HOLDERS_PAGE = 10;
const MAX_PAGES_PER_VALIDATOR = 5;
/** Validators visited per step (about 9 requests, at most 40). */
const VALIDATORS_PER_STEP = 8;
/** Pause between requests inside a step: ~100 a minute at the very most. */
const REQUEST_GAP_MS = 600;
/** Minimum time between steps. */
const STEP_INTERVAL_S = 20;
/** A finished ranking is rebuilt after this long; stakes move slowly. */
const FRESH_MS = 6 * 60 * 60 * 1000;

export interface LsuPosition {
    address: string;
    /** The position's worth in XRD (LSU × its redemption factor). */
    xrd: number;
    validator: string;
    lsu: string;
}

interface ScanState {
    /** How many validators of the queue are done. */
    done: number;
    /** The best position of each account found so far (at most TOP_POSITIONS). */
    best: LsuPosition[];
}

interface RankingState {
    /** The last finished ranking. */
    positions: LsuPosition[];
    updatedAt?: number;
    scan?: ScanState;
}

export interface TopLsu {
    positions: LsuPosition[];
    /** True while only part of the network has been read (first scan). */
    partial: boolean;
}

const stateKey = (network: Network) => `ranking_lsu_${network}`;
const lockKey = (network: Network) => `ranking_lsu_lock_${network}`;

/* ── Storage: Redis, or this instance's memory when there is none (local dev) ── */

const memory = new Map<string, RankingState>();
const memoryLocks = new Map<string, number>();

async function readState(network: Network): Promise<RankingState | null> {
    const redis = getRedis();
    if (!redis) return memory.get(stateKey(network)) ?? null;
    return readBlob<RankingState>(redis, stateKey(network));
}

async function writeState(network: Network, state: RankingState) {
    const redis = getRedis();
    if (!redis) {
        memory.set(stateKey(network), state);
        return;
    }
    await writeBlob(redis, stateKey(network), state);
}

/** True when this caller got the lock; it expires on its own, which is what spaces the steps out. */
async function takeLock(network: Network, seconds: number): Promise<boolean> {
    const redis = getRedis();
    if (!redis) {
        const until = memoryLocks.get(lockKey(network)) ?? 0;
        if (until > Date.now()) return false;
        memoryLocks.set(lockKey(network), Date.now() + seconds * 1000);
        return true;
    }
    return (await redis.set(lockKey(network), '1', { nx: true, ex: seconds })) === 'OK';
}

/** Pushes the next step back, e.g. after the Gateway asked to slow down. */
async function extendLock(network: Network, seconds: number) {
    const redis = getRedis();
    if (!redis) {
        memoryLocks.set(lockKey(network), Date.now() + seconds * 1000);
        return;
    }
    await redis.set(lockKey(network), '1', { ex: seconds });
}

/* ── Reading ── */

const needsWork = (state: RankingState | null, now = Date.now()) =>
    !state || !!state.scan || !state.updatedAt || now - state.updatedAt > FRESH_MS;

/** What to show now, and whether a further step should be asked for. Never calls the Gateway. */
export async function readTopLsu(network: Network): Promise<TopLsu & { wantsStep: boolean }> {
    const state = await readState(network);
    const wantsStep = needsWork(state);
    if (state?.updatedAt) return { positions: state.positions, partial: false, wantsStep };
    const partial = [...(state?.scan?.best ?? [])].toSorted((a, b) => b.xrd - a.xrd);
    return { positions: partial, partial: true, wantsStep };
}

/* ── Scanning ── */

class RateLimited extends Error {
    constructor(readonly retryAfter: number) {
        super('rate limited');
    }
}

interface HoldersPage {
    items?: { holder_address: string; amount: string }[];
    next_cursor?: string | null;
}

async function holdersPage(network: Network, resource: string, cursor?: string): Promise<HoldersPage> {
    const res = await fetch(`${GATEWAY_BASES[network]}/extensions/resource-holders/page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource_address: resource, limit_per_page: HOLDERS_PAGE, cursor }),
        cache: 'no-store',
    });
    if (res.status === 429) {
        const retryAfter = Number(res.headers.get('retry-after'));
        throw new RateLimited(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 30);
    }
    if (!res.ok) throw new Error(`Gateway ${res.status}`);
    return res.json() as Promise<HoldersPage>;
}

const topOf = (best: Map<string, LsuPosition>) =>
    [...best.values()].toSorted((a, b) => b.xrd - a.xrd).slice(0, TOP_POSITIONS);

/**
 * Advances the scan by a few validators — or starts a new one when the ranking
 * is old. Safe to call from anywhere, any number of times: at most one step runs
 * per interval, and a fresh ranking costs one Redis read.
 */
export async function advanceTopLsu(network: Network): Promise<'fresh' | 'busy' | 'advanced' | 'finished' | 'rate-limited' | 'failed'> {
    const before = await readState(network);
    if (!needsWork(before)) return 'fresh';
    if (!(await takeLock(network, STEP_INTERVAL_S))) return 'busy';

    try {
        const { validators } = await getValidatorsCached(network);
        const queue = validators
            .filter(v => v.lsuResource && v.lsu2xrdFactor > 0 && v.totalStakeXRD > 0)
            .toSorted((a, b) => b.totalStakeXRD - a.totalStakeXRD || a.address.localeCompare(b.address));

        const scan = before?.scan ?? { done: 0, best: [] };
        const best = new Map(scan.best.map(p => [p.address, p]));
        const bar = () =>
            best.size < TOP_POSITIONS ? 0 : topOf(best)[TOP_POSITIONS - 1].xrd;
        let done = scan.done;
        let limited: RateLimited | null = null;

        const visit = async (v: (typeof queue)[number]) => {
            let cursor: string | undefined;
            for (let page = 0; page < MAX_PAGES_PER_VALIDATOR; page++) {
                if (page > 0) await new Promise(r => setTimeout(r, REQUEST_GAP_MS));
                const data = await holdersPage(network, v.lsuResource, cursor);
                const items = data.items ?? [];
                for (const item of items) {
                    if (!item.holder_address.startsWith('account_')) continue;
                    const xrd = parseFloat(item.amount) * v.lsu2xrdFactor;
                    const kept = best.get(item.holder_address);
                    if (!kept || xrd > kept.xrd) {
                        best.set(item.holder_address, { address: item.holder_address, xrd, validator: v.address, lsu: item.amount });
                    }
                }
                const last = items.at(-1);
                if (!data.next_cursor || !last || parseFloat(last.amount) * v.lsu2xrdFactor < bar()) return;
                cursor = data.next_cursor;
            }
        };

        let finished = false;
        try {
            for (let n = 0; n < VALIDATORS_PER_STEP; n++) {
                if (done >= queue.length || queue[done].totalStakeXRD <= bar()) {
                    finished = true;
                    break;
                }
                if (n > 0) await new Promise(r => setTimeout(r, REQUEST_GAP_MS));
                await visit(queue[done]);
                done++;
            }
            if (!finished && (done >= queue.length || queue[done].totalStakeXRD <= bar())) finished = true;
        } catch (err) {
            if (!(err instanceof RateLimited)) throw err;
            limited = err;
        }

        const kept = topOf(best);
        if (finished) {
            await writeState(network, { positions: kept, updatedAt: Date.now() });
            logger.info({ network, validators: queue.length, visited: done, positions: kept.length }, '[Rankings] LSU ranking complete');
            return 'finished';
        }

        // Progress is saved even when interrupted, keeping the last finished ranking meanwhile.
        await writeState(network, { positions: before?.positions ?? [], updatedAt: before?.updatedAt, scan: { done, best: kept } });
        if (limited) {
            await extendLock(network, limited.retryAfter + 5);
            logger.warn({ network, retryAfter: limited.retryAfter }, '[Rankings] Gateway asked to slow down; next step postponed');
            return 'rate-limited';
        }
        return 'advanced';
    } catch (err) {
        logger.error({ err, network }, '[Rankings] LSU scan step failed');
        return 'failed';
    }
}
