import React, { useRef } from 'react';
import { StakingAction } from '@/features/dashboard/staking/types/staking-operations.types';
import { useLanguage } from '@/context/LanguageContext';
import type { TranslationsT } from '@/features/dashboard/types';

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
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    children?: React.ReactNode;
    canDistribute?: boolean;
    /**
     * Drop the outer card and the title row because the host already provides
     * them. Used where these controls get a box of their own (the console),
     * so the result is one box with the operation boxed inside it, not three
     * nested frames.
     */
    unstyled?: boolean;
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
    tt,
    children,
    canDistribute = true,
    unstyled = false
}: BatchValidatorStakeActionProps) => {
    const { t: contextT } = useLanguage();
    const inputRef = useRef<HTMLInputElement>(null);

    const accT = tt?.account_summary || contextT?.dashboard?.transactions?.account_summary;

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

            {children && (
                <div className="mb-2">
                    {children}
                </div>
            )}

            <div className="relative flex flex-col">
                <div className="relative">
                    <input
                        ref={inputRef}
                        type="number"
                        min="0"
                        aria-label={accT?.batch_amount_placeholder || 'Amount of XRD to distribute'}
                        value={globalAmountStr}
                        onChange={(e) => {
                            if (e.target.value.includes('-')) return;
                            setGlobalAmountStr(e.target.value);
                            setActionError(null);
                            if (clearError) clearError();
                        }}
                        onKeyDown={(e) => { if (e.key === '-') e.preventDefault(); }}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        placeholder={accT?.batch_amount_placeholder || 'Amount of XRD to distribute'}
                        disabled={isTransacting}
                        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors pr-16 bg-[var(--color-bg)] ${actionError ? 'border-red-500 text-red-500 focus:border-red-500' : 'border-[var(--color-border)] focus:border-[var(--color-primary)]'} ${isTransacting ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                        {accT?.max || 'MAX'}
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
                        !canDistribute ||
                        (action === 'Unstake' && totalStakedXrdSelected <= 0) ||
                        (action !== 'Claim' && (!globalAmountStr || parseFloat(globalAmountStr) <= 0));

                    const label = action;
                    const buttonTitle = !canDistribute ? (accT?.batch_disabled_owner_tooltip || 'Owner mode is active on all selected validators. Batch distribution is not available.') : undefined;

                    return (
                        <button
                            type="button"
                            key={action}
                            onClick={() => onBatchAction(action)}
                            disabled={isDisabled}
                            title={isDisabled ? buttonTitle : undefined}
                            className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--color-bg)] text-[var(--color-text-main)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] leading-tight`}
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
