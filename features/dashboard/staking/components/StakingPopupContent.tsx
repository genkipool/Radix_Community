
import React, { useState, useEffect, useRef } from 'react';
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
import { apiFetchTransactionDetails, apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useXrdPrice } from '@/features/games/hooks/useXrdPrice';
import { invalidateAccountStakingData } from '@/features/dashboard/utils/cacheInvalidation';

interface StakingPopupContentProps {
    validator: Validator;
    t?: Partial<TranslationsT>;
}

interface StakingTranslations {
    errors?: {
        insufficient_balance?: string;
        failedToPrepareTransaction?: string;
        failedToSignTransaction?: string;
        failedToSubmitTransaction?: string;
        failedToCompileTransaction?: string;
        rejectedByUser?: string;
        superior_to_both?: string;
    };
    delegator?: string;
    validator?: string;
    available?: string;
    staked?: string;
    unstaking?: string;
    claimable?: string;
    amount_to?: string;
    amount_placeholder?: string;
    max?: string;
    owner_warning?: string;
    claim_tooltip?: string;
    owner_claim_info?: string;
    stake?: string;
    unstake?: string;
    claim?: string;
}

export const StakingPopupContent = ({ validator, t }: StakingPopupContentProps) => {
    const queryClient = useQueryClient();
    const { accounts, activeNetworkId } = useRadixWallet();
    const [activeTab, setActiveTab] = useState<StakingTab>('delegator');
    const inputRef = useRef<HTMLInputElement>(null);
    const [amountStr, setAmountStr] = useState('');
    const [actionError, setActionError] = useState<string | null>(null);
    const [transactingAction, setTransactingAction] = useState<StakingAction | null>(null);
    const [showOwnerClaimInfo, setShowOwnerClaimInfo] = useState(false);
    const { price } = useXrdPrice();

    const [selectedAccountAddress, setSelectedAccountAddress] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('stakingPopupLastAccount');
        }
        return null;
    });

    const activeAccount = accounts.find(a => a.address === selectedAccountAddress) || (accounts.length > 0 ? accounts[0] : null);

    const handleAccountSelect = (account: WalletAccount) => {
        setSelectedAccountAddress(account.address);
        if (typeof window !== 'undefined') {
            localStorage.setItem('stakingPopupLastAccount', account.address);
        }
    };

    const stakingT = t?.dashboard?.staking as unknown as StakingTranslations | undefined;

    const { data: stakingData, isLoading: isLoadingData } = useAccountStakingData(
        activeAccount?.address || null,
        validator
    );

    const { submitTransaction, isTransacting, error, clearError } = useStakingTransaction();

    const xrdPerLsu = validator.lsu2xrdFactor || 1;

    const isOwnerTab = activeTab === 'validator' && stakingData.isOwner;
    const stakedXrd = isOwnerTab ? stakingData.ownerLockedStakeXrd : (stakingData.lsuBalance * xrdPerLsu);
    const pendingUnstakeXrd = isOwnerTab ? stakingData.ownerPendingUnlockXrd : stakingData.pendingUnstake;
    const claimableXrd = isOwnerTab ? stakingData.ownerUnlockedXrd : stakingData.claimableXrd;

    const isEuroZone = () => {
        try {
            if (typeof window !== 'undefined') {
                const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                return timeZone.startsWith('Europe/') || timeZone === 'Atlantic/Canary';
            }
        } catch {
            return false;
        }
        return false;
    };

    const [isEUR, setIsEUR] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsEUR(isEuroZone());
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        // Auto-focus the input when the popup opens
        // We use a small timeout to ensure the element is rendered and not blocked by transition
        const focusTimer = setTimeout(() => {
            inputRef.current?.focus();
        }, 50);
        return () => clearTimeout(focusTimer);
    }, []);

    const fiatRate = isEUR ? price?.eur : price?.usd;
    const fiatSymbol = isEUR ? '€' : '$';

    const getFiatString = (xrd: number) => {
        if (!fiatRate || xrd === 0) return '';
        const fiatValue = xrd * fiatRate;
        return `≈ ${fiatValue.toFixed(2)} ${fiatSymbol}`;
    };

    const handleAction = async (actionToPerform: StakingAction) => {
        if (!activeAccount) return;
        setActionError(null);

        let amount = parseFloat(amountStr || '0');

        if (actionToPerform === 'Stake' && amount > stakingData.xrdBalance) {
            if (amount - stakingData.xrdBalance <= 0.01) {
                amount = stakingData.xrdBalance;
            } else {
                setActionError(stakingT?.errors?.insufficient_balance ?? 'Saldo insuficiente para esta acción.');
                return;
            }
        }

        if (actionToPerform === 'Unstake' && amount > stakedXrd) {
            if (amount - stakedXrd <= 0.01) {
                amount = stakedXrd;
            } else {
                setActionError(stakingT?.errors?.insufficient_balance ?? 'Saldo insuficiente para esta acción.');
                return;
            }
        }

        setTransactingAction(actionToPerform);

        let txAmount = amount;
        if (actionToPerform === 'Unstake') {
            if (amount === stakedXrd) {
                txAmount = isOwnerTab ? (stakingData.ownerLockedStakeXrd / xrdPerLsu) : stakingData.lsuBalance; // Use exact LSU balance if max
            } else {
                txAmount = amount / xrdPerLsu;
            }
        }

        const hash = await submitTransaction(
            activeAccount.address,
            validator.address,
            actionToPerform,
            activeTab,
            txAmount,
            validator.lsuResource,
            activeTab === 'delegator' ? stakingData.claimNftIds : [],
            validator.claimTokenResourceAddress,
            validator.ownerBadge
        );

        if (hash) {
            setAmountStr('');
            pollTransactionStatus(hash);
        }
    };

    const handleSetMax = () => {
        const maxAmount = Math.max(stakingData.xrdBalance, stakedXrd);
        setAmountStr(maxAmount.toString());
    };

    const pollTransactionStatus = async (hash: string) => {
        const networkName = activeNetworkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
        const maxAttempts = 15; // 15 attempts * 2s = 30s max

        const pollOnce = async (attempt: number) => {
            if (attempt > maxAttempts) {
                if (activeAccount) {
                    invalidateAccountStakingData(queryClient, activeAccount.address, networkName);
                }
                return;
            }

            try {
                const details = await apiFetchTransactionDetails(hash, networkName);

                // If the transaction is committed successfully, update the UI
                if (details && (details.transaction_status === 'CommittedSuccess' || details.transaction_status === 'Committed')) {
                    // Wait 2 seconds for Gateway to sync new ledger state before refetching
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    try {
                        if (activeAccount) {
                            await apiFetchEntityDetails(activeAccount.address, networkName, true);
                        }
                        if (activeTab === 'validator' && stakingData.isOwner) {
                            await apiFetchEntityDetails(validator.address, networkName, true);
                        }
                    } catch (e) {
                        console.error('Error refreshing cache', e);
                    }
                    if (activeTab === 'validator' && transactingAction === 'Claim') {
                        setShowOwnerClaimInfo(true);
                    }
                    if (activeAccount) {
                        invalidateAccountStakingData(queryClient, activeAccount.address, networkName);
                    }
                    return;
                } else if (details && (details.transaction_status === 'CommittedFailure' || details.transaction_status === 'Rejected')) {
                    return;
                }
            } catch (_error) {
                // If it returns 404, it might still be pending in the network, so we keep polling
            }

            setTimeout(() => pollOnce(attempt + 1), 2000);
        };

        pollOnce(1);
    };

    const parsedAmount = parseFloat(amountStr || '0');
    // Error is shown in real-time only if it exceeds BOTH available and staked (with a small margin for floating point rounding)
    const isSuperiorToBoth = parsedAmount > (stakingData.xrdBalance + 0.01) && parsedAmount > (stakedXrd + 0.01);

    const hasTxError = Boolean((error && error.includes('txid_tdx_2_1')) || (actionError && actionError.includes('txid_tdx_2_1')));
    const isNotOwnerWarning = Boolean(activeTab === 'validator' && !stakingData.isOwner && !isLoadingData && activeAccount);

    const renderError = (err: string) => {
        const lower = err.toLowerCase();
        if (lower.includes('failed to prepare') || lower.includes('failedtoprepare')) return stakingT?.errors?.failedToPrepareTransaction ?? 'Failed to prepare transaction. Check your manifest.';
        if (lower.includes('rejected') || lower.includes('rejectedbyuser')) return stakingT?.errors?.rejectedByUser ?? 'Transaction rejected by user.';
        if (lower.includes('failed to sign') || lower.includes('failedtosign')) return stakingT?.errors?.failedToSignTransaction ?? 'Failed to sign transaction.';
        if (lower.includes('failed to submit') || lower.includes('failedtosubmit')) return stakingT?.errors?.failedToSubmitTransaction ?? 'Failed to submit transaction.';
        if (lower.includes('failed to compile') || lower.includes('failedtocompile')) return stakingT?.errors?.failedToCompileTransaction ?? 'Failed to compile transaction.';
        return err;
    };

    return (
        <div
            className="flex flex-col gap-3 w-full sm:w-[420px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 shadow-2xl backdrop-blur-md"
            onClick={e => e.stopPropagation()}
            onMouseEnter={e => e.stopPropagation()}
        >
            <div className="flex border-b border-[var(--color-border)] mb-2">
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setActiveTab('delegator'); }}
                    className={`flex-1 pb-2 text-xs font-semibold transition-colors border-b-2 -mb-[1px] ${activeTab === 'delegator' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                >
                    {stakingT?.delegator ?? 'Delegator'}
                </button>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setActiveTab('validator'); }}
                    className={`flex-1 pb-2 text-xs font-semibold transition-colors border-b-2 -mb-[1px] ${activeTab === 'validator' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                >
                    {stakingT?.validator ?? 'Owner'}
                </button>
            </div>

            <AccountSelector
                accounts={accounts}
                selectedAccount={activeAccount}
                onSelect={handleAccountSelect}
            />

            <div className="bg-[var(--color-bg)] rounded-lg p-3 flex justify-between text-xs">
                {isLoadingData ? (
                    <div className="w-full flex justify-center py-2"><Loader2 className="size-4 animate-spin text-[var(--color-primary)]" /></div>
                ) : (
                    <>
                        <div className="flex flex-col items-center">
                            <span className="text-[var(--color-text-muted)]">{stakingT?.available ?? 'Available'}</span>
                            <span className="font-medium text-[var(--color-text)]">{stakingData.xrdBalance.toFixed(2)} XRD</span>
                            {fiatRate ? <span className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{getFiatString(stakingData.xrdBalance)}</span> : null}
                        </div>
                        <div className="w-px bg-[var(--color-border)]" />
                        <div className="flex flex-col items-center">
                            <span className="text-[var(--color-text-muted)]">{stakingT?.staked ?? 'Staked'}</span>
                            <span className="font-medium text-[var(--color-text)]">{stakedXrd.toFixed(2)} XRD</span>
                            {fiatRate ? <span className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{getFiatString(stakedXrd)}</span> : null}
                        </div>
                        <div className="w-px bg-[var(--color-border)]" />
                        <div className="flex flex-col items-center" title={stakingData.unstakeTooltip || undefined}>
                            <span className="text-[var(--color-text-muted)]">{stakingT?.unstaking ?? 'Unstaking'}</span>
                            <span className="font-medium text-[var(--color-text)]">{pendingUnstakeXrd.toFixed(2)} XRD</span>
                            {fiatRate ? <span className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{getFiatString(pendingUnstakeXrd)}</span> : null}
                        </div>
                        <div className="w-px bg-[var(--color-border)]" />
                        <div className="flex flex-col items-center" title={isOwnerTab ? (stakingT?.claim_tooltip ?? 'The claimed LSU tokens are added to the delegator stake of this validator.') : undefined}>
                            <span className="text-[var(--color-text-muted)]">{stakingT?.claimable ?? 'Claimable'}</span>
                            <span className="font-medium text-[var(--color-text)]">{claimableXrd.toFixed(2)} XRD</span>
                            {fiatRate ? <span className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{getFiatString(claimableXrd)}</span> : null}
                        </div>
                    </>
                )}
            </div>

            <div className="relative flex flex-col">
                <div className="relative">
                    <input
                        ref={inputRef}
                        type="number"
                        min="0"
                        value={amountStr}
                        onChange={(e) => {
                            if (e.target.value.includes('-')) return;
                            setAmountStr(e.target.value);
                            if (clearError) clearError();
                        }}
                        onKeyDown={(e) => { if (e.key === '-') e.preventDefault(); }}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        placeholder={stakingT?.amount_placeholder ?? "Cantidad de XRD"}
                        disabled={isNotOwnerWarning || hasTxError || isTransacting}
                        aria-label={stakingT?.amount_placeholder ?? "Cantidad de XRD"}
                        className={`w-full bg-[var(--color-bg)] border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors pr-16 ${isSuperiorToBoth || error ? 'border-red-500 text-red-500 focus:border-red-500' : 'border-[var(--color-border)] focus:border-[var(--color-primary)]'} ${(isNotOwnerWarning || hasTxError || isTransacting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={e => e.stopPropagation()}
                    />
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSetMax(); }}
                        disabled={isNotOwnerWarning || hasTxError}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-1 rounded transition-colors ${(isNotOwnerWarning || hasTxError) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--color-primary)]/20'}`}
                    >
                        {stakingT?.max ?? 'MAX'}
                    </button>
                </div>
            </div>

            <div className="flex gap-2 mt-1">
                {(['Stake', 'Unstake', 'Claim'] as StakingAction[]).map(action => {
                    const isThisActionTransacting = isTransacting && transactingAction === action;
                    const isDisabled =
                        isTransacting ||
                        !activeAccount ||
                        isSuperiorToBoth ||
                        hasTxError ||
                        isNotOwnerWarning ||
                        (action === 'Unstake' && stakedXrd <= 0) ||
                        (action === 'Claim' && claimableXrd <= 0) ||
                        (action !== 'Claim' && (!amountStr || parseFloat(amountStr) <= 0)) ||
                        (action === 'Claim' && (activeTab === 'delegator' ? stakingData.claimNftIds.length === 0 : false));

                    return (
                        <button
                            type="button"
                            key={action}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAction(action);
                            }}
                            disabled={isDisabled}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--color-bg)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)]`}
                        >
                            {isThisActionTransacting ? (
                                <span className="flex items-center justify-center">
                                    {(stakingT?.[action.toLowerCase() as keyof StakingTranslations] as string) ?? action}
                                    <span className="animate-pulse ml-0.5">...</span>
                                </span>
                            ) : (
                                (stakingT?.[action.toLowerCase() as keyof StakingTranslations] as string) ?? action
                            )}
                        </button>
                    );
                })}
            </div>

            {(error || actionError || isSuperiorToBoth) && (
                <div className="text-xs text-red-500 bg-red-500/10 p-2 rounded-lg break-words mt-1">
                    {isSuperiorToBoth
                        ? (stakingT?.errors?.superior_to_both ?? 'La cantidad ingresada supera la cantidad de saldo y de staking por lo que no puede realizar las operaciones de stake o unstake.')
                        : actionError
                            ? actionError
                            : renderError(error!)}
                </div>
            )}

            {activeTab === 'validator' && !stakingData.isOwner && !isLoadingData && activeAccount && (
                <div className="text-[10px] text-amber-500 bg-amber-500/10 p-2 rounded-lg text-center mt-1">
                    {stakingT?.owner_warning ?? 'Warning: The selected account does not appear to be the owner of this validator.'}
                </div>
            )}

            {showOwnerClaimInfo && (
                <div className="text-[10px] text-blue-500 bg-blue-500/10 p-2 rounded-lg text-center mt-1">
                    {stakingT?.owner_claim_info ?? 'The claimed LSU tokens have been added to the delegator stake of this validator.'}
                </div>
            )}
        </div>
    );
};

