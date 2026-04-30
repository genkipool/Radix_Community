'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Copy, Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetchTransactionDetails } from '@/features/dashboard/services/apiClient';
import { TransactionTabs } from './TransactionTabs';
import type { TransactionDetails, TranslationsT } from '@/features/dashboard/types';
import { formatEntity } from '../../utils/entityUtils';
import { Pill } from '@/components/ui/Pill';
import { CloseButton } from '@/components/ui/CloseButton';
import { FloatingNav } from '@/components/ui/FloatingNav';
import { SwipeableContainer } from '@/components/ui/SwipeableContainer';
import { RadixIcon } from '@/components/shared/RadixIcon';

import { TransactionDetailModalProps } from '../types';

export function TransactionDetailModal({
    tx, onClose, onPrev, onNext,
    t, dt, copiedAddress, copyAddress, network, timezone, locale,
    direction = 0, setDirection, marketData,
}: TransactionDetailModalProps) {
    const tt = (dt?.transactions ?? {}) as TranslationsT['dashboard']['transactions'];
    const isSuccess = tx.status === 'CommittedSuccess' || tx.status === 'Committed';
    const statusColor = isSuccess ? '#22c55e' : '#ef4444';
    const statusLabel = isSuccess ? (tt.success || 'Success') : (tt.failed || 'Failed');

    /* Fetch details directly in the modal — uses the same queryKey as the
       prefetch triggered on hover, so if the user hovered before clicking
       this is a zero-latency cache hit. */
    const { data: details, isLoading } = useQuery({
        queryKey: ['tx-details', tx.intentHash, network],
        queryFn: () => apiFetchTransactionDetails(tx.intentHash, network),
        staleTime: 30_000,
    });

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 24 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-4 pb-4 px-2 sm:px-4 overflow-y-auto"
            onClick={onClose}
        >
            <FloatingNav
                hasPrev={!!onPrev}
                hasNext={!!onNext}
                onPrev={() => { setDirection?.(-1); onPrev?.(); }}
                onNext={() => { setDirection?.(1); onNext?.(); }}
                prevLabel={dt?.reading?.previous_post || 'Anterior'}
                nextLabel={dt?.reading?.next_post || 'Siguiente'}
                className="hidden sm:flex"
            />

            <div
                className="relative w-full max-w-[1400px] h-[calc(100dvh-2rem)] bg-[var(--color-bg)] rounded-2xl border border-[var(--color-card-border)] shadow-[0_0_60px_rgba(0,0,0,0.5)] flex flex-col my-auto overflow-hidden pointer-events-auto"
                onClick={e => e.stopPropagation()}
            >
                <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                    <SwipeableContainer
                        key={tx.intentHash}
                        itemKey={tx.intentHash}
                        direction={direction}
                        setDirection={setDirection || (() => { })}
                        onPrev={onPrev}
                        onNext={onNext}
                        className="flex-1 flex flex-col min-h-0 relative touch-none bg-[var(--color-bg)]"
                    >
                        {/* Decorative top glow */}
                        <div className="absolute top-0 inset-x-0 h-24 pointer-events-none opacity-30"
                            style={{ background: `radial-gradient(ellipse at top, ${statusColor}30, transparent)` }} />

                        {/* ── Header ── */}
                        <div className="relative flex items-center justify-between gap-4 px-5 sm:px-8 pt-6 pb-5 shrink-0">
                            <div className="flex items-center gap-5 min-w-0 flex-1">
                                {/* Status Icon — Replicated from TransactionCard */}
                                <div className="relative shrink-0 hidden sm:flex">
                                    <div className="absolute inset-0 opacity-20 blur-xl rounded-full" style={{ backgroundColor: statusColor }} />
                                    <div className="relative z-10 w-16 h-16 rounded-2xl border-2 flex items-center justify-center bg-[var(--color-surface)] shadow-lg"
                                        style={{ borderColor: statusColor, boxShadow: `0 0 20px ${statusColor}30` }}>
                                        {isSuccess ? (
                                            <RadixIcon className="w-8 h-8" strokeColor={statusColor} />
                                        ) : (
                                            <RadixIcon className="w-8 h-8" strokeColor={statusColor} />
                                        )}
                                    </div>
                                </div>

                                <div className="min-w-0 flex-1">
                                    {/* Intent hash + Close Button */}
                                    <div className="flex flex-row items-start justify-between gap-4 mb-2">
                                        <button
                                            className="flex items-center gap-2 group text-left min-w-0"
                                            onClick={() => copyAddress(tx.intentHash)}
                                        >
                                            <h2 className="text-base sm:text-lg font-mono font-black text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors break-all">
                                                {tx.intentHash}
                                            </h2>
                                            <span className={`shrink-0 transition-colors ${copiedAddress === tx.intentHash ? 'text-green-500' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-main)]'}`}>
                                                {copiedAddress === tx.intentHash ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                            </span>
                                        </button>

                                        <CloseButton
                                            onClose={onClose}
                                            title={dt?.reading?.close || 'Cerrar'}
                                            iconSize={20}
                                            className="shrink-0"
                                        />
                                    </div>

                                    {/* Stats Row: Date, Fee, Ep/Rnd, Accounts, Components + Tags */}
                                    <div className="flex items-center gap-y-2 gap-x-3 text-xs sm:text-sm text-[var(--color-text-muted)] flex-wrap">
                                        {/* 1. Date & Time */}
                                        <span className="font-semibold text-[var(--color-text-main)] shrink-0">
                                            {new Date(tx.confirmedAt).toLocaleString(locale, { timeZone: timezone, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>

                                        <span className="opacity-40 shrink-0">·</span>

                                        {/* 2. Fee Paid */}
                                        <span className="shrink-0">{tt.fee_paid || 'Fee'}: <span className="font-mono font-bold text-[var(--color-text-main)]">{tx.feePaid} XRD</span></span>

                                        <span className="opacity-40 shrink-0">·</span>

                                        {/* 3. Epoch / Round */}
                                        <span className="shrink-0">Ep {tx.epoch} / Rnd {tx.round}</span>

                                        <span className="opacity-40 shrink-0">·</span>

                                        {/* 4. Accounts */}
                                        <span className="shrink-0 font-semibold text-[var(--color-text-main)]">{tx.accountsCount} {t?.dashboard?.transactions?.accounts || 'Accounts'}</span>

                                        <span className="opacity-40 shrink-0">·</span>

                                        {/* 5. Components */}
                                        <span className="shrink-0 font-semibold text-[var(--color-text-main)]">{tx.componentsCount} {t?.dashboard?.transactions?.components || 'Components'}</span>

                                        <span className="opacity-40 shrink-0 mx-1">·</span>

                                        {/* TAGS: Status + Type */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Pill color="custom" className="rounded text-[9px] px-2 py-0.5" style={{ color: statusColor, borderColor: `${statusColor}40`, backgroundColor: `${statusColor}12` }}>
                                                {statusLabel}
                                            </Pill>
                                            {(() => {
                                                const immediateClasses: string[] = (tx.manifestClasses as string[]) ?? [];
                                                const detailDetails = details as TransactionDetails | undefined;
                                                const detailClasses: string[] = detailDetails?.manifest_classes ?? immediateClasses;
                                                const detailEvents: Record<string, unknown>[] = detailDetails?.receipt?.events ?? [];

                                                const resolveType = (classes: string[], events: Record<string, unknown>[]): string => {
                                                    if (classes.includes('ProtocolVote') || events.some((e) => e.name === 'ProtocolUpdateReadinessSignalEvent')) {
                                                        return tt.tx_type_protocol_vote || 'Protocol Vote';
                                                    }
                                                    if (classes.length === 0) return tt.tx_type_general || 'General';
                                                    const c = classes[0];
                                                    if (c === 'ValidatorStake') return tt.tx_type_stake || 'Stake';
                                                    if (c === 'ValidatorUnstake') return tt.tx_type_unstake || 'Unstake';
                                                    if (c === 'ValidatorClaimXrd' || c === 'ValidatorClaim') return tt.tx_type_claim || 'Claim';
                                                    if (c === 'Transfer') return tt.tx_type_transfer || 'Transfer';
                                                    if (c === 'AccountDepositSettingsUpdate') return tt.tx_type_settings || 'Settings';
                                                    return c || (tt.tx_type_general || 'General');
                                                };

                                                const transactionType = resolveType(detailClasses, detailEvents);
                                                const immediateTypeFallback = resolveType(immediateClasses, []);
                                                const label = (details ? transactionType : immediateTypeFallback) || resolveType(immediateClasses, []);

                                                // Only render the pill if we have an actual type that's not 'General' when there are no classes,
                                                // or if we have classes. (Mimicking card logic)
                                                if (immediateClasses.length === 0 && !details && label === (tt.tx_type_general || 'General')) return null;

                                                return <Pill color="muted" className="rounded text-[9px] px-2 py-0.5">{label}</Pill>;
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Content: TransactionTabs directly ── */}
                        <div className="flex-1 overflow-y-auto touch-pan-y custom-scrollbar">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--color-text-muted)]">
                                    <Activity className="w-7 h-7 animate-spin text-[var(--color-primary)]" />
                                    <p className="text-xs uppercase tracking-wider font-bold">{tt.loading_details || 'Loading transaction details...'}</p>
                                </div>
                            ) : (
                                /* TransactionTabs renders the tab bar + content directly — no card wrapper */
                                <div className="px-2 sm:px-4 pb-4">
                                    <TransactionTabs
                                        details={details}
                                        tx={tx}
                                        t={t}
                                        onCopy={copyAddress}
                                        copiedAddress={copiedAddress}
                                        formatEntity={formatEntity}
                                        readingMode={true}
                                        network={network}
                                        columns={1}
                                        timezone={timezone}
                                        locale={locale}
                                        marketData={marketData}
                                    />
                                </div>
                            )}
                        </div>
                    </SwipeableContainer>
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
