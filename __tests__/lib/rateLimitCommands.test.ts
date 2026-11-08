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
    beforeEach(async () => {
        sent.length = 0;
        counters.clear();
        (await import('@/lib/rateLimit'))._resetRateLimit();
    });

    it('sets the expiry only on the first hit of a window and turns away an excess hit without Redis', async () => {
        const { rateLimit, RATE_LIMITS } = await import('@/lib/rateLimit');
        const now = 1_800_000_000_000;
        const policy = RATE_LIMITS.contact; // 5 per hour

        const results = [];
        for (let i = 0; i < 6; i++) results.push(await rateLimit(policy, '203.0.113.7', 1, now + i));

        expect(sent.filter((c) => c === 'pexpire')).toHaveLength(1);
        // The sixth is already over the limit on this instance: no command for it.
        expect(sent.filter((c) => c === 'incrby')).toHaveLength(5);
        expect(results.slice(0, 5).every((r) => r.allowed)).toBe(true);
        expect(results[5].allowed).toBe(false);
    });

    it('spends no Redis command on a flood that is over the limit', async () => {
        const { rateLimit, RATE_LIMITS } = await import('@/lib/rateLimit');
        const now = 1_800_000_000_000;
        for (let i = 0; i < 1_000; i++) await rateLimit(RATE_LIMITS.contact, '203.0.113.8', 1, now + i);
        expect(sent.filter((c) => c === 'incrby')).toHaveLength(5);
    });

    it('caps what one instance spends on counting, however many addresses ask', async () => {
        const { rateLimit, RATE_LIMITS } = await import('@/lib/rateLimit');
        const now = 1_800_000_000_000 - (1_800_000_000_000 % 60_000);
        const results = [];
        for (let i = 0; i < 1_000; i++) results.push(await rateLimit(RATE_LIMITS.contact, `198.51.100.${i % 250}.${i}`, 1, now + i));
        expect(sent.filter((c) => c === 'incrby').length).toBeLessThanOrEqual(300);
        // Past the budget it still counts, in memory: a new address is allowed once.
        expect(results.at(-1)?.allowed).toBe(true);
    });

    it('keeps a separate counting budget per policy, so one busy policy never starves another', async () => {
        const { rateLimit, RATE_LIMITS } = await import('@/lib/rateLimit');
        const now = 1_800_000_000_000 - (1_800_000_000_000 % 60_000);
        for (let i = 0; i < 400; i++) await rateLimit(RATE_LIMITS.mcp, `198.51.100.${i}`, 1, now + i);
        const before = sent.filter((c) => c === 'incrby').length;
        await rateLimit(RATE_LIMITS.auth, '203.0.113.9', 1, now + 500);
        expect(sent.filter((c) => c === 'incrby').length).toBe(before + 1);
    });

    it('keeps counting a caller over the limit while many new addresses arrive', async () => {
        const { rateLimit, RATE_LIMITS } = await import('@/lib/rateLimit');
        const now = 1_800_000_000_000 - (1_800_000_000_000 % 60_000);
        for (let i = 0; i < 6; i++) await rateLimit(RATE_LIMITS.contact, '203.0.113.10', 1, now + i);
        for (let i = 0; i < 10_500; i++) await rateLimit(RATE_LIMITS.engine, `10.0.${i >> 8}.${i & 255}`, 1, now + 10);
        const again = await rateLimit(RATE_LIMITS.contact, '203.0.113.10', 1, now + 20);
        expect(again.allowed).toBe(false);
    });
});
