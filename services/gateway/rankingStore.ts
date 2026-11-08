import { getRedis } from '@/lib/redis';
import { readBlob, writeBlob, SHOWN_VALUE_MAX_AGE_MS } from '@/lib/redisBlob';
import type { Network } from './client';

/*
 * Where a ranking that is built in the background keeps its progress, shared by
 * every such ranking: one small Redis blob per network, and a lock whose expiry
 * is what spaces the steps out. Without Redis (local development) the same
 * thing is held in this instance's memory.
 */

/** The Gateway answered 429; `retryAfter` is the number of seconds it asked for. */
export class RateLimited extends Error {
    constructor(readonly retryAfter: number) {
        super('rate limited');
    }
}

/** Throws RateLimited for a 429, using the Gateway's own Retry-After. */
export function assertNotRateLimited(res: Response) {
    if (res.status !== 429) return;
    const retryAfter = Number(res.headers.get('retry-after'));
    throw new RateLimited(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 30);
}

/** `name` ends up in the Redis keys: `ranking_<name>_<network>` and `ranking_<name>_lock_<network>`. */
export function createScanStore<S>(name: string) {
    const stateKey = (network: Network) => `ranking_${name}_${network}`;
    const lockKey = (network: Network) => `ranking_${name}_lock_${network}`;
    const memory = new Map<string, S>();
    const memoryLocks = new Map<string, number>();
    const tried = new Map<Network, number>();

    return {
        async read(network: Network): Promise<S | null> {
            const redis = getRedis();
            if (!redis) return memory.get(stateKey(network)) ?? null;
            return readBlob<S>(redis, stateKey(network));
        },

        /**
         * The state for showing it: this instance answers from what it read in
         * the last few seconds, so a page view costs Redis nothing most of the
         * time. A step must use `read`, which always asks Redis.
         */
        async readShown(network: Network): Promise<S | null> {
            const redis = getRedis();
            if (!redis) return memory.get(stateKey(network)) ?? null;
            return readBlob<S>(redis, stateKey(network), { maxAgeMs: SHOWN_VALUE_MAX_AGE_MS });
        },

        /**
         * Whether this instance should try a step now: at most once per
         * `seconds`, decided in memory, so readers asking for steps on every
         * view do not each pay a Redis read and a lock attempt.
         */
        shouldTry(network: Network, seconds: number): boolean {
            const now = Date.now();
            if ((tried.get(network) ?? 0) > now) return false;
            tried.set(network, now + seconds * 1000);
            return true;
        },

        async write(network: Network, state: S) {
            const redis = getRedis();
            if (!redis) {
                memory.set(stateKey(network), state);
                return;
            }
            await writeBlob(redis, stateKey(network), state);
        },

        /** True when this caller got the lock; it expires on its own, which is what spaces the steps out. */
        async takeLock(network: Network, seconds: number): Promise<boolean> {
            const redis = getRedis();
            if (!redis) {
                const until = memoryLocks.get(lockKey(network)) ?? 0;
                if (until > Date.now()) return false;
                memoryLocks.set(lockKey(network), Date.now() + seconds * 1000);
                return true;
            }
            return (await redis.set(lockKey(network), '1', { nx: true, ex: seconds })) === 'OK';
        },

        /** Pushes the next step back, e.g. after the Gateway asked to slow down. */
        async extendLock(network: Network, seconds: number) {
            const redis = getRedis();
            if (!redis) {
                memoryLocks.set(lockKey(network), Date.now() + seconds * 1000);
                return;
            }
            await redis.set(lockKey(network), '1', { ex: seconds });
        },
    };
}
