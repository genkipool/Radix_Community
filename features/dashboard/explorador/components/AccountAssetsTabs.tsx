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
import { parseProgrammaticJson } from '@/features/dashboard/utils/resourceUtils';

interface ParsedResource {
    address: string;
    name: string;
    symbol: string;
    iconUrl: string;
    amount: string;
    isPoolUnit: boolean;
    isLsu: boolean;
    validatorAddress?: string;
    poolAddress?: string;
    isClaim: boolean;
    ids?: string[];
    isNft: boolean;
    rawResourceData?: unknown;
    metadataItems?: MetadataItem[];
}

function extractMetadata(items: MetadataItem[] | undefined, key: string): string {
    const meta = items?.find((m) => m.key === key);
    if (meta?.value?.typed?.value) {
        return meta.value.typed.value;
    }
    return '';
}

// Function to safely extract tags
function extractTags(items: MetadataItem[] | undefined): string[] {
    const meta = items?.find((m) => m.key === 'tags');
    if (meta?.value?.typed?.values) {
        return meta.value.typed.values;
    }
    if (meta?.value?.programmatic_json) {
        const parsed = parseProgrammaticJson(meta.value.programmatic_json);
        if (Array.isArray(parsed)) {
            return parsed.map(String);
        }
    }
    return [];
}

/**
 * Extracts the pool component address from LP token metadata.
 * Checks: pool, pool_address keys, dapp_definitions, or component_ pattern in info_url.
 */
function extractPoolAddress(items: MetadataItem[] | undefined): string | undefined {
    if (!items) return undefined;

    // Direct pool or pool_address metadata key
    const poolMeta = items.find((m) => m.key === 'pool' || m.key === 'pool_address');
    if (poolMeta?.value?.typed?.value) return poolMeta.value.typed.value;

    // Check dapp_definitions for component addresses
    const dappDefs = items.find((m) => m.key === 'dapp_definitions');
    if (dappDefs?.value?.typed?.values) {
        const componentAddr = dappDefs.value.typed.values.find(
            (v: string) => v.startsWith('component_')
        );
        if (componentAddr) return componentAddr;
    }
    if (dappDefs?.value?.typed?.value && (dappDefs.value.typed.value as string).startsWith('component_')) {
        return dappDefs.value.typed.value;
    }

    // Single dapp_definition
    const dappDef = items.find((m) => m.key === 'dapp_definition');
    if (dappDef?.value?.typed?.value && (dappDef.value.typed.value as string).startsWith('component_')) {
        return dappDef.value.typed.value;
    }

    // Extract from info_url (e.g. https://app.ociswap.com/pool/component_rdx1...)
    const infoUrl = items.find((m) => m.key === 'info_url');
    const urlStr = infoUrl?.value?.typed?.value ?? infoUrl?.value?.typed?.url ?? '';
    const componentMatch = urlStr.match(/(component_[a-z0-9]+)/i);
    if (componentMatch) return componentMatch[1];

    return undefined;
}

interface ResourceItem {
    resource_address: string;
    amount?: string;
    explicit_metadata?: { items: MetadataItem[] };
    vaults?: { items: { items: string[] }[] };
    [key: string]: unknown;
}

interface ValidatorItem {
    address: string;
    lsuResource: string;
    claimTokenResourceAddress: string;
    [key: string]: unknown;
}

function parseTokensAndNfts(entityData: GatewayEntityDetails | null, network: 'mainnet' | 'stokenet' = 'mainnet', validatorsData?: { validators?: ValidatorItem[] }) {
    const xrdAddress = network === 'mainnet'
        ? 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
        : 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';

    const fungibles = entityData?.fungible_resources?.items || [];
    const nonFungibles = entityData?.non_fungible_resources?.items || [];

    const tokens: ParsedResource[] = [];
    const poolUnits: ParsedResource[] = [];
    const activeNfts: ParsedResource[] = [];
    const burnedNfts: ParsedResource[] = [];

    // Filter out XRD if needed, or keep it. We'll keep all tokens here.
    fungibles.forEach((ft: ResourceItem | unknown) => {
        const ftItem = ft as ResourceItem;
        const meta = ftItem.explicit_metadata?.items || [];
        const valByLsu = validatorsData?.validators?.find((v: ValidatorItem) => v.lsuResource === ftItem.resource_address);

        const r: ParsedResource = {
            address: ftItem.resource_address,
            name: extractMetadata(meta, 'name') || 'Unknown Token',
            symbol: extractMetadata(meta, 'symbol') || '',
            iconUrl: extractMetadata(meta, 'icon_url') || '',
            amount: ftItem.amount || '0',
            isPoolUnit: !!meta.find((m: MetadataItem) => m.key === 'pool_unit') || extractTags(meta).some((tag: string) => ['lp', 'liquidity-pool', 'pool_unit'].includes(tag.toLowerCase())),
            isLsu: !!meta.find((m: MetadataItem) => m.key === 'validator') || !!valByLsu || extractTags(meta).some((tag: string) => tag.toLowerCase() === 'lsu'),
            validatorAddress: extractMetadata(meta, 'validator') || valByLsu?.address,
            poolAddress: undefined,
            isClaim: false,
            isNft: false,
            rawResourceData: ftItem,
            metadataItems: meta
        };

        if (r.isPoolUnit) {
            r.poolAddress = extractPoolAddress(meta);
            poolUnits.push(r);
        } else {
            tokens.push(r);
        }
    });

    // Ensure XRD is always first if present
    const xrdIndex = tokens.findIndex(t => t.address === xrdAddress);
    if (xrdIndex > -1) {
        const [xrd] = tokens.splice(xrdIndex, 1);
        tokens.unshift(xrd);
    }

    nonFungibles.forEach((nft: ResourceItem | unknown) => {
        const nftItem = nft as ResourceItem;
        const meta = nftItem.explicit_metadata?.items || [];
        const valByClaim = validatorsData?.validators?.find((v: ValidatorItem) => v.claimTokenResourceAddress === nftItem.resource_address);
        const nftItems = nftItem.vaults?.items?.[0]?.items || [];
        const nftAmount = nftItem.amount !== undefined ? nftItem.amount : nftItems.length;

        const r: ParsedResource = {
            address: nftItem.resource_address,
            name: extractMetadata(meta, 'name') || 'Unknown NFT',
            symbol: extractMetadata(meta, 'symbol') || '',
            iconUrl: extractMetadata(meta, 'icon_url') || '',
            amount: String(nftAmount),
            isPoolUnit: false,
            isLsu: false,
            validatorAddress: extractMetadata(meta, 'validator') || valByClaim?.address,
            isClaim: !!meta.find((m: MetadataItem) => m.key === 'claim_nft' || m.key === 'validator') || !!valByClaim,
            ids: nftItems,
            isNft: true,
            rawResourceData: nftItem,
            metadataItems: meta
        };

        if (nftAmount === 0) {
            burnedNfts.push(r);
        } else {
            activeNfts.push(r);
        }
    });

    return { tokens, poolUnits, activeNfts, burnedNfts };
}

export function AccountTokensTab({
    entityData,
    tt,
    onCopy,
    copiedAddress,
    network = 'mainnet',
    locale
}: {
    entityData: GatewayEntityDetails | null;
    tt: TranslationsT['dashboard']['transactions'];
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    network?: 'mainnet' | 'stokenet';
    locale?: string;
}) {
    const { tokens } = parseTokensAndNfts(entityData, network);

    return (
        <div className="space-y-6">
            <AssetSection title={tt.account_summary?.tokens_tab || 'Tokens'} items={tokens} onCopy={onCopy} copiedAddress={copiedAddress} tt={tt} network={network} locale={locale} />
            {tokens.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)] italic text-center py-6">No tokens found.</p>
            )}
        </div>
    );
}

export function AccountPoolUnitsTab({
    entityData,
    tt,
    onCopy,
    copiedAddress,
    network = 'mainnet',
    locale
}: {
    entityData: GatewayEntityDetails | null;
    tt: TranslationsT['dashboard']['transactions'];
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    network?: 'mainnet' | 'stokenet';
    locale?: string;
}) {
    const { poolUnits } = parseTokensAndNfts(entityData, network);

    return (
        <div className="space-y-6">
            <AssetSection title={tt.account_summary?.pool_units || 'Pool Units'} items={poolUnits} onCopy={onCopy} copiedAddress={copiedAddress} tt={tt} network={network} locale={locale} />
            {poolUnits.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)] italic text-center py-6">No pool units found.</p>
            )}
        </div>
    );
}

export function AccountNftsTab({
    entityData,
    tt,
    onCopy,
    copiedAddress,
    network = 'mainnet',
    locale
}: {
    entityData: GatewayEntityDetails | null;
    tt: TranslationsT['dashboard']['transactions'];
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    network?: 'mainnet' | 'stokenet';
    locale?: string;
}) {
    const { activeNfts, burnedNfts } = parseTokensAndNfts(entityData, network);

    return (
        <div className="space-y-6">
            <AssetSection title={tt.account_summary?.nfts_tab || 'NFTs'} items={activeNfts} onCopy={onCopy} copiedAddress={copiedAddress} tt={tt} network={network} locale={locale} />
            <AssetSection title={tt.account_summary?.burned_nfts || 'Burned NFTs'} items={burnedNfts} onCopy={onCopy} copiedAddress={copiedAddress} burned tt={tt} network={network} locale={locale} />
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
    tt: TranslationsT['dashboard']['transactions'];
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
    tt: TranslationsT['dashboard']['transactions'];
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

