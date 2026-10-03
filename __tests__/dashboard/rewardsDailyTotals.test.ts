/**
 * The rewards sync writes only what changed.
 *
 * Rewriting the all-years key (5.8 MB) and every year's key on each five-minute
 * run is what exhausted the Redis monthly bandwidth. A run now touches the
 * current year's key alone, and only when the caller hands it daily events.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeBlob, forgetHeldBlobs } from '@/lib/redisBlob';

const store = new Map<string, unknown>();
const written: string[] = [];

const fakeRedis = {
    async get(key: string) {
        return store.has(key) ? store.get(key) : null;
    },
    async set(key: string, value: unknown) {
        store.set(key, value);
        written.push(key);
        return 'OK';
    },
    async eval(_script: string, keys: string[], args: string[]) {
        if (store.has(keys[1])) return 0;
        if (args[1] !== '') store.set(keys[0], args[1]);
        store.set(keys[1], args[0]);
        return 1;
    },
    pipeline() {
        const ops: Array<() => void> = [];
        return {
            set(key: string, value: unknown) {
                ops.push(() => {
                    store.set(key, value);
                    written.push(key);
                });
            },
            del(...keys: string[]) {
                ops.push(() => keys.forEach((key) => store.delete(key)));
            },
            async exec() {
                ops.forEach((op) => op());
            },
        };
    },
};

vi.mock('@/lib/redis', () => ({ getRedis: () => fakeRedis }));

const { syncRewardsToRedis } = await import('@/services/validatorRewards');

const year = new Date().getFullYear().toString();
const lastYear = (Number(year) - 1).toString();
const today = new Date().toISOString().split('T')[0];

function event(epoch: number, validatorAddress = 'validator_rdx1a') {
    return {
        epoch,
        validatorAddress,
        stakePoolAddedXrd: 10,
        validatorFeeXrd: 1,
        totalRewardXrd: 11,
        proposalsMade: 1,
        proposalsMissed: 0,
        totalStakeXrd: 1000,
    };
}

type YearBucket = Record<string, { lastSyncedEpoch: number; daily: Record<string, number> }>;
const bucket = (key: string) => decodeBlob<YearBucket>(store.get(key));

describe('rewards daily totals', () => {
    beforeEach(() => {
        store.clear();
        written.length = 0;
        forgetHeldBlobs();
    });

    it('writes the current year only, never the all-years key or past years', async () => {
        store.set('validator_rewards_all', { untouched: true });
        store.set(`validator_rewards_${lastYear}`, { untouched: true });

        await syncRewardsToRedis([event(100)], 0);

        expect(written).toContain(`validator_rewards_${year}`);
        expect(written).not.toContain('validator_rewards_all');
        expect(written).not.toContain(`validator_rewards_${lastYear}`);
        expect(bucket(`validator_rewards_${year}`)?.['validator_rdx1a'].daily[today]).toBe(1);
    });

    it('fills the epoch table but leaves the totals alone when they are not due', async () => {
        await syncRewardsToRedis([event(100)], 0, null);

        expect(written).toContain('validator_epoch_rewards');
        expect(written).not.toContain(`validator_rewards_${year}`);
    });

    it('does not count an epoch twice when a later run fetches it again', async () => {
        await syncRewardsToRedis([event(100)], 0);
        forgetHeldBlobs();
        await syncRewardsToRedis([event(100), event(101)], 0);

        expect(bucket(`validator_rewards_${year}`)?.['validator_rdx1a'].daily[today]).toBe(2);
    });

    it('carries a validator over from last year without recounting its epochs', async () => {
        store.set(`validator_rewards_${lastYear}`, {
            validator_rdx1a: { lastSyncedEpoch: 100, daily: {}, yearly: {} },
        });

        await syncRewardsToRedis([event(100), event(101)], 0);

        const mine = bucket(`validator_rewards_${year}`)?.['validator_rdx1a'];
        expect(mine?.lastSyncedEpoch).toBe(101);
        expect(mine?.daily[today]).toBe(1);
    });
});
