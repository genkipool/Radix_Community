/* eslint-disable @next/next/no-img-element */
'use client';
import { parseTags } from '../../utils/resourceUtils';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Copy, ChevronDown, Box } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails, apiFetchNonFungibleData } from '@/features/dashboard/services/apiClient';
import { entityKeys } from '@/features/dashboard/hooks/useEntityData';
import { Pill } from '@/components/ui/Pill';
import { getMetaValue } from '../utils/metadataUtils';
import { TokenBadge } from '@/components/ui/TokenBadge';
import { NftCollectionPanel } from './NftCollectionPanel';

import { NftTransferCardProps } from '../types';
import type { GatewayEntityDetails } from '@/features/dashboard/types';

/* ═══════ NFT TRANSFER CARD ═══════ */


/* ═══════ NFT TRANSFER CARD ═══════ */
const NftTransferCard = ({
    resourceAddress, ids, type, onCopy, copiedAddress,
    formatEntity: _formatEntity, onResourceClick: _onResourceClick,
    sourceMethod: _sourceMethod, sourceColor: _sourceColor, sourceBg: _sourceBg,
    sourceTitle: _sourceTitle, methodLabel: _methodLabel, readingMode: _readingMode,
    tt, network = 'mainnet', side: _side,
    claimXrdTotal, isClaim, isStakeClaim: isStakeClaimProp, unstakeXrdExpected, nftReceivedLabel,
}: NftTransferCardProps) => {
    const [expanded, setExpanded] = useState(false);

    const { data: meta } = useQuery({
        queryKey: entityKeys.full(resourceAddress, network),
        queryFn: () => apiFetchEntityDetails(resourceAddress, network as 'mainnet' | 'stokenet'),
        staleTime: Infinity, gcTime: 1000 * 60 * 10, retry: 2, retryOnMount: true,
    });
    const idsKey = [...ids].sort().join(',');
    const { data: nftData = [], isLoading: nftLoading } = useQuery({
        queryKey: ['nft-data', resourceAddress, idsKey, network],
        queryFn: () => apiFetchNonFungibleData(resourceAddress, ids, network as 'mainnet' | 'stokenet'),
        staleTime: Infinity, gcTime: 1000 * 60 * 10, retry: 2, retryOnMount: true,
    });

    const metadataItems = (meta as GatewayEntityDetails | null)?.metadata?.items ?? [];
    const name = getMetaValue(metadataItems, 'name') || tt?.nft_collection || 'NFT Collection';
    const iconUrl = getMetaValue(metadataItems, 'icon_url');
    const symbol = getMetaValue(metadataItems, 'symbol');
    const tagList = parseTags(metadataItems.find((m) => m.key === 'tags') || null);

    const isReceived = type === 'added';
    const color = isReceived ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400';

    const titleStr = isReceived
        ? String(tt?.nft_received_collection || 'Received {count} NFT(s) from {name} collection ({address})').replace('{count}', String(ids.length)).replace('{name}', name).replace('{address}', resourceAddress)
        : String(tt?.nft_sent_collection || 'Sent {count} NFT(s) from {name} collection ({address})').replace('{count}', String(ids.length)).replace('{name}', name).replace('{address}', resourceAddress);

    return (
        <div className="mb-2">
            <div
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-card-border)] group transition-all hover:bg-[var(--color-surface-hover)] gap-3 cursor-pointer select-none ${expanded ? 'rounded-t-xl rounded-b-none border-b-transparent' : ''}`}
                title={titleStr}
                onClick={e => { e.stopPropagation(); if (window.getSelection()?.toString()) return; setExpanded(v => !v); }}
            >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    {iconUrl ? <img src={iconUrl} alt={symbol || name} className="w-10 h-10 rounded-full bg-white/10 shadow-sm border border-[var(--color-card-border)] shrink-0 object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} />
                        : <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center font-bold text-sm shadow-inner border border-[var(--color-primary)]/30 shrink-0"><Box className="w-5 h-5" /></div>}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0 flex-nowrap">
                            <div className="font-bold text-sm sm:text-base text-[var(--color-text-main)] group-hover:text-[var(--color-primary)] transition-colors truncate min-w-0">{name}</div>
                            {symbol && <TokenBadge className="shrink-0">{symbol}</TokenBadge>}
                            <ChevronDown className={`w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform duration-200 shrink-0 ${expanded ? 'rotate-180 text-[var(--color-primary)]' : ''}`} />
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                            <div className="text-[10px] text-[var(--color-text-muted)] font-mono truncate max-w-[150px] sm:max-w-[200px]" title={resourceAddress}>{resourceAddress.slice(0, 12)}...{resourceAddress.slice(-6)}</div>
                            <button onClick={e => { e.stopPropagation(); onCopy?.(resourceAddress); }} className={`p-1 rounded-md transition-colors shrink-0 ${copiedAddress === resourceAddress ? 'text-green-500' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-white/5'}`} title="Copy Resource Address">
                                {copiedAddress === resourceAddress ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                        </div>
                        {tagList.length > 0 && (
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                                {tagList.slice(0, 4).map((tag: string, i: number) => <Pill key={i}>{tag}</Pill>)}
                            </div>
                        )}
                    </div>
                </div>
                <div className={`font-mono font-bold lg:text-lg ${color} shrink-0 text-right flex flex-col items-end justify-end gap-1`}>
                    <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-black opacity-70">
                        {nftReceivedLabel ?? (isClaim ? (tt?.nft_presented_label || 'NFT Presentado') : (tt?.nft_label || 'No Fungible'))}
                    </div>
                    {isClaim && type === 'removed' ? (
                        <div className="font-mono font-bold text-base tabular-nums text-red-600 dark:text-red-400">−1 <span className="text-sm font-semibold opacity-70">NFT</span></div>
                    ) : (
                        <div className="text-xl font-black tabular-nums text-green-700 dark:text-green-400">+{ids.length} <span className="text-sm font-semibold opacity-70">NFT{ids.length > 1 ? 's' : ''}</span></div>
                    )}
                </div>
            </div>
            <AnimatePresence>
                {expanded && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                        <NftCollectionPanel
                            resourceAddress={resourceAddress}
                            meta={meta} nftData={nftData as Record<string, unknown>[]} nftLoading={nftLoading}
                            ids={ids} type={type}
                            onCopy={onCopy} copiedAddress={copiedAddress} tt={tt}
                            claimXrdTotal={claimXrdTotal} isClaim={isClaim}
                            isStakeClaimOverride={isStakeClaimProp}
                            unstakeXrdExpected={unstakeXrdExpected}
                            network={network}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
NftTransferCard.displayName = 'NftTransferCard';

export { NftTransferCard };
