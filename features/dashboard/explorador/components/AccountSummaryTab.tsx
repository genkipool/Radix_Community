'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Check, Info } from 'lucide-react';
import { SafeImage } from '@/components/ui/SafeImage';
import { PanelLoadingState } from './EntityPanelShared';
import { apiFetchNonFungibleData } from '@/features/dashboard/services/apiClient';
import { useValidatorsQuery } from '@/features/dashboard/staking/hooks/useValidatorsQuery';
import { formatXRD, formatNumber, truncateAddress } from '@/utils/formatters';
import type { GatewayEntityDetails, TranslationsT, MetadataItem, MarketData } from '@/features/dashboard/types';
import { getCurrencyForLocale, formatCurrency } from '../../../../utils/currencyUtils';

interface AccountSummaryTabProps {
    address: string;
    entityData: GatewayEntityDetails | null;
    entityName: string | null | undefined;
    iconUrl: string | null | undefined;
    getMeta: (key: string) => string;
    tt: TranslationsT['dashboard']['transactions'];
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    network: 'mainnet' | 'stokenet';
    marketData?: MarketData | null;
    locale: string;
}

interface ParsedResource {
    address: string;
    name: string;
    symbol: string;
    iconUrl: string;
    amount: string;
    isPoolUnit: boolean;
    isLsu: boolean;
    validatorAddress?: string;
    isClaim: boolean;
    ids?: string[];
    isNft: boolean;
}

// Function to safely extract explicit metadata
function extractMetadata(items: MetadataItem[] | undefined, key: string): string {
    const meta = items?.find((m) => m.key === key);
    if (meta?.value?.typed?.value) {
        return meta.value.typed.value;
    }
    return '';
}

export function AccountSummaryTab({
    address,
    entityData,
    entityName,
    iconUrl,
    getMeta,
    tt,
    onCopy,
    copiedAddress,
    network,
    marketData,
    locale
}: AccountSummaryTabProps) {
    const description = getMeta('description');
    const { data: validatorsData, isLoading: isLoadingValidators } = useValidatorsQuery(network);

    const xrdAddress = network === 'mainnet'
        ? 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
        : 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';

    // Parsing Logic
    const fungibles = entityData?.fungible_resources?.items || [];
    const nonFungibles = entityData?.non_fungible_resources?.items || [];

    let xrdAmount = '0';
    const tokens: ParsedResource[] = [];
    const lsuTokens: ParsedResource[] = [];
    const poolUnits: ParsedResource[] = [];
    const activeNfts: ParsedResource[] = [];
    const burnedNfts: ParsedResource[] = [];
    const claimCollections: Record<string, string[]> = {};

    // Process Fungibles
    fungibles.forEach((ft: { resource_address: string; amount: string; explicit_metadata?: { items: MetadataItem[] } }) => {
        if (ft.resource_address === xrdAddress) {
            xrdAmount = ft.amount || '0';
            return;
        }

        const meta = ft.explicit_metadata?.items || [];
        const valByLsu = validatorsData?.validators.find((v: { lsuResource?: string; address: string }) => v.lsuResource === ft.resource_address);

        const r: ParsedResource = {
            address: ft.resource_address,
            name: extractMetadata(meta, 'name') || 'Unknown Token',
            symbol: extractMetadata(meta, 'symbol') || '',
            iconUrl: extractMetadata(meta, 'icon_url') || '',
            amount: ft.amount || '0',
            isPoolUnit: !!meta.find((m: MetadataItem) => m.key === 'pool_unit'),
            isLsu: !!meta.find((m: MetadataItem) => m.key === 'validator') || !!valByLsu,
            validatorAddress: extractMetadata(meta, 'validator') || valByLsu?.address,
            isClaim: false,
            isNft: false
        };

        if (r.isLsu) lsuTokens.push(r);
        else if (r.isPoolUnit) poolUnits.push(r);
        else tokens.push(r);
    });

    // Process Non-Fungibles
    nonFungibles.forEach((nft: { resource_address: string; amount?: number; explicit_metadata?: { items: MetadataItem[] }; vaults?: { items: Array<{ items: string[] }> } }) => {
        const meta = nft.explicit_metadata?.items || [];
        const valByClaim = validatorsData?.validators.find((v: { claimTokenResourceAddress?: string; address: string }) => v.claimTokenResourceAddress === nft.resource_address);
        const nftItems = nft.vaults?.items?.[0]?.items || [];
        const nftAmount = nft.amount !== undefined ? nft.amount : nftItems.length;

        const r: ParsedResource = {
            address: nft.resource_address,
            name: extractMetadata(meta, 'name') || 'Unknown NFT',
            symbol: extractMetadata(meta, 'symbol') || '',
            iconUrl: extractMetadata(meta, 'icon_url') || '',
            amount: String(nftAmount),
            isPoolUnit: false,
            isLsu: false,
            validatorAddress: extractMetadata(meta, 'validator') || valByClaim?.address,
            isClaim: !!meta.find((m: MetadataItem) => m.key === 'claim_nft' || m.key === 'validator') || !!valByClaim,
            ids: nftItems,
            isNft: true
        };

        if (r.isClaim && r.validatorAddress && r.ids && r.ids.length > 0) {
            claimCollections[r.address] = r.ids;
        } else if (nftAmount === 0) {
            burnedNfts.push(r);
        } else {
            activeNfts.push(r);
        }
    });

    const claimCollectionAddresses = Object.keys(claimCollections);
    const { data: claimsData, isLoading: isLoadingClaims } = useQuery({
        queryKey: ['account-claim-nfts', address, network, claimCollectionAddresses.sort().join(',')],
        queryFn: async () => {
            const results: Record<string, Record<string, unknown>[]> = {};
            for (const resAddr of claimCollectionAddresses) {
                results[resAddr] = await apiFetchNonFungibleData(resAddr, claimCollections[resAddr], network);
            }
            return results;
        },
        enabled: claimCollectionAddresses.length > 0,
        staleTime: Infinity,
    });

    if (isLoadingValidators || (claimCollectionAddresses.length > 0 && isLoadingClaims)) {
        return <PanelLoadingState tt={tt} />;
    }

    // Staking Aggregation
    const stakingMap = new Map<string, {
        validatorName: string;
        validatorIcon: string;
        validatorAddress: string;
        xrdInStake: number;
        xrdInUnstake: number;
        xrdInClaim: number;
    }>();

    const getStakingEntry = (vAddr: string) => {
        if (!stakingMap.has(vAddr)) {
            const val = validatorsData?.validators.find(v => v.address === vAddr);
            stakingMap.set(vAddr, {
                validatorName: val?.name || 'Unknown Validator',
                validatorIcon: val?.iconUrl || '',
                validatorAddress: vAddr,
                xrdInStake: 0,
                xrdInUnstake: 0,
                xrdInClaim: 0
            });
        }
        return stakingMap.get(vAddr)!;
    };

    lsuTokens.forEach(lsu => {
        if (!lsu.validatorAddress) return;
        const entry = getStakingEntry(lsu.validatorAddress);
        const val = validatorsData?.validators.find(v => v.address === lsu.validatorAddress);
        const lsuFactor = val?.lsu2xrdFactor || 1;
        entry.xrdInStake += parseFloat(lsu.amount) * lsuFactor;
    });

    if (claimsData) {
        Object.entries(claimsData).forEach(([resAddr, items]) => {
            const nftEntity = nonFungibles.find((n: { resource_address: string }) => n.resource_address === resAddr);
            const valAddr = extractMetadata(nftEntity?.explicit_metadata?.items || [], 'validator') ||
                validatorsData?.validators.find((v: { claimTokenResourceAddress?: string; address: string }) => v.claimTokenResourceAddress === resAddr)?.address;

            if (valAddr) {
                const entry = getStakingEntry(valAddr);
                items.forEach((item: Record<string, unknown>) => {
                    const data = item.data as { programmatic_json?: { fields?: { field_name: string; value: string }[] } } | undefined;
                    const fields = data?.programmatic_json?.fields;
                    const amt = parseFloat(fields?.find(f => f.field_name === 'claim_amount')?.value || '0');
                    // Simplified: Add to unstake column. Distinguishing requires current epoch comparison.
                    entry.xrdInUnstake += amt;
                });
            }
        });
    }

    const stakingRows = Array.from(stakingMap.values()).sort((a, b) => b.xrdInStake - a.xrdInStake);
    const totalLsuAmount = lsuTokens.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
    const totalLsuXrdEquivalent = lsuTokens.reduce((acc, lsu) => {
        if (!lsu.validatorAddress) return acc;
        const val = validatorsData?.validators.find(v => v.address === lsu.validatorAddress);
        const lsuFactor = val?.lsu2xrdFactor || 1;
        return acc + (parseFloat(lsu.amount) * lsuFactor);
    }, 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-[var(--color-card-border)] shrink-0 bg-[var(--color-surface)]">
                    <SafeImage
                        src={iconUrl || ''}
                        alt={entityName || tt.account_summary?.account || 'Account'}
                        fallbackName={entityName || tt.account_summary?.account || 'Account'}
                        className="w-full h-full object-cover"
                    />
                </div>
                <div className="min-w-0">
                    <p className="font-bold text-base text-[var(--color-text-main)] truncate">
                        {entityName || tt.account_summary?.account || 'Account'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono text-[var(--color-text-muted)] truncate select-all">
                            {address}
                        </span>
                        <button
                            onClick={(e) => { e.stopPropagation(); onCopy(address); }}
                            className={`p-1 rounded transition-colors ${copiedAddress === address ? 'text-green-500' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                        >
                            {copiedAddress === address ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                    </div>
                </div>
            </div>

            {description && (
                <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed italic border-l-2 border-[var(--color-primary)]/30 pl-3">
                    {description}
                </p>
            )}

            {/* Principal Balance */}
            <div>
                <h4 className="text-xs font-black uppercase text-[var(--color-text-muted)] mb-3 tracking-wider">{tt.account_summary?.principal_balance || 'Principal Balance'}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <BalanceCard
                        title={tt.account_summary?.total_xrd || 'TOTAL XRD'}
                        amount={xrdAmount}
                        symbol="XRD"
                        valueColor="text-green-500 dark:text-green-400"
                        marketData={marketData}
                        locale={locale}
                    />
                    <BalanceCard
                        title={tt.account_summary?.total_lsu || 'TOTAL LSU'}
                        amount={String(totalLsuAmount)}
                        symbol="LSU"
                        valueColor="text-blue-500 dark:text-blue-400"
                        marketData={marketData}
                        locale={locale}
                        rawFiatAmount={totalLsuXrdEquivalent}
                    />
                    <BalanceCard
                        title={tt.account_summary?.stake_xrd || 'STAKE XRD'}
                        amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInStake, 0))}
                        symbol="XRD"
                        valueColor="text-[var(--color-text-main)]"
                        marketData={marketData}
                        locale={locale}
                    />
                    <BalanceCard
                        title={tt.account_summary?.unstake_xrd || 'UNSTAKE XRD'}
                        amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInUnstake, 0))}
                        symbol="XRD"
                        valueColor="text-orange-500"
                        marketData={marketData}
                        locale={locale}
                    />
                    <BalanceCard
                        title={tt.account_summary?.claim_xrd || 'CLAIM XRD'}
                        amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInClaim, 0))}
                        symbol="XRD"
                        valueColor="text-green-500"
                        marketData={marketData}
                        locale={locale}
                    />
                </div>
            </div>

            {/* Staking */}
            {stakingRows.length > 0 && (
                <div>
                    <h4 className="text-xs font-black uppercase text-[var(--color-text-muted)] mb-3 tracking-wider">{tt.account_summary?.staking || 'Staking'}</h4>
                    <div className="space-y-3">
                        {stakingRows.map((row) => (
                            <div key={row.validatorAddress} className="py-5 border-b border-[var(--color-card-border)] last:border-0">
                                <div className="flex items-start gap-3 mb-5">
                                    <SafeImage src={row.validatorIcon} alt={row.validatorName} fallbackName={row.validatorName} className="w-8 h-8 rounded-full bg-black/10 shrink-0 mt-0.5" />
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-sm text-[var(--color-text-main)] truncate leading-none mb-1">{row.validatorName}</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-mono text-[var(--color-text-muted)] break-all leading-relaxed whitespace-pre-wrap">{row.validatorAddress}</span>
                                            <button onClick={(e) => { e.stopPropagation(); onCopy(row.validatorAddress); }} className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] shrink-0 transition-all active:scale-95">
                                                {copiedAddress === row.validatorAddress ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                    <div className="flex flex-col items-center text-center">
                                        <span className="text-[9px] uppercase font-black text-[var(--color-text-muted)] tracking-widest mb-1">{tt.account_summary?.stake_xrd || 'Stake XRD'}</span>
                                        <span className="text-sm font-mono font-black text-[var(--color-text-main)]">{formatXRD(row.xrdInStake)} XRD</span>
                                    </div>
                                    <div className="flex flex-col items-center text-center">
                                        <span className="text-[9px] uppercase font-black text-[var(--color-text-muted)] tracking-widest mb-1">{tt.account_summary?.unstake_xrd || 'Unstake XRD'}</span>
                                        <span className="text-sm font-mono font-black text-orange-500">{row.xrdInUnstake > 0 ? formatXRD(row.xrdInUnstake) : '0'} XRD</span>
                                    </div>
                                    <div className="flex flex-col items-center text-center">
                                        <span className="text-[9px] uppercase font-black text-[var(--color-text-muted)] tracking-widest mb-1">{tt.account_summary?.claim_xrd || 'Claim XRD'}</span>
                                        <span className="text-sm font-mono font-black text-green-500">{row.xrdInClaim > 0 ? formatXRD(row.xrdInClaim) : '0'} XRD</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Assets */}
            <AssetSection title={`Tokens (${tokens.length})`} items={tokens} onCopy={onCopy} copiedAddress={copiedAddress} />
            <AssetSection title={`NFTs (${activeNfts.length})`} items={activeNfts} onCopy={onCopy} copiedAddress={copiedAddress} />
            <AssetSection title={`Pool Units (${poolUnits.length})`} items={poolUnits} onCopy={onCopy} copiedAddress={copiedAddress} />

            {burnedNfts.length > 0 && (
                <AssetSection
                    title={`NFTs Quemados (${burnedNfts.length})`}
                    items={burnedNfts}
                    onCopy={onCopy}
                    copiedAddress={copiedAddress}
                    burned
                    titleClassName="text-red-500/80"
                />
            )}
        </div>
    );
}

function BalanceCard({ title, amount, symbol, valueColor, marketData, locale, rawFiatAmount }: {
    title: string;
    amount: string;
    symbol: string;
    valueColor: string;
    marketData?: MarketData | null;
    locale: string;
    rawFiatAmount?: number;
}) {
    const currency = getCurrencyForLocale(locale);
    const price = currency === 'EUR' ? marketData?.priceEur : marketData?.priceUsd;
    const numAmount = rawFiatAmount !== undefined ? rawFiatAmount : parseFloat(amount);
    const fiatValue = price ? numAmount * price : null;

    // Apply exact formatting to the amount
    const parsedAmount = parseFloat(amount);
    const formattedAmount = parsedAmount >= 1000 ? formatNumber(parsedAmount, 2) : formatNumber(parsedAmount, 4);

    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-xl p-4 flex flex-col gap-1 w-full shadow-sm hover:shadow-md transition-shadow">
            {/* Row 1: Title (left) */}
            <div className="flex justify-start">
                <span className="text-[10px] uppercase font-black text-[var(--color-text-muted)] tracking-wider">
                    {title}
                </span>
            </div>

            {/* Row 2: Amount (right) */}
            <div className="flex justify-end items-baseline gap-1.5 min-w-0">
                <span className={`text-lg font-black font-mono tracking-tight ${valueColor} truncate`} title={amount}>
                    {formattedAmount}
                </span>
                <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase shrink-0">
                    {symbol}
                </span>
            </div>

            {/* Row 3: Fiat Value (right) */}
            <div className="flex justify-end min-w-0">
                <span className="text-xs font-bold text-[var(--color-text-muted)] truncate">
                    {fiatValue !== null ? formatCurrency(fiatValue, currency, locale) : '—'}
                </span>
            </div>
        </div>
    );
}

function AssetSection({ title, items, onCopy, copiedAddress, burned = false, titleClassName = "" }: {
    title: string;
    items: ParsedResource[];
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    burned?: boolean;
    titleClassName?: string;
}) {
    if (items.length === 0) return null;
    return (
        <div>
            <h4 className={`text-xs font-black uppercase text-[var(--color-text-muted)] mb-3 tracking-wider ${titleClassName}`}>
                {title}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {items.map((item) => (
                    <ResourceCard key={item.address} item={item} onCopy={onCopy} copiedAddress={copiedAddress} burned={burned} />
                ))}
            </div>
        </div>
    );
}

function ResourceCard({ item, onCopy, copiedAddress, burned = false }: {
    item: ParsedResource;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    burned?: boolean;
}) {
    const { address, name, symbol, iconUrl, amount, isNft } = item;

    return (
        <div className={`flex flex-col bg-[var(--color-surface)] border ${burned ? 'border-red-500/20 opacity-70' : 'border-[var(--color-card-border)]'} rounded-xl p-3 hover:border-[var(--color-primary)] transition-colors h-full`}>
            <div className="flex items-center gap-2 mb-2 min-w-0">
                <div className="w-6 h-6 rounded-full shrink-0 overflow-hidden bg-[var(--color-card-border)] flex items-center justify-center">
                    {iconUrl ? (
                        <SafeImage src={iconUrl} alt={name} fallbackName={symbol || name} className={`w-full h-full object-cover ${burned ? 'grayscale' : ''}`} />
                    ) : (
                        <Info className="w-3 h-3 text-[var(--color-text-muted)]" />
                    )}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-bold text-xs text-[var(--color-text-main)] truncate" title={name}>{name}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] font-mono font-bold text-[var(--color-text-main)]">
                            {isNft ? parseInt(amount, 10) : (parseFloat(amount) >= 1000 ? formatNumber(parseFloat(amount), 2) : formatNumber(parseFloat(amount), 4))}
                        </span>
                        {symbol && <span className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider truncate">{symbol}</span>}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between mt-auto pt-2 border-t border-[var(--color-card-border)]">
                <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono text-[var(--color-text-muted)]">{truncateAddress(address, 4, 4)}</span>
                    <button
                        onClick={(e) => { e.stopPropagation(); onCopy(address); }}
                        className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                    >
                        {copiedAddress === address ? <Check className="w-2.5 h-2.5 text-green-500" /> : <Copy className="w-2.5 h-2.5" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
