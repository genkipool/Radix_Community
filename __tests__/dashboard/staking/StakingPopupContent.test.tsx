import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StakingPopupContent } from '@/features/dashboard/staking/components/StakingPopupContent';
import { type Validator } from '@/types/radix';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock dependencies
vi.mock('@/features/wallet/hooks/useRadixWallet', () => ({
    useRadixWallet: () => ({
        accounts: [{ address: 'account_rdx123', label: 'My Account' }],
        activeNetworkId: 1,
    }),
}));

vi.mock('@/features/dashboard/staking/hooks/useAccountStakingData', () => ({
    useAccountStakingData: () => ({
        data: {
            xrdBalance: 1000,
            lsuBalance: 500,
            pendingUnstake: 100,
            claimableXrd: 50,
            claimNftIds: ['nft1'],
            ownerClaimNftIds: [],
            isOwner: false,
        },
        isLoading: false,
    }),
}));

const submitTransactionMock = vi.fn().mockResolvedValue('txid_mock');
vi.mock('@/features/dashboard/staking/hooks/useStakingTransaction', () => ({
    useStakingTransaction: () => ({
        submitTransaction: submitTransactionMock,
        isTransacting: false,
        error: null,
    }),
}));

vi.mock('@/features/games/hooks/useXrdPrice', () => ({
    useXrdPrice: () => ({
        price: { usd: 0.05, eur: 0.04 },
    }),
}));

const mockValidator: Validator = {
    id: 'val_1',
    name: 'Test Validator',
    address: 'validator_rdx123',
    status: 'active',
    nominalFee: 1.5,
    recentUptime: 99.9,
    apy: 5.4,
    totalStakeXRD: 1000000,
    delegatedStake: 1000000,
    delegatedStakePercent: 1.2,
    iconUrl: '',
    uptimePercent: 99.9,
    apyProjection: 5.4,
    effectiveFee: 1.5,
    delegators: 100,
    description: '',
    website: '',
    provider: '',
    providerPercent: 100,
    country: '',
    countryPercent: 100,
    tags: [],
    onlineStatus: true,
    externalStakeAccepted: true,
    acceptsConnect: true,
    protocolUpdateVote: 'yes',
    registered: true,
    publicKey: '',
    lsuResource: 'resource_lsu123',
    recentProposalsMissed: 0,
    recentProposalsMade: 0,
    totalProposalsMissed: 0,
    totalProposalsMade: 0,
    totalUptime: 99.9,
    startOfLiveProposalsMade: 0,
    startOfLiveProposalsMissed: 0,
    serverLiveProposalsMade: 0,
    serverLiveProposalsMissed: 0,
    rank: 1,
    ownerDelegation: 0,
    ownerAddress: '',
    lsu2xrdFactor: 1,
    feePercent: 1.5,
    ownerStake: 0,
    proposalsMade: 0,
    proposalsMissed: 0,
    epochPerformance: [],
    countryCode: 'US',
    version: '1.0.0',
    commit: 'abcdef',
    claimTokenResourceAddress: 'resource_claim123'
};

const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
});

describe('StakingPopupContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = () => {
        return render(
            <QueryClientProvider client={queryClient}>
                <StakingPopupContent validator={mockValidator} />
            </QueryClientProvider>
        );
    };

    it('renders Stake, Unstake, and Claim buttons', () => {
        renderComponent();
        expect(screen.getByText('Stake')).toBeInTheDocument();
        expect(screen.getByText('Unstake')).toBeInTheDocument();
        expect(screen.getByText('Claim')).toBeInTheDocument();
    });

    it('calls submitTransaction with correct arguments for Stake', async () => {
        renderComponent();
        
        // Enter amount
        const input = screen.getByPlaceholderText(/Cantidad/i);
        fireEvent.change(input, { target: { value: '100' } });

        // Click Stake
        const stakeBtn = screen.getByText('Stake');
        fireEvent.click(stakeBtn);

        await waitFor(() => {
            expect(submitTransactionMock).toHaveBeenCalledWith(
                'account_rdx123',
                'validator_rdx123',
                'Stake',
                'delegator',
                100,
                'resource_lsu123',
                ['nft1'],
                'resource_claim123'
            );
        });
    });

    it('calls submitTransaction with correct arguments for Unstake', async () => {
        renderComponent();
        
        const input = screen.getByPlaceholderText(/Cantidad/i);
        fireEvent.change(input, { target: { value: '50' } });

        const unstakeBtn = screen.getByText('Unstake');
        fireEvent.click(unstakeBtn);

        await waitFor(() => {
            expect(submitTransactionMock).toHaveBeenCalledWith(
                'account_rdx123',
                'validator_rdx123',
                'Unstake',
                'delegator',
                50, // 50 / lsu2xrdFactor (which is 1)
                'resource_lsu123',
                ['nft1'],
                'resource_claim123'
            );
        });
    });

    it('calls submitTransaction with correct arguments for Claim', async () => {
        renderComponent();
        
        const claimBtn = screen.getByText('Claim');
        fireEvent.click(claimBtn);

        await waitFor(() => {
            expect(submitTransactionMock).toHaveBeenCalledWith(
                'account_rdx123',
                'validator_rdx123',
                'Claim',
                'delegator',
                0, // Amount is not required for claim, but it passes the input amount (0)
                'resource_lsu123',
                ['nft1'],
                'resource_claim123'
            );
        });
    });
});
