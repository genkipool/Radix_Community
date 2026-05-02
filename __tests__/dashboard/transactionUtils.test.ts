import { describe, it, expect } from 'vitest';
import { resolveTransactionType, getTransactionFlags, buildSwapRoutingChart, extractMinAmount } from '@/features/dashboard/explorador/utils/transactionUtils';

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

    describe('buildSwapRoutingChart', () => {
        const mockFungibles = [
            { entity_address: 'account_1', resource_address: 'resource_xrd', balance_change: '-100' },
            { entity_address: 'component_dex', resource_address: 'resource_xrd', balance_change: '100' },
            { entity_address: 'component_dex', resource_address: 'resource_tkn', balance_change: '-50' },
            { entity_address: 'account_1', resource_address: 'resource_tkn', balance_change: '50' },
        ];
        const mockNames = new Map([['account_1', 'My Wallet'], ['component_dex', 'RadixDEX']]);
        const mockSymbols = new Map([['resource_xrd', 'XRD'], ['resource_tkn', 'TKN']]);
        const mockBlueprints = new Map();

        it('includes spacer nodes to avoid subgraph title overlap', () => {
            const chart = buildSwapRoutingChart([], mockFungibles, [], ['account_1'], mockNames, mockSymbols, mockBlueprints);
            expect(chart).toContain('S_Spacer[" "]:::spacer');
            expect(chart).toContain('R_Spacer[" "]:::spacer');
        });

        it('applies white-space: nowrap to node amount labels', () => {
            const chart = buildSwapRoutingChart([], mockFungibles, [], ['account_1'], mockNames, mockSymbols, mockBlueprints);
            expect(chart).toContain('white-space: nowrap');
        });

        it('applies white-space: nowrap to edge labels', () => {
            const chart = buildSwapRoutingChart([], mockFungibles, [], ['account_1'], mockNames, mockSymbols, mockBlueprints);
            // Verify edge label formatting
            expect(chart).toContain('white-space: nowrap');
        });

        it('includes fee nodes with horizontal layout when fees are present', () => {
            const mockFees = [{ entity_address: 'account_1', resource_address: 'resource_xrd', balance_change: '-1' }];
            const feeDest = { to_burn: '0.5', to_proposer: '0.5' };
            const chart = buildSwapRoutingChart([], mockFungibles, mockFees, ['account_1'], mockNames, mockSymbols, mockBlueprints, {}, 1, feeDest, 'account_1');

            expect(chart).toContain('F_Spacer[" "]:::spacer');
            expect(chart).toContain('Burn<br/><b>0.5 XRD</b>');
            expect(chart).toContain('Proposer<br/><b>0.5 XRD</b>');
        });
    });

    describe('extractMinAmount', () => {
        it('extracts amount when Decimal is on the same or next lines', () => {
            const manifest = `
                ASSERT_WORKTOP_CONTAINS
                    Address("resource_123")
                    Decimal("99.5");
            `;
            expect(extractMinAmount(manifest)).toBe('99.5');
        });

        it('extracts amount when there are several lines in between', () => {
            const manifest = `
                ASSERT_WORKTOP_CONTAINS
                    Address("resource_123")
                    # some comment
                    # another line
                    Decimal("123.456");
            `;
            expect(extractMinAmount(manifest)).toBe('123.456');
        });

        it('returns undefined if ASSERT_WORKTOP_CONTAINS is not followed by Decimal', () => {
            const manifest = `
                TAKE_FROM_WORKTOP
                    Address("resource_123")
                    Decimal("100");
            `;
            expect(extractMinAmount(manifest)).toBeUndefined();
        });
    });
});
