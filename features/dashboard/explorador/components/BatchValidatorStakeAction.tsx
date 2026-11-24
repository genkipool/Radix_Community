import React, { useRef } from 'react';
import { StakingAction } from '@/features/dashboard/staking/types/staking-operations.types';
import { useLanguage } from '@/context/LanguageContext';
import type { TranslationsT } from '@/features/dashboard/types';

interface BatchValidatorStakeActionProps {
    selectedValidatorsCount: number;
    xrdBalance: number;
    totalStakedXrdSelected: number;
    /** XRD the selected validators have ready to claim; Claim stays off at 0. */
    totalClaimableXrdSelected?: number;
    globalAmountStr: string;
    setGlobalAmountStr: (val: string) => void;
    onBatchAction: (action: StakingAction) => void;
    isTransacting: boolean;
    transactingAction: StakingAction | null;
    actionError: string | null;
    setActionError: (err: string | null) => void;
    clearError?: () => void;
    t?: Partial<import('@/features/dashboard/types').TranslationsT>;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    children?: React.ReactNode;
    canDistribute?: boolean;
    /** False when any selected non-owner validator has nothing staked to unstake. */
    canUnstake?: boolean;
    /**
     * Drop the outer card and the title row because the host already provides
     * them. Used where these controls get a box of their own (the console),
     * so the result is one box with the operation boxed inside it, not three
     * nested frames.
     */
    unstyled?: boolean;
    /**
     * Console-only: when set, the action buttons select the pending batch
     * action instead of sending immediately (so the user can inspect the
     * summary, preview the manifest, and simulate before signing).
     */
    selectedAction?: StakingAction;
}

export const BatchValidatorStakeAction = ({
    selectedValidatorsCount,
    xrdBalance,
    totalStakedXrdSelected,
    totalClaimableXrdSelected = 0,
    globalAmountStr,
    setGlobalAmountStr,
    onBatchAction,
    isTransacting,
    transactingAction,
    actionError,
    setActionError,
    clearError,
    tt,
    children,
    canDistribute = true,
    canUnstake = true,
    unstyled = false,
    selectedAction,
}: BatchValidatorStakeActionProps) => {
    const { t: contextT } = useLanguage();
    const inputRef = useRef<HTMLInputElement>(null);

    const accT = tt?.account_summary || contextT?.dashboard?.transactions?.account_summary;
    const globalNum = parseFloat(globalAmountStr || '0');
    const batchLimit = selectedAction === 'Unstake' ? totalStakedXrdSelected : xrdBalance;
    const isBatchExceeded =
        selectedAction !== 'Claim' &&
        globalAmountStr !== '' &&
        globalNum > batchLimit + 1e-6;
    const batchRemaining = Math.max(0, batchLimit - globalNum);

    return (
        /*
         * This panel never draws a box of its own.
         *
         * These controls act on ALL selected validators at once while the rows
         * below act on one each, so the two zones have to read as separate.
         * How that separation is drawn depends on the host:
         *
         *   console  the ToolSection wrapping this panel IS the box, and also
         *            supplies the title, hint and count (hence `unstyled`).
         *   modal    a compact stack with no boxes anywhere, so a card here
         *            would look out of place. A closing rule does the job.
         */
        <div
            className={`flex flex-col gap-3 ${unstyled ? '' : 'mb-6 pb-4 border-b border-[var(--color-card-border)]'}`}
        >
            {children && (
                <div className="mb-1">
                    {children}
                </div>
            )}

            {/* The console gets its title, hint and count from the ToolSection
                wrapping this panel; here they have to be rendered inline. */}
            {!unstyled && (
                <div className="px-1">
                    <div className="text-[10px] font-bold text-[var(--color-text-main)] uppercase tracking-wider flex justify-between items-center">
                        <span className="flex items-center gap-2">
                            {accT?.global_batch_title_short || 'Distribuir XRD'}
                        </span>
                        <span className="text-[var(--color-text-muted)] tracking-normal normal-case">
                            {selectedValidatorsCount} {accT?.selected_validators || 'Selected Validators'}
                        </span>
                    </div>
                    <p className="mt-1 text-[10px] leading-relaxed text-[var(--color-text-muted)]">
                        {accT?.batch_select_hint || 'Select the validators you want to distribute an amount of XRD to.'}
                    </p>
                </div>
            )}

            <div className="relative flex flex-col">
                <div className="relative">
                    <input
                        ref={inputRef}
                        type="number"
                        min="0"
                        aria-label={accT?.batch_amount_placeholder || 'Amount of XRD to distribute'}
                        value={selectedAction === 'Claim' ? '' : globalAmountStr}
                        onChange={(e) => {
                            if (e.target.value.includes('-')) return;
                            setGlobalAmountStr(e.target.value);
                            setActionError(null);
                            if (clearError) clearError();
                        }}
                        onKeyDown={(e) => { if (e.key === '-') e.preventDefault(); }}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        placeholder={accT?.batch_amount_placeholder || 'Amount of XRD to distribute'}
                        disabled={isTransacting || selectedAction === 'Claim'}
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors pr-32 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield] bg-[var(--color-bg)] ${actionError || isBatchExceeded ? 'border-red-500 text-red-500 focus:border-red-500' : 'border-[var(--color-border)] focus:border-[var(--color-primary)]'} ${isTransacting || selectedAction === 'Claim' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                        {selectedAction !== undefined && selectedAction !== 'Claim' && (
                            <span className={`text-[10px] font-mono ${isBatchExceeded ? 'text-red-500' : 'text-[var(--color-text-muted)]'}`}>
                                {batchRemaining.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                const maxAmount = selectedAction === 'Stake'
                                    ? xrdBalance
                                    : selectedAction === 'Unstake'
                                        ? totalStakedXrdSelected
                                        : Math.max(xrdBalance, totalStakedXrdSelected);
                                setGlobalAmountStr(maxAmount.toString());
                            }}
                            disabled={isTransacting || selectedAction === 'Claim'}
                            className={`text-[10px] font-bold text-[var(--color-primary)] bg-[var(--color-primary)]/10 px-2 py-1 rounded transition-colors pointer-events-auto ${isTransacting || selectedAction === 'Claim' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--color-primary)]/20'}`}
                        >
                            {accT?.max || 'MAX'}
                        </button>
                    </div>
                </div>
                <div
                    role={actionError ? 'alert' : undefined}
                    aria-live="polite"
                    className="min-h-[16px] mt-1 text-[10px] leading-4 text-red-500 flex justify-between"
                >
                    {actionError && <span>{actionError}</span>}
                </div>
            </div>

            {/* Buttons Row */}
            <div className="flex gap-2">
                {(['Stake', 'Unstake', 'Claim'] as StakingAction[]).map(action => {
                    const isSelectMode = selectedAction !== undefined;
                    const isSelected = isSelectMode && selectedAction === action;
                    const isThisActionTransacting = !isSelectMode && isTransacting && transactingAction === action;
                    const hasVisibleTotalStake =
                        Number.isFinite(totalStakedXrdSelected) && Number(totalStakedXrdSelected.toFixed(2)) > 0;
                    const isDisabled = isSelectMode
                        ? (
                            isTransacting ||
                            (!isSelected && (
                                (action === 'Unstake' && (!canUnstake || !hasVisibleTotalStake)) ||
                                (action === 'Claim' && !(totalClaimableXrdSelected > 0))
                            ))
                        )
                        : (
                            isTransacting ||
                            selectedValidatorsCount === 0 ||
                            !canDistribute ||
                            (action === 'Unstake' && (!canUnstake || !hasVisibleTotalStake)) ||
                            (action === 'Claim' && !(totalClaimableXrdSelected > 0)) ||
                            (action !== 'Claim' && (!globalAmountStr || parseFloat(globalAmountStr) <= 0))
                        );

                    const label = action;
                    const buttonTitle = !canDistribute ? (accT?.batch_disabled_owner_tooltip || 'Owner mode is active on all selected validators. Batch distribution is not available.') : undefined;

                    return (
                        <button
                            type="button"
                            key={action}
                            onClick={() => onBatchAction(action)}
                            disabled={isDisabled}
                            title={isDisabled ? buttonTitle : undefined}
                            className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed leading-tight ${
                                isSelected
                                    ? 'bg-[var(--color-primary)] text-white shadow-md border border-transparent'
                                    : 'bg-[var(--color-bg)] text-[var(--color-text-main)] enabled:hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)]'
                            }`}
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
                {accT?.batch_distribute_hint || 'The entered amount will be distributed equally among the selected validators.'}
            </div>

        </div>
    );
};
