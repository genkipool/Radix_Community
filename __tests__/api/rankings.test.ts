import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/rankings/route';

const readAccessControllers = vi.fn();
vi.mock('@/services/gateway/accessControllers', () => ({
    readAccessControllers: (...args: unknown[]) => readAccessControllers(...args),
    advanceAccessControllers: vi.fn(),
}));

const readValidatorWatch = vi.fn();
vi.mock('@/services/gateway/validatorWatch', () => ({
    readValidatorWatch: (...args: unknown[]) => readValidatorWatch(...args),
}));

const request = (query: string) => new NextRequest(`http://localhost/api/rankings?${query}`);

const holder = (holder_address: string, amount: string) => ({ holder_address, amount });

describe('GET /api/rankings', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('rejects a ranking that has no data source', async () => {
        const res = await GET(request('type=top_tokens'));
        expect(res.status).toBe(400);
    });

    it('keeps only accounts, in the order the Gateway returns them, and hands back the cursor', async () => {
        const items = [
            holder('component_rdx1aaa', '900'),
            holder('account_rdx1acc0', '800'),
            holder('validator_rdx1val', '700'),
            holder('account_rdx1acc1', '600'),
        ];
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items, next_cursor: 'next' }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);

        const res = await GET(request('type=top_accounts&network=mainnet&cursor=abc'));
        const body = await res.json() as { accounts: { address: string; amount: string }[]; nextCursor?: string };

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(JSON.parse(fetchMock.mock.calls[0][1].body).cursor).toBe('abc');
        expect(body.accounts).toEqual([
            { address: 'account_rdx1acc0', amount: '800' },
            { address: 'account_rdx1acc1', amount: '600' },
        ]);
        expect(body.nextCursor).toBe('next');
    });

    it('asks the Stokenet Gateway about the Stokenet XRD', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);

        await GET(request('type=top_accounts&network=stokenet'));

        expect(fetchMock.mock.calls[0][0]).toBe('https://gateway-stokenet.radix.community/extensions/resource-holders/page');
        expect(JSON.parse(fetchMock.mock.calls[0][1].body).resource_address).toMatch(/^resource_tdx_2_1/);
    });

    it('answers 503 without caching when the Gateway fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));
        const res = await GET(request('type=top_accounts'));
        expect(res.status).toBe(503);
        expect(res.headers.get('Cache-Control')).toBe('no-store');
    });

    it('serves the shielded accounts from what is stored, a page at a time', async () => {
        const accounts = Array.from({ length: 30 }, (_, i) => ({ address: `account_rdx1acc${i}`, controller: `accesscontroller_rdx1c${i}`, stateVersion: 100 - i }));
        readAccessControllers.mockResolvedValue({ accounts, partial: false, wantsStep: false });
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const first = await (await GET(request('type=access_controllers'))).json() as { accounts: { address: string; controller: string }[]; nextCursor?: string; partial: boolean };
        expect(first.accounts).toHaveLength(25);
        expect(first.accounts[0]).toEqual({ address: 'account_rdx1acc0', controller: 'accesscontroller_rdx1c0' });
        expect(first.nextCursor).toBe('25');
        expect(first.partial).toBe(false);

        const second = await (await GET(request('type=access_controllers&cursor=25'))).json() as { accounts: unknown[]; nextCursor?: string };
        expect(second.accounts).toHaveLength(5);
        expect(second.nextCursor).toBeUndefined();
        expect(fetchMock).not.toHaveBeenCalled(); // readers never reach the Gateway
    });

    it('lists the validators with an owner unlock under way, paged by offset', async () => {
        readValidatorWatch.mockResolvedValue({
            ownerUnlocks: Array.from({ length: 30 }, (_, i) => ({ validator: `validator_rdx1v${i}`, unlocking: 10, parts: 1, nextEpoch: 100 + i, lastEpoch: 100 + i })),
            feeChanges: [],
        });
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const first = await (await GET(request('type=owner_unlocks'))).json() as { accounts: { address: string }[]; nextCursor?: string };
        expect(first.accounts).toHaveLength(25);
        expect(first.accounts[0]).toEqual({ address: 'validator_rdx1v0' });
        expect(first.nextCursor).toBe('25');

        const second = await (await GET(request('type=owner_unlocks&cursor=25'))).json() as { accounts: unknown[]; nextCursor?: string };
        expect(second.accounts).toHaveLength(5);
        expect(second.nextCursor).toBeUndefined();
        expect(fetchMock).not.toHaveBeenCalled(); // the service is mocked: the route asks the Gateway for nothing itself
    });

    it('lists the validators with a commission change coming, from the same read', async () => {
        readValidatorWatch.mockResolvedValue({
            ownerUnlocks: [{ validator: 'validator_rdx1unlock', unlocking: 1, parts: 1, nextEpoch: 1, lastEpoch: 1 }],
            feeChanges: [{ validator: 'validator_rdx1fee', current: 25, next: 100, epoch: 5 }],
        });
        const body = await (await GET(request('type=fee_changes'))).json() as { accounts: { address: string }[]; nextCursor?: string };
        expect(body.accounts).toEqual([{ address: 'validator_rdx1fee' }]);
        expect(body.nextCursor).toBeUndefined();
    });

    it('answers 503 without caching when the unlock list cannot be read', async () => {
        readValidatorWatch.mockRejectedValue(new Error('Gateway 500'));
        const res = await GET(request('type=owner_unlocks'));
        expect(res.status).toBe(503);
        expect(res.headers.get('Cache-Control')).toBe('no-store');
    });
});
