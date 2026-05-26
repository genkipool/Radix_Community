import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { useStakingTransaction } from '@/features/dashboard/staking/hooks/useStakingTransaction';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { getOrCreateToolkit } from '@/features/wallet/lib/radix-toolkit';
import {
    buildStakeManifest,
    buildUnstakeManifest,
    buildClaimManifest
} from '@/features/wallet/lib/manifest-builders';

// Mock dependencies
vi.mock('@/features/wallet/hooks/useRadixWallet', () => ({
    useRadixWallet: vi.fn(),
}));

vi.mock('@/features/wallet/lib/radix-toolkit', () => ({
    getOrCreateToolkit: vi.fn(),
}));

vi.mock('@/features/wallet/constants/radix-addresses', () => ({
    RADIX_TOKEN_ADDRESSES: {
        'mainnet': {
            XRD: 'resource_mainnet_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
        }
    }
}));

vi.mock('@/features/wallet/lib/manifest-builders', () => ({
    buildStakeManifest: vi.fn(),
    buildUnstakeManifest: vi.fn(),
    buildClaimManifest: vi.fn(),
    buildOwnerStakeManifest: vi.fn(),
    buildOwnerUnstakeManifest: vi.fn(),
    buildOwnerClaimManifest: vi.fn(),
}));

describe('useStakingTransaction', () => {
    const mockSendTransaction = vi.fn();
    
    beforeEach(() => {
        vi.clearAllMocks();
        
        // Default mocks
        (useRadixWallet as Mock).mockReturnValue({ activeNetworkId: 'mainnet' });
        
        (getOrCreateToolkit as Mock).mockReturnValue({
            walletApi: {
                sendTransaction: mockSendTransaction
            }
        });

        // Mock successful transaction by default
        mockSendTransaction.mockResolvedValue({
            isErr: () => false,
            value: { transactionIntentHash: 'tx_hash_123' }
        });

        // Default returned manifests
        (buildStakeManifest as Mock).mockReturnValue('STAKE_MANIFEST');
        (buildUnstakeManifest as Mock).mockReturnValue('UNSTAKE_MANIFEST');
        (buildClaimManifest as Mock).mockReturnValue('CLAIM_MANIFEST');
    });

    it('should submit a Stake transaction successfully', async () => {
        const { result } = renderHook(() => useStakingTransaction());
        
        let txHash;
        await act(async () => {
            txHash = await result.current.submitTransaction(
                'account_123',
                'validator_456',
                'Stake',
                'delegator',
                100,
                'lsu_123'
            );
        });

        expect(buildStakeManifest).toHaveBeenCalledWith(
            'account_123',
            'validator_456',
            100,
            'resource_mainnet_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
        );
        expect(mockSendTransaction).toHaveBeenCalledWith({
            transactionManifest: 'STAKE_MANIFEST',
            version: 1
        });
        expect(txHash).toBe('tx_hash_123');
        expect(result.current.error).toBeNull();
    });

    it('should submit an Unstake transaction successfully', async () => {
        const { result } = renderHook(() => useStakingTransaction());
        
        let txHash;
        await act(async () => {
            txHash = await result.current.submitTransaction(
                'account_123',
                'validator_456',
                'Unstake',
                'delegator',
                50,
                'lsu_123'
            );
        });

        expect(buildUnstakeManifest).toHaveBeenCalledWith(
            'account_123',
            'validator_456',
            50,
            'lsu_123'
        );
        expect(mockSendTransaction).toHaveBeenCalledWith({
            transactionManifest: 'UNSTAKE_MANIFEST',
            version: 1
        });
        expect(txHash).toBe('tx_hash_123');
        expect(result.current.error).toBeNull();
    });

    it('should submit a Claim transaction successfully', async () => {
        const { result } = renderHook(() => useStakingTransaction());
        
        let txHash;
        await act(async () => {
            txHash = await result.current.submitTransaction(
                'account_123',
                'validator_456',
                'Claim',
                'delegator',
                0, // Amount is not used for claim
                'lsu_123',
                ['nft_1', 'nft_2'],
                'claim_nft_resource_123'
            );
        });

        expect(buildClaimManifest).toHaveBeenCalledWith(
            'account_123',
            'validator_456',
            ['nft_1', 'nft_2'],
            'claim_nft_resource_123'
        );
        expect(mockSendTransaction).toHaveBeenCalledWith({
            transactionManifest: 'CLAIM_MANIFEST',
            version: 1
        });
        expect(txHash).toBe('tx_hash_123');
        expect(result.current.error).toBeNull();
    });

    it('should handle wallet rejection error', async () => {
        mockSendTransaction.mockResolvedValueOnce({
            isErr: () => true,
            error: { error: 'Rejected by user' }
        });

        const { result } = renderHook(() => useStakingTransaction());
        
        let txHash;
        await act(async () => {
            txHash = await result.current.submitTransaction(
                'account_123',
                'validator_456',
                'Stake',
                'delegator',
                100,
                'lsu_123'
            );
        });

        expect(txHash).toBeNull();
        expect(result.current.error).toBe('Rejected by user');
    });
});
