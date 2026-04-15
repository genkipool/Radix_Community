'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Clock, Copy, Coins, Box, Users, Mail, Check
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetchTransactionDetails } from '@/features/dashboard/services/apiClient';
import { usePrefetchTransactionDetails } from '../hooks/usePrefetchTx';
import { TransactionTabs } from './TransactionTabs';
import { Card } from '@/components/ui/Card';
import type { TranslationsT, TransactionDetails } from '@/features/dashboard/types';
import { resolveTransactionType } from '../utils/transactionUtils';

/* ═══════ TRANSACTION CARD ═══════ */
import { formatEntity } from '../../utils/entityUtils';

import { TransactionCardProps } from '../types';

const TransactionCard = ({ tx, index: _index, isExpanded, columns, onExpand, onCopy, copiedAddress, t, readingMode, network = 'mainnet' }: TransactionCardProps) => {
    const tt = (t?.dashboard?.transactions ?? {}) as TranslationsT['dashboard']['transactions'];
    const isVertical = columns >= 3;
    const isCompact = columns >= 5;
    const isSuccess = tx.status === 'CommittedSuccess' || tx.status === 'Committed';
    const color = isSuccess ? '#22c55e' : '#ef4444';

    // Pre-warm the cache on hover so details are ready before the user clicks.
    const { prefetchTx } = usePrefetchTransactionDetails();

    // Fetch details via React Query — uses the same cache key as prefetchTx,
    // so a hover pre-fetch means no extra request when the card expands.
    const { data: details } = useQuery({
        queryKey: ['tx-details', tx.intentHash, network],
        queryFn: () => apiFetchTransactionDetails(tx.intentHash, network),
        enabled: isExpanded,
        staleTime: 30_000,
    });

    const statusLabel = isSuccess ? (tt.success || 'Success') : (tt.failed || 'Failed');

    // Middle truncation for hashes (Grid 2+)
    const truncateHash = (hash: string) => {
        if (!hash || columns <= 1) return hash;
        if (columns >= 2 && columns <= 3) {
            // Less truncation for lower-density grids
            return `${hash.slice(0, 10)}...${hash.slice(-10)}`;
        }
        if (columns === 4) {
            // Further truncation for columns=4 since it becomes 2-columns on mobile (very tight)
            return `${hash.slice(0, 6)}...${hash.slice(-6)}`;
        }
        if (columns === 8) {
            // More truncation for the highest-density grid
            return `${hash.slice(0, 4)}...${hash.slice(-4)}`;
        }
        // Default truncation for intermediate grids (5-7)
        return `${hash.slice(0, 6)}...${hash.slice(-6)}`;
    };

    // Immediate type from tx list data — no expand needed
    const immediateClasses: string[] = (tx.manifestClasses as string[]) ?? [];
    // When details load they may refine the type (e.g. protocol vote from events)
    const detailDetails = (details as TransactionDetails | null);
    const detailClasses: string[] = detailDetails?.manifest_classes ?? immediateClasses;
    const detailEvents: Record<string, unknown>[] = detailDetails?.receipt?.events ?? [];
    const transactionType = resolveTransactionType(detailClasses, detailEvents, tt);
    // Show immediately even before expand
    const immediateTypeFallback = resolveTransactionType(immediateClasses, [], tt);
    const immediateType = (isExpanded ? transactionType : immediateTypeFallback) || resolveTransactionType(immediateClasses, [], tt);

    const [downTime, setDownTime] = useState(0);

    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Common Label Styles to ensure Status & Type match
    const labelBaseClass = "inline-flex items-center justify-center px-2 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider leading-none align-middle box-border border backdrop-blur-md transition-all duration-300 h-[18px] sm:h-[22px]";

    // Extracted to avoid duplicating the identical status+type label pair
    const StatusTypeLabels = () => (
        <>
            <span className={`${labelBaseClass} bg-white/5`} style={{ color, borderColor: `${color}40`, boxShadow: `0 0 12px ${color}25, inset 0 0 4px ${color}15`, textShadow: `0 0 8px ${color}40` }}>
                <span className="mt-[1px]">{statusLabel}</span>
            </span>
            <div className={`${labelBaseClass} bg-[var(--color-surface)] border-[var(--color-card-border)] px-3 text-[var(--color-text-muted)]`} title="Transaction Type">
                <span className="mt-[1px]">{immediateType}</span>
            </div>
        </>
    );

    return (
        <Card
            onPointerEnter={() => prefetchTx(tx.intentHash, network)}
            onPointerDown={() => setDownTime(Date.now())}
            onClick={() => {
                if (Date.now() - downTime > 500) return; // Prevent long-press expansion
                if (window.getSelection()?.toString()) return; // Don't toggle when text is selected
                onExpand(tx.intentHash);
            }}
            className={`p-0 shadow-md transition-all duration-300 group cursor-pointer overflow-hidden ${isExpanded ? 'ring-2 ring-[var(--color-primary)]' : 'hover:shadow-lg hover:border-[var(--color-secondary)]/30'}`}
        >
            <div className={`flex ${isVertical ? 'flex-col' : 'flex-col sm:flex-row'}`}>
                {/* AVATAR / ICON */}
                <div onClick={() => undefined}
                    className={`${isVertical ? 'w-full p-3' : 'w-full sm:w-[140px] p-4 sm:p-6 border-r'} shrink-0 border-b sm:border-b-0 border-[var(--color-card-border)] bg-[var(--color-surface)] flex flex-row ${isVertical ? 'justify-between' : 'sm:flex-col'} items-center gap-3 text-center relative overflow-hidden cursor-default self-stretch justify-center`}>
                    <div className="absolute top-0 inset-x-0 h-1/2 opacity-10" style={{ background: `radial-gradient(circle at top, ${color}, transparent)` }} />
                    <div className="relative z-10 p-3 sm:p-4 rounded-2xl border-2 shadow-lg bg-[var(--color-bg)] transition-all duration-300 flex items-center justify-center" style={{ borderColor: color, boxShadow: `0 0 15px ${color}30` }}>
                        {isSuccess ? (
                            <svg width={isVertical ? (isCompact ? "20" : "24") : "32"} height={isVertical ? (isCompact ? "20" : "24") : "32"} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                                <path d="M14,53 L25,53 L42,78 L66,20 L88,20" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        ) : (
                            <svg width={isVertical ? (isCompact ? "20" : "24") : "32"} height={isVertical ? (isCompact ? "20" : "24") : "32"} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                                <path d="M14,47 L25,47 L42,22 L66,80 L88,80" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 4" />
                            </svg>
                        )}
                    </div>
                </div>

                {/* BODY */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className={`${isVertical ? 'p-3 pt-0' : 'p-5'} flex-1 min-w-0`}>
                        {/* Intent Hash Area */}
                        <div className={`flex items-start justify-between gap-4 ${isVertical ? 'mb-2 mt-2 flex-wrap' : 'mb-3 sm:flex-nowrap'}`}>
                            <div className="flex flex-col min-w-0 flex-1">
                                <h3 className={`${isVertical ? 'text-[11px] sm:text-xs' : 'text-sm sm:text-base'} font-mono font-black text-[var(--color-text-main)] group-hover:text-[var(--color-secondary)] transition-colors truncate flex items-center gap-1.5 sm:gap-2`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCopy(tx.intentHash);
                                    }}>
                                    <span className="truncate">{truncateHash(tx.intentHash)}</span>
                                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                                        <AnimatePresence mode="wait" initial={false}>
                                            {copiedAddress === tx.intentHash ? (
                                                <motion.div
                                                    key="check"
                                                    initial={{ scale: 0.5, opacity: 0, rotate: -45 }}
                                                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                                    exit={{ scale: 0.5, opacity: 0, rotate: 45 }}
                                                    transition={{ duration: 0.2, ease: "backOut" }}
                                                >
                                                    <Check className="w-3.5 h-3.5 text-green-500" />
                                                </motion.div>
                                            ) : (
                                                <motion.div
                                                    key="copy"
                                                    initial={{ scale: 0.8, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    exit={{ scale: 0.8, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="text-[var(--color-primary)] opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </h3>
                            </div>

                            {columns === 1 && (
                                <div className="text-[10px] sm:text-xs font-bold text-[var(--color-text-muted)] flex items-center gap-2 shrink-0">
                                    <StatusTypeLabels />
                                </div>
                            )}
                        </div>

                        {/* Stats Grid */}
                        <div className={`grid ${columns >= 5 ? 'grid-cols-1' :
                            columns === 4 ? 'grid-cols-1 sm:grid-cols-2' :
                                (columns === 2 || columns === 3) ? 'grid-cols-2' :
                                    'grid-cols-2 sm:grid-cols-5'
                            } gap-2 sm:gap-4 text-sm mt-3 items-center`}>
                            <div>
                                <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold truncate flex items-center gap-1"><Clock className="w-3 h-3" /> {tt.date_time || 'Date & Time'}</div>
                                <div className={`${isVertical ? 'text-[11px]' : 'text-sm'} font-bold text-[var(--color-text-main)] truncate`}>
                                    {isMounted ? new Date(tx.confirmedAt).toLocaleString(undefined, {
                                        year: 'numeric', month: 'short', day: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                    }) : '...'}
                                </div>
                            </div>
                            <div>
                                <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold truncate flex items-center gap-1"><Clock className="w-3 h-3" /> {tt.epoch_round || 'Epoch/Round'}</div>
                                <div className={`${isVertical ? 'text-[11px]' : 'text-sm'} font-bold text-[var(--color-text-main)] truncate`}>
                                    Ep: {tx.epoch} / Rnd: {tx.round}
                                </div>
                            </div>
                            <div>
                                <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold truncate flex items-center gap-1"><Coins className="w-3 h-3" /> {tt.fee_paid || 'Fee Paid'}</div>
                                <div className={`${isVertical ? 'text-[11px]' : 'text-base sm:text-lg'} font-bold text-[var(--color-text-main)] truncate`}>{tx.feePaid.toString()} XRD</div>
                            </div>
                            <div className="flex flex-col justify-start gap-1 text-left mt-2 sm:mt-0">
                                <div className="text-[10px] sm:text-xs font-bold text-[var(--color-text-muted)] flex items-center justify-start gap-1">
                                    <Users className="w-3 h-3 shrink-0" /> {tx.accountsCount} {t?.dashboard?.transactions?.accounts || 'Accounts'}
                                </div>
                                <div className="text-[10px] sm:text-xs font-bold text-[var(--color-text-muted)] flex items-center justify-start gap-1">
                                    <Box className="w-3 h-3 shrink-0" /> {tx.componentsCount} {t?.dashboard?.transactions?.components || 'Components'}
                                </div>
                            </div>
                        </div>

                        {/* Labels Footer (Grid 2+) */}
                        {columns >= 2 && (
                            <div className={`flex ${columns >= 7 ? 'flex-col items-start' : 'flex-wrap items-center'} gap-2 mt-4 pt-3 border-t border-[var(--color-card-border)]/50`}>
                                <StatusTypeLabels />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MESSAGE FOOTER - Only visible when unexpanded */}
            {tx.message && !isExpanded && (
                <div className="p-3 bg-[var(--color-bg)]/80 text-[11px] sm:text-xs font-mono text-[var(--color-text-muted)] border-t border-[var(--color-card-border)] flex items-start gap-2 shadow-inner">
                    <Mail className="shrink-0 mt-0.5 text-[var(--color-primary)] w-3.5 h-3.5" />
                    <span className="truncate translate-y-[2px]">{tx.message}</span>
                </div>
            )}

            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden bg-[var(--color-bg)]">
                        <TransactionTabs details={details} tx={tx} t={t} onCopy={onCopy} copiedAddress={copiedAddress} formatEntity={formatEntity} readingMode={readingMode} network={network} columns={columns} />
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
};
TransactionCard.displayName = 'TransactionCard';

/* Re-export so existing imports of formatEntity from this file keep working */
export { TransactionCard, formatEntity };