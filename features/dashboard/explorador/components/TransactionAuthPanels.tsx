'use client';

import React from 'react';
import type { TranslationsT, Network } from '@/features/dashboard/types';
import { Check, Copy, Shield } from 'lucide-react';
import { BalanceChangeRow } from './BalanceChangeRow';

/* ─────────────────────────────────────────
   LockFeePanel
   Shows max-authorized vs actual fee, with
   the account address + parsed action.
───────────────────────────────────────── */
export function LockFeePanel({
    lockFeeAmount, lockFeeAccount, mainAction, nftId, actualFeePaid,
    tt, onCopy, copiedAddress,
}: {
    lockFeeAmount: string;
    lockFeeAccount: string | null;
    mainAction: string | null;
    nftId: string | null;
    actualFeePaid: string;
    tt: TranslationsT['dashboard']['transactions'];
    onCopy: (v: string) => void;
    copiedAddress: string | null;
}) {
    return (
        <div
            className="bg-[var(--color-card-bg)] rounded-xl border border-amber-500/20 overflow-hidden"
            title={tt.lock_fee_title || 'Fee pre-authorization. Unused amount is automatically returned.'}
        >
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-amber-500/20 bg-[var(--color-surface)] flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                {tt.lock_fee_label || 'Lock Fee (Authorization)'}
            </h3>
            <div className="p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-black text-amber-600 tracking-widest">{tt.lock_fee_max || 'Max Authorized Fee'}</span>
                    <span className="font-mono font-semibold text-sm text-amber-600">{lockFeeAmount} XRD</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-black text-green-700 dark:text-green-400 tracking-widest">{tt.lock_fee_actual || 'Actual Fee Charged'}</span>
                    <span className="font-mono font-semibold text-sm text-green-700 dark:text-green-400">{actualFeePaid} XRD</span>
                </div>
                {lockFeeAccount && (
                    <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                        <span className="font-mono truncate" title={lockFeeAccount}>{lockFeeAccount.slice(0, 16)}...{lockFeeAccount.slice(-6)}</span>
                        <button type="button" onClick={e => { e.stopPropagation(); onCopy(lockFeeAccount); }} className={`p-0.5 rounded transition-colors ${copiedAddress === lockFeeAccount ? 'text-green-500' : 'hover:text-[var(--color-text-main)]'}`}>
                            {copiedAddress === lockFeeAccount ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                        </button>
                    </div>
                )}
                <p className="text-[12px] text-[var(--color-text-muted)] italic">
                    {String(tt.lock_fee_desc || 'You authorized the network to spend up to {max} XRD. The actual fee was {actual} XRD.')
                        .replace('{max}', lockFeeAmount)
                        .replace('{actual}', actualFeePaid)}
                </p>
                {mainAction && (
                    <div className="mt-1 space-y-1 pt-2 border-t border-amber-500/10">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] uppercase font-black text-amber-400/70 tracking-normal shrink-0">{tt.lock_fee_action || 'Action'}:</span>
                            <span className="text-[10px] font-mono text-[var(--color-text-main)]">{mainAction}</span>
                        </div>
                        {nftId && (
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] uppercase font-black text-amber-400/70 tracking-normal shrink-0">{tt.lock_fee_objective || 'Objective'}:</span>
                                <span className="text-[10px] font-mono text-[var(--color-text-main)]">NFT #{nftId}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────
   AuthBadgePanel
   Shows the proof badge used to authorise an
   operation (e.g. Oracle update, validator vote).
───────────────────────────────────────── */
export function AuthBadgePanel({
    badgeResource, badgeAmount, badgeOrigin,
    tt, t, onCopy, copiedAddress, onResourceClick, readingMode, network = 'mainnet', locale,
}: {
    badgeResource: string;
    badgeAmount: string;
    badgeOrigin: string | null;
    tt: TranslationsT['dashboard']['transactions'];
    t: TranslationsT;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    onResourceClick?: (addr: string) => void;
    readingMode?: boolean;
    network?: Network;
    locale: string;
}) {
    return (
        <div className="bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-primary)]/30 overflow-hidden mt-4">
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--color-primary)]/20 bg-[var(--color-surface)] flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                {tt.auth_badge_label || 'Authorization Badge'}
            </h3>
            <div className="p-3">
                {tt.auth_badge_desc && (
                    <p className="text-[10px] text-[var(--color-text-muted)] italic mb-1.5">
                        {String(tt.auth_badge_desc).replace('{amount}', badgeAmount).replace('{resource}', '')}
                    </p>
                )}
                {badgeOrigin && (
                    <div className="flex items-baseline gap-2 mb-4 px-0.5">
                        <span className="text-xs font-bold text-[var(--color-text-main)] shrink-0">{tt.auth_badge_presenter || 'Presented by'}</span>
                        <span className="font-mono text-xs text-[var(--color-text-main)] truncate opacity-90" title={badgeOrigin}>
                            {badgeOrigin.slice(0, 16)}...{badgeOrigin.slice(-8)}
                        </span>
                        <button type="button" onClick={e => { e.stopPropagation(); onCopy(badgeOrigin); }} className="hover:text-[var(--color-accent)] transition-colors shrink-0 translate-y-[1px]">
                            {copiedAddress === badgeOrigin ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />}
                        </button>
                    </div>
                )}
                <BalanceChangeRow
                    change={{
                        resource_address: badgeResource,
                        balance_change: badgeAmount,
                        entity_address: badgeOrigin || '',
                    }}
                    t={t}
                    onCopy={onCopy}
                    copiedAddress={copiedAddress}
                    onResourceClick={onResourceClick}
                    readingMode={readingMode}
                    network={network}
                    locale={locale}
                />
            </div>
        </div>
    );
}
