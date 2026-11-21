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
        initiators: new Set([ACCOUNT_1]),
        realTransferAddresses: new Set([ACCOUNT_1]),
        actualFeePaid: '1.0',
        t: {} as unknown as TranslationsT,
        tt: {} as unknown as TranslationsT['dashboard']['transactions'],
        onCopy: vi.fn(),
        onResourceClick: vi.fn(),
        copiedAddress: null,
        formatEntity: (e: string) => e,
        network: 'mainnet' as const,
        columns: 3,
        locale: 'en',
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

    it('renders fee as primary row on receiver side when address is not an initiator', () => {
        const group: FungibleChange[] = [
            { entity_address: ACCOUNT_2, resource_address: XRD, balance_change: '-1', is_fee: true },
        ];
        const props = { ...baseProps, initiators: new Set([ACCOUNT_1]) };
        const bc: BalanceChanges = { fungible_balance_changes: [], fungible_fee_balance_changes: group };

        render(<AssetTransferGroup {...props} group={group} balanceChanges={bc} />);
        
        const feeRow = screen.getByTestId('balance-row');
        expect(feeRow.getAttribute('data-is-fee')).toBe('true');
        expect(feeRow.getAttribute('data-side')).toBe('receiver');
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

    it('constrains both origin and destination flex columns with min-w-0 so wide content cannot squeeze the sibling column', () => {
        const group: FungibleChange[] = [
            { entity_address: ACCOUNT_1, resource_address: XRD, balance_change: '-10' },
            { entity_address: ACCOUNT_2, resource_address: XRD, balance_change: '10' },
        ];
        const bc: BalanceChanges = { fungible_balance_changes: group, fungible_fee_balance_changes: [] };

        const { container } = render(<AssetTransferGroup {...baseProps} group={group} balanceChanges={bc} />);
        const columns = container.querySelectorAll('div.flex-1.p-3');
        expect(columns).toHaveLength(2);
        for (const col of columns) {
            expect(col.className).toContain('min-w-0');
        }
    });

    it('places the Faucet component in Origin (with nested fee) and the recipient account in Destination', () => {
        const STOKENET_FAUCET = 'component_tdx_2_1cptxxxxxxxxxfaucetxxxxxxxxx000527798379xxxxxxxxxyulkzl';
        const RECIPIENT = 'account_tdx_2_128kdm8cy2exfj4f37r2t7vz6skclvm8dyrgwz76r69ds43f2q4l0dl';
        const STOKENET_XRD = 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc';

        const group: FungibleChange[] = [
            { entity_address: STOKENET_FAUCET, resource_address: STOKENET_XRD, balance_change: '-10000' },
            { entity_address: RECIPIENT, resource_address: STOKENET_XRD, balance_change: '10000' },
            { entity_address: STOKENET_FAUCET, resource_address: STOKENET_XRD, balance_change: '-0.59365336649', is_fee: true },
        ];
        const bc: BalanceChanges = {
            fungible_balance_changes: group.slice(0, 2),
            fungible_fee_balance_changes: [
                { type: 'FeePayment', entity_address: STOKENET_FAUCET, resource_address: STOKENET_XRD, balance_change: '-0.59365336649' },
            ],
            non_fungible_balance_changes: [],
        };

        render(
            <AssetTransferGroup
                {...baseProps}
                network="stokenet"
                group={group}
                balanceChanges={bc}
                initiators={new Set([STOKENET_FAUCET])}
                realTransferAddresses={new Set([STOKENET_FAUCET, RECIPIENT])}
            />
        );

        const rows = screen.getAllByTestId('balance-row');
        const faucetTransferRow = rows.find(r => r.textContent === STOKENET_FAUCET && r.getAttribute('data-is-fee') === 'false');
        const faucetFeeRow = rows.find(r => r.textContent === STOKENET_FAUCET && r.getAttribute('data-is-fee') === 'true');
        const recipientRow = rows.find(r => r.textContent === RECIPIENT && r.getAttribute('data-is-fee') === 'false');

        expect(faucetTransferRow?.getAttribute('data-side')).toBe('sender');
        expect(faucetFeeRow?.getAttribute('data-side')).toBe('sender');
        expect(recipientRow?.getAttribute('data-side')).toBe('receiver');
        expect(screen.queryByText(/Minted through the component/i)).toBeNull();
    });

    it('separates sender and receiver into Origin and Destination on each card of a subintent P2P swap', () => {
        const ACCOUNT_A = 'account_tdx_2_12xxzejnznsxh7r2m9p29f6cntfs0pc7j66tdn45a3xexnmckjdhdy9';
        const ACCOUNT_B = 'account_tdx_2_12yq4pxcsrlqc5dk6c297697nq5qvlw3wcycza87kl6s7vg3axh9hm9';
        const STOKENET_XRD = 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc';
        const TOKEN_X = 'resource_tdx_2_1th7w39rfv8dux3egj68femh6e5kp20xruxv8u5ll4j0xnh6enw4kfx';

        const bc: BalanceChanges = {
            fungible_balance_changes: [
                { entity_address: ACCOUNT_A, resource_address: STOKENET_XRD, balance_change: '100' },
                { entity_address: ACCOUNT_A, resource_address: TOKEN_X, balance_change: '-10' },
                { entity_address: ACCOUNT_B, resource_address: STOKENET_XRD, balance_change: '-100' },
                { entity_address: ACCOUNT_B, resource_address: TOKEN_X, balance_change: '10' },
            ],
            fungible_fee_balance_changes: [
                { type: 'FeePayment', entity_address: ACCOUNT_A, resource_address: STOKENET_XRD, balance_change: '-0.55244992933' },
            ],
            non_fungible_balance_changes: [],
        };
        const bothInitiators = new Set([ACCOUNT_A, ACCOUNT_B]);

        // Card 1: XRD (Account B sends -100 XRD -> Account A receives +100 XRD and pays fee)
        const xrdGroup: FungibleChange[] = [
            { entity_address: ACCOUNT_A, resource_address: STOKENET_XRD, balance_change: '100' },
            { entity_address: ACCOUNT_B, resource_address: STOKENET_XRD, balance_change: '-100' },
            { entity_address: ACCOUNT_A, resource_address: STOKENET_XRD, balance_change: '-0.55244992933', is_fee: true },
        ];
        const { unmount } = render(
            <AssetTransferGroup
                {...baseProps}
                network="stokenet"
                group={xrdGroup}
                balanceChanges={bc}
                initiators={bothInitiators}
                realTransferAddresses={bothInitiators}
            />
        );
        const xrdRows = screen.getAllByTestId('balance-row');
        expect(xrdRows.find(r => r.textContent === ACCOUNT_B && r.getAttribute('data-is-fee') === 'false')?.getAttribute('data-side')).toBe('sender');
        expect(xrdRows.find(r => r.textContent === ACCOUNT_A && r.getAttribute('data-is-fee') === 'false')?.getAttribute('data-side')).toBe('receiver');
        expect(xrdRows.find(r => r.textContent === ACCOUNT_A && r.getAttribute('data-is-fee') === 'true')?.getAttribute('data-side')).toBe('receiver');
        expect(screen.queryByText(/Deposited into the origin account itself/i)).toBeNull();
        unmount();

        // Card 2: TOKEN_X (Account A sends -10 TOKEN_X -> Account B receives +10 TOKEN_X)
        const tokenGroup: FungibleChange[] = [
            { entity_address: ACCOUNT_A, resource_address: TOKEN_X, balance_change: '-10' },
            { entity_address: ACCOUNT_B, resource_address: TOKEN_X, balance_change: '10' },
        ];
        render(
            <AssetTransferGroup
                {...baseProps}
                network="stokenet"
                group={tokenGroup}
                balanceChanges={bc}
                initiators={bothInitiators}
                realTransferAddresses={bothInitiators}
            />
        );
        const tokenRows = screen.getAllByTestId('balance-row');
        expect(tokenRows.find(r => r.textContent === ACCOUNT_A && r.getAttribute('data-is-fee') === 'false')?.getAttribute('data-side')).toBe('sender');
        expect(tokenRows.find(r => r.textContent === ACCOUNT_B && r.getAttribute('data-is-fee') === 'false')?.getAttribute('data-side')).toBe('receiver');
        expect(screen.queryByText(/Deposited into the origin account itself/i)).toBeNull();
    });
});
