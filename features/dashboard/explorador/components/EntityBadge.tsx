/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Copy, Info, Shield } from 'lucide-react';
import { sanitizeText } from '@/utils/sanitize';
import {
    useEntityData,
    isConsensusManager,
    formatEntityAddress,
    getEntityType,
} from '@/features/dashboard/hooks/useEntityData';
import type { Network, TranslationsT } from '@/features/dashboard/types';

/* ─────────────────────────────────────────
   ConsensusManagerInfoCard
   Expandable explanation of what the CM is
───────────────────────────────────────── */
export function ConsensusManagerInfoCard({ tt }: { tt: TranslationsT['dashboard']['transactions'] }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="mt-1.5 rounded-xl border border-blue-500/30 bg-blue-500/5 overflow-hidden">
            <button
                type="button"
                onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-blue-500/10 transition-colors"
            >
                <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="text-[11px] font-bold text-blue-300 flex-1">
                    {String(tt.consensus_manager_badge || 'System Component')}
                </span>
                <Info className="w-3 h-3 text-blue-400/60" />
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <p className="px-3 pb-3 pt-1 text-[11px] leading-relaxed text-blue-200/80">
                            {String(tt.consensus_manager_info_body ||
                                'The Consensus Manager is a native built-in component of the Radix protocol that manages epochs, block proposals, and staking reward distribution. When it appears as Origin, the protocol itself is distributing XRD (e.g., network emissions to validators or delegators).')}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ─────────────────────────────────────────
   AddressDisplay
   Label + truncated address + copy button
───────────────────────────────────────── */
export function AddressDisplay({
    label, address, tt, onCopy, copiedAddress, showConsensusInfo = false, network,
}: {
    label: string;
    address: string;
    tt: TranslationsT['dashboard']['transactions'];
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    showConsensusInfo?: boolean;
    network: Network;
}) {
    const isCM = isConsensusManager(address);
    const meta = useEntityData(address, network);
    const entityName = meta?.name;
    const entityIcon = meta?.iconUrl;
    const isValidator = sanitizeText(address).startsWith('validator_');
    const displayText = formatEntityAddress(address, tt, entityName ?? null);
    const copyableAddr = String(isCM ? (tt.consensus_manager_address || address) : address);

    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-bold text-[var(--color-text-muted)] tracking-wider">
                {label}:
            </span>
            <div className="flex items-center gap-2">
                {isValidator && entityIcon && (
                    <img src={entityIcon} alt={entityName || address} className="w-5 h-5 rounded-full shrink-0 border border-[var(--color-card-border)] bg-white/10 object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                )}
                {isValidator && !entityIcon && entityName && (
                    <div className="w-5 h-5 rounded-full shrink-0 border border-[var(--color-card-border)] bg-[var(--color-primary)]/10 flex items-center justify-center text-[8px] font-bold text-[var(--color-primary)]">
                        {String(entityName).slice(0, 2).toUpperCase()}
                    </div>
                )}
                <div className="flex flex-col min-w-0">
                    {isValidator && entityName && (
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 truncate max-w-[200px]">{entityName}</span>
                    )}
                    <div className="flex items-center gap-1.5">
                        <span
                            className={`font-mono truncate max-w-[200px] text-xs ${isCM ? 'text-blue-300 font-semibold' : 'text-[var(--color-text-main)]'}`}
                            title={sanitizeText(address)}
                        >
                            {displayText}
                        </span>
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); onCopy(copyableAddr); }}
                            className="hover:text-white transition-colors shrink-0"
                            title="Copy Address"
                        >
                            {copiedAddress === copyableAddr
                                ? <Check className="w-3 h-3 text-green-500" />
                                : <Copy className="w-3 h-3" />}
                        </button>
                    </div>
                </div>
            </div>
            {isCM && showConsensusInfo && <ConsensusManagerInfoCard tt={tt} />}
        </div>
    );
}

/* ─────────────────────────────────────────
   EntityBadge
   Full address card with type label, icon, name, copy button
───────────────────────────────────────── */
export function EntityBadge({
    address, tt, onCopy, copiedAddress, onResourceClick, network,
}: {
    address: string;
    tt: TranslationsT['dashboard']['transactions'];
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    network: Network;
}) {
    const clean = sanitizeText(address);
    const { label, color, bg } = getEntityType(clean, tt);
    const meta = useEntityData(clean, network);
    const entityName = meta?.name;
    const iconUrl = meta?.iconUrl;
    const short = clean.length > 20 ? `${clean.slice(0, 12)}...${clean.slice(-6)}` : clean;
    const isResource = clean.startsWith('resource_');
    const isClickable = !!onResourceClick && (
        clean.startsWith('resource_') ||
        clean.startsWith('account_') ||
        clean.startsWith('component_') ||
        clean.startsWith('package_')
    );

    return (
        <div
            className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border ${bg} group/entity ${isResource ? '' : 'transition-all hover:brightness-110'}`}
        >
            <div className="flex items-center gap-2 min-w-0">
                {iconUrl && (
                    <img
                        src={iconUrl}
                        alt={entityName || 'Token'}
                        className="w-6 h-6 rounded-full bg-white/10 shadow-sm border border-[var(--color-card-border)] shrink-0"
                        onError={e => { e.currentTarget.style.display = 'none'; }}
                    />
                )}
                <span className={`text-[9px] uppercase font-black tracking-wider px-1.5 pt-[2px] pb-[1px] leading-none rounded border ${bg} ${color} shrink-0`}>
                    {label}
                </span>
                <div className="min-w-0 flex-1 flex flex-col">
                    {entityName && (
                        <span className={`text-[11px] font-semibold truncate ${color}`}>
                            {entityName}
                        </span>
                    )}
                    <span
                        className={`font-mono text-xs truncate ${entityName ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-main)]'
                            } ${isClickable ? 'cursor-pointer hover:text-[var(--color-primary)] transition-colors' : ''}`}
                        title={clean}
                        onClick={() => isClickable && onResourceClick?.(clean)}
                    >
                        {short}
                    </span>
                </div>
            </div>
            <button
                type="button"
                onClick={e => { e.stopPropagation(); onCopy(clean); }}
                className={`shrink-0 p-1 rounded transition-colors ${copiedAddress === clean
                        ? 'text-green-500'
                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                    }`}
                title="Copy address"
            >
                {copiedAddress === clean
                    ? <Check className="w-3 h-3" />
                    : <Copy className="w-3 h-3" />}
            </button>
        </div>
    );
}

/* ─────────────────────────────────────────
   ValidatorNameLabel
   Inline display: "Name (short…addr)"
───────────────────────────────────────── */
export function ValidatorNameLabel({
    address, fallback, network,
}: {
    address: string; fallback?: string; network: Network;
}) {
    const meta = useEntityData(address, network);
    const name = meta?.name;
    const short = (address && typeof address === 'string')
        ? (address.length > 20 ? `${address.slice(0, 12)}...${address.slice(-6)}` : address)
        : (address || '...');
    return (
        <span className="font-mono text-xs truncate" title={address}>
            {name
                ? <><span className="font-semibold text-[var(--color-text-main)]">{name}</span>{' '}<span className="text-[var(--color-text-muted)] text-[10px]">({short})</span></>
                : (fallback || short)}
        </span>
    );
}
