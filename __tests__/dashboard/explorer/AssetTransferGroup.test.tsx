import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Mock the hook and component that fetch data
vi.mock('@/features/dashboard/hooks/useEntityData', () => ({
    useEntityData: vi.fn(() => null),
    isConsensusManager: vi.fn((addr) => addr.startsWith('consensusmanager')),
    entityKeys: { detail: vi.fn(() => ['entity', 'detail']) },
}));

vi.mock('@/features/dashboard/explorador/components/EntityBadge', () => ({
    EntityBadge: vi.fn(({ address }: { address: string }) => <div data-testid="entity-badge">{address}</div>),
    AddressDisplay: vi.fn(({ address }: { address: string }) => <div data-testid="address-display">{address}</div>),
    ConsensusManagerInfoCard: vi.fn(() => null),
    ValidatorNameLabel: vi.fn(() => null),
}));

// Mock BalanceChangeRow and others
vi.mock('@/features/dashboard/explorador/components/BalanceChangeRow', () => ({
    BalanceChangeRow: vi.fn(({ change, side }: { change: FungibleChange; side: string }) => (
        <div data-testid="balance-row" data-side={side} data-is-fee={change.is_fee ? 'true' : 'false'}>
            {change.entity_address}
        </div>
    )),
}));

vi.mock('@/features/dashboard/explorador/components/NftTransferCard', () => ({
    NftTransferCard: vi.fn(() => <div data-testid="nft-card" />),
}));
vi.mock('@/features/dashboard/explorador/components/TransferFooter', () => ({
    TransferFooter: vi.fn(() => <div data-testid="transfer-footer" />),
}));

import { AssetTransferGroup } from '@/features/dashboard/explorador/components/AssetTransferGroup';
import type { BalanceChanges, FungibleChange } from '@/features/dashboard/explorador/types';
import type { TranslationsT } from '@/features/dashboard/types';

describe('AssetTransferGroup', () => {
    const ACCOUNT_1 = 'account_rdx12yv6vyky9n9k5p5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6';
    const ACCOUNT_2 = 'account_rdx12v6vyky9n9k5p5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6q7p8z5z6';
    const XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';

    const baseProps = {
        allSenderAddresses: new Set([ACCOUNT_1]),
        realTransferAddresses: new Set([ACCOUNT_1]),
        actualFeePaid: '1.0',
        t: {} as unknown as TranslationsT,
        tt: {} as unknown as TranslationsT['dashboard']['transactions'],
        onCopy: vi.fn(),
        copiedAddress: null,
        formatEntity: (e: string) => e,
        network: 'mainnet' as const,
        columns: 3,
    };

    it('nests a fee under an origin transfer row', () => {
        const group: FungibleChange[] = [
            { entity_address: ACCOUNT_1, resource_address: XRD, balance_change: '-10' },
            { entity_address: ACCOUNT_1, resource_address: XRD, balance_change: '-1', is_fee: true },
        ];
        const bc: BalanceChanges = { fungible_balance_changes: group.slice(0, 1), fungible_fee_balance_changes: group.slice(1) };

        render(<AssetTransferGroup {...baseProps} group={group} balanceChanges={bc} />);
        
        const rows = screen.getAllByTestId('balance-row');
        expect(rows).toHaveLength(2);
        
        const feeRow = rows.find(r => r.getAttribute('data-is-fee') === 'true');
        expect(feeRow?.getAttribute('data-side')).toBe('sender');
    });

    it('renders fee as primary row on origin if no non-fee row exists for that address', () => {
        const group: FungibleChange[] = [
            { entity_address: ACCOUNT_2, resource_address: XRD, balance_change: '-1', is_fee: true },
        ];
        const props = { ...baseProps, allSenderAddresses: new Set([ACCOUNT_1]) };
        const bc: BalanceChanges = { fungible_balance_changes: [], fungible_fee_balance_changes: group };

        render(<AssetTransferGroup {...props} group={group} balanceChanges={bc} />);
        
        const feeRow = screen.getByTestId('balance-row');
        expect(feeRow.getAttribute('data-is-fee')).toBe('true');
        expect(feeRow.getAttribute('data-side')).toBe('sender');
    });

    it('nests destination-side fee correctly', () => {
        const group: FungibleChange[] = [
            { entity_address: ACCOUNT_2, resource_address: XRD, balance_change: '10' },
            { entity_address: ACCOUNT_2, resource_address: XRD, balance_change: '-1', is_fee: true },
        ];
        const bc: BalanceChanges = { fungible_balance_changes: [group[0]], fungible_fee_balance_changes: [group[1]] };

        render(<AssetTransferGroup {...baseProps} group={group} balanceChanges={bc} />);
        
        const rows = screen.getAllByTestId('balance-row');
        expect(rows).toHaveLength(2);
        
        const receiverRow = rows.find(r => r.getAttribute('data-is-fee') === 'false');
        expect(receiverRow?.getAttribute('data-side')).toBe('receiver');

        const feeRow = rows.find(r => r.getAttribute('data-is-fee') === 'true');
        expect(feeRow?.getAttribute('data-side')).toBe('receiver');
    });
});
