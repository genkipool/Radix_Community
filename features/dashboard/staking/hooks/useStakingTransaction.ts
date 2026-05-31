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
    buildBatchStakeManifest,
    buildBatchUnstakeManifest,
    buildBatchClaimManifest,
    BatchStakeItem,
    BatchUnstakeItem,
    BatchClaimItem,
    MixedBatchItem,
    buildMixedBatchManifest
} from '@/features/wallet/lib/manifest-builders';
import { StakingAction, StakingTab } from '../types/staking-operations.types';

export const useStakingTransaction = () => {
    const { activeNetworkId } = useRadixWallet();
    const [isTransacting, setIsTransacting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const sendWithTimeout = async (rdt: any, manifest: string) => {
        const timeoutPromise = new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error('Tiempo de espera agotado tras 60 segundos.')), 60000)
        );
        return Promise.race([
            rdt.walletApi.sendTransaction({
                transactionManifest: manifest,
                version: 1,
            }),
            timeoutPromise
        ]);
    };

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

                const result = await sendWithTimeout(rdt, manifest);

                if (result.isErr()) {
                    const errMsg = result.error.error || result.error.message || 'Transaction rejected by wallet';
                    const translatedError = errMsg.includes('rejectedByUser') ? 'Transacción rechazada por el usuario.' : errMsg;
                    setError(translatedError);
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

    const submitBatchTransaction = async (
        accountAddress: string,
        action: StakingAction,
        items: (BatchStakeItem | BatchUnstakeItem | BatchClaimItem)[]
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

        if (items.length === 0) {
            setError('No validators selected');
            return null;
        }

        setIsTransacting(true);
        setError(null);

        try {
            let manifest = '';

            if (action === 'Stake') {
                manifest = buildBatchStakeManifest(accountAddress, items as BatchStakeItem[], xrdAddress);
            } else if (action === 'Unstake') {
                manifest = buildBatchUnstakeManifest(accountAddress, items as BatchUnstakeItem[]);
            } else if (action === 'Claim') {
                manifest = buildBatchClaimManifest(accountAddress, items as BatchClaimItem[]);
            }

            if (!manifest) {
                setError('Unsupported action');
                setIsTransacting(false);
                return null;
            }

            const result = await sendWithTimeout(rdt, manifest);

            if (result.isErr()) {
                const errMsg = result.error.error || result.error.message || 'Transaction rejected by wallet';
                const translatedError = errMsg.includes('rejectedByUser') ? 'Transacción rechazada por el usuario.' : errMsg;
                setError(translatedError);
                setIsTransacting(false);
                return null;
            }

            setIsTransacting(false);
            return result.value.transactionIntentHash;
        } catch (err: unknown) {
            console.error('Batch staking transaction error:', err);
            setError(err instanceof Error ? err.message : 'An error occurred during the transaction');
            setIsTransacting(false);
            return null;
        }
    };

    const submitMixedBatchTransaction = async (
        accountAddress: string,
        items: MixedBatchItem[]
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

        if (items.length === 0) {
            setError('No items selected');
            return null;
        }

        setIsTransacting(true);
        setError(null);

        try {
            const manifest = buildMixedBatchManifest(accountAddress, items, xrdAddress);

            const result = await sendWithTimeout(rdt, manifest);

            if (result.isErr()) {
                console.error('Mixed Batch Transaction error:', result.error);
                const errMsg = result.error.error || result.error.message || 'Transaction failed';
                const translatedError = errMsg.includes('rejectedByUser') ? 'Transacción rechazada por el usuario.' : errMsg;
                setError(translatedError);
                setIsTransacting(false);
                return null;
            }

            setIsTransacting(false);
            return result.value.transactionIntentHash;
        } catch (err: unknown) {
            console.error('Mixed Batch Transaction error:', err);
            setError(err instanceof Error ? err.message : 'An error occurred during the transaction');
            setIsTransacting(false);
            return null;
        }
    };

    const clearError = () => setError(null);

    return {
        submitTransaction,
        submitBatchTransaction,
        submitMixedBatchTransaction,
        isTransacting,
        error,
        clearError,
    };
};
