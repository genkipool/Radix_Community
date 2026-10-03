import { beforeEach, describe, expect, it } from 'vitest';
import type { Redis } from '@upstash/redis';
import { decodeBlob, encodeBlob, forgetHeldBlobs, readBlob, writeBlob } from '@/lib/redisBlob';

/** An in-memory Redis that records every key read, the way Upstash bills them. */
function fakeRedis() {
    const store = new Map<string, unknown>();
    const reads: string[] = [];
    const redis = {
        async get(key: string) {
            reads.push(key);
            return store.has(key) ? store.get(key) : null;
        },
        async set(key: string, value: unknown) {
            store.set(key, value);
            return 'OK';
        },
        pipeline() {
            const queued: Array<[string, unknown]> = [];
            return {
                set(key: string, value: unknown) {
                    queued.push([key, value]);
                },
                async exec() {
                    for (const [key, value] of queued) store.set(key, value);
                },
            };
        },
    };
    return { redis: redis as unknown as Redis, store, reads };
}

describe('redisBlob', () => {
    beforeEach(() => forgetHeldBlobs());

    it('round-trips a value through compression', () => {
        const value = { validators: [{ address: 'validator_rdx1', stake: 12.5 }], updatedAt: 1 };
        const stored = encodeBlob(value);
        expect(stored.startsWith('gz:')).toBe(true);
        expect(decodeBlob(stored)).toEqual(value);
    });

    it('reads values stored before compression as they are', () => {
        expect(decodeBlob({ plain: true })).toEqual({ plain: true });
        expect(decodeBlob(null)).toBeNull();
    });

    it('downloads a large value only when its stamp changed', async () => {
        const { redis, reads } = fakeRedis();
        await writeBlob(redis, 'big', { n: 1 });
        forgetHeldBlobs(); // another instance

        expect(await readBlob(redis, 'big')).toEqual({ n: 1 });
        expect(await readBlob(redis, 'big')).toEqual({ n: 1 });
        expect(reads.filter((key) => key === 'big')).toHaveLength(1);

        await writeBlob(redis, 'big', { n: 2 });
        forgetHeldBlobs();
        expect(await readBlob(redis, 'big')).toEqual({ n: 2 });
        expect(reads.filter((key) => key === 'big')).toHaveLength(2);
    });

    it('stamps a value written before stamps existed, so the next read is cheap', async () => {
        const { redis, store, reads } = fakeRedis();
        store.set('old', { legacy: true });

        expect(await readBlob(redis, 'old')).toEqual({ legacy: true });
        expect(store.get('old:stamp')).toBeTruthy();
        expect(await readBlob(redis, 'old')).toEqual({ legacy: true });
        expect(reads.filter((key) => key === 'old')).toHaveLength(1);
    });

    it('answers null for a missing value', async () => {
        const { redis } = fakeRedis();
        expect(await readBlob(redis, 'nothing')).toBeNull();
    });
});
