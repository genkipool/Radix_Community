import { useState } from 'react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { getOrCreateToolkit } from '@/features/wallet/lib/radix-toolkit';
import { RADIX_TOKEN_ADDRESSES } from '@/features/wallet/constants/radix-addresses';
import {
    buildStakeManifest,
    buildUnstakeManifest,
    buildClaimManifest,
    buildOwnerStakeManifest,
    buildOwnerUnstakeManifest,
    buildOwnerClaimManifest,
} from '@/features/wallet/lib/manifest-builders';
import { StakingAction, StakingTab } from '../types/staking-operations.types';

export const useStakingTransaction = () => {
    const { activeNetworkId } = useRadixWallet();
    const [isTransacting, setIsTransacting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submitTransaction = async (
            accountAddress: string,
            validatorAddress: string,
            action: StakingAction,
            tab: StakingTab,
            amount: number,
            lsuResourceAddress: string,
            claimNftIds?: string[]
        ) => {
            if (!activeNetworkId) {
                setError('No active network');
                return null;
            }

            const rdt = getOrCreateToolkit(activeNetworkId);
            if (!rdt) {
                setError('Radix Dapp Toolkit not initialized');
                return null;
            }

            const xrdAddress = RADIX_TOKEN_ADDRESSES[activeNetworkId]?.XRD;
            if (!xrdAddress) {
                setError('XRD address not found for network');
                return null;
            }

            setIsTransacting(true);
            setError(null);

            try {
                let manifest = '';

                if (tab === 'delegator') {
                    if (action === 'Stake') {
                        manifest = buildStakeManifest(accountAddress, validatorAddress, amount, xrdAddress);
                    } else if (action === 'Unstake') {
                        manifest = buildUnstakeManifest(accountAddress, validatorAddress, amount, lsuResourceAddress);
                    } else if (action === 'Claim') {
                        // Assuming claimNftResourceAddress is passed in place of lsuResourceAddress for Claim
                        manifest = buildClaimManifest(accountAddress, validatorAddress, claimNftIds || [], lsuResourceAddress);
                    }
                } else if (tab === 'validator') {
                    if (action === 'Stake') {
                        manifest = buildOwnerStakeManifest(accountAddress, validatorAddress, amount, xrdAddress, lsuResourceAddress);
                    } else if (action === 'Unstake') {
                        manifest = buildOwnerUnstakeManifest(accountAddress, validatorAddress, amount);
                    } else if (action === 'Claim') {
                        manifest = buildOwnerClaimManifest(accountAddress, validatorAddress, claimNftIds || [], lsuResourceAddress);
                    }
                }

                if (!manifest) {
                    throw new Error('Unsupported action');
                }

                const result = await rdt.walletApi.sendTransaction({
                    transactionManifest: manifest,
                    version: 1,
                });

                if (result.isErr()) {
                    throw new Error(result.error.error || 'Transaction rejected by wallet');
                }

                return result.value.transactionIntentHash;
            } catch (err: unknown) {
                console.error('Staking transaction error:', err);
                setError(err instanceof Error ? err.message : 'An error occurred during the transaction');
                return null;
            } finally {
                setIsTransacting(false);
            }
        };

    return {
        submitTransaction,
        isTransacting,
        error,
    };
};
