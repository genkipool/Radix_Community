import { describe, it, expect } from 'vitest';
import { extractSelfTransfers, selfTransferCards } from '@/features/dashboard/explorador/utils/selfTransfers';
import type { BalanceChanges } from '@/features/dashboard/explorador/types';
import type { GatewayEvent } from '@/features/dashboard/types';

const ACCOUNT = 'account_rdx1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER = 'account_rdx1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
const NFT = 'resource_rdx1nfccccccccccccccccccccccccccccccccccccccccccccccccccc';
const VAULT = 'internal_vault_rdx1tzdddddddddddddddddddddddddddddddddddddddddddddddddd';

const resource = (address: string) => ({ kind: 'Reference', type_name: 'ResourceAddress', value: address });
const fungible = (name: string, address: string, amount: string, emitter = ACCOUNT) =>
    ({ name, emitter: { entity: { entity_address: emitter } }, data: { kind: 'Enum', variant_name: 'Fungible', fields: [resource(address), { kind: 'Decimal', value: amount }] } }) as unknown as GatewayEvent;
const nonFungible = (name: string, address: string, ids: string[]) =>
    ({
        name,
        emitter: { entity: { entity_address: ACCOUNT } },
        data: { kind: 'Enum', variant_name: 'NonFungible', fields: [resource(address), { kind: 'Array', elements: ids.map((value) => ({ kind: 'NonFungibleLocalId', value })) }] },
    }) as unknown as GatewayEvent;
const noChanges: BalanceChanges = { fungible_fee_balance_changes: [], fungible_balance_changes: [], non_fungible_balance_changes: [] } as unknown as BalanceChanges;

describe('extractSelfTransfers', () => {
    it('finds tokens an account withdrew and deposited back into itself', () => {
        const events = [
            fungible('WithdrawEvent', XRD, '5', VAULT), // the fee lock, inside the vault
            fungible('WithdrawEvent', XRD, '1'),
            fungible('DepositEvent', XRD, '1'),
        ];
        expect(extractSelfTransfers(events, noChanges)).toEqual([{ account: ACCOUNT, resource: XRD, amount: 1 }]);
    });

    it('finds NFTs sent back to the same account', () => {
        const events = [nonFungible('WithdrawEvent', NFT, ['#1#', '#2#']), nonFungible('DepositEvent', NFT, ['#1#', '#2#'])];
        expect(extractSelfTransfers(events, noChanges)).toEqual([{ account: ACCOUNT, resource: NFT, ids: ['#1#', '#2#'] }]);
    });

    it('leaves to the transfer cards whatever shows up as a balance change', () => {
        const events = [fungible('WithdrawEvent', XRD, '10'), fungible('DepositEvent', XRD, '2')];
        const refund = { ...noChanges, fungible_balance_changes: [{ entity_address: ACCOUNT, resource_address: XRD, balance_change: '-8' }] } as unknown as BalanceChanges;
        expect(extractSelfTransfers(events, refund)).toEqual([]);
    });

    it('ignores plain transfers between two accounts', () => {
        const events = [fungible('WithdrawEvent', XRD, '1'), fungible('DepositEvent', XRD, '1', OTHER)];
        expect(extractSelfTransfers(events, noChanges)).toEqual([]);
    });
});

describe('selfTransferCards', () => {
    it('puts the account on both sides, keeps the fee and gives one group per asset', () => {
        const fee = { type: 'FeePayment', entity_address: ACCOUNT, resource_address: XRD, balance_change: '-0.2' };
        const changes = { ...noChanges, fungible_fee_balance_changes: [fee] } as unknown as BalanceChanges;
        const { balanceChanges, groups } = selfTransferCards(
            [{ account: ACCOUNT, resource: XRD, amount: 1 }, { account: ACCOUNT, resource: NFT, ids: ['#1#'] }],
            changes,
        );
        expect(groups).toEqual([
            [
                { entity_address: ACCOUNT, resource_address: XRD, balance_change: '-1' },
                { entity_address: ACCOUNT, resource_address: XRD, balance_change: '1' },
            ],
            [{ entity_address: ACCOUNT, resource_address: NFT, balance_change: '0' }],
        ]);
        expect(balanceChanges.fungible_fee_balance_changes).toEqual([fee]);
        expect(balanceChanges.non_fungible_balance_changes).toEqual([{ entity_address: ACCOUNT, resource_address: NFT, added: ['#1#'], removed: ['#1#'] }]);
    });
});
