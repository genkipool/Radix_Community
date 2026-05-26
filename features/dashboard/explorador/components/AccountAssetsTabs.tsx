'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Check, Info, ChevronDown } from 'lucide-react';
import { SafeImage } from '@/components/ui/SafeImage';
import { truncateAddress } from '@/utils/formatters';
import { ResourceInlinePanel } from './BalanceChangeRow';
import { NftCollectionPanel } from './NftCollectionPanel';
import { entityKeys } from '@/features/dashboard/hooks/useEntityData';
import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails, apiFetchNonFungibleData } from '@/features/dashboard/services/apiClient';
import type { GatewayEntityDetails, TranslationsT, MetadataItem } from '@/features/dashboard/types';
import { useAccountStats } from '../hooks/useAccountStats';

interface ParsedResource {
    address: string;
    name: string;
    symbol: string;
    iconUrl: string;
    amount: string;
    isPoolUnit: boolean;
    isLsu: boolean;
    validatorAddress?: string;
    validatorName?: string;
    poolAddress?: string;
    isClaim: boolean;
    ids?: string[];
    isNft: boolean;
    rawResourceData?: unknown;
    metadataItems?: MetadataItem[];
}
export function AccountTokensTab({
    address: _address,
    entityData,
    tt,
    onCopy,
    copiedAddress,
    network = 'mainnet',
    locale
}: {
    address: string;
    entityData: GatewayEntityDetails | null;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    network?: 'mainnet' | 'stokenet';
    locale?: string;
}) {
    const { tokens } = useAccountStats(_address, network, entityData);

    return (
        <div className="space-y-6">
            <AssetSection title={tt?.account_summary?.tokens_tab || 'Tokens'} items={tokens} onCopy={onCopy} copiedAddress={copiedAddress} tt={tt} network={network} locale={locale} />
            {tokens.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)] italic text-center py-6">No tokens found.</p>
            )}
        </div>
    );
}

export function AccountPoolUnitsTab({
    address: _address,
    entityData,
    tt,
    onCopy,
    copiedAddress,
    network = 'mainnet',
    locale
}: {
    address: string;
    entityData: GatewayEntityDetails | null;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    network?: 'mainnet' | 'stokenet';
    locale?: string;
}) {
    const { poolUnits } = useAccountStats(_address, network, entityData);

    return (
        <div className="space-y-6">
            <AssetSection title={tt?.account_summary?.pool_units || 'Pool Units'} items={poolUnits} onCopy={onCopy} copiedAddress={copiedAddress} tt={tt} network={network} locale={locale} />
            {poolUnits.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)] italic text-center py-6">No pool units found.</p>
            )}
        </div>
    );
}

export function AccountNftsTab({
    address: _address,
    entityData,
    tt,
    onCopy,
    copiedAddress,
    network = 'mainnet',
    locale
}: {
    address: string;
    entityData: GatewayEntityDetails | null;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    network?: 'mainnet' | 'stokenet';
    locale?: string;
}) {
    const { activeNfts, burnedNfts } = useAccountStats(_address, network, entityData);

    return (
        <div className="space-y-6">
            <AssetSection title={tt?.account_summary?.nfts_tab || 'NFTs'} items={activeNfts} onCopy={onCopy} copiedAddress={copiedAddress} tt={tt} network={network} locale={locale} />
            <AssetSection title={tt?.account_summary?.burned_nfts || 'Burned NFTs'} items={burnedNfts} onCopy={onCopy} copiedAddress={copiedAddress} burned tt={tt} network={network} locale={locale} />
            {activeNfts.length === 0 && burnedNfts.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)] italic text-center py-6">No NFTs found.</p>
            )}
        </div>
    );
}

function AssetSection({ title, items, onCopy, copiedAddress, burned = false, tt, network = 'mainnet', locale }: {
    title: string;
    items: ParsedResource[];
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    burned?: boolean;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    network?: 'mainnet' | 'stokenet';
    locale?: string;
}) {
    if (items.length === 0) return null;
    return (
        <div className="mt-4">
            <h4 className={`text-xs font-black uppercase mb-3 tracking-wider ${burned ? 'text-red-500/80' : 'text-[var(--color-text-muted)]'}`}>
                {title} ({items.length})
            </h4>
            <div className="flex flex-col gap-2">
                {items.map((item) => (
                    <ExpandableResourceCard key={item.address} item={item} onCopy={onCopy} copiedAddress={copiedAddress} burned={burned} tt={tt} network={network} locale={locale} />
                ))}
            </div>
        </div>
    );
}

function ExpandableResourceCard({
    item,
    onCopy,
    copiedAddress,
    burned = false,
    tt,
    network = 'mainnet',
    locale
}: {
    item: ParsedResource;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    burned?: boolean;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    network?: 'mainnet' | 'stokenet';
    locale?: string;
}) {
    const { address, name, symbol, iconUrl, amount, isNft, ids } = item;
    const [expanded, setExpanded] = useState(false);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.getSelection()?.toString()) return;
        setExpanded(v => !v);
    };

    const { data: entityData, isLoading: isLoadingEntity } = useQuery({
        queryKey: entityKeys.full(address, network),
        queryFn: () => apiFetchEntityDetails(address, network as 'mainnet' | 'stokenet'),
        enabled: expanded,
        staleTime: Infinity,
        gcTime: 10 * 60_000,
        retry: 1,
    });

    const idsKey = ids ? [...ids].sort().join(',') : '';
    const { data: nftData = [], isLoading: isLoadingNft } = useQuery({
        queryKey: ['nft-data', address, idsKey, network],
        queryFn: () => apiFetchNonFungibleData(address, ids || [], network as 'mainnet' | 'stokenet'),
        enabled: expanded && isNft && !!ids && ids.length > 0,
        staleTime: Infinity,
        gcTime: 10 * 60_000,
        retry: 1,
    });

    return (
        <div className={`flex flex-col bg-[var(--color-surface)] border ${burned ? 'border-red-500/20 opacity-70' : 'border-[var(--color-card-border)]'} rounded-xl transition-all shadow-sm`}>
            {/* Clickable Header */}
            <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-colors rounded-xl"
                onClick={handleToggle}
            >
                {/* Left side: Icon + Name + Address */}
                <div className="flex items-center gap-3 min-w-0 pr-4 flex-1">
                    <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden bg-[var(--color-card-border)] flex items-center justify-center border border-[var(--color-card-border)]">
                        {iconUrl ? (
                            <SafeImage src={iconUrl} alt={name} fallbackName={symbol || name} className={`w-full h-full object-cover ${burned ? 'grayscale' : ''}`} />
                        ) : (
                            <Info className="w-4 h-4 text-[var(--color-text-muted)]" />
                        )}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                            <span className="font-bold text-sm text-[var(--color-text-main)] truncate" title={name}>{name}</span>
                            {symbol && <span className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider truncate shrink-0">{symbol}</span>}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] font-mono text-[var(--color-text-muted)] truncate select-all">{truncateAddress(address, 6, 6)}</span>
                            <button
                                onClick={(e) => { e.stopPropagation(); onCopy(address); }}
                                className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors shrink-0"
                            >
                                {copiedAddress === address ? <Check className="w-2.5 h-2.5 text-green-500" /> : <Copy className="w-2.5 h-2.5" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right side: Amount + Chevron */}
                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-mono font-black text-[var(--color-text-main)] tracking-tight">
                            {parseFloat(amount).toLocaleString(locale || 'en-US')}
                        </span>
                        <span className="text-[10px] font-bold text-[var(--color-text-muted)] text-right truncate max-w-[80px]" title={symbol || name}>
                            {symbol || name}
                        </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 ml-1 text-[var(--color-text-muted)] transition-transform duration-200 ${expanded ? 'rotate-180 text-[var(--color-primary)]' : ''}`} />
                </div>
            </div>

            {/* Expandable Content Overlay using AnimatePresence */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                    >
                        {isNft ? (
                            <NftCollectionPanel
                                resourceAddress={address}
                                meta={entityData} 
                                nftData={nftData as Record<string, unknown>[]} 
                                nftLoading={isLoadingNft || isLoadingEntity}
                                ids={ids || []} 
                                type="neutral"
                                onCopy={onCopy} 
                                copiedAddress={copiedAddress} 
                                tt={tt}
                                network={network}
                                locale={locale || 'en-US'}
                                validatorAddress={item.validatorAddress}
                                validatorName={item.validatorName}
                            />
                        ) : (
                            <ResourceInlinePanel 
                                address={address} 
                                details={entityData || null} 
                                loading={isLoadingEntity} 
                                onCopy={onCopy} 
                                copiedAddress={copiedAddress} 
                                tt={tt} 
                                locale={locale || 'en-US'}
                                isPoolUnit={item.isPoolUnit}
                                userBalance={parseFloat(item.amount) || 0}
                                poolAddress={item.poolAddress}
                            />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

