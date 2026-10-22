import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { summarizeOwnerUnlocks, epochDate } from '@/features/dashboard/explorador/utils/ownerUnlocks';
import { pendingFeeChange } from '@/features/dashboard/explorador/utils/feeChange';

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

describe('pendingFeeChange', () => {
    it('reads a request whose epoch has not come, in percent', () => {
        const state = { validator_fee_factor: '0.25', validator_fee_change_request: { new_fee_factor: '1', epoch_effective: 1100 } };
        expect(pendingFeeChange(state, 1000)).toEqual({ current: 25, next: 100, epoch: 1100 });
    });

    it('ignores a request that has already taken effect, or none', () => {
        const state = { validator_fee_factor: '0.25', validator_fee_change_request: { new_fee_factor: '1', epoch_effective: 1000 } };
        expect(pendingFeeChange(state, 1000)).toBeNull();
        expect(pendingFeeChange({ validator_fee_factor: '0.25', validator_fee_change_request: null }, 1000)).toBeNull();
        expect(pendingFeeChange(undefined, 1000)).toBeNull();
    });
});

describe('readValidatorWatch', () => {
    let service: typeof import('@/services/gateway/validatorWatch');
    const validator = (address: string, withdrawals: { epoch_unlocked: number; stake_unit_amount: string }[], extra: object = {}) => ({
        address, state: { pending_owner_stake_unit_withdrawals: withdrawals, ...extra },
    });
    const page = (items: unknown[], next_cursor?: string) => new Response(JSON.stringify({
        ledger_state: { epoch: 1000 }, validators: { items, next_cursor },
    }), { status: 200 });

    beforeEach(async () => {
        vi.resetModules();
        service = await import('@/services/gateway/validatorWatch');
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

        const { ownerUnlocks: unlocks } = await service.readValidatorWatch('mainnet');

        expect(unlocks).toEqual([
            { validator: 'validator_rdx1soon', unlocking: 10, parts: 2, nextEpoch: 1100, lastEpoch: 1200 },
            { validator: 'validator_rdx1late', unlocking: 10, parts: 1, nextEpoch: 1500, lastEpoch: 1500 },
        ]);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(JSON.parse(fetchMock.mock.calls[1][1].body).cursor).toBe('next');
    });

    it('collects the commission changes still to come from the same walk, the soonest first', async () => {
        const change = (epoch_effective: number, new_fee_factor: string) => ({ validator_fee_factor: '0.1', validator_fee_change_request: { new_fee_factor, epoch_effective } });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(page([
            validator('validator_rdx1later', [], change(1300, '0.5')),
            validator('validator_rdx1applied', [], change(900, '1')),
            validator('validator_rdx1sooner', [], change(1100, '1')),
        ])));

        const { feeChanges } = await service.readValidatorWatch('mainnet');

        expect(feeChanges).toEqual([
            { validator: 'validator_rdx1sooner', current: 10, next: 100, epoch: 1100 },
            { validator: 'validator_rdx1later', current: 10, next: 50, epoch: 1300 },
        ]);
    });

    it('answers a crowd with one read, and a repeat within the minute from memory', async () => {
        const fetchMock = vi.fn().mockImplementation(async () => page([validator('validator_rdx1a', [part(1100, '1')])]));
        vi.stubGlobal('fetch', fetchMock);

        await Promise.all([service.readValidatorWatch('mainnet'), service.readValidatorWatch('mainnet'), service.readValidatorWatch('mainnet')]);
        await service.readValidatorWatch('mainnet');

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
