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
            claimNftIds?: string[],
            claimNftResourceAddress?: string
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
                        manifest = buildClaimManifest(accountAddress, validatorAddress, claimNftIds || [], claimNftResourceAddress || '');
                    }
                } else if (tab === 'validator') {
                    if (action === 'Stake') {
                        manifest = buildOwnerStakeManifest(accountAddress, validatorAddress, amount, xrdAddress, lsuResourceAddress);
                    } else if (action === 'Unstake') {
                        manifest = buildOwnerUnstakeManifest(accountAddress, validatorAddress, amount);
                    } else if (action === 'Claim') {
                        manifest = buildOwnerClaimManifest(accountAddress, validatorAddress, claimNftIds || [], claimNftResourceAddress || '');
                    }
                }

                if (!manifest) {
                    setError('Unsupported action');
                    setIsTransacting(false);
                    return null;
                }

                const result = await rdt.walletApi.sendTransaction({
                    transactionManifest: manifest,
                    version: 1,
                });

                if (result.isErr()) {
                    setError(result.error.error || 'Transaction rejected by wallet');
                    setIsTransacting(false);
                    return null;
                }

                setIsTransacting(false);
                return result.value.transactionIntentHash;
            } catch (err: unknown) {
                console.error('Staking transaction error:', err);
                setError(err instanceof Error ? err.message : 'An error occurred during the transaction');
                setIsTransacting(false);
                return null;
            }
        };

    return {
        submitTransaction,
        isTransacting,
        error,
    };
};
