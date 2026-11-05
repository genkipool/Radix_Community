import { useState } from 'react';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { getOrCreateToolkit } from '@/features/wallet/lib/radix-toolkit';
import { sendToWallet } from '@/features/wallet/lib/wallet-requests';
import { useWalletRequestScope } from '@/features/wallet/hooks/useWalletRequestScope';
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
    buildMixedBatchManifest,
    buildSignalProtocolUpdateManifest
} from '@/features/wallet/lib/manifest-builders';
import { StakingAction, StakingTab } from '../types/staking-operations.types';

/** How long the wallet has to answer before the request is cancelled. */
const TX_TIMEOUT_MS = 60_000;

export const useStakingTransaction = () => {
    const { activeNetworkId } = useRadixWallet();
    const [isTransacting, setIsTransacting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Closing the popup or modal that sent it cancels it in the wallet too.
    const requests = useWalletRequestScope();

    /**
     * Sends a manifest to the wallet and returns its transaction id, or null
     * with the error set. A cancel the person asked for leaves no error.
     */
    const sendManifest = async (
        rdt: NonNullable<ReturnType<typeof getOrCreateToolkit>>,
        manifest: string,
    ): Promise<string | null> => {
        const outcome = await sendToWallet(
            rdt,
            'transaction',
            () => rdt.walletApi.sendTransaction({ transactionManifest: manifest, version: 1 }),
            { timeoutMs: TX_TIMEOUT_MS, signal: requests.signal() },
        );
        if (outcome.ok) return outcome.value.transactionIntentHash;
        const { reason, code } = outcome.failure;
        if (reason !== 'cancelled') console.error('Staking transaction error:', outcome.failure);
        setError(reason === 'cancelled' ? null : code);
        return null;
    };

    const submitTransaction = async (
            accountAddress: string,
            validatorAddress: string,
            action: StakingAction,
            tab: StakingTab,
            amount: number,
            lsuResourceAddress: string,
            claimNftIds?: string[],
            claimNftResourceAddress?: string,
            ownerBadgeId?: string
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
            const ownerBadgeResourceAddress = RADIX_TOKEN_ADDRESSES[activeNetworkId]?.OWNER_BADGE;
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
                    if (!ownerBadgeId || !ownerBadgeResourceAddress) {
                        setError('Missing owner badge information');
                        setIsTransacting(false);
                        return null;
                    }
                    if (action === 'Stake') {
                        manifest = buildOwnerStakeManifest(accountAddress, validatorAddress, amount, xrdAddress, lsuResourceAddress, ownerBadgeId, ownerBadgeResourceAddress);
                    } else if (action === 'Unstake') {
                        manifest = buildOwnerUnstakeManifest(accountAddress, validatorAddress, amount, ownerBadgeId, ownerBadgeResourceAddress);
                    } else if (action === 'Claim') {
                        manifest = buildOwnerClaimManifest(accountAddress, validatorAddress, ownerBadgeId, ownerBadgeResourceAddress);
                    }
                }

                if (!manifest) {
                    setError('Unsupported action');
                    setIsTransacting(false);
                    return null;
                }

                const hash = await sendManifest(rdt, manifest);
                setIsTransacting(false);
                return hash;
            } catch (err: unknown) {
                console.error('Staking transaction error:', err);
                setError(err instanceof Error ? err.message : 'An error occurred during the transaction');
                setIsTransacting(false);
                return null;
            }
        };

    const submitProtocolVote = async (
        accountAddress: string,
        validatorAddress: string,
        ownerBadgeId: string,
        protocolVersionName: string
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

        const ownerBadgeResourceAddress = RADIX_TOKEN_ADDRESSES[activeNetworkId]?.OWNER_BADGE;
        if (!ownerBadgeResourceAddress) {
            setError('Owner badge resource not found for network');
            return null;
        }
        if (!ownerBadgeId) {
            setError('Missing owner badge information');
            return null;
        }

        setIsTransacting(true);
        setError(null);

        try {
            const manifest = buildSignalProtocolUpdateManifest(
                accountAddress,
                validatorAddress,
                ownerBadgeId,
                ownerBadgeResourceAddress,
                protocolVersionName
            );

            const hash = await sendManifest(rdt, manifest);
            setIsTransacting(false);
            return hash;
        } catch (err: unknown) {
            console.error('Protocol vote transaction error:', err);
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

            const hash = await sendManifest(rdt, manifest);
            setIsTransacting(false);
            return hash;
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

            const hash = await sendManifest(rdt, manifest);
            setIsTransacting(false);
            return hash;
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
        submitProtocolVote,
        submitBatchTransaction,
        submitMixedBatchTransaction,
        isTransacting,
        error,
        clearError,
    };
};
