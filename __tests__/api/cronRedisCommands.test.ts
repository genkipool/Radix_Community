import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Upstash bills every command, including each one inside a pipeline. The two
 * queue crons used to send one per validator on every run (about a hundred);
 * these tests hold them to a handful, however many validators there are.
 */

const VALIDATORS = 120;
const validators = Array.from({ length: VALIDATORS }, (_, i) => ({
    address: `validator_rdx1v${i}`,
    lsuResource: `resource_rdx1lsu${i}`,
    status: 'active',
}));
vi.mock('@/services/gateway/validators', () => ({ getValidatorsCached: vi.fn(async () => ({ validators })) }));
vi.mock('@/services/gateway/transactions', () => ({
    fetchStakeHistoryIncremental: vi.fn(async () => ({ data: [], lastSyncedDate: '2026-11-01', lastSyncedAt: 1 })),
}));

/** Counts every command, sent alone or in a pipeline. */
const sent: string[] = [];
const zaddArgs: unknown[][] = [];
function fakeRedis() {
    const record = (name: string) => (...args: unknown[]) => {
        sent.push(name);
        if (name === 'zadd') zaddArgs.push(args);
        return name === 'zrange' ? Promise.resolve(validators.slice(0, 10).map((v) => v.lsuResource)) : Promise.resolve(null);
    };
    const pipeline = () => {
        const p: Record<string, unknown> = {};
        for (const name of ['zadd', 'hmset']) p[name] = (...args: unknown[]) => { record(name)(...args); return p; };
        p.exec = async () => [];
        return p;
    };
    return { zadd: record('zadd'), zscore: record('zscore'), zrange: record('zrange'), hmget: record('hmget'), pipeline };
}
let redis = fakeRedis();
vi.mock('@/lib/redis', () => ({ getRedis: () => redis }));

const call = (path: string) =>
    new Request(`https://example.test/api/cron/${path}?secret=s3cret`);

describe('queue crons and Redis commands', () => {
    beforeEach(() => {
        vi.stubEnv('CRON_SECRET', 's3cret');
        sent.length = 0;
        zaddArgs.length = 0;
        redis = fakeRedis();
        vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => { fn(); return 0; }) as unknown as typeof setTimeout);
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ total_count: 7 }), { status: 200 })));
    });
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
    });

    it('sync-holders queues every LSU with one ZADD NX and spends a few commands per run', async () => {
        const { GET } = await import('@/app/api/cron/sync-holders/route');
        const res = await GET(call('sync-holders'));
        expect(res.status).toBe(200);
        expect(sent).not.toContain('zscore');
        expect(zaddArgs[0][1]).toEqual({ nx: true });
        expect(zaddArgs[0]).toHaveLength(2 + VALIDATORS);
        expect(sent.length).toBeLessThanOrEqual(4);
    });

    it('sync-stake-history queues every validator with one ZADD NX and spends a few commands per run', async () => {
        const { GET } = await import('@/app/api/cron/sync-stake-history/route');
        const res = await GET(call('sync-stake-history'));
        expect(res.status).toBe(200);
        expect(zaddArgs[0][1]).toEqual({ nx: true });
        expect(zaddArgs[0]).toHaveLength(2 + VALIDATORS);
        expect(sent.length).toBeLessThanOrEqual(5);
    });
});
