import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/rankings/route';

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
});
