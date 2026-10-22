import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/funds-flow/route';

const readFundsFlow = vi.fn();
const readDestinationHints = vi.fn();
vi.mock('@/services/gateway/fundsFlow', () => ({
    readFundsFlow: (...args: unknown[]) => readFundsFlow(...args),
    readDestinationHints: (...args: unknown[]) => readDestinationHints(...args),
    shared: (_key: string, read: () => Promise<unknown>) => read(),
}));

const request = (query: string) => new NextRequest(`http://localhost/api/funds-flow?${query}`);

describe('GET /api/funds-flow', () => {
    it('only answers for accounts', async () => {
        expect((await GET(request('network=mainnet'))).status).toBe(400);
        expect((await GET(request('address=validator_rdx1abc'))).status).toBe(400);
        expect((await GET(request('address=not%20an%20address'))).status).toBe(400);
        expect(readFundsFlow).not.toHaveBeenCalled();
    });

    it('returns the flow, or the hints of the biggest destinations with hints=1', async () => {
        readFundsFlow.mockResolvedValue({ counterparties: [], received: 0, sent: 0 });
        readDestinationHints.mockResolvedValue({ account_rdx1x: { kind: 'other', hub: null, share: 0, hubSenders: 0 } });

        const flow = await (await GET(request('address=account_rdx1abc&network=stokenet'))).json();
        expect(flow).toEqual({ counterparties: [], received: 0, sent: 0 });
        expect(readFundsFlow).toHaveBeenCalledWith('account_rdx1abc', 'stokenet');

        const hints = await (await GET(request('address=account_rdx1abc&hints=1'))).json();
        expect(hints.hints.account_rdx1x.kind).toBe('other');
    });

    it('answers 503 without caching when the Gateway cannot be read', async () => {
        readFundsFlow.mockRejectedValue(new Error('Gateway 500'));
        const res = await GET(request('address=account_rdx1abc'));
        expect(res.status).toBe(503);
        expect(res.headers.get('Cache-Control')).toBe('no-store');
    });
});
