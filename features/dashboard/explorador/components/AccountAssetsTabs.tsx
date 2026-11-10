'use client';


import React, { useState } from 'react';
import { truncateAddress } from '@/utils/formatters';
import { ResourceInlinePanel } from '@/features/dashboard/explorador/components/ResourceInlinePanel';
import { NftCollectionPanel } from './NftCollectionPanel';
import { AssetListSection, AssetRowCard } from './AssetRowCard';
import { entityKeys } from '@/features/dashboard/hooks/useEntityData';
import { useQuery } from '@tanstack/react-query';
import { apiFetchAccountNftHistory, apiFetchEntityDetails, apiFetchNonFungibleData } from '@/features/dashboard/services/apiClient';
import type { GatewayEntityDetails, TranslationsT, MetadataItem } from '@/features/dashboard/types';
import { useAccountStats } from '../hooks/useAccountStats';
import type { ParsedResource as SharedParsedResource } from '../types/models.types';
import { useTokenPrices, type TokenFiatPrice } from '@/features/dashboard/hooks/useTokenPrices';
import { formatFiatPrecise } from '@/utils/currencyUtils';
import { TokenFiatValue, totalFiatValue } from './TokenFiatValue';

/** A holding as the account tabs draw it: the shared parse plus its raw Gateway data. */
type ParsedResource = SharedParsedResource & {
    rawResourceData?: unknown;
    metadataItems?: MetadataItem[];
};
export function AccountTokensTab({
    address: _address,
    entityData,
    tt,
    onCopy,
    copiedAddress,
    network = 'mainnet',
    locale,
    showPrices = true,
}: {
    address: string;
    entityData: GatewayEntityDetails | null;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    network?: 'mainnet' | 'stokenet';
    locale?: string;
    /** Today's fiat value of each token; off for a past state, which today's prices do not describe. */
    showPrices?: boolean;
}) {
    const { tokens } = useAccountStats(_address, network, entityData);
    const loc = locale || 'en-US';
    const { priceOf, currency, ready } = useTokenPrices(network, loc, showPrices);
    const priced = showPrices && ready;
    const total = priced ? totalFiatValue(tokens, priceOf) : 0;
    const accT = tt?.account_summary;

    return (
        <div className="space-y-6">
            <AssetSection
                title={`${tt?.account_summary?.tokens_tab || 'Tokens'} (${tokens.length})`}
                items={tokens}
                onCopy={onCopy}
                copiedAddress={copiedAddress}
                tt={tt}
                network={network}
                locale={locale}
                priceOf={priced ? priceOf : undefined}
                aside={total > 0 ? (
                    <span className="text-xs font-black font-mono text-[var(--color-text-main)] whitespace-nowrap" title={accT?.token_prices_note}>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mr-1.5">{accT?.tokens_value ?? 'Value'}</span>
                        {formatFiatPrecise(total, currency, loc)}
                    </span>
                ) : undefined}
                footer={total > 0 && accT?.token_prices_note ? <p className="mt-2 text-[10px] text-[var(--color-text-muted)]">{accT.token_prices_note}</p> : undefined}
            />
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
    locale,
    pastState = false,
}: {
    address: string;
    entityData: GatewayEntityDetails | null;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    network?: 'mainnet' | 'stokenet';
    locale?: string;
    /** A past state: the pool's tokens of today would not describe it. */
    pastState?: boolean;
}) {
    const { poolUnits } = useAccountStats(_address, network, entityData);

    return (
        <div className="space-y-6">
            <AssetSection title={`${tt?.account_summary?.pool_units || 'Pool Units'} (${poolUnits.length})`} items={poolUnits} holder={_address} onCopy={onCopy} copiedAddress={copiedAddress} tt={tt} network={network} locale={locale} pastState={pastState} />
            {poolUnits.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)] italic text-center py-6">{tt?.account_summary?.no_pool_units || 'No pool units in this account.'}</p>
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
            <AssetSection title={`${tt?.account_summary?.nfts_tab || 'NFTs'} (${activeNfts.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)})`} items={activeNfts} onCopy={onCopy} copiedAddress={copiedAddress} tt={tt} network={network} locale={locale} />
            <AssetSection title={`${tt?.account_summary?.burned_nfts || 'Burned, sent or deposited NFTs'} (${burnedNfts.length})`} items={burnedNfts} holder={_address} onCopy={onCopy} copiedAddress={copiedAddress} burned tt={tt} network={network} locale={locale} />
            {activeNfts.length === 0 && burnedNfts.length === 0 && (
                <p className="text-xs text-[var(--color-text-muted)] italic text-center py-6">No NFTs found.</p>
            )}
        </div>
    );
}

function AssetSection({ title, items, holder, onCopy, copiedAddress, burned = false, tt, network = 'mainnet', locale, priceOf, aside, footer, pastState = false }: {
    title: string;
    pastState?: boolean;
    /** Each token's fiat price, when its value is shown. */
    priceOf?: (resource: string) => TokenFiatPrice | null;
    aside?: React.ReactNode;
    footer?: React.ReactNode;
    items: ParsedResource[];
    /** The account holding them, for what depends on who holds them (a pool position). */
    holder?: string;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    burned?: boolean;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    network?: 'mainnet' | 'stokenet';
    locale?: string;
}) {
    if (items.length === 0) return null;
    return (
        <AssetListSection title={title} burned={burned} aside={aside} footer={footer}>
            {items.map((item) => (
                <ExpandableResourceCard key={item.address} item={item} holder={holder} onCopy={onCopy} copiedAddress={copiedAddress} burned={burned} tt={tt} network={network} locale={locale} price={priceOf?.(item.address) ?? null} pastState={pastState} />
            ))}
        </AssetListSection>
    );
}

function ExpandableResourceCard({
    item,
    holder,
    onCopy,
    copiedAddress,
    burned = false,
    tt,
    network = 'mainnet',
    locale,
    price = null,
    pastState = false,
}: {
    price?: TokenFiatPrice | null;
    pastState?: boolean;
    item: ParsedResource;
    holder?: string;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    burned?: boolean;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    network?: 'mainnet' | 'stokenet';
    locale?: string;
}) {
    const { address, name, symbol, iconUrl, amount, isNft, ids } = item;
    const [expanded, setExpanded] = useState(false);

    const { data: entityData, isLoading: isLoadingEntity } = useQuery({
        queryKey: entityKeys.full(address, network),
        queryFn: () => apiFetchEntityDetails(address, network as 'mainnet' | 'stokenet'),
        enabled: expanded,
        staleTime: Infinity,
        gcTime: 10 * 60_000,
        retry: 1 });

    // A collection the account no longer holds has no ids in its vaults: the
    // ones it held come from its history, newest movement first.
    const formerHolder = burned && isNft && !ids?.length ? holder : undefined;
    const { data: formerIds, isLoading: isLoadingFormer } = useQuery({
        queryKey: ['account-nft-history', formerHolder, address, network],
        queryFn: () => apiFetchAccountNftHistory(formerHolder!, address, network as 'mainnet' | 'stokenet'),
        enabled: expanded && !!formerHolder,
        staleTime: 5 * 60_000,
        gcTime: 10 * 60_000,
        retry: 1 });
    const shownIds = ids?.length ? ids : formerIds ?? [];

    const idsKey = shownIds.toSorted().join(',');
    const { data: nftData = [], isLoading: isLoadingNft } = useQuery({
        queryKey: ['nft-data', address, idsKey, network],
        queryFn: () => apiFetchNonFungibleData(address, shownIds, network as 'mainnet' | 'stokenet'),
        enabled: expanded && isNft && shownIds.length > 0,
        staleTime: Infinity,
        gcTime: 10 * 60_000,
        retry: 1 });

    return (
        <AssetRowCard
            address={address}
            name={name}
            symbol={symbol}
            iconUrl={iconUrl}
            amountText={parseFloat(amount).toLocaleString(locale || 'en-US')}
            amountExtra={price && !isNft ? (
                <TokenFiatValue price={price} amount={amount} symbol={symbol || name} locale={locale || 'en-US'} priceLabel={tt?.account_summary?.token_price} />
            ) : (item.isClaim || item.isOwnerBadge) && (
                <div className="flex items-center gap-1.5 justify-end">
                    {(item.validatorName || item.validatorAddress) && (
                        <span className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[100px]" title={item.validatorName || item.validatorAddress}>
                            {item.validatorName || truncateAddress(item.validatorAddress || '', 4, 4)}
                        </span>
                    )}
                    {item.isClaim && item.claimXrdTotal !== undefined && item.claimXrdTotal > 0 && (
                        <span className="text-[10px] font-mono font-bold text-[var(--color-accent)]">
                            ~{item.claimXrdTotal.toLocaleString(locale || 'en-US', { maximumFractionDigits: 4 })} XRD
                        </span>
                    )}
                </div>
            )}
            expanded={expanded}
            onToggle={() => setExpanded(v => !v)}
            onCopy={onCopy}
            copiedAddress={copiedAddress}
            burned={burned}
        >
            {isNft ? (
                <NftCollectionPanel
                    // Remounted once the former ids arrive, so it opens on them.
                    key={formerHolder ? `former-${shownIds.length}` : 'held'}
                    resourceAddress={address}
                    meta={entityData}
                    nftData={nftData as Record<string, unknown>[]}
                    nftLoading={isLoadingNft || isLoadingEntity || (!!formerHolder && isLoadingFormer)}
                    ids={shownIds}
                    type={formerHolder ? 'removed' : 'neutral'}
                    itemsLabel={formerHolder ? tt?.nft_panel_items_former : undefined}
                    onCopy={onCopy}
                    copiedAddress={copiedAddress}
                    tt={tt}
                    network={network}
                    locale={locale || 'en-US'}
                    validatorAddress={item.validatorAddress}
                    validatorName={item.validatorName}
                    isClaim={item.isClaim}
                    claimXrdTotal={item.claimXrdTotal}
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
                    network={network}
                    holder={holder}
                    isPoolUnit={item.isPoolUnit}
                    userBalance={parseFloat(item.amount) || 0}
                    poolAddress={item.poolAddress}
                    pastState={pastState}
                />
            )}
        </AssetRowCard>
    );
}

