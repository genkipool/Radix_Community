/* eslint-disable @next/next/no-img-element */
'use client';

import React from 'react';
import { Activity, Gift } from 'lucide-react';
import { useEntityData } from '@/features/dashboard/hooks/useEntityData';
import { Pill } from '@/components/ui/Pill';
import { EntityBadge } from './EntityBadge';
import type { OracleUpdate, AirdropData } from '@/features/dashboard/explorador/types';
import type { Network, TranslationsT } from '@/features/dashboard/types';

/* OraclePriceUpdateCard */

export function OraclePriceUpdateCard({
    update, tt, onCopy, copiedAddress, onResourceClick, network,
}: { 
    update: OracleUpdate; 
    tt: TranslationsT['dashboard']['transactions']; 
    onCopy: (addr: string) => void; 
    copiedAddress: string | null; 
    onResourceClick?: (addr: string) => void; 
    network: Network 
}) {
    const meta   = useEntityData(update.quoteToken, network);
    const symbol = meta?.symbol ?? '';

    return (
        <div className="p-2.5 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] flex flex-col gap-2.5 shadow-sm">
            <div className="flex flex-col gap-1.5 min-w-0">
                <EntityBadge
                    address={update.baseToken}
                    tt={tt}
                    onCopy={onCopy}
                    copiedAddress={copiedAddress}
                    onResourceClick={onResourceClick}
                    network={network}
                />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-[var(--color-card-border)]">
                <span className="text-[10px] uppercase font-black text-blue-500 tracking-wider">
                    {tt.oracle_new_price || 'New Price'}
                </span>
                <span className="text-sm font-mono font-black text-blue-400 flex items-center gap-1.5">
                    {update.price}
                    {symbol && (
                        <span className="text-[10px] font-bold text-[var(--color-text-main)] bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                            {symbol}
                        </span>
                    )}
                </span>
            </div>
            <div className="flex items-center justify-between pt-1">
                <span className="text-[8px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider border border-[var(--color-card-border)] px-1.5 py-0.5 rounded-sm">
                    {tt.quote_token || 'Quote Token'}
                </span>
                <span className="text-[10px] font-mono text-[var(--color-text-muted)] truncate" title={update.quoteToken}>
                    {update.quoteToken.slice(0, 16)}...{update.quoteToken.slice(-6)}
                </span>
            </div>
        </div>
    );
}

/* OracleUpdateSection
   Section wrapper + grid of OraclePriceUpdateCards */
export function OracleUpdateSection({
    updates, tt, onCopy, copiedAddress, onResourceClick, network,
}: { 
    updates: OracleUpdate[]; 
    tt: TranslationsT['dashboard']['transactions']; 
    onCopy: (addr: string) => void; 
    copiedAddress: string | null; 
    onResourceClick?: (addr: string) => void; 
    network: Network 
}) {
    if (updates.length === 0) return null;
    return (
        <div className="bg-[var(--color-card-bg)] rounded-xl border border-blue-500/30 overflow-hidden mt-4">
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-blue-500/20 bg-[var(--color-surface)] flex items-center justify-between">
                <span className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-blue-400" />
                    {tt.oracle_update_label || 'Oracle Price Update'}
                </span>
                <Pill color="custom" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                    {updates.length}
                </Pill>
            </h3>
            <div className="p-3 space-y-2">
                {tt.oracle_update_desc && (
                    <p className="text-[10px] text-[var(--color-text-muted)] italic mb-3">
                        {tt.oracle_update_desc}
                    </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {updates.map((update, idx: number) => (
                        <OraclePriceUpdateCard
                            key={idx}
                            update={update}
                            tt={tt}
                            onCopy={onCopy}
                            copiedAddress={copiedAddress}
                            onResourceClick={onResourceClick}
                            network={network}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

/* AirdropRewardCard + AirdropSection */

function AirdropRewardCard({
    airdropData, tt, onCopy, copiedAddress, onResourceClick, network,
}: { 
    airdropData: AirdropData; 
    tt: TranslationsT['dashboard']['transactions']; 
    onCopy: (addr: string) => void; 
    copiedAddress: string | null; 
    onResourceClick?: (addr: string) => void; 
    network: Network 
}) {
    const meta   = useEntityData(airdropData.resource || '', network);
    const symbol = meta?.symbol ?? '';
    const iconUrl = meta?.iconUrl;

    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-xl p-3 shadow-sm divide-y divide-[var(--color-card-border)]">
            <div className="pb-2">
                <span className="text-[9px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider block mb-1.5">
                    {tt.airdrop_winner || 'Winner Account'}
                </span>
                <EntityBadge address={airdropData.account} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} onResourceClick={onResourceClick} network={network} />
            </div>
            <div className="pt-2 flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-black text-purple-500 tracking-wider flex items-center gap-1.5 opacity-80">
                        {tt.airdrop_amount || 'Reward Amount'}
                    </span>
                    {airdropData.resource && (
                        <div
                            className="flex items-center gap-1 mt-1 cursor-pointer hover:text-[var(--color-primary)] transition-colors"
                            onClick={() => onResourceClick?.(airdropData.resource!)}
                        >
                            {iconUrl && <img src={iconUrl} alt="Token" className="w-4 h-4 rounded-full bg-white/10" />}
                            <span className="text-[9px] font-mono text-[var(--color-text-muted)] truncate max-w-[120px]" title={airdropData.resource}>
                                {airdropData.resource.slice(0, 8)}...{airdropData.resource.slice(-6)}
                            </span>
                        </div>
                    )}
                </div>
                <span className="text-base font-mono font-black text-purple-400 flex items-center gap-1.5">
                    +{airdropData.amount}
                    {symbol && (
                        <span className="text-xs font-bold text-[var(--color-text-main)] bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                            {symbol}
                        </span>
                    )}
                </span>
            </div>
            <div className="pt-2 mt-1">
                <span className="text-[9px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider block mb-1.5">
                    {tt.airdrop_contract || 'Smart Contract'}
                </span>
                <EntityBadge address={airdropData.component} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} onResourceClick={onResourceClick} network={network} />
            </div>
            <div className="pt-2 mt-1 flex items-center justify-between">
                <span className="text-[9px] uppercase font-bold text-[var(--color-text-muted)] tracking-wider">
                    {tt.airdrop_event_id || 'Event ID'}:
                </span>
                <span className="text-[10px] font-mono font-bold bg-white/5 px-2 py-0.5 rounded text-[var(--color-text-main)] border border-[var(--color-card-border)]">
                    #{airdropData.eventId}
                </span>
            </div>
        </div>
    );
}

export function AirdropSection({
    airdropData, tt, onCopy, copiedAddress, onResourceClick, network,
}: { 
    airdropData: AirdropData | null; 
    tt: TranslationsT['dashboard']['transactions']; 
    onCopy: (addr: string) => void; 
    copiedAddress: string | null; 
    onResourceClick?: (addr: string) => void; 
    network: Network 
}) {
    if (!airdropData) return null;
    return (
        <div className="bg-[var(--color-card-bg)] rounded-xl border border-purple-500/30 overflow-hidden mt-4">
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-purple-500/20 bg-[var(--color-surface)] flex items-center justify-between">
                <span className="flex items-center gap-2">
                    <Gift className="w-3.5 h-3.5 text-purple-400" />
                    {tt.airdrop_label || 'Airdrop / Rewards'}
                </span>
            </h3>
            <div className="p-3">
                {tt.airdrop_desc && (
                    <p className="text-[10px] text-[var(--color-text-muted)] italic mb-3">{tt.airdrop_desc}</p>
                )}
                <AirdropRewardCard
                    airdropData={airdropData}
                    tt={tt}
                    onCopy={onCopy}
                    copiedAddress={copiedAddress}
                    onResourceClick={onResourceClick}
                    network={network}
                />
            </div>
        </div>
    );
}
