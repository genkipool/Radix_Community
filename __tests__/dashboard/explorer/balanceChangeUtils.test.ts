import { describe, it, expect } from 'vitest';
import { getResourceGroups, getInitiators, getNftOnlyGroups } from '@/features/dashboard/explorador/utils/balanceChangeUtils';
import type { BalanceChanges } from '@/features/dashboard/explorador/types';

describe('balanceChangeUtils', () => {
    const XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
    const ACCOUNT_1 = 'account_rdx12yv6vyky9n9k5p5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6';
    const ACCOUNT_2 = 'account_rdx12v6vyky9n9k5p5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6';
    const CM = 'consensusmanager_rdx1scxxxxxxxxxxcnsmgrxxxxxxxxx000999993157';

    describe('getResourceGroups', () => {
        it('groups fungible changes by resource address', () => {
            const bc: BalanceChanges = {
                fungible_balance_changes: [
                    { entity_address: ACCOUNT_1, resource_address: XRD, balance_change: '-10' },
                    { entity_address: ACCOUNT_2, resource_address: XRD, balance_change: '10' },
                ]
            };
            const groups = getResourceGroups(bc);
            expect(groups).toHaveLength(1);
            expect(groups[0]).toHaveLength(2);
        });

        it('includes fee balance changes and marks them with is_fee', () => {
            const bc: BalanceChanges = {
                fungible_fee_balance_changes: [
                    { entity_address: ACCOUNT_1, resource_address: XRD, balance_change: '-1' },
                ]
            };
            const groups = getResourceGroups(bc);
            expect(groups[0][0]).toMatchObject({
                entity_address: ACCOUNT_1,
                balance_change: '-1',
                is_fee: true
            });
        });

        it('filters out managerconsensus (CM) addresses', () => {
            const bc: BalanceChanges = {
                fungible_balance_changes: [
                    { entity_address: ACCOUNT_1, resource_address: XRD, balance_change: '10' },
                    { entity_address: CM, resource_address: XRD, balance_change: '-10' },
                ],
                fungible_fee_balance_changes: [
                    { entity_address: CM, resource_address: XRD, balance_change: '1' },
                ]
            };
            const groups = getResourceGroups(bc);
            expect(groups[0]).toHaveLength(1);
            expect(groups[0][0].entity_address).toBe(ACCOUNT_1);
        });
    });

    describe('getInitiators', () => {
        it('returns only addresses with negative balance change', () => {
            const bc: BalanceChanges = {
                fungible_balance_changes: [
                    { entity_address: ACCOUNT_1, resource_address: XRD, balance_change: '-10' },
                    { entity_address: ACCOUNT_2, resource_address: XRD, balance_change: '10' },
                ]
            };
            const senders = getInitiators(bc);
            expect(senders.has(ACCOUNT_1)).toBe(true);
            expect(senders.has(ACCOUNT_2)).toBe(false);
        });

        it('excludes managerconsensus from sender list', () => {
            const bc: BalanceChanges = {
                fungible_balance_changes: [
                    { entity_address: CM, resource_address: XRD, balance_change: '-100' },
                ]
            };
            const senders = getInitiators(bc);
            expect(senders.size).toBe(0);
        });
    });

    describe('getNftOnlyGroups', () => {
        it('returns empty if resourceGroups exist', () => {
            const bc: BalanceChanges = {
                non_fungible_balance_changes: [
                    { entity_address: ACCOUNT_1, resource_address: 'nft_1', added: ['id1'], removed: [] }
                ]
            };
            const groups = getNftOnlyGroups(bc, 1); // 1 means resourceGroups.length > 0
            expect(groups).toHaveLength(0);
        });

        it('creates synthetic groups if no fungible changes exist but NFTs do', () => {
            const bc: BalanceChanges = {
                non_fungible_balance_changes: [
                    { entity_address: ACCOUNT_1, resource_address: 'nft_1', added: ['id1'], removed: [] }
                ]
            };
            const groups = getNftOnlyGroups(bc, 0); // 0 means no fungible changes
            expect(groups).toHaveLength(1);
            expect(groups[0][0]).toMatchObject({
                entity_address: ACCOUNT_1,
                balance_change: '0'
            });
        });
    });
});
