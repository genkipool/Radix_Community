/**
 * The validator rewards cron must take in every epoch, however its runs fall.
 *
 * In 2026 it kept about 40 % of the rewards: each run read a window of the
 * newest epochs sized from the cached validator list's epoch, which lags, so
 * whatever fell outside the window when runs were late or rare was lost for
 * good, and catching up booked everything on the day of the run. These tests
 * drive the route against a simulated ledger and pin that:
 *
 *  - no epoch is lost or counted twice, whatever the gaps between runs;
 *  - after downtime each epoch is booked on the day it closed;
 *  - each run asks the Gateway once, for a bounded page (it rate-limits), and
 *    with the cursor field the Gateway actually reads.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeBlob, forgetHeldBlobs } from '@/lib/redisBlob';

// ── A Redis in memory ────────────────────────────────────────────────────────
const store = new Map<string, unknown>();
const fakeRedis = {
    async get(key: string) {
        return store.has(key) ? store.get(key) : null;
    },
    async set(key: string, value: unknown) {
        store.set(key, value);
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
            set(key: string, value: unknown) { ops.push(() => store.set(key, value)); },
            del(...keys: string[]) { ops.push(() => keys.forEach((key) => store.delete(key))); },
            async exec() { ops.forEach((op) => op()); },
        };
    },
};
vi.mock('@/lib/redis', () => ({ getRedis: () => fakeRedis }));
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), cacheLife: vi.fn(), cacheTag: vi.fn() }));

// The cached validator list, whose epoch lags the ledger (as it does in production).
let cachedEpoch = 0;
vi.mock('@/services/gateway/validators', () => ({
    getValidatorsCached: async () => ({ networkStats: { epoch: cachedEpoch } }),
}));

// ── A ledger of epoch changes ────────────────────────────────────────────────
const VALIDATORS = ['validator_rdx1a', 'validator_rdx1b'];
const START = Date.parse('2026-03-01T22:00:00Z');
const FIVE_MIN = 5 * 60_000;
let head = 0; // epochs closed so far: 1..head
const sv = (epoch: number) => epoch * 10;
const closedAt = (epoch: number) => new Date(START + epoch * FIVE_MIN).toISOString();

function epochChange(epoch: number) {
    return {
        state_version: sv(epoch),
        epoch,
        round_timestamp: closedAt(epoch),
        receipt: {
            events: VALIDATORS.map((validator) => ({
                name: 'ValidatorEmissionAppliedEvent',
                emitter: { entity: { entity_address: validator } },
                data: {
                    fields: [
                        { field_name: 'epoch', value: String(epoch) },
                        { field_name: 'validator_fee_xrd', value: '1' },
                        { field_name: 'stake_pool_added_xrd', value: '10' },
                        { field_name: 'starting_stake_pool_xrd', value: '1000' },
                        { field_name: 'proposals_made', value: '1' },
                        { field_name: 'proposals_missed', value: '0' },
                    ],
                },
            })),
        },
    };
}

const gatewayCalls: Array<Record<string, unknown>> = [];
const gateway = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as {
        limit_per_page: number;
        order?: string;
        from_ledger_state?: { state_version: number };
    };
    gatewayCalls.push(body);
    let epochs: number[];
    if (body.order === 'Asc') {
        // Without a cursor the Gateway would start at genesis, long before 2026.
        const from = body.from_ledger_state?.state_version ?? 0;
        epochs = Array.from({ length: head }, (_, i) => i + 1).filter((e) => sv(e) >= from).slice(0, body.limit_per_page);
    } else {
        epochs = Array.from({ length: Math.min(body.limit_per_page, head) }, (_, i) => head - i);
    }
    return new Response(JSON.stringify({ items: epochs.map(epochChange) }), { status: 200 });
});

// ── Driving the cron ─────────────────────────────────────────────────────────
process.env.CRON_SECRET = 'secret';
const { GET } = await import('@/app/api/cron/sync-validator-rewards/route');

/** The ledger moves on `epochs` epochs (clock included), then the cron runs once. */
async function runAfter(epochs: number, { lag = 3 } = {}) {
    head += epochs;
    vi.setSystemTime(START + head * FIVE_MIN + 30_000);
    cachedEpoch = Math.max(0, head - lag);
    forgetHeldBlobs();
    const before = gatewayCalls.length;
    const res = await GET(new Request('http://localhost/api/cron/sync-validator-rewards?secret=secret'));
    expect(res.status).toBe(200);
    return gatewayCalls.length - before;
}

type Year = Record<string, { daily: Record<string, number>; dailyDelegants: Record<string, number>; lastSyncedEpoch: number }>;
const totals = () => decodeBlob<Year>(store.get('validator_rewards_2026')) ?? {};
const tableEpochs = () => Object.keys(decodeBlob<Record<string, unknown>>(store.get('validator_epoch_rewards')) ?? {}).map(Number);
const sumDays = (days: Record<string, number> = {}) => Object.values(days).reduce((a, b) => a + b, 0);

/** Runs every five minutes, with no new epochs, until the totals have caught up. */
async function settle() {
    for (let i = 0; i < 40; i++) {
        await runAfter(0);
    }
}

describe('validator rewards cron', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        store.clear();
        gatewayCalls.length = 0;
        head = 0;
        vi.stubGlobal('fetch', gateway);
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('takes in every epoch, whatever the gaps between runs and however stale the cached epoch', async () => {
        // A first run to set the cursor, then runs that are on time, late, or very late.
        await runAfter(1);
        for (const gap of [1, 1, 7, 2, 13, 1, 24, 3, 9, 1, 30, 1]) {
            await runAfter(gap, { lag: gap + 4 });
        }
        // Let the half-hourly totals pick up the tail, as later runs would.
        vi.setSystemTime(Date.now() + 31 * 60_000);
        await runAfter(0);
        vi.setSystemTime(Date.now() + 31 * 60_000);
        await runAfter(0);

        for (const validator of VALIDATORS) {
            const mine = totals()[validator];
            expect(mine.lastSyncedEpoch).toBe(head);
            // Every epoch from the first one, once: fee 1 and pool 10 each.
            expect(sumDays(mine.daily)).toBe(head);
            expect(sumDays(mine.dailyDelegants)).toBe(10 * head);
        }
        // The history table holds every recent finished epoch.
        for (let epoch = head - 4; epoch <= head; epoch++) expect(tableEpochs()).toContain(epoch);
    });

    it('books each epoch on the day it closed when it catches up after downtime', async () => {
        await runAfter(1);
        // A day and a half without runs: the ledger moves on 432 epochs.
        await runAfter(432, { lag: 500 });
        await settle();

        const days = totals()[VALIDATORS[0]].daily;
        const expected: Record<string, number> = {};
        for (let epoch = 1; epoch <= head; epoch++) {
            const day = closedAt(epoch).slice(0, 10);
            expected[day] = (expected[day] ?? 0) + 1;
        }
        expect(days).toEqual(expected);
        expect(Object.keys(days).length).toBeGreaterThan(1);
    });

    it('asks the Gateway once per run, for a bounded page, with the cursor it reads', async () => {
        await runAfter(1);
        for (const gap of [1, 50, 200]) {
            const calls = await runAfter(gap, { lag: gap + 10 });
            expect(calls).toBe(1);
        }
        const following = gatewayCalls.slice(1);
        for (const body of following) {
            expect(body.limit_per_page).toBeLessThanOrEqual(25);
            expect(body.order).toBe('Asc');
            expect(body.from_ledger_state).toEqual({ state_version: expect.any(Number) });
            expect(body).not.toHaveProperty('from_state_version');
        }
    });

    it('starts from the newest epochs on its first run, then follows the ledger', async () => {
        head = 1000;
        await runAfter(1);
        expect(gatewayCalls[0].order).toBeUndefined();
        const meta = store.get('validator_rewards_meta') as { lastStateVersion?: number };
        expect(meta.lastStateVersion).toBe(sv(head));

        await runAfter(2);
        expect(gatewayCalls[1].from_ledger_state).toEqual({ state_version: sv(head - 2) + 1 });
    });
});
