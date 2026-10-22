import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { summarizeOwnerUnlocks, epochDate } from '@/features/dashboard/explorador/utils/ownerUnlocks';

vi.mock('@/lib/logger', () => ({ default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const part = (epoch_unlocked: number, amount: string) => ({ epoch_unlocked, stake_unit_amount: amount });

describe('summarizeOwnerUnlocks', () => {
    it('counts only the parts whose epoch has not come', () => {
        const summary = summarizeOwnerUnlocks([part(90, '5'), part(100, '7'), part(150, '1.5'), part(120, '2')], 100);
        // 100 itself is ready: only 120 and 150 are still waiting.
        expect(summary).toEqual({ unlocking: 3.5, parts: 2, nextEpoch: 120, lastEpoch: 150 });
    });

    it('is null when nothing waits, or nothing is listed', () => {
        expect(summarizeOwnerUnlocks([part(10, '5')], 100)).toBeNull();
        expect(summarizeOwnerUnlocks([], 100)).toBeNull();
        expect(summarizeOwnerUnlocks(undefined, 100)).toBeNull();
    });
});

describe('epochDate', () => {
    it('puts a date on an epoch from the ledger clock, five minutes an epoch', () => {
        expect(epochDate(112, 100, '2026-10-22T00:00:00.000Z').toISOString()).toBe('2026-10-22T01:00:00.000Z');
    });
});

describe('readOwnerUnlocks', () => {
    let service: typeof import('@/services/gateway/ownerUnlocks');
    const validator = (address: string, withdrawals: { epoch_unlocked: number; stake_unit_amount: string }[]) => ({
        address, state: { pending_owner_stake_unit_withdrawals: withdrawals },
    });
    const page = (items: unknown[], next_cursor?: string) => new Response(JSON.stringify({
        ledger_state: { epoch: 1000 }, validators: { items, next_cursor },
    }), { status: 200 });

    beforeEach(async () => {
        vi.resetModules();
        service = await import('@/services/gateway/ownerUnlocks');
    });
    afterEach(() => vi.unstubAllGlobals());

    it('walks the validator list and keeps the owners still unlocking, the soonest first', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(page([
                validator('validator_rdx1late', [part(1500, '10')]),
                validator('validator_rdx1none', [part(900, '99')]),
            ], 'next'))
            .mockResolvedValueOnce(page([
                validator('validator_rdx1soon', [part(1100, '4'), part(1200, '6')]),
                { address: 'validator_rdx1empty', state: {} },
            ]));
        vi.stubGlobal('fetch', fetchMock);

        const unlocks = await service.readOwnerUnlocks('mainnet');

        expect(unlocks).toEqual([
            { validator: 'validator_rdx1soon', unlocking: 10, parts: 2, nextEpoch: 1100, lastEpoch: 1200 },
            { validator: 'validator_rdx1late', unlocking: 10, parts: 1, nextEpoch: 1500, lastEpoch: 1500 },
        ]);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(JSON.parse(fetchMock.mock.calls[1][1].body).cursor).toBe('next');
    });

    it('answers a crowd with one read, and a repeat within the minute from memory', async () => {
        const fetchMock = vi.fn().mockImplementation(async () => page([validator('validator_rdx1a', [part(1100, '1')])]));
        vi.stubGlobal('fetch', fetchMock);

        await Promise.all([service.readOwnerUnlocks('mainnet'), service.readOwnerUnlocks('mainnet'), service.readOwnerUnlocks('mainnet')]);
        await service.readOwnerUnlocks('mainnet');

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
