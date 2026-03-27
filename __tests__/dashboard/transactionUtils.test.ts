import { describe, it, expect } from 'vitest';
import { resolveTransactionType, getTransactionFlags } from '@/features/dashboard/explorador/utils/transactionUtils';

describe('transactionUtils', () => {
    const mockTt = {
        tx_type_protocol_vote: 'Protocol Vote',
        tx_type_general: 'General Transaction',
        tx_type_stake: 'Stake',
        tx_type_unstake: 'Unstake',
        tx_type_claim: 'Claim XRD',
        tx_type_transfer: 'Transfer',
        tx_type_settings: 'Settings',
    };

    describe('resolveTransactionType', () => {
        it('resolves Protocol Vote from classes', () => {
            const result = resolveTransactionType(['ProtocolVote'], [], mockTt);
            expect(result).toBe('Protocol Vote');
        });

        it('resolves Protocol Vote from events', () => {
            const result = resolveTransactionType([], [{ name: 'ProtocolUpdateReadinessSignalEvent' }], mockTt);
            expect(result).toBe('Protocol Vote');
        });

        it('resolves General for empty classes and events', () => {
            const result = resolveTransactionType([], [], mockTt);
            expect(result).toBe('General Transaction');
        });

        it('resolves Stake correctly', () => {
            expect(resolveTransactionType(['ValidatorStake'], [], mockTt)).toBe('Stake');
        });

        it('resolves Unstake correctly', () => {
            expect(resolveTransactionType(['ValidatorUnstake'], [], mockTt)).toBe('Unstake');
        });

        it('resolves Claim correctly (both classes)', () => {
            expect(resolveTransactionType(['ValidatorClaimXrd'], [], mockTt)).toBe('Claim XRD');
            expect(resolveTransactionType(['ValidatorClaim'], [], mockTt)).toBe('Claim XRD');
        });

        it('resolves Transfer correctly', () => {
            expect(resolveTransactionType(['Transfer'], [], mockTt)).toBe('Transfer');
        });

        it('resolves unknown class by returning the class name itself', () => {
            expect(resolveTransactionType(['UnknownClass'], [], mockTt)).toBe('UnknownClass');
        });

        it('falls back to default English string if translations are missing', () => {
            expect(resolveTransactionType(['ValidatorStake'], [], {})).toBe('Stake');
            expect(resolveTransactionType(['ValidatorUnstake'], [], {})).toBe('Unstake');
            expect(resolveTransactionType([], [], {})).toBe('General');
            expect(resolveTransactionType(['ProtocolVote'], [], {})).toBe('Protocol Vote');
        });
    });

    describe('getTransactionFlags', () => {
        it('returns true for isStake when class is ValidatorStake', () => {
            const flags = getTransactionFlags(['ValidatorStake', 'Transfer']);
            expect(flags).toEqual({
                isStake: true,
                isUnstake: false,
                isClaim: false,
                isTransfer: false,
            });
        });

        it('returns true for isUnstake when class is ValidatorUnstake', () => {
            expect(getTransactionFlags(['ValidatorUnstake']).isUnstake).toBe(true);
        });

        it('returns true for isClaim when class is ValidatorClaimXrd', () => {
            expect(getTransactionFlags(['ValidatorClaimXrd']).isClaim).toBe(true);
            expect(getTransactionFlags(['ValidatorClaim']).isClaim).toBe(true);
        });

        it('returns true for isTransfer when class is Transfer', () => {
            expect(getTransactionFlags(['Transfer']).isTransfer).toBe(true);
        });

        it('returns all false for unknown classes or empty array', () => {
            const emptyFlags = getTransactionFlags([]);
            expect(emptyFlags.isStake).toBe(false);
            expect(emptyFlags.isTransfer).toBe(false);

            const unknownFlags = getTransactionFlags(['SomeOtherClass']);
            expect(unknownFlags.isStake).toBe(false);
        });
    });
});
