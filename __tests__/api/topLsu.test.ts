import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/redis', () => ({ getRedis: () => null }));

const makeValidators = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
        address: `validator_rdx1v${i}`,
        lsuResource: `resource_rdx1lsu${i}`,
        lsu2xrdFactor: 1,
        totalStakeXRD: 1_000_000 - i * 1000,
    }));

let validators = makeValidators(3);
vi.mock('@/services/gateway/validators', () => ({ getValidatorsCached: vi.fn(async () => ({ validators })) }));

type Rankings = typeof import('@/services/gateway/rankings');

/** One account per validator, worth less the further down the list. */
const holdersFor = (resource: string) => {
    const i = Number(resource.replace('resource_rdx1lsu', ''));
    return [
        { holder_address: `component_rdx1dapp${i}`, amount: '999999' },
        { holder_address: `account_rdx1acc${i}`, amount: String(500_000 - i) },
    ];
};

describe('top LSU ranking scan', () => {
    let rankings: Rankings;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.resetModules();
        rankings = await import('@/services/gateway/rankings');
        // No waiting between requests in tests.
        vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => { fn(); return 0; }) as unknown as typeof setTimeout);
        fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
            const { resource_address } = JSON.parse(init.body);
            return new Response(JSON.stringify({ items: holdersFor(resource_address) }), { status: 200 });
        });
        vi.stubGlobal('fetch', fetchMock);
    });
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('has nothing to show, and wants a step, before the first scan', async () => {
        const read = await rankings.readTopLsu('mainnet');
        expect(read).toMatchObject({ positions: [], partial: true, wantsStep: true });
    });

    it('finishes a small network in one step, keeping accounts only and best-first', async () => {
        validators = makeValidators(3);
        expect(await rankings.advanceTopLsu('mainnet')).toBe('finished');

        const read = await rankings.readTopLsu('mainnet');
        expect(read.partial).toBe(false);
        expect(read.wantsStep).toBe(false);
        expect(read.positions.map(p => p.address)).toEqual(['account_rdx1acc0', 'account_rdx1acc1', 'account_rdx1acc2']);
    });

    it('costs the Gateway nothing once the ranking is fresh', async () => {
        validators = makeValidators(3);
        await rankings.advanceTopLsu('mainnet');
        fetchMock.mockClear();

        expect(await rankings.advanceTopLsu('mainnet')).toBe('fresh');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('spreads a big network over steps and serves the partial ranking meanwhile', async () => {
        validators = makeValidators(30);
        expect(await rankings.advanceTopLsu('mainnet')).toBe('advanced');
        // 8 validators per step, one request each here.
        expect(fetchMock).toHaveBeenCalledTimes(8);

        const read = await rankings.readTopLsu('mainnet');
        expect(read.partial).toBe(true);
        expect(read.wantsStep).toBe(true);
        expect(read.positions).toHaveLength(8);

        // Steps are spaced out: a second one right away does nothing.
        fetchMock.mockClear();
        expect(await rankings.advanceTopLsu('mainnet')).toBe('busy');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('stops at a Gateway 429, keeps its progress and holds off the next step', async () => {
        validators = makeValidators(30);
        let calls = 0;
        fetchMock.mockImplementation(async (_url: string, init: { body: string }) => {
            if (++calls > 3) return new Response('{}', { status: 429, headers: { 'retry-after': '30' } });
            const { resource_address } = JSON.parse(init.body);
            return new Response(JSON.stringify({ items: holdersFor(resource_address) }), { status: 200 });
        });

        expect(await rankings.advanceTopLsu('mainnet')).toBe('rate-limited');
        expect(calls).toBe(4);
        expect((await rankings.readTopLsu('mainnet')).positions).toHaveLength(3);

        fetchMock.mockClear();
        expect(await rankings.advanceTopLsu('mainnet')).toBe('busy');
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
