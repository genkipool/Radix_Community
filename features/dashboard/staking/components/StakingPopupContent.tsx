import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { Validator } from '@/types/radix';
import { AccountSelector } from './AccountSelector';
import { useAccountStakingData } from '../hooks/useAccountStakingData';
import { useStakingTransaction } from '../hooks/useStakingTransaction';
import { StakingTab, StakingAction } from '../types/staking-operations.types';
import { WalletAccount } from '@/features/wallet/types/wallet';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { Loader2 } from 'lucide-react';
import { TranslationsT } from '@/features/dashboard/types';
import { apiFetchTransactionDetails } from '@/features/dashboard/services/apiClient';

interface StakingPopupContentProps {
    validator: Validator;
    t?: Partial<TranslationsT>;
}

export const StakingPopupContent = ({ validator, t }: StakingPopupContentProps) => {
    const queryClient = useQueryClient();
    const { accounts, activeNetworkId } = useRadixWallet();
    const [activeTab, setActiveTab] = useState<StakingTab>('delegator');
    const [activeAction, setActiveAction] = useState<StakingAction>('Stake');
    const [selectedAccount, setSelectedAccount] = useState<WalletAccount | null>(null);
    const [amountStr, setAmountStr] = useState('');

    const activeAccount = selectedAccount || (accounts.length > 0 ? accounts[0] : null);

    const { data: stakingData, isLoading: isLoadingData } = useAccountStakingData(
        activeAccount?.address || null,
        validator
    );

    const { submitTransaction, isTransacting, error } = useStakingTransaction();

    const handleAction = async () => {
        if (!activeAccount) return;
        const amount = parseFloat(amountStr);
        if (activeAction !== 'Claim' && (isNaN(amount) || amount <= 0)) return;

        const hash = await submitTransaction(
            activeAccount.address,
            validator.address,
            activeAction,
            activeTab,
            amount || 0,
            validator.lsuResource,
            activeTab === 'delegator' ? stakingData.claimNftIds : stakingData.ownerClaimNftIds
        );

        if (hash) {
            setAmountStr('');
            pollTransactionStatus(hash);
        }
    };

    const pollTransactionStatus = async (hash: string) => {
        const networkName = activeNetworkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
        const maxAttempts = 15; // 15 attempts * 2s = 30s max
        let attempts = 0;

        const interval = setInterval(async () => {
            attempts++;
            try {
                const details = await apiFetchTransactionDetails(hash, networkName);
                
                // If the transaction is committed successfully, update the UI
                if (details && (details.transaction_status === 'CommittedSuccess' || details.transaction_status === 'Committed')) {
                    clearInterval(interval);
                    try {
                        const { apiFetchEntityDetails } = await import('@/features/dashboard/services/apiClient');
                        if (activeAccount) {
                            await apiFetchEntityDetails(activeAccount.address, networkName, true);
                        }
                    } catch (e) {
                        console.error('Error refreshing cache', e);
                    }
                    queryClient.invalidateQueries({ queryKey: ['entity'] });
                    queryClient.invalidateQueries({ queryKey: ['account-transactions'] });
                    queryClient.invalidateQueries({ queryKey: ['account-claim-nfts'] });
                } else if (details && (details.transaction_status === 'CommittedFailure' || details.transaction_status === 'Rejected')) {
                    clearInterval(interval);
                }
            } catch (_error) {
                // If it returns 404, it might still be pending in the network, so we keep polling
            }

            if (attempts >= maxAttempts) {
                clearInterval(interval);
                // Fallback invalidation just in case
                queryClient.invalidateQueries({ queryKey: ['entity'] });
                queryClient.invalidateQueries({ queryKey: ['account-transactions'] });
                queryClient.invalidateQueries({ queryKey: ['account-claim-nfts'] });
            }
        }, 2000);
    };

    let maxAmount = 0;
    if (activeAction === 'Stake') maxAmount = stakingData.xrdBalance;
    if (activeAction === 'Unstake') maxAmount = stakingData.lsuBalance;

    const handleSetMax = () => {
        setAmountStr(maxAmount.toString());
    };

    return (
        <div 
            className="flex flex-col gap-3 w-[420px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 shadow-2xl backdrop-blur-md" 
            onClick={e => e.stopPropagation()}
            onMouseEnter={e => e.stopPropagation()}
        >
            <div className="flex border-b border-[var(--color-border)] mb-2">
                <button 
                    onClick={(e) => { e.stopPropagation(); setActiveTab('delegator'); }}
                    className={`flex-1 pb-2 text-xs font-semibold transition-colors border-b-2 -mb-[1px] ${activeTab === 'delegator' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                >
                    {t?.dashboard?.staking?.delegator ?? 'Delegator'}
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); setActiveTab('validator'); }}
                    className={`flex-1 pb-2 text-xs font-semibold transition-colors border-b-2 -mb-[1px] ${activeTab === 'validator' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                >
                    {t?.dashboard?.staking?.validator ?? 'Validator'}
                </button>
            </div>

            <AccountSelector 
                accounts={accounts} 
                selectedAccount={activeAccount} 
                onSelect={setSelectedAccount} 
            />

            <div className="bg-[var(--color-background)] rounded-lg p-3 flex justify-between text-xs">
                {isLoadingData ? (
                    <div className="w-full flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" /></div>
                ) : (
                    <>
                        <div className="flex flex-col items-center">
                            <span className="text-[var(--color-text-muted)]">{t?.dashboard?.staking?.available ?? 'Available'}</span>
                            <span className="font-medium text-[var(--color-text)]">{stakingData.xrdBalance.toFixed(2)} XRD</span>
                        </div>
                        <div className="w-px bg-[var(--color-border)]" />
                        <div className="flex flex-col items-center">
                            <span className="text-[var(--color-text-muted)]">{t?.dashboard?.staking?.staked ?? 'Staked'}</span>
                            <span className="font-medium text-[var(--color-text)]">{stakingData.lsuBalance.toFixed(2)} LSU</span>
                        </div>
                        <div className="w-px bg-[var(--color-border)]" />
                        <div className="flex flex-col items-center">
                            <span className="text-[var(--color-text-muted)]">{t?.dashboard?.staking?.unstaking ?? 'Unstaking'}</span>
                            <span className="font-medium text-[var(--color-text)]">{stakingData.pendingUnstake.toFixed(2)} XRD</span>
                        </div>
                        <div className="w-px bg-[var(--color-border)]" />
                        <div className="flex flex-col items-center">
                            <span className="text-[var(--color-text-muted)]">{t?.dashboard?.staking?.claimable ?? 'Claimable'}</span>
                            <span className="font-medium text-[var(--color-text)]">{stakingData.claimableXrd.toFixed(2)} XRD</span>
                        </div>
                    </>
                )}
            </div>

            {activeAction !== 'Claim' && (
                <div className="relative">
                    <input 
                        type="number" 
                        value={amountStr}
                        onChange={(e) => setAmountStr(e.target.value)}
                        placeholder={`${t?.dashboard?.staking?.amount_to ?? 'Amount to'} ${t?.dashboard?.staking?.[activeAction.toLowerCase() as keyof typeof t.dashboard.staking] ?? activeAction.toLowerCase()}`}
                        className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors pr-16"
                        onClick={e => e.stopPropagation()}
                    />
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleSetMax(); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-1 rounded hover:bg-[var(--color-primary)]/20 transition-colors"
                    >
                        {t?.dashboard?.staking?.max ?? 'MAX'}
                    </button>
                </div>
            )}
            
            {error && (
                <div className="text-xs text-red-500 bg-red-500/10 p-2 rounded-lg break-words">
                    {error === 'failedToPrepareTransaction' ? (t?.dashboard?.staking?.errors?.failedToPrepareTransaction ?? 'Failed to prepare transaction. Check your manifest.') : error}
                </div>
            )}

            <div className="flex gap-2 mt-1">
                {(['Stake', 'Unstake', 'Claim'] as StakingAction[]).map(action => (
                    <button
                        key={action}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (activeAction === action) {
                                handleAction();
                            } else {
                                setActiveAction(action);
                                setAmountStr('');
                            }
                        }}
                        disabled={
                            isTransacting || 
                            !activeAccount || 
                            (action === 'Unstake' && stakingData.lsuBalance <= 0) ||
                            (action === 'Claim' && stakingData.claimableXrd <= 0) ||
                            (activeAction === action && action !== 'Claim' && (!amountStr || parseFloat(amountStr) <= 0)) ||
                            (activeAction === action && action === 'Claim' && (activeTab === 'delegator' ? stakingData.claimNftIds.length === 0 : stakingData.ownerClaimNftIds.length === 0))
                        }
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                            activeAction === action 
                                ? 'bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary,var(--color-primary))] text-white shadow-lg shadow-[var(--color-primary)]/20 scale-[1.02]' 
                                : 'bg-[var(--color-background)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)]'
                        }`}
                    >
                        {isTransacting && activeAction === action ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                        ) : (
                            (t?.dashboard?.staking as unknown as Record<string, string>)?.[action.toLowerCase()] ?? action
                        )}
                    </button>
                ))}
            </div>
            
            {activeTab === 'validator' && !stakingData.isOwner && !isLoadingData && activeAccount && (
                <div className="text-[10px] text-amber-500 bg-amber-500/10 p-2 rounded-lg text-center mt-1">
                    {t?.dashboard?.staking?.owner_warning ?? 'Warning: The selected account does not appear to be the owner of this validator.'}
                </div>
            )}
        </div>
    );
};
