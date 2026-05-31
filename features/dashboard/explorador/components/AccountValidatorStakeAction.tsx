import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useStakingTransaction } from '@/features/dashboard/staking/hooks/useStakingTransaction';
import { StakingAction } from '@/features/dashboard/staking/types/staking-operations.types';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { apiFetchTransactionDetails, apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { GatewayEntityDetails } from '@/features/dashboard/types';
import { useValidatorsQuery } from '@/features/dashboard/staking/hooks/useValidatorsQuery';

interface AccountValidatorStakeActionProps {
    accountAddress: string;
    validatorAddress: string;
    network: 'mainnet' | 'stokenet';
    entityData: GatewayEntityDetails | null;
    xrdBalance: number;
    stakedXrd: number;
    claimableXrd: number;
    lsuBalance: number;
    t?: Partial<import('@/features/dashboard/types').TranslationsT>;
    ghostAmount?: string;
    hasGlobalAmount?: boolean;
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
    hasGlobalAmount
}: AccountValidatorStakeActionProps) => {
    const queryClient = useQueryClient();
    const { activeNetworkId } = useRadixWallet();
    const { data: validatorsData } = useValidatorsQuery(network);
    const validator = validatorsData?.validators.find(v => v.address === validatorAddress);

    const inputRef = useRef<HTMLInputElement>(null);
    const [amountStr, setAmountStr] = useState('');
    const [actionError, setActionError] = useState<string | null>(null);
    const [transactingAction, setTransactingAction] = useState<StakingAction | null>(null);

    const stakingT = t?.staking;
    const { submitTransaction, isTransacting, error } = useStakingTransaction();

    const xrdPerLsu = validator?.lsu2xrdFactor || 1;

    // Extract claimNftIds for this validator from the account's entity data
    const claimNftIds: string[] = [];
    if (validator && entityData?.non_fungible_resources?.items) {
        const claimResource = entityData.non_fungible_resources.items.find(
            nft => nft.resource_address === validator.claimTokenResourceAddress
        );
        if (claimResource && claimResource.vaults?.items?.[0]?.items) {
            claimNftIds.push(...claimResource.vaults.items[0].items);
        }
    }

    const hasTxError = !!error || !!actionError;

    const handleAction = async (actionToPerform: StakingAction) => {
        setActionError(null);

        let amount = parseFloat(amountStr || '0');

        if (actionToPerform === 'Stake' && amount > xrdBalance) {
            if (amount - xrdBalance <= 0.01) {
                amount = xrdBalance;
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
            setAmountStr('');
            pollTransactionStatus(hash);
        }
    };

    const handleSetMax = () => {
        const maxAmount = Math.max(xrdBalance, stakedXrd);
        setAmountStr(maxAmount.toString());
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
                    setActionError(stakingT?.errors?.rejectedByUser ?? 'Transacción rechazada.');
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

    return (
        <div className="flex flex-col gap-3 pt-4 border-t border-[var(--color-card-border)]/30">
            {/* Input Row */}
            <div className="relative flex flex-col">
                <div className="relative">
                    <input
                        ref={inputRef}
                        type="number"
                        value={amountStr}
                        onChange={(e) => setAmountStr(e.target.value)}
                        placeholder={ghostAmount ? `${ghostAmount} (Automático)` : (stakingT?.amount_placeholder ?? "Cantidad de XRD")}
                        disabled={hasTxError}
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors pr-16 ${hasTxError ? 'border-red-500 text-red-500 focus:border-red-500 bg-[var(--color-background)]' : 'border-[var(--color-border)] focus:border-[var(--color-primary)]'} ${ghostAmount && !amountStr ? 'bg-[var(--color-primary)]/5 text-[var(--color-text-muted)] italic' : 'bg-[var(--color-background)]'} ${hasTxError ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={e => e.stopPropagation()}
                    />
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSetMax(); }}
                        disabled={hasTxError}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-1 rounded transition-colors ${hasTxError ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--color-primary)]/20'}`}
                    >
                        {stakingT?.max ?? 'MAX'}
                    </button>
                </div>
                {hasTxError && (
                    <div className="text-[10px] text-red-500 mt-1 flex justify-between">
                        <span>{actionError || error}</span>
                        <button type="button" onClick={() => setActionError(null)} className="underline hover:no-underline">X</button>
                    </div>
                )}
            </div>

            {/* Buttons Row */}
            <div className="flex gap-2">
                {(['Stake', 'Unstake', 'Claim'] as StakingAction[]).map(action => {
                    const isThisActionTransacting = isTransacting && transactingAction === action;
                    const amountToUse = amountStr || ghostAmount || '0';
                    const isDisabled =
                        !validator ||
                        isTransacting ||
                        hasTxError ||
                        (action === 'Unstake' && stakedXrd <= 0) ||
                        (action === 'Claim' && claimableXrd <= 0) ||
                        (action !== 'Claim' && parseFloat(amountToUse) <= 0) ||
                        (action === 'Claim' && claimNftIds.length === 0);

                    const labelPrefix = (stakingT?.[action.toLowerCase() as keyof typeof stakingT] as string) ?? action;
                    const label = hasGlobalAmount ? `${labelPrefix} SELECCIONADOS` : labelPrefix;

                    return (
                        <button
                            type="button"
                            key={action}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleAction(action);
                            }}
                            disabled={isDisabled}
                            className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--color-background)] text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] leading-tight`}
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
