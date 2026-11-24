'use client';

import React from 'react';
import { Info, X } from 'lucide-react';
import { m, AnimatePresence } from 'motion/react';
import { Portal } from '@/components/ui/Portal';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import dashboardExploradorEn from '@/features/dashboard/explorador/locales/en.json';

interface StakingInfoModalLabels {
    global_mixed_title?: string;
    info_modal_desc?: string;
    global_batch_title?: string;
    global_batch_stake?: string;
    global_batch_stake_desc?: string;
    global_batch_unstake?: string;
    global_batch_unstake_desc?: string;
    global_batch_claim?: string;
    global_batch_claim_desc?: string;
    mixed_operations_title?: string;
    mixed_cart_mode?: string;
    mixed_cart_desc?: string;
    mixed_action_selection?: string;
    mixed_action_desc?: string;
    mixed_single_tx?: string;
    mixed_single_tx_desc?: string;
}

interface StakingInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    accT?: StakingInfoModalLabels;
}

const DEFAULT_LABELS: StakingInfoModalLabels =
    dashboardExploradorEn.dashboard.transactions.account_summary;

/** Explains global batch actions and manual mixed (cart) staking operations. */
export function StakingInfoModal({ isOpen, onClose, accT }: StakingInfoModalProps) {
    const labels: StakingInfoModalLabels = { ...DEFAULT_LABELS, ...accT };
    return (
        <Portal>
            <AnimatePresence>
                {isOpen && (
                    <>
                        <ModalOverlay onClose={onClose} blur="sm" className="z-[9999]" />
                        <m.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none"
                        >
                            <div
                                className="w-full max-w-2xl bg-[var(--color-surface)]/95 backdrop-blur-2xl border border-[var(--color-card-border)] shadow-2xl rounded-3xl overflow-hidden pointer-events-auto relative p-6"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="absolute top-4 right-4 size-8 rounded-full hover:bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                                >
                                    <X className="size-4" />
                                </button>

                                <div className="flex items-center gap-3 mb-4 text-[var(--color-primary)]">
                                    <Info className="size-6" />
                                    <h3 className="text-lg font-black tracking-tight">
                                        {labels.global_mixed_title}
                                    </h3>
                                </div>

                                <div className="space-y-4 text-sm text-[var(--color-text-main)] leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
                                    <p>
                                        {labels.info_modal_desc}
                                    </p>
                                    <h4 className="font-bold text-[var(--color-text-main)] border-b border-[var(--color-border)] pb-1">
                                        {labels.global_batch_title}
                                    </h4>
                                    <ul className="list-disc pl-5 space-y-2 text-[var(--color-text-muted)]">
                                        <li>
                                            <strong className="text-[var(--color-text-main)]">{labels.global_batch_stake}</strong>{' '}
                                            {labels.global_batch_stake_desc}
                                        </li>
                                        <li>
                                            <strong className="text-[var(--color-text-main)]">{labels.global_batch_unstake}</strong>{' '}
                                            {labels.global_batch_unstake_desc}
                                        </li>
                                        <li>
                                            <strong className="text-[var(--color-text-main)]">{labels.global_batch_claim}</strong>{' '}
                                            {labels.global_batch_claim_desc}
                                        </li>
                                    </ul>
                                    <h4 className="font-bold text-[var(--color-text-main)] border-b border-[var(--color-border)] mt-4 pb-1">
                                        {labels.mixed_operations_title}
                                    </h4>
                                    <ul className="list-disc pl-5 space-y-2 text-[var(--color-text-muted)]">
                                        <li>
                                            <strong className="text-[var(--color-text-main)]">{labels.mixed_cart_mode}</strong>{' '}
                                            {labels.mixed_cart_desc}
                                        </li>
                                        <li>
                                            <strong className="text-[var(--color-text-main)]">{labels.mixed_action_selection}</strong>{' '}
                                            {labels.mixed_action_desc}
                                        </li>
                                        <li>
                                            <strong className="text-[var(--color-text-main)]">{labels.mixed_single_tx}</strong>{' '}
                                            {labels.mixed_single_tx_desc}
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </m.div>
                    </>
                )}
            </AnimatePresence>
        </Portal>
    );
}
