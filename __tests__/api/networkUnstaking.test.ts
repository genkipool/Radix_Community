import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const history: Record<string, unknown> = {};
const held = new Set<string>();
const locks = {
    get: async () => null,
    set: async (key: string, _v: string, opts?: { nx?: boolean }) => {
        if (opts?.nx && held.has(key)) return null;
        held.add(key);
        return 'OK';
    },
};
vi.mock('@/lib/redis', () => ({
    getRedis: () => ({ hgetall: async () => history, ...locks }),
}));
// Blobs go through memory in tests, as without Redis.
const store = vi.hoisted(() => new Map<string, unknown>());
vi.mock('@/lib/redisBlob', () => ({
    readBlob: async (_r: unknown, key: string) => store.get(key) ?? null,
    writeBlob: async (_r: unknown, key: string, value: unknown) => { store.set(key, value); },
}));

const makeValidators = (n: number) => Array.from({ length: n }, (_, i) => ({ address: `validator_rdx1v${i}`, lsu2xrdFactor: 1 }));
let validators = makeValidators(3);
vi.mock('@/services/gateway/validators', () => ({ getValidatorsCached: vi.fn(async () => ({ validators })) }));

type Service = typeof import('@/services/gateway/networkUnstaking');

const vaultOf = (validator: string) => `internal_vault_rdx1${validator.replace('validator_rdx1', '')}`;

/** Answers entity/details for validators (their vault) and for vaults (their balance). */
const gateway = (balances: Record<string, string>) =>
    vi.fn(async (_url: string, init: { body: string }) => {
        const { addresses } = JSON.parse(init.body) as { addresses: string[] };
        const items = addresses.map(address =>
            address.startsWith('validator_')
                ? { address, details: { state: { pending_xrd_withdraw_vault: { entity_address: vaultOf(address) } } } }
                : { address, details: { balance: { amount: balances[address] ?? '0' } } });
        return new Response(JSON.stringify({ items }), { status: 200 });
    });

describe('network unstaking figure', () => {
    let service: Service;

    beforeEach(async () => {
        vi.resetModules();
        for (const key of Object.keys(history)) delete history[key];
        held.clear();
        store.clear();
        service = await import('@/services/gateway/networkUnstaking');
        vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => { fn(); return 0; }) as unknown as typeof setTimeout);
    });
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('wants a refresh, and has nothing, before the first one', async () => {
        expect(await service.readNetworkUnstaking('mainnet')).toMatchObject({ pending: 0, updatedAt: null, wantsRefresh: true });
    });

    it('adds up the validators\' pending-withdraw vaults', async () => {
        validators = makeValidators(3);
        vi.stubGlobal('fetch', gateway({ [vaultOf('validator_rdx1v0')]: '100.5', [vaultOf('validator_rdx1v1')]: '200', [vaultOf('validator_rdx1v2')]: '0.25' }));

        expect(await service.refreshNetworkUnstaking('mainnet')).toBe('refreshed');

        const read = await service.readNetworkUnstaking('mainnet');
        expect(read.pending).toBeCloseTo(300.75);
        expect(read.validators).toBe(3);
        expect(read.wantsRefresh).toBe(false);
        expect(read.samples).toHaveLength(1);
    });

    it('costs the Gateway nothing while the figure is fresh', async () => {
        validators = makeValidators(3);
        const fetchMock = gateway({});
        vi.stubGlobal('fetch', fetchMock);
        await service.refreshNetworkUnstaking('mainnet');
        fetchMock.mockClear();

        expect(await service.refreshNetworkUnstaking('mainnet')).toBe('fresh');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('batches by 20 and finds each vault address only once', async () => {
        validators = makeValidators(45);
        const fetchMock = gateway({});
        vi.stubGlobal('fetch', fetchMock);

        await service.refreshNetworkUnstaking('mainnet');
        // 45 validators → 3 requests for vault addresses + 3 for balances.
        expect(fetchMock).toHaveBeenCalledTimes(6);
    });

    it('keeps the last figure and holds off when the Gateway says 429', async () => {
        validators = makeValidators(3);
        vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429, headers: { 'retry-after': '30' } })));

        expect(await service.refreshNetworkUnstaking('mainnet')).toBe('rate-limited');
        expect((await service.readNetworkUnstaking('mainnet')).updatedAt).toBeNull();

        const fetchMock = gateway({});
        vi.stubGlobal('fetch', fetchMock);
        expect(await service.refreshNetworkUnstaking('mainnet')).toBe('busy');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('takes the still-locked part from the last 7 days of unstakes', async () => {
        validators = makeValidators(2);
        const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
        // Per validator: 100 unstaked on each of the last 10 days.
        const record = { data: Array.from({ length: 10 }, (_, o) => ({ date: day(9 - o), stake: 10, unstake: 100, claim: 5 })) };
        history.validator_rdx1v0 = record;
        history.validator_rdx1v1 = JSON.stringify(record);
        vi.stubGlobal('fetch', gateway({ [vaultOf('validator_rdx1v0')]: '1000', [vaultOf('validator_rdx1v1')]: '1000' }));

        await service.refreshNetworkUnstaking('mainnet');
        const read = await service.readNetworkUnstaking('mainnet');

        // 7 days × 100 × 2 validators, plus the part of day 8 not yet passed: between 1400 and 1600.
        expect(read.unbonding).toBeGreaterThanOrEqual(1400);
        expect(read.unbonding).toBeLessThanOrEqual(1600);
        expect(read.days).toHaveLength(10);
        expect(read.days[0]).toMatchObject({ stake: 20, unstake: 200, claim: 10 });
        expect(read.pending).toBe(2000);
    });

    it('leaves the split unknown when there is no stake history', async () => {
        validators = makeValidators(2);
        vi.stubGlobal('fetch', gateway({}));
        await service.refreshNetworkUnstaking('mainnet');
        expect((await service.readNetworkUnstaking('mainnet')).unbonding).toBeNull();
    });
});
