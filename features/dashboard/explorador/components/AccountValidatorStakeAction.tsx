import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useStakingTransaction } from '@/features/dashboard/staking/hooks/useStakingTransaction';
import { StakingAction } from '@/features/dashboard/staking/types/staking-operations.types';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { apiFetchTransactionDetails, apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { GatewayEntityDetails } from '@/features/dashboard/types';
import { useValidatorsQuery } from '@/features/dashboard/staking/hooks/useValidatorsQuery';

export type ValidatorSelections = { amountStr?: string; stake?: string; unstake?: string; claim?: boolean };

interface AccountValidatorStakeActionProps {
    accountAddress: string;
    validatorAddress: string;
    network: 'mainnet' | 'stokenet';
    entityData?: any;
    xrdBalance: number;
    stakedXrd: number;
    claimableXrd: number;
    lsuBalance: number;
    t?: any;
    ghostAmount?: string;
    selections?: ValidatorSelections;
    onUpdateSelections?: (selections: ValidatorSelections) => void;
    isMultiMode: boolean;
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
    t,
    ghostAmount,
    selections = {},
    onUpdateSelections,
    isMultiMode
}: AccountValidatorStakeActionProps) => {
    const queryClient = useQueryClient();
    const { activeNetworkId } = useRadixWallet();
    const { data: validatorsData } = useValidatorsQuery(network);
    const validator = validatorsData?.validators.find(v => v.address === validatorAddress);

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
            (nft: any) => nft.resource_address === validator.claimTokenResourceAddress
        );
        if (claimResource && claimResource.vaults?.items?.[0]?.items) {
            claimNftIds.push(...claimResource.vaults.items[0].items);
        }
    }

    const hasTxError = !!error || !!actionError;

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
            if (activeTab === 'Stake' && newSelections.stake !== undefined) {
                newSelections.stake = val;
            } else if (activeTab === 'Unstake' && newSelections.unstake !== undefined) {
                newSelections.unstake = val;
            } else if (activeTab !== 'Claim') {
                newSelections.amountStr = val;
            }
            
            if (val === '') {
                if (activeTab === 'Stake') delete newSelections.stake;
                if (activeTab === 'Unstake') delete newSelections.unstake;
                if (activeTab !== 'Claim') delete newSelections.amountStr;
            }
            onUpdateSelections(newSelections);
        }
    };

    const handleAction = async (actionToPerform: StakingAction) => {
        setActionError(null);
        if (clearError) clearError();

        let rawAmountStr = '0';
        if (actionToPerform === 'Stake' && selections.stake !== undefined) rawAmountStr = selections.stake;
        else if (actionToPerform === 'Unstake' && selections.unstake !== undefined) rawAmountStr = selections.unstake;
        else rawAmountStr = selections.amountStr || '0';

        if (isMultiMode && onUpdateSelections) {
            const newSelections = { ...selections };
            
            if (actionToPerform === 'Claim') {
                if (selections.claim) {
                    delete newSelections.claim;
                    setActiveTab('Stake');
                } else {
                    newSelections.claim = true;
                    newSelections.amountStr = ''; // clear general input
                    setActiveTab('Claim');
                }
            } else if (actionToPerform === 'Stake') {
                if (selections.stake !== undefined) {
                    delete newSelections.stake; // toggle off
                    if (activeTab === 'Stake') setActiveTab(newSelections.unstake !== undefined ? 'Unstake' : (newSelections.claim ? 'Claim' : null));
                } else {
                    newSelections.stake = rawAmountStr; // toggle on with current amount
                    newSelections.amountStr = ''; // clear general input
                    setActiveTab('Stake');
                }
            } else if (actionToPerform === 'Unstake') {
                if (selections.unstake !== undefined) {
                    delete newSelections.unstake; // toggle off
                    if (activeTab === 'Unstake') setActiveTab(newSelections.stake !== undefined ? 'Stake' : (newSelections.claim ? 'Claim' : null));
                } else {
                    newSelections.unstake = rawAmountStr; // toggle on with current amount
                    newSelections.amountStr = ''; // clear general input
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
                setActionError('Saldo insuficiente para esta acción.');
                return;
            }
        }

        if (actionToPerform === 'Unstake' && amount > stakedXrd) {
            if (amount - stakedXrd <= 0.01) {
                amount = stakedXrd;
            } else {
                setActionError('Saldo insuficiente para esta acción.');
                return;
            }
        }

        setTransactingAction(actionToPerform);

        let txAmount = amount;
        if (actionToPerform === 'Unstake') {
            if (amount === stakedXrd) {
                txAmount = lsuBalance; // Use exact LSU balance if max
            } else {
                txAmount = amount / xrdPerLsu;
            }
        }

        if (!validator) {
            setActionError('Validador no encontrado');
            return;
        }

        const hash = await submitTransaction(
            accountAddress,
            validator.address,
            actionToPerform,
            'delegator',
            txAmount,
            validator.lsuResource,
            claimNftIds,
            validator.claimTokenResourceAddress
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
                newSelections.unstake = stakedXrd.toString();
            } else {
                const maxAmount = Math.max(xrdBalance, stakedXrd);
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
                queryClient.invalidateQueries({ queryKey: ['entity'] });
                queryClient.invalidateQueries({ queryKey: ['account-entity-details'] });
                return;
            }

            try {
                const details = await apiFetchTransactionDetails(hash, networkName);
                if (details && (details.transaction_status === 'CommittedSuccess' || details.transaction_status === 'Committed')) {
                    try {
                        await apiFetchEntityDetails(accountAddress, networkName, true);
                    } catch (e) {
                        console.error('Failed to pre-fetch entity details after transaction', e);
                    }
                    queryClient.invalidateQueries({ queryKey: ['entity'] });
                    queryClient.invalidateQueries({ queryKey: ['account-entity-details'] });
                    setTransactingAction(null);
                    return;
                } else if (details && details.transaction_status === 'CommittedFailure') {
                    setActionError('La transacción falló.');
                    setTransactingAction(null);
                    return;
                } else if (details && details.transaction_status === 'Rejected') {
                    setActionError('Transacción rechazada.');
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

    // Solo mostramos el input si no es multimodo, o si en multimodo hay una tab activa
    const showInput = !isMultiMode || (activeTab === 'Stake' || activeTab === 'Unstake');

    return (
        <div className="flex flex-col gap-3 pt-4 border-t border-[var(--color-card-border)]/30">
            {/* Input Row */}
            {showInput && (
                <div className="relative flex flex-col">
                    <div className="relative">
                        <input
                            ref={inputRef}
                            type="number"
                            min="0"
                            value={currentInputVal}
                            onChange={(e) => handleInputChange(e.target.value)}
                            onKeyDown={(e) => { if (e.key === '-') e.preventDefault(); }}
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            placeholder={ghostAmount ? `${ghostAmount} (Automático)` : `Cantidad de XRD ${isMultiMode && activeTab !== 'Claim' ? `(${activeTab})` : ''}`}
                            disabled={isTransacting || activeTab === 'Claim'}
                            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors pr-16 ${hasTxError ? 'border-red-500 text-red-500 focus:border-red-500 bg-[var(--color-background)]' : 'border-[var(--color-border)] focus:border-[var(--color-primary)]'} ${ghostAmount && !currentInputVal ? 'bg-[var(--color-primary)]/5 text-[var(--color-text-muted)] italic' : 'bg-[var(--color-background)]'} ${(isTransacting || activeTab === 'Claim') ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={e => e.stopPropagation()}
                        />
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleSetMax(); }}
                            disabled={isTransacting || activeTab === 'Claim'}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-1 rounded transition-colors ${(isTransacting || activeTab === 'Claim') ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--color-primary)]/20'}`}
                        >
                            MAX
                        </button>
                    </div>
                    {hasTxError && (
                        <div className="text-[10px] text-red-500 mt-1 flex justify-between">
                            <span>{actionError || error}</span>
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
                                (action === 'Unstake' && stakedXrd <= 0) || 
                                (action === 'Claim' && claimableXrd <= 0) ||
                                (action === 'Claim' && claimNftIds.length === 0);
                        }
                    } else {
                        isDisabled =
                            !validator ||
                            isTransacting ||
                            hasTxError ||
                            (action === 'Unstake' && stakedXrd <= 0) ||
                            (action === 'Claim' && claimableXrd <= 0) ||
                            (action !== 'Claim' && (!currentInputVal || parseFloat(currentInputVal) <= 0)) ||
                            (action === 'Claim' && claimNftIds.length === 0);
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
                            className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${isSelected ? 'bg-[var(--color-primary)] text-white shadow-md' : 'bg-[var(--color-background)] text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)]'} leading-tight`}
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
    );
};
