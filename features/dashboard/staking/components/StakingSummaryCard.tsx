'use client';

import React from 'react';
import { m } from 'motion/react';
import { FlaskConical, X } from 'lucide-react';
import type { SummaryGroup } from '../lib/stakingPlan';

interface StakingSummaryCardProps {
    variant: 'inline' | 'side' | 'floating';
    title: string;
    resetLabel: string;
    closeLabel: string;
    sendLabel: string;
    sendingLabel: string;
    simulateLabel: string;
    accountAddress?: string;
    accountLabel?: string;
    groups: SummaryGroup[];
    emptyHint?: string;
    canSend: boolean;
    isTransacting: boolean;
    onSend: () => void;
    onReset: () => void;
    resetDisabled?: boolean;
    onClose?: () => void;
    onSimulate?: () => void;
    simulateDisabled?: boolean;
    isSimulating?: boolean;
    simulateResult?: React.ReactNode;
    errorMessage?: string | null;
}

/**
 * Unified Operations Summary card used across Distributed & Multiple staking
 * in all three layouts: inline (narrow/standalone), side column (console),
 * and centered floating modal card (wallet profile modal).
 */
export function StakingSummaryCard({
    variant,
    title,
    resetLabel,
    closeLabel,
    sendLabel,
    sendingLabel,
    simulateLabel,
    accountAddress,
    accountLabel,
    groups,
    emptyHint,
    canSend,
    isTransacting,
    onSend,
    onReset,
    resetDisabled = false,
    onClose,
    onSimulate,
    simulateDisabled = false,
    isSimulating = false,
    simulateResult,
    errorMessage,
}: StakingSummaryCardProps) {
    const containerClass =
        variant === 'floating'
            ? 'pointer-events-auto w-full max-w-[340px] max-h-[80vh] overflow-y-auto rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-surface)]/95 backdrop-blur-xl p-4 shadow-2xl'
            : variant === 'side'
                ? 'rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-4 shadow-sm'
                : 'mt-6 pt-4 border-t border-[var(--color-border)]';

    return (
        <m.div
            initial={{ opacity: 0, y: 12, scale: variant === 'floating' ? 0.97 : 1 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            onMouseDown={variant === 'floating' ? (e) => e.stopPropagation() : undefined}
            className={containerClass}
        >
            {variant === 'floating' && accountAddress && (
                <div className="mb-3 pb-2 border-b border-[var(--color-card-border)] flex items-center justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs font-black text-[var(--color-text-main)] truncate">
                            {accountLabel || `${accountAddress.slice(0, 10)}...${accountAddress.slice(-6)}`}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                            {accountAddress.slice(0, 8)}…{accountAddress.slice(-5)}
                        </span>
                    </div>
                    {onClose && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                            }}
                            disabled={isTransacting}
                            aria-label={closeLabel}
                            title={closeLabel}
                            className="p-1 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-bg)] transition-colors shrink-0 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                        >
                            <X className="size-4" />
                        </button>
                    )}
                </div>
            )}

            <div className="flex justify-between items-center mb-3">
                <h5 className="text-xs font-bold text-[var(--color-text-main)] uppercase tracking-wider">
                    {title}
                </h5>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onReset();
                    }}
                    disabled={isTransacting || resetDisabled}
                    className="text-[10px] font-bold uppercase tracking-wider transition-opacity shrink-0 text-[var(--color-text-muted)] hover:opacity-70 flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                >
                    {resetLabel}
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                    </svg>
                </button>
            </div>

            {groups.length > 0 ? (
                <div className="space-y-3 mb-5">
                    {groups.map((group) => (
                        <div
                            key={group.validatorAddress}
                            className="flex flex-col text-sm border-b border-[var(--color-border)] pb-3 last:border-0 last:pb-0"
                        >
                            <span className="font-bold text-[var(--color-text-main)] mb-1.5 truncate">
                                {group.validatorName}
                            </span>
                            <ul className="space-y-1.5 w-full">
                                {group.actions.map((act) => (
                                    <li key={`${act.label}:${act.badge ?? ''}`} className="flex items-center justify-between gap-2 text-xs">
                                        <div className="flex flex-col justify-center gap-0.5 min-w-0">
                                            <span className="font-semibold text-[var(--color-text-muted)] leading-4">
                                                {act.label}
                                            </span>
                                            {act.badge && (
                                                <span className="text-[10px] text-[var(--color-text-muted)]/80 leading-3.5">
                                                    {act.badge}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-col justify-center items-end gap-0.5 shrink-0">
                                            <span className={`${act.color} font-bold whitespace-nowrap leading-4`}>
                                                {act.value}
                                            </span>
                                            {act.subText && (
                                                <span className="text-[10px] font-mono text-[var(--color-secondary)] leading-3.5">
                                                    {act.subText}
                                                </span>
                                            )}
                                            {act.error && (
                                                <span className="text-[10px] font-semibold text-red-500 leading-3.5">
                                                    {act.error}
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            ) : emptyHint ? (
                <p className="text-xs leading-relaxed text-[var(--color-text-muted)] mb-5">
                    {emptyHint}
                </p>
            ) : null}

            <div className="space-y-2">
                <button
                    type="button"
                    onClick={onSend}
                    disabled={!canSend || isTransacting}
                    className="w-full font-bold py-3 px-4 rounded-xl shadow-lg transition-all transform enabled:hover:scale-[1.02] enabled:active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] text-white flex justify-center items-center gap-2 cursor-pointer"
                >
                    {isTransacting ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 size-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            {sendingLabel}
                        </>
                    ) : (
                        sendLabel
                    )}
                </button>
                {onSimulate && (
                    <>
                        <button
                            type="button"
                            onClick={onSimulate}
                            disabled={simulateDisabled || isTransacting || isSimulating}
                            className="w-full font-bold py-2.5 px-4 rounded-xl transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed bg-[var(--color-primary)] text-white flex justify-center items-center gap-2 text-sm cursor-pointer"
                        >
                            {isSimulating ? (
                                <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            ) : (
                                <FlaskConical className="size-4 text-white" />
                            )}
                            {simulateLabel}
                        </button>
                        {simulateResult}
                    </>
                )}
            </div>

            {variant === 'side' ? (
                <div
                    role={errorMessage ? 'alert' : undefined}
                    aria-live="polite"
                    className="mt-3 min-h-[2.25rem] flex items-center justify-center"
                >
                    {errorMessage && (
                        <div className="w-full text-xs leading-4 text-red-500 px-2 py-2 bg-red-500/10 rounded border border-red-500/20 text-center">
                            {errorMessage}
                        </div>
                    )}
                </div>
            ) : errorMessage ? (
                <div
                    role="alert"
                    className="text-xs leading-4 text-red-500 mt-3 p-2 bg-red-500/10 rounded border border-red-500/20 text-center"
                >
                    {errorMessage}
                </div>
            ) : null}
        </m.div>
    );
}
