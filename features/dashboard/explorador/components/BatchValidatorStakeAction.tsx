import React, { useRef } from 'react';
import { StakingAction } from '@/features/dashboard/staking/types/staking-operations.types';

interface BatchValidatorStakeActionProps {
    selectedValidatorsCount: number;
    xrdBalance: number;
    totalStakedXrdSelected: number;
    globalAmountStr: string;
    setGlobalAmountStr: (val: string) => void;
    onBatchAction: (action: StakingAction) => void;
    isTransacting: boolean;
    transactingAction: StakingAction | null;
    actionError: string | null;
    setActionError: (err: string | null) => void;
    clearError?: () => void;
    t?: Partial<import('@/features/dashboard/types').TranslationsT>;
    children?: React.ReactNode;
}

export const BatchValidatorStakeAction = ({
    selectedValidatorsCount,
    xrdBalance,
    totalStakedXrdSelected,
    globalAmountStr,
    setGlobalAmountStr,
    onBatchAction,
    isTransacting,
    transactingAction,
    actionError,
    setActionError,
    clearError,
    children
}: BatchValidatorStakeActionProps) => {
    const inputRef = useRef<HTMLInputElement>(null);
    
    // In batch mode, we don't know the exact max balance trivially here since it depends on the sum across selected validators.
    // The actual limit validation happens before calling onBatchAction or inside it.
    
    return (
        <div className="flex flex-col gap-3 mb-6">
            <div className="text-xs font-bold text-[var(--color-primary)] flex justify-between items-center px-1">
                <span className="flex items-center gap-2">
                    ACCIÓN GLOBAL (LOTES)
                </span>
                <span>{selectedValidatorsCount} Validadores Seleccionados</span>
            </div>
            
            {children && (
                <div className="mb-2">
                    {children}
                </div>
            )}
            
            {/* Input Row */}
            <div className="relative flex flex-col">
                <div className="relative">
                    <input
                        ref={inputRef}
                        type="number"
                        min="0"
                        value={globalAmountStr}
                        onChange={(e) => {
                            if (e.target.value.includes('-')) return;
                            setGlobalAmountStr(e.target.value);
                            setActionError(null);
                            if (clearError) clearError();
                        }}
                        onKeyDown={(e) => { if (e.key === '-') e.preventDefault(); }}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        placeholder="Cantidad de XRD (Lote)"
                        disabled={isTransacting}
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors pr-16 ${actionError ? 'border-red-500 text-red-500 focus:border-red-500 bg-[var(--color-background)]' : 'border-[var(--color-border)] focus:border-[var(--color-primary)] bg-[var(--color-background)]'} ${isTransacting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                    <button
                        type="button"
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            const maxAmount = Math.max(xrdBalance, totalStakedXrdSelected);
                            setGlobalAmountStr(maxAmount.toString()); 
                        }}
                        disabled={isTransacting}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-1 rounded transition-colors ${isTransacting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--color-primary)]/20'}`}
                    >
                        MAX
                    </button>
                </div>
                {actionError && (
                    <div className="text-[10px] text-red-500 mt-1 flex justify-between">
                        <span>{actionError}</span>
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
                        (action === 'Unstake' && totalStakedXrdSelected <= 0) ||
                        (action !== 'Claim' && (!globalAmountStr || parseFloat(globalAmountStr) <= 0));
                    
                    const label = action;

                    return (
                        <button
                            type="button"
                            key={action}
                            onClick={() => onBatchAction(action)}
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
            
            <div className="text-[10px] text-[var(--color-text-muted)] text-center italic mt-2">
                La cantidad ingresada se distribuirá a partes iguales entre los validadores seleccionados.
            </div>

        </div>
    );
};
