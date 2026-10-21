import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const held = new Set<string>();
const store = vi.hoisted(() => new Map<string, unknown>());
vi.mock('@/lib/redis', () => ({
    getRedis: () => ({
        get: async () => null,
        set: async (key: string, _v: string, opts?: { nx?: boolean }) => {
            if (opts?.nx && held.has(key)) return null;
            held.add(key);
            return 'OK';
        },
    }),
}));
// Blobs go through memory in tests.
vi.mock('@/lib/redisBlob', () => ({
    readBlob: async (_r: unknown, key: string) => store.get(key) ?? null,
    writeBlob: async (_r: unknown, key: string, value: unknown) => { store.set(key, value); },
}));

const makeValidators = (n: number) => Array.from({ length: n }, (_, i) => ({ address: `validator_rdx1v${i}` }));
let validators = makeValidators(3);
vi.mock('@/services/gateway/validators', () => ({ getValidatorsCached: vi.fn(async () => ({ validators })) }));

type Service = typeof import('@/services/gateway/networkUnstaking');

const DAY = 86_400_000;
const vaultOf = (validator: string) => `internal_vault_rdx1${validator.replace('validator_rdx1', '')}`;

/** An unstake transaction `ago` ms ago that put `xrd` into the pending vault of validator `v`. */
const unstake = (version: number, ago: number, v: string, xrd: string, status = 'CommittedSuccess') => ({
    state_version: version,
    confirmed_at: new Date(Date.now() - ago).toISOString(),
    receipt: {
        status,
        events: [
            // The matching withdrawal from the stake vault, and some other vault's deposit: neither counts.
            { name: 'DepositEvent', emitter: { entity: { entity_address: 'internal_vault_rdx1someoneelse' } }, data: { fields: [{ field_name: 'amount', value: '999' }] } },
            { name: 'DepositEvent', emitter: { entity: { entity_address: vaultOf(v) } }, data: { fields: [{ field_name: 'amount', value: xrd }] } },
        ],
    },
});

/** An unstake with its account: LSUs withdrawn by `account`, burned by the validator, XRD into its vault. */
const unstakeBy = (version: number, ago: number, v: string, xrd: string, account: string, units = '90') => {
    const tx = unstake(version, ago, v, xrd);
    tx.receipt.events.push(
        { name: 'UnstakeEvent', emitter: { entity: { entity_address: v } }, data: { fields: [{ field_name: 'stake_units', value: units }] } },
        // The account's own withdrawal has an unnamed field, like the vault's amount event.
        { name: 'WithdrawEvent', emitter: { entity: { entity_address: account } }, data: { fields: [{ field_name: '', value: units }] } },
    );
    return tx;
};

interface Options {
    balances?: Record<string, string>;
    /** Stream pages, newest first; the cursor is the index of the page asked for. */
    pages?: ReturnType<typeof unstake>[][];
}

/** Answers entity/details (validators → vault, vaults → balance) and the unstake stream. */
const gateway = ({ balances = {}, pages = [[]] }: Options = {}) =>
    vi.fn(async (url: string, init: { body: string }) => {
        const body = JSON.parse(init.body);
        if (url.endsWith('/stream/transactions')) {
            const index = body.cursor ? Number(body.cursor) : 0;
            return new Response(JSON.stringify({ items: pages[index] ?? [], next_cursor: index + 1 < pages.length ? String(index + 1) : null }), { status: 200 });
        }
        const items = (body.addresses as string[]).map(address =>
            address.startsWith('validator_')
                ? { address, details: { state: { pending_xrd_withdraw_vault: { entity_address: vaultOf(address) } } } }
                : { address, details: { balance: { amount: balances[address] ?? '0' } } });
        return new Response(JSON.stringify({ items }), { status: 200 });
    });

describe('network unstaking figures', () => {
    let service: Service;

    beforeEach(async () => {
        vi.resetModules();
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
        expect(await service.readNetworkUnstaking('mainnet')).toMatchObject({ pending: 0, unbonding: null, schedule: [], updatedAt: null, wantsRefresh: true });
    });

    it('adds up the vaults and the XRD unstaked in the last 7 days', async () => {
        validators = makeValidators(2);
        vi.stubGlobal('fetch', gateway({
            balances: { [vaultOf('validator_rdx1v0')]: '1000', [vaultOf('validator_rdx1v1')]: '500' },
            pages: [[
                unstake(30, 1 * DAY, 'validator_rdx1v0', '100'),
                unstake(20, 3 * DAY, 'validator_rdx1v1', '50.5'),
                unstake(10, 6 * DAY, 'validator_rdx1v0', '25'),
                unstake(5, 9 * DAY, 'validator_rdx1v0', '400'), // already unlocked
            ]],
        }));

        expect(await service.refreshNetworkUnstaking('mainnet')).toBe('refreshed');

        const read = await service.readNetworkUnstaking('mainnet');
        expect(read.pending).toBe(1500);
        expect(read.unbonding).toBeCloseTo(175.5);
        expect(read.validators).toBe(2);
        expect(read.wantsRefresh).toBe(false);
    });

    it('says what the locked total was a day and a week ago', async () => {
        validators = makeValidators(1);
        vi.stubGlobal('fetch', gateway({
            pages: [[
                unstake(40, 0.5 * DAY, 'validator_rdx1v0', '10'), // locked now only
                unstake(30, 3 * DAY, 'validator_rdx1v0', '20'), // locked now, 24 h ago
                unstake(20, 7.5 * DAY, 'validator_rdx1v0', '40'), // locked 24 h ago, not now
                unstake(10, 10 * DAY, 'validator_rdx1v0', '80'), // locked 7 days ago, with the one above
            ]],
        }));
        await service.refreshNetworkUnstaking('mainnet');

        const read = await service.readNetworkUnstaking('mainnet');
        expect(read.unbonding).toBeCloseTo(30);
        expect(read.unbonding24hAgo).toBeCloseTo(60); // 20 + 40
        expect(read.unbonding7dAgo).toBeCloseTo(120); // 40 + 80
    });

    it('schedules each unstake for the day it unlocks, 7 days after', async () => {
        validators = makeValidators(1);
        vi.stubGlobal('fetch', gateway({
            pages: [[
                unstake(30, 1 * DAY, 'validator_rdx1v0', '100'), // unlocks in 6 days
                unstake(20, 5 * DAY, 'validator_rdx1v0', '30'), // unlocks in 2 days
                unstake(10, 5.2 * DAY, 'validator_rdx1v0', '20'), // unlocks in ~2 days
            ]],
        }));
        await service.refreshNetworkUnstaking('mainnet');

        const { schedule, unbonding } = await service.readNetworkUnstaking('mainnet');
        expect(schedule).toHaveLength(8);
        expect(schedule[0].date).toBe(new Date().toISOString().slice(0, 10));
        expect(schedule.reduce((sum, d) => sum + d.xrd, 0)).toBeCloseTo(150);
        expect(unbonding).toBeCloseTo(150);
        // The 100 unlocks on the day 6 days from now (UTC).
        const sixDays = new Date(Date.now() + 6 * DAY).toISOString().slice(0, 10);
        expect(schedule.find(d => d.date === sixDays)?.xrd).toBeCloseTo(100);
    });

    it('skips failed transactions and unstakes it cannot attribute to a vault', async () => {
        validators = makeValidators(1);
        vi.stubGlobal('fetch', gateway({
            pages: [[
                unstake(30, 1 * DAY, 'validator_rdx1v0', '100', 'Failed'),
                unstake(20, 1 * DAY, 'validator_rdx1unknown', '70'),
                unstake(10, 1 * DAY, 'validator_rdx1v0', '5'),
            ]],
        }));
        await service.refreshNetworkUnstaking('mainnet');
        expect((await service.readNetworkUnstaking('mainnet')).unbonding).toBeCloseTo(5);
    });

    it('does not show a locked figure until the ledger has been read back 7 days', async () => {
        validators = makeValidators(1);
        // Two pages of newest unstakes, and the budget runs out before the horizon: only 2 days are covered.
        const many = Array.from({ length: 10 }, (_, i) => ({ ...unstake(1000 - i, (1 + i * 0.2) * DAY, 'validator_rdx1v0', '1'), }));
        vi.stubGlobal('fetch', gateway({ pages: Array.from({ length: 20 }, () => many) }));

        await service.refreshNetworkUnstaking('mainnet');
        const first = await service.readNetworkUnstaking('mainnet');
        expect(first.unbonding).toBeNull();
        expect(first.schedule).toEqual([]);
        // It keeps going on the next refreshes.
        expect(first.wantsRefresh).toBe(true);
    });

    it('breaks the locked part down by account, the biggest first', async () => {
        validators = makeValidators(2);
        vi.stubGlobal('fetch', gateway({
            pages: [[
                unstakeBy(50, 1 * DAY, 'validator_rdx1v0', '100', 'account_rdx1whale', '95'),
                unstakeBy(40, 2 * DAY, 'validator_rdx1v1', '300', 'account_rdx1whale', '290'),
                unstakeBy(30, 3 * DAY, 'validator_rdx1v0', '40', 'account_rdx1small', '38'),
                unstakeBy(20, 9 * DAY, 'validator_rdx1v0', '500', 'account_rdx1old', '480'), // already unlocked
                unstake(10, 4 * DAY, 'validator_rdx1v0', '7'), // no account named
            ]],
        }));
        await service.refreshNetworkUnstaking('mainnet');

        const read = await service.readNetworkUnstaking('mainnet');
        expect(read.accounts.map(a => a.address)).toEqual(['account_rdx1whale', 'account_rdx1small']);
        expect(read.accounts[0]).toMatchObject({ xrd: 400, unstakes: 2, validators: ['validator_rdx1v1', 'validator_rdx1v0'] });
        expect(read.accounts[1]).toMatchObject({ xrd: 40, unstakes: 1, validators: ['validator_rdx1v0'] });
        expect(read.unattributedXrd).toBeCloseTo(7);
        // Their first part unlocks 7 days after the earlier unstake (2 days ago → in 5 days).
        expect(read.accounts[0].nextUnlock - Date.now()).toBeGreaterThan(4.9 * DAY);
        expect(read.accounts[0].nextUnlock - Date.now()).toBeLessThan(5.1 * DAY);
        // The parts add up to the wave.
        expect(read.accounts.reduce((sum, a) => sum + a.xrd, 0) + read.unattributedXrd).toBeCloseTo(read.unbonding!);
    });

    it('pairs two unstakes of one validator in a transaction with their own accounts', async () => {
        validators = makeValidators(1);
        const tx = unstakeBy(60, 1 * DAY, 'validator_rdx1v0', '100', 'account_rdx1a', '90');
        tx.receipt.events.push(
            { name: 'DepositEvent', emitter: { entity: { entity_address: vaultOf('validator_rdx1v0') } }, data: { fields: [{ field_name: 'amount', value: '200' }] } },
            { name: 'UnstakeEvent', emitter: { entity: { entity_address: 'validator_rdx1v0' } }, data: { fields: [{ field_name: 'stake_units', value: '180' }] } },
            { name: 'WithdrawEvent', emitter: { entity: { entity_address: 'account_rdx1b' } }, data: { fields: [{ field_name: '', value: '180' }] } },
        );
        vi.stubGlobal('fetch', gateway({ pages: [[tx]] }));
        await service.refreshNetworkUnstaking('mainnet');

        const { accounts } = await service.readNetworkUnstaking('mainnet');
        expect(accounts.map(a => [a.address, a.xrd])).toEqual([['account_rdx1b', 200], ['account_rdx1a', 100]]);
    });

    it('costs the Gateway nothing while the figures are fresh', async () => {
        validators = makeValidators(3);
        const fetchMock = gateway();
        vi.stubGlobal('fetch', fetchMock);
        await service.refreshNetworkUnstaking('mainnet');
        fetchMock.mockClear();

        expect(await service.refreshNetworkUnstaking('mainnet')).toBe('fresh');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('batches vaults by 20 and finds each vault address only once', async () => {
        validators = makeValidators(45);
        const fetchMock = gateway();
        vi.stubGlobal('fetch', fetchMock);

        await service.refreshNetworkUnstaking('mainnet');
        const detailCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/state/entity/details'));
        // 45 validators → 3 requests for vault addresses + 3 for balances.
        expect(detailCalls).toHaveLength(6);
    });

    it('keeps the figures and holds off when the Gateway says 429', async () => {
        validators = makeValidators(3);
        vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429, headers: { 'retry-after': '30' } })));

        expect(await service.refreshNetworkUnstaking('mainnet')).toBe('rate-limited');
        expect((await service.readNetworkUnstaking('mainnet')).updatedAt).toBeNull();

        const fetchMock = gateway();
        vi.stubGlobal('fetch', fetchMock);
        expect(await service.refreshNetworkUnstaking('mainnet')).toBe('busy');
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
