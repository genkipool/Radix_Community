'use client';

import React, { useState, useRef } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useStakingLocale } from '@/features/dashboard/staking/hooks/useStakingLocale';
import type { StakingAction } from '@/features/dashboard/staking/types/staking-operations.types';
import type { TranslationsT } from '@/features/dashboard/types';

export type ValidatorSelections = {
    amountStr?: string;
    stake?: string;
    unstake?: string;
    claim?: boolean;
    /** Console-only owner mode: whether OwnerStake also locks minted LSUs (defaults to true). */
    ownerLockOnStake?: boolean;
    /** Console-only owner mode: existing liquid LSUs to lock into the owner vault. */
    ownerLock?: string;
};

type ActiveTab = 'Stake' | 'Unstake' | 'Claim' | 'Lock' | null;

const EMPTY_SELECTIONS: ValidatorSelections = {};

/** Picks the next remaining active tab after toggling an action off, and syncs `amountStr`. */
function pickNextActiveTab(selections: ValidatorSelections): ActiveTab {
    if (selections.stake !== undefined) {
        selections.amountStr = selections.stake;
        return 'Stake';
    }
    if (selections.unstake !== undefined) {
        selections.amountStr = selections.unstake;
        return 'Unstake';
    }
    if (selections.ownerLock !== undefined) {
        selections.amountStr = selections.ownerLock;
        return 'Lock';
    }
    if (selections.claim) return 'Claim';
    return null;
}

interface AccountValidatorStakeActionProps {
    xrdBalance: number;
    /** Total XRD already allocated to Stake in OTHER validator rows (for real-time remaining balance). */
    otherValidatorsStakeXrd?: number;
    /** Effective staked XRD for this row (owner locked stake when `ownerMode` is on, delegator stake otherwise). */
    stakedXrd: number;
    /** Effective claimable XRD for this row (owner unlocked when `ownerMode` is on, matured claim NFTs otherwise). */
    claimableXrd: number;
    /** Matured claim NFTs for this validator (delegator mode). */
    claimableNftIds?: string[];
    lsuBalance: number;
    ghostAmount?: string;
    selections?: ValidatorSelections;
    onUpdateSelections: (selections: ValidatorSelections) => void;
    ownerMode?: boolean;
    /** Console-only: exposes Stake unlocked and Lock LSU in owner mode. */
    advancedOwnerControls?: boolean;
    isTransacting?: boolean;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
}

/**
 * Pure per-validator staking control bar (input + MAX + live remaining balance +
 * action toggle buttons). All owner/delegator balances are computed by its parent
 * `ValidatorStakingRow` and transaction execution lives in `AccountStakingSection`.
 */
export const AccountValidatorStakeAction = ({
    xrdBalance,
    otherValidatorsStakeXrd = 0,
    stakedXrd,
    claimableXrd,
    claimableNftIds = [],
    lsuBalance,
    ghostAmount,
    selections = EMPTY_SELECTIONS,
    onUpdateSelections,
    ownerMode = false,
    advancedOwnerControls = false,
    isTransacting = false,
    tt,
}: AccountValidatorStakeActionProps) => {
    const { t: contextT } = useLanguage();
    const accT = tt?.account_summary || contextT?.dashboard?.transactions?.account_summary;
    const stakingT = useStakingLocale();
    const tooltips = stakingT.tooltips;

    const inputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<ActiveTab>('Stake');
    const showAdvancedOwner = ownerMode && advancedOwnerControls;

    // Matches the 2-decimal display (`formatNumber(x, 2)`): sub-cent dust that renders as "0 XRD" cannot be unstaked.
    const hasVisibleStake = Number.isFinite(stakedXrd) && Number(stakedXrd.toFixed(2)) > 0;

    // Reset activeTab when selections are completely cleared (e.g. from Reset button)
    const [prevSelectionsLength, setPrevSelectionsLength] = useState(Object.keys(selections).length);
    const currentSelectionsLength = Object.keys(selections).length;
    if (prevSelectionsLength !== currentSelectionsLength) {
        setPrevSelectionsLength(currentSelectionsLength);
        if (currentSelectionsLength === 0 && activeTab !== 'Stake') {
            setActiveTab('Stake');
        }
    }

    const currentInputVal = activeTab === 'Stake' && selections.stake !== undefined
        ? selections.stake
        : activeTab === 'Unstake' && selections.unstake !== undefined
            ? selections.unstake
            : activeTab === 'Lock' && selections.ownerLock !== undefined
                ? selections.ownerLock
                : activeTab === 'Claim'
                    ? ''
                    : selections.amountStr || '';

    const handleInputChange = (val: string) => {
        if (val.includes('-')) return;
        const next: ValidatorSelections = { ...selections, amountStr: val };
        if (activeTab === 'Stake' && next.stake !== undefined) next.stake = val;
        else if (activeTab === 'Unstake' && next.unstake !== undefined) next.unstake = val;
        else if (activeTab === 'Lock' && next.ownerLock !== undefined) next.ownerLock = val;

        if (val === '') {
            if (activeTab === 'Stake') delete next.stake;
            if (activeTab === 'Unstake') delete next.unstake;
            if (activeTab === 'Lock') delete next.ownerLock;
            delete next.amountStr;
        }
        onUpdateSelections(next);
    };

    const handleOwnerStakeUnlockedAction = () => {
        const next: ValidatorSelections = { ...selections };
        if (selections.stake !== undefined && selections.ownerLockOnStake === false) {
            delete next.stake;
            delete next.ownerLockOnStake;
            setActiveTab(pickNextActiveTab(next));
        } else {
            const raw = selections.stake !== undefined
                ? selections.stake
                : (selections.unstake !== undefined || selections.ownerLock !== undefined ? '' : (selections.amountStr || ''));
            next.stake = raw;
            next.amountStr = raw;
            next.ownerLockOnStake = false;
            setActiveTab('Stake');
        }
        onUpdateSelections(next);
    };

    const handleOwnerLockAction = () => {
        const next: ValidatorSelections = { ...selections };
        if (selections.ownerLock !== undefined) {
            delete next.ownerLock;
            setActiveTab(pickNextActiveTab(next));
        } else {
            const raw = selections.stake !== undefined || selections.unstake !== undefined ? '' : (selections.amountStr || '');
            next.ownerLock = raw;
            next.amountStr = raw;
            setActiveTab('Lock');
        }
        onUpdateSelections(next);
    };

    const handleAction = (actionToPerform: StakingAction) => {
        let rawAmountStr = '';
        if (actionToPerform === 'Stake' && selections.stake !== undefined) {
            rawAmountStr = selections.stake;
        } else if (actionToPerform === 'Unstake' && selections.unstake !== undefined) {
            rawAmountStr = selections.unstake;
        } else if (
            (actionToPerform === 'Stake' && selections.unstake !== undefined) ||
            (actionToPerform === 'Unstake' && selections.stake !== undefined)
        ) {
            rawAmountStr = '';
        } else {
            rawAmountStr = selections.amountStr || '';
        }

        const next: ValidatorSelections = { ...selections };
        if (actionToPerform === 'Claim') {
            if (selections.claim) {
                delete next.claim;
                setActiveTab(pickNextActiveTab(next));
            } else {
                next.claim = true;
                setActiveTab('Claim');
            }
        } else if (actionToPerform === 'Stake') {
            const isRowStakeSelected = selections.stake !== undefined && (!showAdvancedOwner || selections.ownerLockOnStake !== false);
            if (isRowStakeSelected) {
                delete next.stake;
                delete next.ownerLockOnStake;
                setActiveTab(pickNextActiveTab(next));
            } else {
                next.stake = rawAmountStr;
                next.amountStr = rawAmountStr;
                if (showAdvancedOwner) next.ownerLockOnStake = true;
                setActiveTab('Stake');
            }
        } else if (actionToPerform === 'Unstake') {
            if (selections.unstake !== undefined) {
                delete next.unstake;
                setActiveTab(pickNextActiveTab(next));
            } else {
                next.unstake = rawAmountStr;
                next.amountStr = rawAmountStr;
                setActiveTab('Unstake');
            }
        }

        onUpdateSelections(next);
    };

    const availableStakeXrdForRow = Math.max(0, xrdBalance - otherValidatorsStakeXrd);

    const handleSetMax = () => {
        const next: ValidatorSelections = { ...selections };
        if (activeTab === 'Stake') {
            next.stake = availableStakeXrdForRow.toString();
            next.amountStr = availableStakeXrdForRow.toString();
        } else if (activeTab === 'Unstake') {
            next.unstake = stakedXrd.toString();
            next.amountStr = stakedXrd.toString();
        } else if (activeTab === 'Lock') {
            next.ownerLock = lsuBalance.toString();
            next.amountStr = lsuBalance.toString();
        } else {
            const maxAmount = Math.max(availableStakeXrdForRow, stakedXrd);
            next.amountStr = maxAmount.toString();
        }
        onUpdateSelections(next);
    };

    let limitAmount = 0;
    let isStakeContext = false;
    if (activeTab === 'Stake') {
        limitAmount = availableStakeXrdForRow;
        isStakeContext = true;
    } else if (activeTab === 'Unstake') {
        limitAmount = stakedXrd;
    } else if (activeTab === 'Lock') {
        limitAmount = lsuBalance;
    } else if (activeTab === 'Claim') {
        limitAmount = claimableXrd;
    } else if (selections.claim) {
        limitAmount = claimableXrd;
    } else if (selections.ownerLock !== undefined) {
        limitAmount = lsuBalance;
    } else if (selections.unstake !== undefined) {
        limitAmount = stakedXrd;
    } else {
        limitAmount = availableStakeXrdForRow;
        isStakeContext = true;
    }

    const valAmount = parseFloat(currentInputVal || '0');
    const isExceeded =
        currentInputVal !== '' &&
        (isStakeContext
            ? otherValidatorsStakeXrd + valAmount > xrdBalance + 1e-6
            : valAmount > limitAmount + 1e-6);
    const displayedLimitAmount = activeTab === 'Claim' ? limitAmount : Math.max(0, limitAmount - valAmount);
    const isLockTab = activeTab === 'Lock';
    const placeholder = isLockTab
        ? stakingT.lock_lsu_placeholder
        : ghostAmount
            ? `${ghostAmount} (${accT?.auto_placeholder || 'Auto'})`
            : `${accT?.amount_xrd || 'Amount of XRD'} ${activeTab && activeTab !== 'Claim' ? `(${activeTab})` : ''}`;

    const getButtonTitle = (action: StakingAction) => {
        if (ownerMode) {
            if (action === 'Stake') return tooltips.owner_stake;
            if (action === 'Unstake') return tooltips.owner_unstake;
            return tooltips.owner_claim;
        }
        if (action === 'Stake') return tooltips.delegator_stake;
        if (action === 'Unstake') return tooltips.delegator_unstake;
        return tooltips.delegator_claim;
    };

    return (
        <div className="w-full">
            <div style={{ display: 'none' }} data-prev-len={prevSelectionsLength} />
            <div className="flex flex-col gap-3 pt-4 border-t border-[var(--color-card-border)]/30">
                {/* Input Row */}
                <div className="relative flex flex-col">
                    <div className="relative">
                        <input
                            ref={inputRef}
                            type="number"
                            min="0"
                            aria-label={placeholder}
                            value={currentInputVal}
                            onChange={(e) => handleInputChange(e.target.value)}
                            onKeyDown={(e) => { if (e.key === '-') e.preventDefault(); }}
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            placeholder={placeholder}
                            disabled={isTransacting || activeTab === 'Claim'}
                            className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors pr-32 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield] ${isExceeded ? 'border-red-500 text-red-500 focus:border-red-500 bg-[var(--color-bg)]' : 'border-[var(--color-border)] focus:border-[var(--color-primary)]'} ${ghostAmount && !currentInputVal ? 'bg-[var(--color-primary)]/5 text-[var(--color-text-muted)] italic' : 'bg-[var(--color-bg)]'} ${(isTransacting || activeTab === 'Claim') ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={e => e.stopPropagation()}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                            <span className={`text-[10px] font-mono ${isExceeded ? 'text-red-500' : 'text-[var(--color-text-muted)]'}`}>
                                {displayedLimitAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
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
                </div>

                {/* Buttons Row 1 */}
                <div className="flex gap-2">
                    {(['Stake', 'Unstake', 'Claim'] as StakingAction[]).map(action => {
                        const label = action === 'Stake' ? 'Staking' : action;
                        const isSelected = action === 'Stake'
                            ? (selections.stake !== undefined && (!showAdvancedOwner || selections.ownerLockOnStake !== false))
                            : action === 'Unstake'
                                ? selections.unstake !== undefined
                                : !!selections.claim;

                        const isDisabled = !isSelected && (
                            isTransacting ||
                            (action === 'Unstake' && !hasVisibleStake) ||
                            (action === 'Claim' && !(claimableXrd > 0)) ||
                            (action === 'Claim' && !ownerMode && claimableNftIds.length === 0)
                        );

                        return (
                            <button
                                type="button"
                                key={action}
                                title={getButtonTitle(action)}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAction(action);
                                }}
                                disabled={isDisabled}
                                className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${isSelected ? 'bg-[var(--color-primary)] text-white shadow-md border border-transparent' : 'bg-[var(--color-bg)] text-[var(--color-text-main)] enabled:hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)]'} leading-tight`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>

                {/* Buttons Row 2 (Console Owner Mode) */}
                {showAdvancedOwner && (
                    <div className="flex gap-2">
                        <button
                            type="button"
                            title={tooltips.owner_stake_unlocked}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleOwnerStakeUnlockedAction();
                            }}
                            disabled={isTransacting}
                            className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed leading-tight cursor-pointer ${
                                selections.stake !== undefined && selections.ownerLockOnStake === false
                                    ? 'bg-[var(--color-primary)] text-white shadow-md border border-transparent'
                                    : 'bg-[var(--color-bg)] text-[var(--color-text-main)] enabled:hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)]'
                            }`}
                        >
                            {stakingT.stake_unlocked}
                        </button>
                        <button
                            type="button"
                            title={tooltips.owner_lock_lsu}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleOwnerLockAction();
                            }}
                            disabled={isTransacting || (selections.ownerLock === undefined && !(lsuBalance > 0))}
                            className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed leading-tight cursor-pointer ${
                                selections.ownerLock !== undefined
                                    ? 'bg-[var(--color-primary)] text-white shadow-md border border-transparent'
                                    : 'bg-[var(--color-bg)] text-[var(--color-text-main)] enabled:hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)]'
                            }`}
                        >
                            {stakingT.lock_lsu}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
