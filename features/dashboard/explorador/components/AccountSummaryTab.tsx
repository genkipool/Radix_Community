
'use client';

import React, { useState } from 'react';
import { Copy, Check, Info, Download, Landmark } from 'lucide-react';
import { AccountRewardsCsvModal } from './AccountRewardsCsvModal';
import { usePrefetchRewards } from '@/features/dashboard/hooks/usePrefetchRewards';
import { SafeImage } from '@/components/ui/SafeImage';
import { AccountValidatorStakeAction } from './AccountValidatorStakeAction';
import { PanelLoadingState } from './EntityPanelShared';
import { formatNumber, truncateAddress } from '@/utils/formatters';
import type { GatewayEntityDetails, TranslationsT, MarketData } from '@/features/dashboard/types';
import { getCurrencyForLocale, formatCurrency } from '../../../../utils/currencyUtils';
import { type AccountRewardsCsvModalDict } from '../types/components.types';
import { useAccountStats } from '../hooks/useAccountStats';

interface AccountSummaryTabProps {
    address: string;
    entityData: GatewayEntityDetails | null;
    entityName: string | null | undefined;
    iconUrl: string | null | undefined;
    getMeta: (key: string) => string;
    tt?: Partial<TranslationsT['dashboard']['transactions']> & { account_summary?: AccountRewardsCsvModalDict };
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    network: 'mainnet' | 'stokenet';
    marketData?: MarketData | null;
    locale: string;
    isModal?: boolean;
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
    locale,
    isBadge = false,
    isModal = false
}: AccountSummaryTabProps & { isBadge?: boolean }) {
    const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
    const { prefetchAccountRewards } = usePrefetchRewards();

    const description = getMeta('description');
    const {
        isLoading,
        xrdAmount,
        tokens,
        lsuTokens,
        activeNfts,
        burnedNfts,
        poolUnits,
        stakingRows,
        totalLsuAmount,
        totalLsuXrdEquivalent,
    } = useAccountStats(address, network, entityData);

    if (isLoading) {
        return <PanelLoadingState tt={tt} />;
    }

    return (
        <div className="space-y-6">
            {/* Header: Name + Icon */}
            <div className="flex items-center gap-3">
                {iconUrl && (
                    <div className="size-10 rounded-xl overflow-hidden border border-[var(--color-card-border)] shrink-0 bg-[var(--color-surface)]">
                        <SafeImage
                            src={iconUrl}
                            alt={entityName || address}
                            fallbackName={entityName || address}
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}
                <div className="min-w-0">
                    <p className="font-bold text-sm text-[var(--color-text-main)] truncate">
                        {entityName || tt?.account_summary?.account || 'Account'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono text-[var(--color-text-muted)] truncate select-all">
                            {address}
                        </span>
                        {address.startsWith('account_') && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setIsCsvModalOpen(true); }}
                                onPointerEnter={() => prefetchAccountRewards(address)}
                                className="p-1 rounded transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                                title={tt?.account_summary?.download_rewards_tooltip || 'Download Rewards'}
                            >
                                <Download className="size-3" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onCopy(address); }}
                            className={`p-1 rounded transition-colors ${copiedAddress === address ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                        >
                            {copiedAddress === address ? <Check className="size-3" /> : <Copy className="size-3" />}
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
                <h4 className={`text-xs font-black uppercase text-[var(--color-text-muted)] tracking-wider mb-3 ${isModal ? 'pb-2 border-b border-[var(--color-border)]' : ''}`}>{isModal ? 'Balance' : (tt?.account_summary?.principal_balance || 'Principal Balance')}</h4>
                {!isBadge ? (
                    isModal ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3 items-stretch">
                                <BalanceCard
                                    title={tt?.account_summary?.total_xrd || 'TOTAL XRD'}
                                    amount={xrdAmount}
                                    symbol="XRD"
                                    valueColor="text-[var(--color-accent)]"
                                    marketData={marketData}
                                    locale={locale}
                                    rawFiatAmount={Number(xrdAmount) || 0}
                                    isModal={isModal}
                                    align="left"
                                />
                                <BalanceCard
                                    title={tt?.account_summary?.total_lsu || 'TOTAL LSU'}
                                    amount={String(totalLsuAmount)}
                                    symbol="LSU"
                                    valueColor="text-blue-500 dark:text-blue-400"
                                    marketData={marketData}
                                    locale={locale}
                                    rawFiatAmount={totalLsuXrdEquivalent}
                                    isModal={isModal}
                                    align="right"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-3 items-stretch">
                                <BalanceCard
                                    title={tt?.account_summary?.stake_xrd || 'STAKE XRD'}
                                    amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInStake, 0))}
                                    symbol="XRD"
                                    valueColor="text-[var(--color-text-main)]"
                                    marketData={marketData}
                                    locale={locale}
                                    rawFiatAmount={stakingRows.reduce((acc, row) => acc + row.xrdInStake, 0)}
                                    isModal={isModal}
                                    align="left"
                                />
                                <BalanceCard
                                    title={tt?.account_summary?.unstake_xrd || 'UNSTAKE XRD'}
                                    amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInUnstake, 0))}
                                    symbol="XRD"
                                    valueColor="text-orange-500"
                                    marketData={marketData}
                                    locale={locale}
                                    rawFiatAmount={stakingRows.reduce((acc, row) => acc + row.xrdInUnstake, 0)}
                                    isModal={isModal}
                                    align="center"
                                />
                                <BalanceCard
                                    title={tt?.account_summary?.claim_xrd || 'CLAIM XRD'}
                                    amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInClaim, 0))}
                                    symbol="XRD"
                                    valueColor="text-[var(--color-accent)]"
                                    marketData={marketData}
                                    locale={locale}
                                    rawFiatAmount={stakingRows.reduce((acc, row) => acc + row.xrdInClaim, 0)}
                                    isModal={isModal}
                                    align="right"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-stretch">
                            <BalanceCard
                                title={tt?.account_summary?.total_xrd || 'TOTAL XRD'}
                                amount={xrdAmount}
                                symbol="XRD"
                                valueColor="text-[var(--color-accent)]"
                                marketData={marketData}
                                locale={locale}
                                rawFiatAmount={Number(xrdAmount) || 0}
                                isModal={isModal}
                            />
                            <BalanceCard
                                title={tt?.account_summary?.total_lsu || 'TOTAL LSU'}
                                amount={String(totalLsuAmount)}
                                symbol="LSU"
                                valueColor="text-blue-500 dark:text-blue-400"
                                marketData={marketData}
                                locale={locale}
                                rawFiatAmount={totalLsuXrdEquivalent}
                                isModal={isModal}
                            />
                            <BalanceCard
                                title={tt?.account_summary?.stake_xrd || 'STAKE XRD'}
                                amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInStake, 0))}
                                symbol="XRD"
                                valueColor="text-[var(--color-text-main)]"
                                marketData={marketData}
                                locale={locale}
                                rawFiatAmount={stakingRows.reduce((acc, row) => acc + row.xrdInStake, 0)}
                                isModal={isModal}
                            />
                            <BalanceCard
                                title={tt?.account_summary?.unstake_xrd || 'UNSTAKE XRD'}
                                amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInUnstake, 0))}
                                symbol="XRD"
                                valueColor="text-orange-500"
                                marketData={marketData}
                                locale={locale}
                                rawFiatAmount={stakingRows.reduce((acc, row) => acc + row.xrdInUnstake, 0)}
                                isModal={isModal}
                            />
                            <BalanceCard
                                title={tt?.account_summary?.claim_xrd || 'CLAIM XRD'}
                                amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInClaim, 0))}
                                symbol="XRD"
                                valueColor="text-[var(--color-accent)]"
                                marketData={marketData}
                                locale={locale}
                                rawFiatAmount={stakingRows.reduce((acc, row) => acc + row.xrdInClaim, 0)}
                                isModal={isModal}
                            />
                        </div>
                    )
                ) : (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
                            <BalanceCard
                                title={tt?.account_summary?.total_xrd || 'TOTAL XRD'}
                                amount={xrdAmount}
                                symbol="XRD"
                                valueColor="text-[var(--color-accent)]"
                                marketData={marketData}
                                locale={locale}
                            />
                            <BalanceCard
                                title={tt?.account_summary?.total_lsu || 'TOTAL LSU'}
                                amount={String(totalLsuAmount)}
                                symbol="LSU"
                                valueColor="text-blue-500 dark:text-blue-400"
                                marketData={marketData}
                                locale={locale}
                                rawFiatAmount={totalLsuXrdEquivalent}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
                            <BalanceCard
                                title={tt?.account_summary?.stake_xrd || 'STAKE XRD'}
                                amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInStake, 0))}
                                symbol="XRD"
                                valueColor="text-[var(--color-text-main)]"
                                marketData={marketData}
                                locale={locale}
                            />
                            <BalanceCard
                                title={tt?.account_summary?.unstake_xrd || 'UNSTAKE XRD'}
                                amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInUnstake, 0))}
                                symbol="XRD"
                                valueColor="text-orange-500"
                                marketData={marketData}
                                locale={locale}
                            />
                            <BalanceCard
                                title={tt?.account_summary?.claim_xrd || 'CLAIM XRD'}
                                amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInClaim, 0))}
                                symbol="XRD"
                                valueColor="text-[var(--color-accent)]"
                                marketData={marketData}
                                locale={locale}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Staking Section */}
            {stakingRows.length > 0 && (
                <div className="mb-8">
                    <h4 className={`text-xs font-black uppercase text-[var(--color-text-muted)] tracking-wider ${isModal ? 'pb-2 mb-4 border-b border-[var(--color-card-border)] w-full' : 'mb-4'}`}>
                        {tt?.account_summary?.staking_validators_title || 'STAKING'} ({stakingRows.length})
                    </h4>
                    <div className="space-y-4">
                        {stakingRows.map((row) => (
                            <div key={row.validatorAddress} className={isModal ? "flex flex-col gap-4 py-2" : "flex flex-col gap-4 p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-card-border)] hover:border-[var(--color-primary)]/30 transition-all shadow-sm"}>
                                {/* Validator Header */}
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-full shrink-0 overflow-hidden bg-[var(--color-card-border)] flex items-center justify-center shadow-inner">
                                        {row.validatorIcon ? (
                                            <SafeImage src={row.validatorIcon} alt={row.validatorName || 'Validator'} fallbackName={row.validatorName || 'Validator'} className="w-full h-full object-cover" />
                                        ) : (
                                            <Landmark className="size-5 text-[var(--color-text-muted)]" />
                                        )}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-black text-sm text-[var(--color-text-main)] truncate">{row.validatorName || 'Unknown Validator'}</span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs font-mono text-[var(--color-text-muted)] truncate select-all">{row.validatorAddress}</span>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); onCopy(row.validatorAddress); }}
                                                className={`p-1 rounded transition-colors ${copiedAddress === row.validatorAddress ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                            >
                                                {copiedAddress === row.validatorAddress ? <Check className="size-3" /> : <Copy className="size-3" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Staking Grid */}
                                <div className="grid grid-cols-3 gap-4 py-2 border-t border-[var(--color-card-border)]/50">
                                    <div className="flex flex-col items-center text-center">
                                        <span className="text-[10px] uppercase font-black text-[var(--color-text-muted)] tracking-widest mb-1">{tt?.account_summary?.stake_xrd || 'STAKE XRD'}</span>
                                        <span className="text-sm font-mono font-black text-[var(--color-text-main)]">{formatNumber(row.xrdInStake, 2, locale)} XRD</span>
                                    </div>
                                    <div className="flex flex-col items-center text-center">
                                        <span className="text-[10px] uppercase font-black text-[var(--color-text-muted)] tracking-widest mb-1">{tt?.account_summary?.unstake_xrd || 'UNSTAKE XRD'}</span>
                                        <span className="text-sm font-mono font-black text-orange-500">{formatNumber(row.xrdInUnstake, 2, locale)} XRD</span>
                                    </div>
                                    <div className="flex flex-col items-center text-center">
                                        <span className="text-[10px] uppercase font-black text-[var(--color-text-muted)] tracking-widest mb-1">{tt?.account_summary?.claim_xrd || 'CLAIM XRD'}</span>
                                        <span className="text-sm font-mono font-black text-[var(--color-accent)]">{formatNumber(row.xrdInClaim, 2, locale)} XRD</span>
                                    </div>
                                </div>

                                {/* Interactive Staking Actions */}
                                {isModal && (
                                    <AccountValidatorStakeAction
                                        accountAddress={address}
                                        validatorAddress={row.validatorAddress}
                                        network={network}
                                        entityData={entityData}
                                        xrdBalance={parseFloat(xrdAmount)}
                                        stakedXrd={row.xrdInStake}
                                        claimableXrd={row.xrdInClaim}
                                        lsuBalance={lsuTokens.find(t => t.validatorAddress === row.validatorAddress)?.amount ? parseFloat(lsuTokens.find(t => t.validatorAddress === row.validatorAddress)!.amount) : 0}
                                        t={tt}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}


            {/* Assets */}
            <AssetSection title={`Tokens (${tokens.length})`} items={tokens} onCopy={onCopy} copiedAddress={copiedAddress} locale={locale} isModal={isModal} />
            <AssetSection title={`NFTs (${activeNfts.length})`} items={activeNfts} onCopy={onCopy} copiedAddress={copiedAddress} locale={locale} isModal={isModal} />

            {burnedNfts.length > 0 && (
                <AssetSection
                    title={`${tt?.account_summary?.burned_nfts || 'NFTs Quemados'} (${burnedNfts.length})`}
                    items={burnedNfts}
                    onCopy={onCopy}
                    copiedAddress={copiedAddress}
                    burned
                    titleClassName="text-red-500/80"
                    locale={locale}
                    isModal={isModal}
                />
            )}
            <AssetSection title={`${tt?.account_summary?.pool_units || 'Pool Units'} (${poolUnits.length})`} items={poolUnits} onCopy={onCopy} copiedAddress={copiedAddress} locale={locale} isModal={isModal} />

            {/* Account Rewards CSV Modal */}
            {isCsvModalOpen && (
                <AccountRewardsCsvModal
                    accountAddress={address}
                    isOpen={isCsvModalOpen}
                    onClose={() => setIsCsvModalOpen(false)}
                    locale={locale}
                    tt={tt?.account_summary}
                    marketData={marketData}
                />
            )}
        </div>
    );
}

function BalanceCard({ title, amount, symbol, valueColor, marketData, locale, rawFiatAmount, isModal = false, align = 'left' }: {
    title: string;
    amount: string;
    symbol: string;
    valueColor: string;
    marketData?: MarketData | null;
    locale: string;
    rawFiatAmount?: number;
    isModal?: boolean;
    align?: 'left' | 'center' | 'right';
}) {
    const currency = getCurrencyForLocale(locale);
    const price = currency === 'EUR' ? marketData?.priceEur : marketData?.priceUsd;
    const numAmount = rawFiatAmount !== undefined ? rawFiatAmount : parseFloat(amount);
    const fiatValue = price ? numAmount * price : null;

    // Apply exact formatting to the amount
    const parsedAmount = parseFloat(amount);
    const formattedAmount = parsedAmount >= 1000 ? formatNumber(parsedAmount, 2, locale) : formatNumber(parsedAmount, 4, locale);

    if (isModal) {
        const alignClass = align === 'right' ? 'items-end text-right' : align === 'center' ? 'items-center text-center' : 'items-start text-left';

        return (
            <div className={`flex flex-col gap-0.5 w-full py-2 ${alignClass}`}>
                <span className="text-[10px] uppercase font-black text-[var(--color-text-muted)] tracking-wider mb-0.5">
                    {title}
                </span>
                <div className="flex items-baseline gap-1.5 min-w-0">
                    <span className={`text-2xl font-black font-mono tracking-tight ${valueColor} truncate`} title={amount}>
                        {formattedAmount}
                    </span>
                    <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase shrink-0">
                        {symbol}
                    </span>
                </div>
                {fiatValue !== null && fiatValue > 0 && (
                    <span className="text-[11px] font-bold text-[var(--color-text-muted)]/70 truncate">
                        {formatCurrency(fiatValue, currency, locale)}
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-xl p-4 flex flex-col gap-1 w-full shadow-sm hover:shadow-md transition-shadow h-full">
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
            {fiatValue !== null && fiatValue > 0 ? (
                <div className="flex justify-end min-w-0">
                    <span className="text-xs font-bold text-[var(--color-text-muted)] truncate">
                        {formatCurrency(fiatValue, currency, locale)}
                    </span>
                </div>
            ) : (
                <div className="flex justify-end min-w-0 h-[18px]"></div>
            )}
        </div>
    );
}

function AssetSection({ title, items, onCopy, copiedAddress, burned = false, titleClassName = "", locale, isModal = false }: {
    title: string;
    items: ParsedResource[];
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    burned?: boolean;
    titleClassName?: string;
    locale: string;
    isModal?: boolean;
}) {
    if (items.length === 0) return null;
    return (
        <div>
            <h4 className={`text-xs font-black uppercase text-[var(--color-text-muted)] tracking-wider ${titleClassName} ${isModal ? 'pb-2 mb-4 border-b border-[var(--color-card-border)] w-full' : 'mb-3'}`}>
                {title}
            </h4>
            <div className={isModal ? "grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar items-stretch" : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar items-stretch"}>
                {items.map((item) => (
                    <ResourceCard key={item.address} item={item} onCopy={onCopy} copiedAddress={copiedAddress} burned={burned} locale={locale} isModal={isModal} />
                ))}
            </div>
        </div>
    );
}

function ResourceCard({ item, onCopy, copiedAddress, burned = false, locale, isModal = false }: {
    item: ParsedResource;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    burned?: boolean;
    locale: string;
    isModal?: boolean;
}) {
    const { address, name, symbol, iconUrl, amount, isNft } = item;

    return (
        <div className={isModal ? `flex flex-col h-full py-1 ${burned ? 'opacity-70' : ''}` : `flex flex-col bg-[var(--color-surface)] border ${burned ? 'border-red-500/20 opacity-70' : 'border-[var(--color-card-border)]'} rounded-xl p-3 hover:border-[var(--color-primary)] transition-colors h-full`}>
            <div className="flex items-center gap-2 mb-2 min-w-0">
                <div className="size-6 rounded-full shrink-0 overflow-hidden bg-[var(--color-card-border)] flex items-center justify-center">
                    {iconUrl ? (
                        <SafeImage src={iconUrl} alt={name} fallbackName={symbol || name} className={`w-full h-full object-cover ${burned ? 'grayscale' : ''}`} />
                    ) : (
                        <Info className="size-3 text-[var(--color-text-muted)]" />
                    )}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-bold text-xs text-[var(--color-text-main)] truncate" title={name}>{name}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] font-mono font-bold text-[var(--color-text-main)]">
                            {isNft ? formatNumber(parseInt(amount, 10), 0, locale) : (parseFloat(amount) >= 1000 ? formatNumber(parseFloat(amount), 2, locale) : formatNumber(parseFloat(amount), 4, locale))}
                        </span>
                        {symbol && <span className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider truncate">{symbol}</span>}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between mt-auto pt-2 border-t border-[var(--color-card-border)]">
                <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono text-[var(--color-text-muted)]">{truncateAddress(address, 13, 12)}</span>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onCopy(address); }}
                        className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                    >
                        {copiedAddress === address ? <Check className="size-2.5 text-[var(--color-accent)]" /> : <Copy className="size-2.5" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
