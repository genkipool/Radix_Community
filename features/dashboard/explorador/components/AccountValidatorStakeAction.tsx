import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useLanguage } from '@/context/LanguageContext';
import { useStakingTransaction } from '@/features/dashboard/staking/hooks/useStakingTransaction';
import { StakingAction } from '@/features/dashboard/staking/types/staking-operations.types';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { apiFetchTransactionDetails, apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useValidatorsQuery } from '@/features/dashboard/staking/hooks/useValidatorsQuery';
import { useQuery } from '@tanstack/react-query';
import type { TranslationsT } from '@/features/dashboard/types';
import type { ValidatorEntityState } from '@/features/dashboard/staking/hooks/useAccountStakingData';
import { invalidateAccountStakingData } from '@/features/dashboard/utils/cacheInvalidation';
import { dashboardKeys } from '@/features/dashboard/utils/entityCache';
import { CACHE_TIMES } from '@/features/dashboard/utils/queryCache';
export type ValidatorSelections = { amountStr?: string; stake?: string; unstake?: string; claim?: boolean };

const EMPTY_SELECTIONS: ValidatorSelections = {};

interface AccountValidatorStakeActionProps {
    accountAddress: string;
    validatorAddress: string;
    network: 'mainnet' | 'stokenet';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entityData: any;
    xrdBalance: number;
    stakedXrd: number;
    claimableXrd: number;
    lsuBalance: number;
    ghostAmount?: string;
    selections?: ValidatorSelections;
    onUpdateSelections?: (selections: ValidatorSelections) => void;
    isMultiMode: boolean;
    ownerMode?: boolean;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    stakingErrors?: Record<string, string>;
}

export const AccountValidatorStakeAction = ({
    accountAddress,
    validatorAddress,
    network,
    entityData,
    xrdBalance,
    stakedXrd,
    claimableXrd,
    lsuBalance,
    ghostAmount,
    selections = EMPTY_SELECTIONS,
    onUpdateSelections,
    isMultiMode,
    ownerMode = false,
    tt,
    stakingErrors,
}: AccountValidatorStakeActionProps) => {
    const queryClient = useQueryClient();
    const { t: contextT } = useLanguage();
    const accT = tt?.account_summary || contextT?.dashboard?.transactions?.account_summary;
    const { activeNetworkId, accounts } = useRadixWallet();
    const { data: validatorsData } = useValidatorsQuery(network);
    const validator = validatorsData?.validators.find(v => v.address === validatorAddress);

    const { data: validatorEntityData } = useQuery({
        queryKey: dashboardKeys.entities.detail(validator?.address || '', network),
        queryFn: () => apiFetchEntityDetails(validator!.address, network),
        enabled: !!validator && ownerMode,
        staleTime: CACHE_TIMES.SHORT,
        gcTime: CACHE_TIMES.LONG,
    });

    const ownerLockedStakeXrd = (() => {
        if (!ownerMode || !validatorEntityData || !validator) return 0;
        const state = (validatorEntityData as ValidatorEntityState)?.details?.state;
        if (!state) return 0;
        const lsu2xrd = validator.lsu2xrdFactor || 1;
        const lockedVaultAddress = state.locked_owner_stake_unit_vault?.entity_address;
        let lockedLsu = 0;
        const lsuResourceObj = (validatorEntityData as ValidatorEntityState)?.fungible_resources?.items?.find(
            (item) => item.resource_address === validator.lsuResource
        );
        if (lsuResourceObj?.vaults?.items) {
            for (const vault of lsuResourceObj.vaults.items) {
                if (vault.vault_address === lockedVaultAddress) {
                    lockedLsu = parseFloat(vault.amount) || 0;
                }
            }
        }
        return lockedLsu * lsu2xrd;
    })();

    const ownerUnlockedXrd = (() => {
        if (!ownerMode || !validatorEntityData || !validator) return 0;
        const state = (validatorEntityData as ValidatorEntityState)?.details?.state;
        if (!state) return 0;
        const lsu2xrd = validator.lsu2xrdFactor || 1;
        const currentEpoch = (entityData as { ledger_state?: { epoch?: number } })?.ledger_state?.epoch ?? 0;
        const alreadyUnlocked = parseFloat(state.already_unlocked_owner_stake_unit_amount || '0');
        let totalClaimableLsu = alreadyUnlocked;
        if (state.pending_owner_stake_unit_withdrawals) {
            for (const w of state.pending_owner_stake_unit_withdrawals) {
                const amt = parseFloat(w.stake_unit_amount || '0');
                if (w.epoch_unlocked <= currentEpoch) {
                    totalClaimableLsu += amt;
                }
            }
        }
        return totalClaimableLsu * lsu2xrd;
    })();

    const effectiveStakedXrd = ownerMode ? ownerLockedStakeXrd : stakedXrd;
    const effectiveClaimableXrd = ownerMode ? ownerUnlockedXrd : claimableXrd;

    const inputRef = useRef<HTMLInputElement>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [transactingAction, setTransactingAction] = useState<StakingAction | null>(null);

    // Para modo multi: qué input estamos editando. Si no hay nada, por defecto Stake o Unstake si Stake no está disponible.
    const [activeTab, setActiveTab] = useState<'Stake' | 'Unstake' | 'Claim' | null>('Stake');

    const { submitTransaction, isTransacting, error, clearError } = useStakingTransaction();

    const xrdPerLsu = validator?.lsu2xrdFactor || 1;

    // Extract claimNftIds for this validator from the account's entity data
    const claimNftIds: string[] = [];
    if (validator && entityData?.non_fungible_resources?.items) {
        const claimResource = entityData.non_fungible_resources.items.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (nft: any) => nft.resource_address === validator.claimTokenResourceAddress
        );
        if (claimResource && claimResource.vaults?.items?.[0]?.items) {
            claimNftIds.push(...claimResource.vaults.items[0].items);
        }
    }

    const hasTxError = !!error || !!actionError;

    const renderError = (err: string) => {
        const lower = err.toLowerCase();
        if (lower.includes('failed to prepare') || lower.includes('failedtoprepare')) return stakingErrors?.failedToPrepareTransaction || accT?.failed_to_prepare || 'Failed to prepare transaction. Check your manifest.';
        if (lower.includes('rejected') || lower.includes('rejectedbyuser')) return stakingErrors?.rejectedByUser || accT?.rejected_by_user || 'Transaction rejected by user.';
        if (lower.includes('failed to sign') || lower.includes('failedtosign')) return stakingErrors?.failedToSignTransaction || 'Failed to sign transaction.';
        if (lower.includes('failed to submit') || lower.includes('failedtosubmit')) return stakingErrors?.failedToSubmitTransaction || 'Failed to submit transaction.';
        if (lower.includes('failed to compile') || lower.includes('failedtocompile')) return stakingErrors?.failedToCompileTransaction || 'Failed to compile transaction.';
        return err;
    };

    // Update activeTab when selections are completely cleared (e.g. from Reset button)
    const [prevSelectionsLength, setPrevSelectionsLength] = useState(Object.keys(selections).length);
    const currentSelectionsLength = Object.keys(selections).length;
    if (prevSelectionsLength !== currentSelectionsLength) {
        setPrevSelectionsLength(currentSelectionsLength);
        if (currentSelectionsLength === 0 && activeTab !== 'Stake') {
            setActiveTab('Stake');
        }
    }

    // Obtiene el valor a mostrar en el input según el modo y el tab activo
    const currentInputVal = activeTab === 'Stake' && selections.stake !== undefined
        ? selections.stake
        : activeTab === 'Unstake' && selections.unstake !== undefined
            ? selections.unstake
            : activeTab === 'Claim'
                ? ''
                : selections.amountStr || '';

    const handleInputChange = (val: string) => {
        setActionError(null);
        if (clearError) clearError();

        // Prevent negative numbers manually if they bypass input type
        if (val.includes('-')) return;

        if (onUpdateSelections) {
            const newSelections = { ...selections };
            newSelections.amountStr = val; // always sync to amountStr so it doesn't disappear

            if (activeTab === 'Stake' && newSelections.stake !== undefined) {
                newSelections.stake = val;
            } else if (activeTab === 'Unstake' && newSelections.unstake !== undefined) {
                newSelections.unstake = val;
            }

            if (val === '') {
                if (activeTab === 'Stake') delete newSelections.stake;
                if (activeTab === 'Unstake') delete newSelections.unstake;
                delete newSelections.amountStr;
            }
            onUpdateSelections(newSelections);
        }
    };

    const handleAction = async (actionToPerform: StakingAction) => {
        setActionError(null);
        if (clearError) clearError();

        let rawAmountStr = '';
        if (actionToPerform === 'Stake' && selections.stake !== undefined) {
            rawAmountStr = selections.stake;
        } else if (actionToPerform === 'Unstake' && selections.unstake !== undefined) {
            rawAmountStr = selections.unstake;
        } else {
            // We are toggling ON a new action.
            // If another amount action is already ON, start empty. Otherwise use amountStr.
            if (actionToPerform === 'Stake' && selections.unstake !== undefined) {
                rawAmountStr = '';
            } else if (actionToPerform === 'Unstake' && selections.stake !== undefined) {
                rawAmountStr = '';
            } else {
                rawAmountStr = selections.amountStr || '';
            }
        }

        if (isMultiMode && onUpdateSelections) {
            const newSelections = { ...selections };

            if (actionToPerform === 'Claim') {
                if (selections.claim) {
                    delete newSelections.claim;
                    const newTab = newSelections.stake !== undefined ? 'Stake' : (newSelections.unstake !== undefined ? 'Unstake' : null);
                    setActiveTab(newTab);
                    if (newTab === 'Stake') newSelections.amountStr = newSelections.stake;
                    else if (newTab === 'Unstake') newSelections.amountStr = newSelections.unstake;
                } else {
                    newSelections.claim = true;
                    setActiveTab('Claim');
                }
            } else if (actionToPerform === 'Stake') {
                if (selections.stake !== undefined) {
                    delete newSelections.stake; // toggle off
                    const newTab = newSelections.unstake !== undefined ? 'Unstake' : (newSelections.claim ? 'Claim' : null);
                    setActiveTab(newTab);
                    if (newTab === 'Unstake') newSelections.amountStr = newSelections.unstake;
                } else {
                    newSelections.stake = rawAmountStr; // toggle on with current amount
                    newSelections.amountStr = rawAmountStr; // keep synced
                    setActiveTab('Stake');
                }
            } else if (actionToPerform === 'Unstake') {
                if (selections.unstake !== undefined) {
                    delete newSelections.unstake; // toggle off
                    const newTab = newSelections.stake !== undefined ? 'Stake' : (newSelections.claim ? 'Claim' : null);
                    setActiveTab(newTab);
                    if (newTab === 'Stake') newSelections.amountStr = newSelections.stake;
                } else {
                    newSelections.unstake = rawAmountStr; // toggle on with current amount
                    newSelections.amountStr = rawAmountStr; // keep synced
                    setActiveTab('Unstake');
                }
            }

            onUpdateSelections(newSelections);
            return;
        }

        // --- SINGLE MODE TRANSACTION ---
        let amount = parseFloat(rawAmountStr || '0');

        if (actionToPerform === 'Stake' && amount > xrdBalance) {
            if (amount - xrdBalance <= 0.01) {
                amount = xrdBalance;
            } else {
                setActionError(stakingErrors?.insufficient_balance || accT?.insufficient_balance_action || 'Insufficient balance for this action.');
                return;
            }
        }

        if (actionToPerform === 'Unstake' && amount > effectiveStakedXrd) {
            if (amount - effectiveStakedXrd <= 0.01) {
                amount = effectiveStakedXrd;
            } else {
                setActionError(stakingErrors?.insufficient_balance || accT?.insufficient_balance_action || 'Insufficient balance for this action.');
                return;
            }
        }

        setTransactingAction(actionToPerform);

        let txAmount = amount;
        if (actionToPerform === 'Unstake') {
            if (ownerMode) {
                txAmount = amount;
            } else if (amount === stakedXrd) {
                txAmount = lsuBalance;
            } else {
                txAmount = amount / xrdPerLsu;
            }
        }

        if (!validator) {
            setActionError(accT?.validator_not_found || 'Validator not found');
            return;
        }

        const hash = await submitTransaction(
            accountAddress,
            validator.address,
            actionToPerform,
            ownerMode ? 'validator' : 'delegator',
            txAmount,
            validator.lsuResource,
            claimNftIds,
            validator.claimTokenResourceAddress,
            ownerMode ? validator.ownerBadge : undefined
        );

        if (hash) {
            if (onUpdateSelections) onUpdateSelections({});
            pollTransactionStatus(hash);
        } else {
            setTransactingAction(null);
        }
    };

    const handleSetMax = () => {
        if (onUpdateSelections) {
            const newSelections = { ...selections };
            if (activeTab === 'Stake') {
                newSelections.stake = xrdBalance.toString();
            } else if (activeTab === 'Unstake') {
                newSelections.unstake = effectiveStakedXrd.toString();
            } else {
                const maxAmount = Math.max(xrdBalance, effectiveStakedXrd);
                newSelections.amountStr = maxAmount.toString();
            }
            onUpdateSelections(newSelections);
        }
    };

    const pollTransactionStatus = async (hash: string) => {
        const networkName = activeNetworkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
        const maxAttempts = 15; // 15 attempts * 2s = 30s max

        const pollOnce = async (attempt: number) => {
            if (attempt > maxAttempts) {
                invalidateAccountStakingData(queryClient, accountAddress, networkName);
                return;
            }

            try {
                const details = await apiFetchTransactionDetails(hash, networkName);
                if (details && (details.transaction_status === 'CommittedSuccess' || details.transaction_status === 'Committed')) {
                    // Wait 2 seconds for Gateway to sync new ledger state before refetching
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    try {
                        await Promise.all((accounts || []).map(async (acc) => {
                            await apiFetchEntityDetails(acc.address, networkName, true);
                            invalidateAccountStakingData(queryClient, acc.address, networkName);
                        }));
                    } catch (e) {
                        console.error('Failed to pre-fetch entity details after transaction for accounts', e);
                    }
                    setTransactingAction(null);
                    return;
                } else if (details && details.transaction_status === 'CommittedFailure') {
                    setActionError(accT?.transaction_failed || 'Transaction failed.');
                    setTransactingAction(null);
                    return;
                } else if (details && details.transaction_status === 'Rejected') {
                    setActionError(accT?.transaction_rejected || 'Transaction rejected.');
                    setTransactingAction(null);
                    return;
                }
            } catch (err) {
                console.error("Error polling transaction:", err);
            }

            setTimeout(() => pollOnce(attempt + 1), 2000);
        };

        pollOnce(1);
    };

    // Siempre mostramos el input
    const showInput = true;

    let limitAmount = 0;
    if (activeTab === 'Stake') limitAmount = xrdBalance;
    else if (activeTab === 'Unstake') limitAmount = effectiveStakedXrd;
    else if (activeTab === 'Claim') limitAmount = effectiveClaimableXrd;
    else if (!activeTab) {
        if (selections.claim) limitAmount = effectiveClaimableXrd;
        else if (selections.unstake !== undefined) limitAmount = effectiveStakedXrd;
        else limitAmount = xrdBalance; // defaults to stake context
    }
    const valAmount = parseFloat(currentInputVal || '0');
    const isExceeded = currentInputVal !== '' && valAmount > limitAmount;

    return (
        <div className="w-full">
            <div style={{ display: 'none' }} data-prev-len={prevSelectionsLength} />
            <div className="flex flex-col gap-3 pt-4 border-t border-[var(--color-card-border)]/30">
            {/* Input Row */}
            {showInput && (
                <div className="relative flex flex-col">
                    <div className="relative">
                        <input
                            ref={inputRef}
                            type="number"
                            min="0"
                            aria-label={ghostAmount ? `${ghostAmount} (${accT?.auto_placeholder || 'Auto'})` : `${accT?.amount_xrd || 'Amount of XRD'} ${isMultiMode && activeTab !== 'Claim' && activeTab ? `(${activeTab})` : ''}`}
                            value={currentInputVal}
                            onChange={(e) => handleInputChange(e.target.value)}
                            onKeyDown={(e) => { if (e.key === '-') e.preventDefault(); }}
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            placeholder={ghostAmount ? `${ghostAmount} (${accT?.auto_placeholder || 'Auto'})` : `${accT?.amount_xrd || 'Amount of XRD'} ${isMultiMode && activeTab !== 'Claim' && activeTab ? `(${activeTab})` : ''}`}
                            disabled={isTransacting || activeTab === 'Claim'}
                            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors pr-32 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield] ${hasTxError || isExceeded ? 'border-red-500 text-red-500 focus:border-red-500 bg-[var(--color-bg)]' : 'border-[var(--color-border)] focus:border-[var(--color-primary)]'} ${ghostAmount && !currentInputVal ? 'bg-[var(--color-primary)]/5 text-[var(--color-text-muted)] italic' : 'bg-[var(--color-bg)]'} ${(isTransacting || activeTab === 'Claim') ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={e => e.stopPropagation()}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                            <span className={`text-[10px] font-mono ${isExceeded ? 'text-red-500' : 'text-[var(--color-text-muted)]'}`}>
                                {limitAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                            </span>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleSetMax(); }}
                                disabled={isTransacting || activeTab === 'Claim'}
                                className={`text-[10px] font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-1 rounded transition-colors pointer-events-auto ${(isTransacting || activeTab === 'Claim') ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--color-primary)]/20'}`}
                            >
                                {accT?.max || 'MAX'}
                            </button>
                        </div>
                    </div>
                    {hasTxError && (
                        <div className="text-[10px] text-red-500 mt-1 flex justify-between">
                            <span>{actionError || renderError(error || '')}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Buttons Row */}
            <div className="flex gap-2">
                {(['Stake', 'Unstake', 'Claim'] as StakingAction[]).map(action => {
                    const label = action === 'Stake' ? 'Staking' : action;
                    const isThisActionTransacting = isTransacting && transactingAction === action;

                    let isSelected = false;
                    let isDisabled = false;

                    if (isMultiMode) {
                        isSelected = action === 'Stake' ? selections.stake !== undefined : action === 'Unstake' ? selections.unstake !== undefined : !!selections.claim;

                        // Habilitar toggle off siempre. Toggle on solo si hay fondos.
                        if (!isSelected) {
                            isDisabled =
                                (action === 'Unstake' && effectiveStakedXrd <= 0) ||
                                (action === 'Claim' && effectiveClaimableXrd <= 0) ||
                                (action === 'Claim' && !ownerMode && claimNftIds.length === 0);
                        }
                    } else {
                        isDisabled =
                            !validator ||
                            isTransacting ||
                            hasTxError ||
                            (action === 'Unstake' && effectiveStakedXrd <= 0) ||
                            (action === 'Claim' && effectiveClaimableXrd <= 0) ||
                            (action !== 'Claim' && (!currentInputVal || parseFloat(currentInputVal) <= 0)) ||
                            (action === 'Claim' && !ownerMode && claimNftIds.length === 0);
                    }

                    return (
                        <button
                            type="button"
                            key={action}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAction(action);
                            }}
                            disabled={isDisabled && !isSelected}
                            className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${isSelected ? 'bg-[var(--color-primary)] text-white shadow-md border border-transparent' : 'bg-[var(--color-bg)] text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)]'} leading-tight`}
                        >
                            {isThisActionTransacting ? (
                                <span className="flex items-center justify-center">
                                    {label}
                                    <span className="animate-pulse ml-0.5">...</span>
                                </span>
                            ) : (
                                label
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
        </div>
    );
};
