'use client';
import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Clock, Coins, Landmark, Users, Mail
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetchTransactionDetails } from '@/features/dashboard/services/apiClient';
import { usePrefetchTransactionDetails } from '../hooks/usePrefetchTx';
import { TransactionTabs } from './TransactionTabs';
import { Card } from '@/components/ui/Card';
import { CopyButton } from '@/components/ui/CopyButton';
import type { TransactionDetails } from '@/features/dashboard/types';
import { resolveTransactionType } from '../utils/transactionUtils';
import { useEntityData } from '@/features/dashboard/hooks/useEntityData';
import { resolveProposerInfo } from '../utils/proposerUtils';
import { useValidatorsQuery } from '@/features/dashboard/staking';
import { SafeImage } from '@/components/ui/SafeImage';
import { RadixIcon } from '@/components/shared/RadixIcon';

/* ─────────────────────────────────────────
   formatAmount
   Locale-aware number formatting (same hydration as time display)
───────────────────────────────────────── */
const formatAmount = (n: number, loc: string): string => {
    if (n === 0) return '0';
    // Truncate to 4 decimals without rounding
    const truncated = Math.trunc(n * 10000) / 10000;
    return truncated.toLocaleString(loc, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4
    });
};

/* ─────────────────────────────────────────
   RenderSymbol
   Resolves and displays token symbol/name asynchronously
───────────────────────────────────────── */
const RenderSymbol = ({ address, fallback, network, enrichedName }: { address: string; fallback?: string; network: string; enrichedName?: string }) => {
    // 1. Prioritize pre-enriched data from server/cache
    const displayName = enrichedName || fallback;

    // 2. Fallback to client-side hook only if essential metadata is missing
    const meta = useEntityData((!displayName || displayName === address) ? address : '', network);

    if (!address) return null;
    if (address === 'XRD') return 'XRD';

    const finalName = enrichedName || meta?.symbol || meta?.name || fallback || formatEntity(address);

    const displayVal = finalName.length > 40 ? finalName.slice(0, 37).trim() + '...' : finalName;

    return (
        <span className="truncate pe-1" title={address}>
            {displayVal}
        </span>
    );
};

/* ── StatusTypeLabels component ── */
function StatusTypeLabels({ isSuccess, color, statusLabel, labelBaseClass, immediateType }: { isSuccess: boolean; color: string; statusLabel: string; labelBaseClass: string; immediateType: string }) {
    const statusStyle = isSuccess
        ? {
            color: 'var(--color-accent)',
            borderColor: 'rgba(var(--color-accent-rgb), 0.2)',
            boxShadow: '0 0 12px rgba(var(--color-accent-rgb), 0.1), inset 0 0 4px rgba(var(--color-accent-rgb), 0.05)',
            textShadow: '0 0 8px rgba(var(--color-accent-rgb), 0.3)'
        }
        : {
            color,
            borderColor: `${color}40`,
            boxShadow: `0 0 12px ${color}25, inset 0 0 4px ${color}15`,
            textShadow: `0 0 8px ${color}40`
        };

    return (
        <>
            <span className={`${labelBaseClass} bg-white/5`} style={statusStyle}>
                <span className="mt-[1px]">{statusLabel}</span>
            </span>
            <div className={`${labelBaseClass} bg-[var(--color-surface)] border-[var(--color-card-border)] px-3 text-[var(--color-text-muted)]`} title="Transaction Type">
                <span className="mt-[1px]">{immediateType}</span>
            </div>
        </>
    );
}

/* ═══════ TRANSACTION CARD ═══════ */
import { formatEntity } from '../../utils/entityUtils';

import { TransactionCardProps } from '../types/components.types';

const TransactionCard = ({ tx, index: _index, isExpanded, columns, onExpand, onCopy, copiedAddress, t, readingMode, network = 'mainnet', timezone, locale, marketData }: TransactionCardProps) => {
    const tt = t?.dashboard?.transactions;
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

    // Fetch validators to map proposer index to name/icon (fallback only)
    const { data: validatorsData } = useValidatorsQuery(network);

    // Perfect Hydration: proposerInfo comes fully populated from the backend.
    // Fall back to client calculation only if not hydrated (e.g. older caches).
    const proposerInfo = tx.proposerInfo || resolveProposerInfo(details as TransactionDetails);

    // Primary path: use pre-enriched display data embedded by page.tsx
    // This data is part of the dehydrated tx cache, so it's available on the
    // very first render — no separate query needed, no hydration flash.
    // Fallback: resolve from validators query (for older cache entries or edge cases)
    const proposerSource = (() => {
        if (proposerInfo?.name) {
            return { name: proposerInfo.name, iconUrl: proposerInfo.iconUrl || '', address: proposerInfo.address || '' };
        }
        if (proposerInfo && validatorsData?.validators) {
            const v = validatorsData.validators.find(val => val.rank === proposerInfo.rank);
            if (v) return { name: v.name, iconUrl: v.iconUrl || '', address: v.address };
        }
        return null;
    })();

    const proposerDisplay = proposerSource ? (
        <div className="flex items-center gap-2 min-w-0">
            <SafeImage
                src={proposerSource.iconUrl}
                alt={proposerSource.name}
                fallbackName={proposerSource.name}
                className="size-4 sm:w-5 sm:h-5 rounded-full border border-[var(--color-card-border)] bg-[var(--color-bg)] object-cover shrink-0"
            />
            <span className="text-[10px] sm:text-[11px] font-bold text-[var(--color-text-main)] truncate" title={proposerSource.address}>
                {proposerSource.name}
            </span>
        </div>
    ) : null;

    const statusLabel = isSuccess ? (tt?.success || 'Success') : (tt?.failed || 'Failed');

    // Middle truncation for hashes (Grid 2+)
    const truncateHash = (hash: string) => {
        if (!hash || columns <= 1) return hash;
        if (columns >= 2 && columns <= 5) {
            // Less truncation for lower-density grids
            return `${hash.slice(0, 10)}...${hash.slice(-10)}`;
        }
        if (columns === 8) {
            // More truncation for the highest-density grid
            return `${hash.slice(0, 4)}...${hash.slice(-4)}`;
        }
        // Default truncation for intermediate grids (6-7)
        if (hash.length <= 12) return hash;
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
    const downTimeRef = useRef(0);
    const downPosRef = useRef({ x: 0, y: 0 });
    const selectionRef = useRef<string | null>(null);

    // Common Label Styles to ensure Status & Type match
    const labelBaseClass = "inline-flex items-center justify-center px-2 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider leading-none align-middle box-border border backdrop-blur-md transition-all duration-300 h-[18px] sm:h-[22px]";

    return (
        <Card
            onPointerEnter={() => prefetchTx(tx.intentHash, network)}
            onPointerDown={(e) => {
                downTimeRef.current = Date.now();
                downPosRef.current = { x: e.clientX, y: e.clientY };

                // Capture current selection state to differentiate between starting a selection
                // and clicking after a selection already existed.
                const selection = window.getSelection();
                if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    // Check if the selection is inside this card's DOM
                    if (e.currentTarget.contains(range.commonAncestorContainer)) {
                        selectionRef.current = selection.toString();
                    } else {
                        selectionRef.current = null;
                    }
                } else {
                    selectionRef.current = null;
                }
            }}
            onClick={(e) => {
                const target = e.target as HTMLElement;

                // 1. Interactive check: If we click on a button, link, or any identified interactive role, don't toggle expansion.
                if (target.closest('button, a, [role="button"], input, textarea')) return;

                // 2. Deselection check: 
                // If a selection EXISTED when we pressed down, it means we are now
                // either interacting with it or clearing it. We MUST NOT toggle in this case.
                if (selectionRef.current && selectionRef.current.trim().length > 0) {
                    // We clear it so that the NEXT click (after selection is gone) will work.
                    selectionRef.current = null;
                    return;
                }

                // 3. New selection check: If text was selected during this specific click, don't toggle.
                const currentSelection = window.getSelection();
                if (currentSelection && !currentSelection.isCollapsed) {
                    return;
                }

                // 4. Distance check: If the mouse moved significantly (drag/selection), don't toggle.

                const dp = downPosRef.current;
                if (Math.sqrt(Math.pow(e.clientX - dp.x, 2) + Math.pow(e.clientY - dp.y, 2)) > 10) return;

                // 5. Time check: Prevent long-press triggers.
                if (Date.now() - downTimeRef.current > 500) return;

                onExpand(tx.intentHash);
            }}
            className={`p-0 shadow-md transition-all duration-300 group cursor-pointer overflow-hidden ${isExpanded ? 'ring-2 ring-[var(--color-primary)]' : 'hover:shadow-lg'}`}
        >
            <div className={`flex ${isVertical ? 'flex-col' : 'flex-col sm:flex-row'}`}>
                {/* AVATAR / ICON */}
                <div aria-hidden="true"
                    className={`${isVertical ? 'w-full p-3' : 'w-full sm:w-[140px] p-4 sm:p-6 border-r'} shrink-0 border-b sm:border-b-0 border-[var(--color-card-border)] bg-[var(--color-surface)] flex flex-row ${isVertical ? 'justify-between' : 'sm:flex-col'} items-center gap-3 text-center relative overflow-hidden cursor-pointer self-stretch justify-center`}>
                    <div className="absolute top-0 inset-x-0 h-1/2 opacity-10" style={{ background: `radial-gradient(circle at top, ${isSuccess ? 'rgba(var(--color-accent-rgb), 0.2)' : color}, transparent)` }} />
                    <div className="relative z-10 p-3 sm:p-4 rounded-2xl border-2 shadow-lg bg-[var(--color-bg)] transition-all duration-300 flex items-center justify-center" style={{ borderColor: isSuccess ? 'var(--color-accent)' : color, boxShadow: isSuccess ? `0 0 15px rgba(var(--color-accent-rgb), 0.2)` : `0 0 15px ${color}30` }}>
                        {isSuccess ? (
                            <RadixIcon className={isVertical ? (isCompact ? "size-5" : "size-6") : "size-8"} strokeColor="var(--color-accent)" />
                        ) : (
                            <RadixIcon className={`${isVertical ? (isCompact ? "size-5" : "size-6") : "size-8"} scale-y-[-1] [stroke-dasharray:4_4]`} strokeColor={color} />
                        )}
                    </div>
                </div>

                {/* BODY */}
                <div className="flex-1 flex flex-col min-w-0">
                    <div className={`${isVertical ? 'p-3 pt-0' : 'p-5'} flex-1 min-w-0`}>
                        {/* Intent Hash Area */}
                        <div className={`flex items-start justify-between gap-4 ${isVertical ? 'mb-2 mt-2 flex-wrap' : 'mb-3 sm:flex-nowrap'}`}>
                            <div className="flex flex-col min-w-0 flex-1">
                                <button type="button" className={`${isVertical ? 'text-[11px] sm:text-xs' : 'text-sm sm:text-base'} font-mono font-black text-[var(--color-text-main)] group-hover:text-[var(--color-secondary)] transition-colors truncate flex items-center gap-1.5 sm:gap-2 text-left`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCopy(tx.intentHash);
                                    }}>
                                    <span className="truncate">{truncateHash(tx.intentHash)}</span>
                                    <CopyButton
                                        value={tx.intentHash}
                                        variant="card-inline"
                                        size="sm"
                                        forceCopied={copiedAddress === tx.intentHash}
                                        onClick={() => onCopy(tx.intentHash)}
                                        className="shrink-0 ml-1"
                                    />
                                </button>
                            </div>

                            {columns === 1 && (
                                <div className="text-[10px] sm:text-xs font-bold text-[var(--color-text-muted)] flex items-center gap-2 shrink-0">
                                    <StatusTypeLabels isSuccess={isSuccess} color={color} statusLabel={statusLabel} labelBaseClass={labelBaseClass} immediateType={immediateType} />
                                </div>
                            )}
                        </div>

                        {/* Stats Grid */}
                        <div className={`grid ${isCompact ? 'grid-cols-1' : (columns >= 2 && columns <= 4) ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-5'} gap-2 sm:gap-4 text-sm mt-3 items-center`}>
                            <div>
                                <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold truncate flex items-center gap-1"><Clock className="size-3" /> {tt?.date_time || 'Date & Time'}</div>
                                <div className={`${isVertical ? 'text-[11px]' : 'text-sm'} font-bold text-[var(--color-text-main)] truncate`}>
                                    {new Date(tx.confirmedAt).toLocaleString(locale, {
                                        timeZone: timezone,
                                        year: 'numeric', month: 'short', day: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                    })}
                                </div>
                            </div>
                            <div>
                                <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold truncate flex items-center gap-1"><Clock className="size-3" /> {tt?.epoch_round || 'Epoch/Round'}</div>
                                <div className={`${isVertical ? 'text-[11px]' : 'text-sm'} font-bold text-[var(--color-text-main)] truncate`}>
                                    Ep: {tx.epoch} / Rnd: {tx.round}
                                </div>
                            </div>
                            <div>
                                <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold truncate flex items-center gap-1">
                                    {tx.displayIsMint ? (
                                        <div className="flex items-center gap-1">
                                            <Landmark className="size-3" />
                                            {tt?.minting || 'Minting'}
                                        </div>
                                    ) : (
                                        <>
                                            <Coins className="size-3" />
                                            {tx.displayAmount !== undefined
                                                ? (tt?.amount || 'Amount')
                                                : (tt?.fee_paid || 'Fee Paid')}
                                        </>
                                    )}
                                </div>
                                <div className={`${isVertical ? 'text-[11px]' : 'text-base sm:text-lg'} font-bold text-[var(--color-text-main)] truncate`}>
                                    {tx.displayAmount !== undefined ? (
                                        <div className="flex items-baseline gap-1.5">
                                            <span>{formatAmount(tx.displayAmount, locale)}</span>
                                            <span className="uppercase">
                                                {tx.displayIsXrd || tx.displayResource === 'XRD' ? (
                                                    'XRD'
                                                ) : (
                                                    <RenderSymbol
                                                        address={tx.displayResource || ''}
                                                        fallback={tx.displayResourceName}
                                                        enrichedName={tx.displayResourceName}
                                                        network={network}
                                                    />
                                                )}
                                            </span>
                                        </div>
                                    ) : (
                                        `${formatAmount(tx.feePaid, locale)} XRD`
                                    )}
                                </div>
                            </div>
                            <div className={`flex items-center gap-8 sm:gap-12 min-w-0 w-full ${columns === 1 ? 'sm:col-span-2' : 'col-span-1'}`}>
                                <div className="flex sm:flex-col justify-end sm:justify-start gap-4 sm:gap-1 text-right sm:text-left mt-2 sm:mt-0 shrink-0">
                                    <div className="text-[10px] sm:text-xs font-bold text-[var(--color-text-muted)] flex items-center justify-end sm:justify-start gap-1">
                                        <Users className="size-3" /> {tx.accountsCount} {t?.dashboard?.transactions?.accounts || 'Accounts'}
                                    </div>
                                    <div className="text-[10px] sm:text-xs font-bold text-[var(--color-text-muted)] flex items-center justify-end sm:justify-start gap-1">
                                        <Landmark className="size-3" /> {tx.componentsCount} {t?.dashboard?.transactions?.components || 'Components'}
                                    </div>
                                </div>

                                {/* Proposer for Grid 1 (Collapsed context) */}
                                {columns === 1 && proposerDisplay && (
                                    <div className="flex flex-col gap-0.5 border-s border-[var(--color-card-border)] ps-6 min-w-0 flex-1">
                                        <div
                                            className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold cursor-help w-fit"
                                            title={tt?.proposer_tooltip}
                                        >
                                            {tt?.proposer || 'Proposer'}
                                        </div>
                                        {proposerDisplay}
                                    </div>
                                )}
                            </div>

                            {/* Proposer for Grid 5-8 (Extra row) */}
                            {columns >= 5 && proposerDisplay && (
                                <div className="flex flex-col gap-0.5 min-w-0">
                                    <div
                                        className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold cursor-help w-fit"
                                        title={tt?.proposer_tooltip}
                                    >
                                        {tt?.proposer || 'Proposer'}
                                    </div>
                                    {proposerDisplay}
                                </div>
                            )}
                        </div>

                        {/* Labels Footer (Grid 2+) */}
                        {columns >= 2 && (
                            <div className={`flex ${columns >= 7 ? 'flex-col items-start' : 'items-center'} gap-2 mt-4 pt-3 border-t border-[var(--color-card-border)]/50`}>
                                <StatusTypeLabels isSuccess={isSuccess} color={color} statusLabel={statusLabel} labelBaseClass={labelBaseClass} immediateType={immediateType} />

                                {/* Proposer for Grid 2-4 (Footer) */}
                                {columns >= 2 && columns <= 4 && proposerDisplay && (
                                    <div className="flex items-center gap-2 border-s border-[var(--color-card-border)] ps-3 ml-1 min-w-0">
                                        {proposerDisplay}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MESSAGE FOOTER - Only visible when unexpanded */}
            {tx.message && !isExpanded && (
                <div className="p-3 bg-[var(--color-bg)]/80 text-[11px] sm:text-xs font-mono text-[var(--color-text-muted)] border-t border-[var(--color-card-border)] flex items-start gap-2 shadow-inner">
                    <Mail className="shrink-0 mt-0.5 text-[var(--color-primary)] size-3.5" />
                    <span className="truncate translate-y-[2px]">{tx.message}</span>
                </div>
            )}

            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden bg-[var(--color-bg)]">
                        <TransactionTabs details={details} tx={tx} t={t} onCopy={onCopy} copiedAddress={copiedAddress} formatEntity={formatEntity} readingMode={readingMode} network={network} columns={columns} timezone={timezone} locale={locale} marketData={marketData} />
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
};
TransactionCard.displayName = 'TransactionCard';

export { TransactionCard };
