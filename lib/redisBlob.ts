/**
 * lib/redisBlob.ts
 *
 * Large cached values in Upstash, read without paying for them every time.
 *
 * Upstash bills every byte that crosses its REST API, and the free plan stops
 * the whole database at 10 GB a month. The validator list alone is over 600 KB,
 * and it used to be downloaded in full by every page, API call and cron that
 * needed it — some hundreds of reads a day are enough to run out.
 *
 * So a large value is stored next to a stamp of a few bytes that changes on
 * every write. A reader first asks for the stamp; when it matches the copy
 * this instance already holds in memory, that copy is the answer and the large
 * value is not downloaded. The value itself is stored gzip-compressed, which
 * makes each write and each real download about a fifth of the size.
 *
 * Values written before this existed (plain JSON, no stamp) are still read, and
 * the first read gives them a stamp so later reads take the cheap path.
 */

import { gunzipSync, gzipSync } from 'node:zlib';
import type { Redis } from '@upstash/redis';

const GZIP_PREFIX = 'gz:';

/** The copy of each value this instance holds, with the stamp it was read at. */
const held = new Map<string, { stamp: string; value: unknown }>();

function stampKey(key: string) {
    return `${key}:stamp`;
}

function newStamp() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function encodeBlob(value: unknown): string {
    return GZIP_PREFIX + gzipSync(JSON.stringify(value)).toString('base64');
}

/** A stored value back as data; plain JSON values from before compression pass through. */
export function decodeBlob<T>(stored: unknown): T | null {
    if (stored === null || stored === undefined) return null;
    if (typeof stored === 'string' && stored.startsWith(GZIP_PREFIX)) {
        return JSON.parse(gunzipSync(Buffer.from(stored.slice(GZIP_PREFIX.length), 'base64')).toString('utf8')) as T;
    }
    return stored as T;
}

/**
 * The value under `key`, downloaded only when it changed since this instance
 * last read it. Errors are thrown to the caller, as a plain `get` would.
 */
export async function readBlob<T>(redis: Redis, key: string): Promise<T | null> {
    const stamp = await redis.get<string>(stampKey(key));
    const mine = held.get(key);
    if (stamp && mine?.stamp === stamp) return mine.value as T;

    const value = decodeBlob<T>(await redis.get(key));
    if (value === null) {
        held.delete(key);
        return null;
    }

    if (stamp) {
        held.set(key, { stamp, value });
    } else {
        // Written before stamps existed: stamp it once, so the next read is cheap.
        const given = newStamp();
        await redis.set(stampKey(key), given);
        held.set(key, { stamp: given, value });
    }
    return value;
}

/** Stores `value` under `key`, compressed, with a fresh stamp. */
export async function writeBlob(redis: Redis, key: string, value: unknown): Promise<void> {
    const stamp = newStamp();
    const pipeline = redis.pipeline();
    pipeline.set(key, encodeBlob(value));
    pipeline.set(stampKey(key), stamp);
    await pipeline.exec();
    held.set(key, { stamp, value });
}

/**
 * Queues the write of `value` under `key`, compressed and with a fresh stamp,
 * on a pipeline the caller executes along with its other writes.
 */
export function queueBlobWrite(pipeline: ReturnType<Redis['pipeline']>, key: string, value: unknown): void {
    pipeline.set(key, encodeBlob(value));
    pipeline.set(stampKey(key), newStamp());
}

/** Forgets what this instance holds; for tests. */
export function forgetHeldBlobs() {
    held.clear();
}
