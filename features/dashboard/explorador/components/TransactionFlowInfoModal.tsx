'use client';
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Info, Landmark } from 'lucide-react';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { Portal } from '@/components/ui/Portal';
import type { TranslationsT } from '@/features/dashboard/types';

interface TransactionFlowInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    tt: TranslationsT['dashboard']['transactions'];
}

export function TransactionFlowInfoModal({
    isOpen,
    onClose,
    tt,
}: TransactionFlowInfoModalProps) {
    return (
        <Portal>
            <AnimatePresence>
                {isOpen && (
                    <>
                        <ModalOverlay onClose={onClose} blur="sm" />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none"
                        >
                            <div
                                className="w-full max-w-2xl bg-[var(--color-surface)]/95 backdrop-blur-2xl border border-[var(--color-card-border)] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] rounded-3xl overflow-hidden pointer-events-auto relative"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Decorative background */}
                                <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)]/5 via-transparent to-[var(--color-accent)]/5 pointer-events-none" />

                                <div className="p-8 flex flex-col relative z-10">
                                    {/* Close Button */}
                                    <button
                                        onClick={onClose}
                                        className="absolute top-6 right-6 w-8 h-8 rounded-full hover:bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors border border-transparent hover:border-[var(--color-card-border)]"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>

                                    {/* Header */}
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-secondary)] flex items-center justify-center text-white shadow-xl relative group shrink-0">
                                            <Info className="w-6 h-6 group-hover:scale-110 transition-transform duration-500" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-[var(--color-text-main)] tracking-tight">
                                                {tt.tx_flow_info_title || 'How to read our transaction flow'}
                                            </h3>
                                        </div>
                                    </div>

                                    <div className="space-y-6 text-[var(--color-text-main)] text-sm leading-relaxed mb-8">
                                        <div className="space-y-2 opacity-90 text-[15px]">
                                            <p>{tt.tx_flow_info_desc_1 || 'In the Web3 ecosystem, transactions are rarely one-way transfers. Usually, they are swaps (you give something to receive something else).'}</p>
                                            <p>{tt.tx_flow_info_desc_2 || 'That is why, in our interface, the columns do not separate "what goes out" from "what comes in", but rather group the movements according to the Role of the Actors:'}</p>
                                        </div>

                                        <div className="grid md:grid-cols-2 gap-4">
                                            {/* Left Column Explanation */}
                                            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 space-y-3 relative overflow-hidden group hover:border-red-500/40 transition-colors">
                                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                    <Landmark className="w-16 h-16 text-red-500" />
                                                </div>
                                                <h4 className="font-black text-red-500 text-xs tracking-widest uppercase flex items-center gap-2">
                                                    <Landmark className="w-4 h-4" />
                                                    {tt.tx_flow_info_left_col_title || 'LEFT COLUMN: Origin Address'}
                                                </h4>
                                                <p className="text-[13px] opacity-90">
                                                    {tt.tx_flow_info_left_col_desc || 'This column represents the entity that initiates the action. Here we group all net changes that this account undergoes in the transaction, both positive and negative.'}
                                                </p>
                                                <p className="text-[12px] italic text-[var(--color-text-main)] opacity-70 pt-1">
                                                    {tt.tx_flow_info_left_col_example || 'Example: If you initiate a swap, in this same column you will see that -10 XRD goes out and at the same time +1 NFT comes in. Both data are here because they belong to the final balance of the account that originated the action.'}
                                                </p>
                                            </div>

                                            {/* Right Column Explanation */}
                                            <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-5 space-y-3 relative overflow-hidden group hover:border-green-500/40 transition-colors">
                                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                    <Landmark className="w-16 h-16 text-green-500" />
                                                </div>
                                                <h4 className="font-black text-[#16a34a] text-xs tracking-widest uppercase flex items-center gap-2">
                                                    <Landmark className="w-4 h-4" />
                                                    {tt.tx_flow_info_right_col_title || 'RIGHT COLUMN: Destination Address'}
                                                </h4>
                                                <p className="text-[13px] opacity-90">
                                                    {tt.tx_flow_info_right_col_desc || 'This column represents the entity or smart contract to which the main action is directed. Like the origin, it shows the total impact on that account.'}
                                                </p>
                                                <p className="text-[12px] italic text-[var(--color-text-main)] opacity-70 pt-1">
                                                    {tt.tx_flow_info_right_col_example || 'Example: If the account receiving the transaction is the one that assumes the payment of commissions (fees), you will see that negative value reflected here, in the destination column.'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </Portal>
    );
}
