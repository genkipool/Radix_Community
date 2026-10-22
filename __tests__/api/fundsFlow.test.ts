import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { classifyDestination, forwardingPattern, summarizeFunds, xrdLegs, type FlowItem } from '@/features/dashboard/explorador/utils/fundsFlow';

vi.mock('@/lib/logger', () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
const ME = 'account_rdx1me';
const tx = (at: string, ...changes: [string, number, string?][]): FlowItem => ({
    confirmed_at: at,
    balance_changes: { fungible_balance_changes: changes.map(([entity_address, amount, resource_address]) => ({ entity_address, resource_address: resource_address ?? XRD, balance_change: String(amount) })) },
});

describe('xrdLegs', () => {
    it('shares the account change between the parties on the other side, in proportion', () => {
        const legs = xrdLegs(ME, [tx('2026-01-01', [ME, 100], ['account_rdx1a', -75], ['account_rdx1b', -25])], XRD);
        expect(legs.map(l => [l.counterparty, l.amount, l.incoming])).toEqual([['account_rdx1a', 75, true], ['account_rdx1b', 25, true]]);
    });

    it('ignores other resources, dust and transactions the account did not move XRD in', () => {
        const items = [
            tx('2026-01-01', [ME, 5, 'resource_rdx1other'], ['account_rdx1a', -5, 'resource_rdx1other']),
            tx('2026-01-02', [ME, 0.001], ['account_rdx1a', -0.001]),
            tx('2026-01-03', ['account_rdx1a', 10], ['account_rdx1b', -10]),
        ];
        expect(xrdLegs(ME, items, XRD)).toEqual([]);
    });
});

describe('summarizeFunds', () => {
    it('totals what came in and went out per counterparty, the biggest dealings first', () => {
        const items = [
            tx('2026-01-03', [ME, -40], ['account_rdx1b', 40]),
            tx('2026-01-02', [ME, 10], ['account_rdx1a', -10]),
            tx('2026-01-01', [ME, 100], ['account_rdx1a', -100]),
        ];
        const flow = summarizeFunds(ME, items, XRD);
        expect(flow.counterparties).toEqual([
            { address: 'account_rdx1a', received: 110, sent: 0, txs: 2, lastAt: '2026-01-02' },
            { address: 'account_rdx1b', received: 0, sent: 40, txs: 1, lastAt: '2026-01-03' },
        ]);
        expect(flow).toMatchObject({ received: 110, sent: 40, txs: 3, moved: 3, from: '2026-01-01', to: '2026-01-03' });
    });
});

describe('forwardingPattern and classifyDestination', () => {
    // An address that is fed by many and passes it all to one place.
    const fed = Array.from({ length: 12 }, (_, i) => tx(`2026-01-${10 + i}`, ['account_rdx1dep', 10], [`account_rdx1s${i}`, -10]));
    const passes = tx('2026-02-01', ['account_rdx1dep', -120], ['account_rdx1hub', 120]);

    it('measures how much of what an address receives it passes to its biggest destination', () => {
        const pattern = forwardingPattern('account_rdx1dep', [passes, ...fed], XRD);
        expect(pattern).toMatchObject({ hub: 'account_rdx1hub', share: 1, senders: 12, received: 120 });
    });

    it('calls it a collector only when the hub is an account many others feed', () => {
        const pattern = forwardingPattern('account_rdx1dep', [passes, ...fed], XRD);
        expect(classifyDestination(pattern, { senders: 12, txs: 100 })).toBe('collector');
        expect(classifyDestination(pattern, { senders: 3, txs: 100 })).toBe('other');
        expect(classifyDestination(pattern, { senders: 12, txs: 20 })).toBe('other');
        expect(classifyDestination(pattern, null)).toBe('other');
    });

    it('says on-chain when it passes the XRD to something that is not an account, and other when it keeps it', () => {
        const toPool = tx('2026-02-01', ['account_rdx1dep', -120], ['pool_rdx1p', 120]);
        expect(classifyDestination(forwardingPattern('account_rdx1dep', [toPool, ...fed], XRD), null)).toBe('onchain');
        expect(classifyDestination(forwardingPattern('account_rdx1dep', fed, XRD), null)).toBe('other');
    });
});

describe('readFundsFlow', () => {
    let service: typeof import('@/services/gateway/fundsFlow');
    beforeEach(async () => {
        vi.resetModules();
        service = await import('@/services/gateway/fundsFlow');
    });
    afterEach(() => vi.unstubAllGlobals());

    it('reads up to three pages, and says when the account has older transactions', async () => {
        const page = (cursor?: string) => new Response(JSON.stringify({ items: [tx('2026-01-01', [ME, 1], ['account_rdx1a', -1])], next_cursor: cursor }), { status: 200 });
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(page('c1')).mockResolvedValueOnce(page('c2')).mockResolvedValueOnce(page('c3'));
        vi.stubGlobal('fetch', fetchMock);

        const flow = await service.readFundsFlow(ME, 'mainnet');

        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(JSON.parse(fetchMock.mock.calls[2][1].body).cursor).toBe('c2');
        expect(flow).toMatchObject({ txs: 3, more: true, received: 3 });
    });

    it('stops at the last page', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [] }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        const flow = await service.readFundsFlow(ME, 'mainnet');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(flow.more).toBe(false);
    });

    it('answers a repeat within two minutes from memory, and a crowd with one read', async () => {
        const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        const read = () => service.shared('k', () => service.readFundsFlow(ME, 'mainnet'));
        await Promise.all([read(), read(), read()]);
        await read();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
