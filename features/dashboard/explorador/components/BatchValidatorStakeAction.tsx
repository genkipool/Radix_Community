import React, { useRef } from 'react';
import { StakingAction } from '@/features/dashboard/staking/types/staking-operations.types';

interface BatchValidatorStakeActionProps {
    accountAddress: string;
    network: 'mainnet' | 'stokenet';
    selectedValidatorsCount: number;
    globalAmountStr: string;
    setGlobalAmountStr: (val: string) => void;
    onBatchAction: (action: StakingAction) => void;
    isTransacting: boolean;
    transactingAction: StakingAction | null;
    actionError: string | null;
    setActionError: (err: string | null) => void;
    t?: Partial<import('@/features/dashboard/types').TranslationsT>;
}

export const BatchValidatorStakeAction = ({
    selectedValidatorsCount,
    globalAmountStr,
    setGlobalAmountStr,
    onBatchAction,
    isTransacting,
    transactingAction,
    actionError,
    setActionError,
    t
}: BatchValidatorStakeActionProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const stakingT = t?.staking;
    
    // In batch mode, we don't know the exact max balance trivially here since it depends on the sum across selected validators.
    // The actual limit validation happens before calling onBatchAction or inside it.
    
    return (
        <div className="flex flex-col gap-3 p-4 rounded-xl bg-[var(--color-surface)] border-2 border-[var(--color-primary)]/50 shadow-md mb-6">
            <div className="text-xs font-bold text-[var(--color-primary)] flex justify-between items-center">
                <span>ACCIÓN GLOBAL (LOTES)</span>
                <span>{selectedValidatorsCount} Validadores Seleccionados</span>
            </div>
            
            {/* Input Row */}
            <div className="relative flex flex-col">
                <div className="relative">
                    <input
                        ref={inputRef}
                        type="number"
                        value={globalAmountStr}
                        onChange={(e) => {
                            setGlobalAmountStr(e.target.value);
                            setActionError(null);
                        }}
                        placeholder={`Cantidad total de XRD a distribuir`}
                        disabled={isTransacting || selectedValidatorsCount === 0}
                        className={`w-full bg-[var(--color-background)] border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors pr-16 ${actionError ? 'border-red-500 text-red-500 focus:border-red-500' : 'border-[var(--color-border)] focus:border-[var(--color-primary)]'} ${(isTransacting || selectedValidatorsCount === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                </div>
                {actionError && (
                    <div className="text-[10px] text-red-500 mt-1 flex justify-between">
                        <span>{actionError}</span>
                        <button type="button" onClick={() => setActionError(null)} className="underline hover:no-underline">X</button>
                    </div>
                )}
            </div>

            {/* Buttons Row */}
            <div className="flex gap-2">
                {(['Stake', 'Unstake', 'Claim'] as StakingAction[]).map(action => {
                    const isThisActionTransacting = isTransacting && transactingAction === action;
                    const isDisabled =
                        isTransacting ||
                        selectedValidatorsCount === 0 ||
                        (action !== 'Claim' && (!globalAmountStr || parseFloat(globalAmountStr) <= 0));

                    return (
                        <button
                            type="button"
                            key={action}
                            onClick={(e) => {
                                e.stopPropagation();
                                onBatchAction(action);
                            }}
                            disabled={isDisabled}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${action === 'Claim' ? 'bg-[var(--color-accent)] text-white hover:opacity-90' : 'bg-[var(--color-primary)] text-white hover:opacity-90'}`}
                        >
                            {isThisActionTransacting ? (
                                <span className="flex items-center justify-center">
                                    {(stakingT?.[action.toLowerCase() as keyof typeof stakingT] as string) ?? action}
                                    <span className="animate-pulse ml-0.5">...</span>
                                </span>
                            ) : (
                                `${(stakingT?.[action.toLowerCase() as keyof typeof stakingT] as string) ?? action} TODOS`
                            )}
                        </button>
                    );
                })}
            </div>
            
            <div className="text-[10px] text-[var(--color-text-muted)] italic text-center mt-1">
                La cantidad ingresada se distribuirá a partes iguales entre los validadores seleccionados.
            </div>
        </div>
    );
};
