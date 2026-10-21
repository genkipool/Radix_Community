import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/redis', () => ({ getRedis: () => null }));
vi.mock('@/lib/logger', () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/services/gateway/knownAddresses', () => ({
    fetchKnownAddresses: vi.fn(async () => ({ account_owner_badge: 'resource_rdx1nfbadge' })),
}));

// Real mainnet accounts: the owner badge id of each is its own node id.
const A = 'account_rdx12yp6ctezsjqxgfn36y3hk3f7ugmwmd6tr4wefuk07k29gdmduwqnz2';
const B = 'account_rdx12823amuuzw4302yfpmzs75edst2v3w7r0lums2nrvtrrhnytl8h95j';
const CONTROLLER = 'accesscontroller_rdx1cwyyg3rlxrdpyzus2adrq9lnfexf8wgs4p6r8ugsgmdnu0g4utjqq4';

type AccessControllers = typeof import('@/services/gateway/accessControllers');
type Item = { state_version: number; affected_global_entities: string[] };

describe('Access Controller list scan', () => {
    let list: AccessControllers;
    let streams: { items: Item[]; next_cursor?: string }[];
    /** Where each badge is, by account: its controller, a plain account, or nowhere. */
    let holders: Record<string, string | undefined>;
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.resetModules();
        list = await import('@/services/gateway/accessControllers');
        const { ownerBadgeLocalId } = await import('@/features/console/lib/account-security');
        vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => { fn(); return 0; }) as unknown as typeof setTimeout);
        streams = [];
        holders = {};
        fetchMock = vi.fn(async (url: string, init: { body: string }) => {
            const body = JSON.parse(init.body);
            if (url.endsWith('/stream/transactions')) {
                // One stream page per cursor: no cursor is page 0, cursor "pN" is page N.
                const index = body.cursor ? Number(String(body.cursor).slice(1)) : 0;
                return new Response(JSON.stringify(streams[index] ?? { items: [] }), { status: 200 });
            }
            const owned = Object.entries(holders).flatMap(([address, holder]) => {
                const id = ownerBadgeLocalId(address);
                return holder && id && body.non_fungible_ids.includes(id)
                    ? [{ non_fungible_id: id, owning_vault_global_ancestor_address: holder }]
                    : [];
            });
            return new Response(JSON.stringify({ non_fungible_ids: owned }), { status: 200 });
        });
        vi.stubGlobal('fetch', fetchMock);
    });
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('has nothing to show, and wants a step, before the first scan', async () => {
        expect(await list.readAccessControllers('mainnet')).toMatchObject({ accounts: [], partial: true, wantsStep: true });
    });

    it('keeps the accounts of transactions that name a controller, once their badge is confirmed in one', async () => {
        streams = [{ items: [
            { state_version: 10, affected_global_entities: [A, CONTROLLER, 'resource_rdx1nfbadge'] },
            { state_version: 20, affected_global_entities: [B, 'resource_rdx1nfbadge'] }, // no controller involved
        ] }];
        holders = { [A]: CONTROLLER, [B]: B };

        expect(await list.advanceAccessControllers('mainnet')).toBe('finished');
        const read = await list.readAccessControllers('mainnet');
        expect(read).toMatchObject({ partial: false, wantsStep: false });
        expect(read.accounts).toEqual([{ address: A, controller: CONTROLLER, stateVersion: 10 }]);
    });

    it('drops an account whose badge is not in a controller after all, and lists the newest first', async () => {
        streams = [{ items: [
            { state_version: 10, affected_global_entities: [A, CONTROLLER] },
            { state_version: 30, affected_global_entities: [B, CONTROLLER, 'account_rdx1payer'] },
        ] }];
        holders = { [A]: CONTROLLER, [B]: CONTROLLER };
        await list.advanceAccessControllers('mainnet');
        expect((await list.readAccessControllers('mainnet')).accounts.map(a => a.address)).toEqual([B, A]);
    });

    it('reads the stream a few pages per step and shows what it has meanwhile', async () => {
        const page = (version: number, address: string, next?: string): { items: Item[]; next_cursor?: string } =>
            ({ items: [{ state_version: version, affected_global_entities: [address, CONTROLLER] }], next_cursor: next });
        streams = [page(1, A, 'p1'), page(2, B, 'p2'), { items: [], next_cursor: 'p3' }, { items: [], next_cursor: 'p4' }, { items: [] }];
        holders = { [A]: CONTROLLER, [B]: CONTROLLER };

        expect(await list.advanceAccessControllers('mainnet')).toBe('advanced');
        const partial = await list.readAccessControllers('mainnet');
        expect(partial).toMatchObject({ partial: true, wantsStep: true });
        expect(partial.accounts).toHaveLength(2);
    });

    it('later reads only what is new, and checks again what it already holds', async () => {
        streams = [{ items: [{ state_version: 10, affected_global_entities: [A, CONTROLLER] }] }];
        holders = { [A]: CONTROLLER };
        await list.advanceAccessControllers('mainnet');

        // Half an hour on, the controller has been emptied.
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(Date.now() + 31 * 60 * 1000);
        holders = { [A]: A };
        streams = [{ items: [] }];
        fetchMock.mockClear();

        expect(await list.advanceAccessControllers('mainnet')).toBe('finished');
        const stream = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/stream/transactions'))!;
        expect(JSON.parse(stream[1].body).from_ledger_state).toEqual({ state_version: 11 });
        expect((await list.readAccessControllers('mainnet')).accounts).toEqual([]);
        vi.useRealTimers();
    });

    it('postpones the next step when the Gateway asks to slow down', async () => {
        fetchMock.mockResolvedValue(new Response('{}', { status: 429, headers: { 'retry-after': '40' } }));
        expect(await list.advanceAccessControllers('mainnet')).toBe('rate-limited');
        expect(await list.advanceAccessControllers('mainnet')).toBe('busy');
    });
});
