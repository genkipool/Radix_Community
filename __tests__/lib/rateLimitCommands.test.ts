import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Upstash bills every command: a request should cost one, the first of a window two. */
const sent: string[] = [];
const counters = new Map<string, number>();
const redis = {
    async incrby(key: string, by: number) {
        sent.push('incrby');
        const next = (counters.get(key) ?? 0) + by;
        counters.set(key, next);
        return next;
    },
    async pexpire() {
        sent.push('pexpire');
        return 1;
    },
};
vi.mock('@/lib/redis', () => ({ getRedis: () => redis }));

describe('rateLimit and Redis commands', () => {
    beforeEach(() => {
        sent.length = 0;
        counters.clear();
    });

    it('sets the expiry only on the first hit of a window and still counts every hit', async () => {
        const { rateLimit, RATE_LIMITS } = await import('@/lib/rateLimit');
        const now = 1_800_000_000_000;
        const policy = RATE_LIMITS.contact; // 5 per hour

        const results = [];
        for (let i = 0; i < 6; i++) results.push(await rateLimit(policy, '203.0.113.7', 1, now + i));

        expect(sent.filter((c) => c === 'pexpire')).toHaveLength(1);
        expect(sent.filter((c) => c === 'incrby')).toHaveLength(6);
        expect(results.slice(0, 5).every((r) => r.allowed)).toBe(true);
        expect(results[5].allowed).toBe(false);
    });
});
