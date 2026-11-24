'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { apiFetchEntityDetails, apiFetchTransactionDetails } from '@/features/dashboard/services/apiClient';
import { invalidateAccountStakingData } from '@/features/dashboard/utils/cacheInvalidation';

interface PollCallbacks {
    onDone: () => void;
    onError: (message: string) => void;
    failedText?: string;
    rejectedText?: string;
}

/**
 * Shared post-submission transaction poller used by both `AccountStakingSection`
 * and `AccountValidatorStakeAction`: waits for Gateway commit, refreshes all
 * connected accounts' entity details, and invalidates staking caches.
 */
export function useStakingTxPoller(accountAddress: string) {
    const queryClient = useQueryClient();
    const { activeNetworkId, accounts } = useRadixWallet();

    const pollTransactionStatus = (hash: string, callbacks: PollCallbacks) => {
        const netName = activeNetworkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
        const maxAttempts = 15;

        const pollOnce = async (attempt: number) => {
            if (attempt > maxAttempts) {
                invalidateAccountStakingData(queryClient, accountAddress, netName);
                callbacks.onDone();
                return;
            }

            try {
                const details = await apiFetchTransactionDetails(hash, netName);
                if (details && (details.transaction_status === 'CommittedSuccess' || details.transaction_status === 'Committed')) {
                    // Wait 2 seconds for Gateway to sync new ledger state before refetching
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    try {
                        await Promise.all((accounts || []).map(async (acc) => {
                            await apiFetchEntityDetails(acc.address, netName, true);
                            invalidateAccountStakingData(queryClient, acc.address, netName);
                        }));
                    } catch (e) {
                        console.error('Failed to pre-fetch entity details after transaction for accounts', e);
                    }
                    callbacks.onDone();
                    return;
                }
                if (details && details.transaction_status === 'CommittedFailure') {
                    callbacks.onError(callbacks.failedText || 'Transaction failed.');
                    callbacks.onDone();
                    return;
                }
                if (details && details.transaction_status === 'Rejected') {
                    callbacks.onError(callbacks.rejectedText || 'Transaction rejected.');
                    callbacks.onDone();
                    return;
                }
            } catch (err) {
                console.warn('Failed to fetch transaction details', err);
            }

            setTimeout(() => void pollOnce(attempt + 1), 2000);
        };

        void pollOnce(1);
    };

    return { pollTransactionStatus };
}
