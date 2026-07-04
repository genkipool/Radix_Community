
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState } from 'react';
import { Copy, Check, Info, Download } from 'lucide-react';
import { AccountRewardsCsvModal } from './AccountRewardsCsvModal';
import { usePrefetchRewards } from '@/features/dashboard/hooks/usePrefetchRewards';
import { SafeImage } from '@/components/ui/SafeImage';
import { AccountStakingSection } from '@/features/dashboard/staking/components/AccountStakingSection';

import { formatNumber, truncateAddress } from '@/utils/formatters';
import type { GatewayEntityDetails, TranslationsT, MarketData } from '@/features/dashboard/types';
import { getCurrencyForLocale, formatCurrency } from '../../../../utils/currencyUtils';
import { type AccountRewardsCsvModalDict } from '../types/components.types';
import { useAccountStats } from '../hooks/useAccountStats';
import { useLanguage } from '@/context/LanguageContext';

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
    stakingErrors?: Record<string, string>;
    sendTransactionSection?: React.ReactNode;
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
    validatorName?: string;
    isClaim: boolean;
    ids?: string[];
    isNft: boolean;
    claimXrdTotal?: number;
    isOwnerBadge?: boolean;
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
    isModal = false,
    stakingErrors,
    sendTransactionSection,
}: AccountSummaryTabProps & { isBadge?: boolean }) {
    const [csvModalAddress, setCsvModalAddress] = useState<string | null>(null);
    const { prefetchAccountRewards } = usePrefetchRewards();
    const { t: contextT } = useLanguage();
    const accT = tt?.account_summary || contextT?.dashboard?.transactions?.account_summary;

    const [hideTransactionBuilder, setHideTransactionBuilder] = useState(false);

    const description = getMeta('description');
    const {
        xrdAmount,
        tokens,
        activeNfts,
        burnedNfts,
        poolUnits,
        stakingRows,
        totalLsuAmount,
        totalLsuXrdEquivalent,
    } = useAccountStats(address, network, entityData);

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
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-sm text-[var(--color-text-main)] truncate">
                            {entityName || accT?.account || 'Account'}
                        </p>
                        {isModal && sendTransactionSection && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setHideTransactionBuilder(!hideTransactionBuilder); }}
                                title={hideTransactionBuilder ? ((accT as any)?.show_transaction_tooltip || (locale === 'es' ? 'Mostrar sección para enviar transacciones' : 'Show transaction section')) : ((accT as any)?.hide_transaction_tooltip || (locale === 'es' ? 'Ocultar sección para enviar transacciones' : 'Hide transaction section'))}
                                className={`text-[10px] font-bold uppercase tracking-wider transition-opacity shrink-0 ${hideTransactionBuilder ? 'text-[var(--color-text-muted)] hover:opacity-70' : 'text-[var(--color-primary)]'}`}
                            >
                                {hideTransactionBuilder ? ((accT as any)?.show_transaction || (locale === 'es' ? 'Mostrar Transacción' : 'Show Transaction')) : ((accT as any)?.hide_transaction || (locale === 'es' ? 'Ocultar Transacción' : 'Hide Transaction'))}
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono text-[var(--color-text-muted)] truncate select-all">
                            {address}
                        </span>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onCopy(address); }}
                            className={`p-1 rounded transition-colors ${copiedAddress === address ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                        >
                            {copiedAddress === address ? <Check className="size-3" /> : <Copy className="size-3" />}
                        </button>
                        {address.startsWith('account_') && network === 'mainnet' && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setCsvModalAddress(address); }}
                                onPointerEnter={() => prefetchAccountRewards(address)}
                                className="p-1 rounded transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                                title={accT?.download_rewards_tooltip || 'Download Rewards'}
                            >
                                <Download className="size-3" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {!hideTransactionBuilder && sendTransactionSection}

            {description && (
                <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed italic border-l-2 border-[var(--color-primary)]/30 pl-3">
                    {description}
                </p>
            )}

            {/* Principal Balance */}
            <div>
                <h4 className={`text-xs font-black uppercase text-[var(--color-text-muted)] tracking-wider mb-3 ${isModal ? 'pb-2 border-b border-[var(--color-border)]' : ''}`}>{accT?.balance || 'Balance'}</h4>
                {!isBadge ? (
                    isModal ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3 items-stretch">
                                <BalanceCard
                                    title={accT?.total_xrd || 'TOTAL XRD'}
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
                                    title={accT?.total_lsu || 'TOTAL LSU'}
                                    amount={String(totalLsuAmount)}
                                    symbol="LSU"
                                    valueColor="text-[var(--color-secondary)]"
                                    marketData={marketData}
                                    locale={locale}
                                    rawFiatAmount={totalLsuXrdEquivalent}
                                    isModal={isModal}
                                    align="right"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-3 items-stretch">
                                <BalanceCard
                                    title={accT?.stake_xrd || 'STAKE XRD'}
                                    amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInStake, 0))}
                                    symbol="XRD"
                                    valueColor="text-[var(--color-primary)]"
                                    marketData={marketData}
                                    locale={locale}
                                    rawFiatAmount={stakingRows.reduce((acc, row) => acc + row.xrdInStake, 0)}
                                    isModal={isModal}
                                    align="left"
                                />
                                <BalanceCard
                                    title={accT?.unstake_xrd || 'UNSTAKE XRD'}
                                    amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInUnstake, 0))}
                                    symbol="XRD"
                                    valueColor="text-[var(--color-secondary)]"
                                    marketData={marketData}
                                    locale={locale}
                                    rawFiatAmount={stakingRows.reduce((acc, row) => acc + row.xrdInUnstake, 0)}
                                    isModal={isModal}
                                    align="center"
                                />
                                <BalanceCard
                                    title={accT?.claim_xrd || 'CLAIM XRD'}
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
                                title={accT?.total_xrd || 'TOTAL XRD'}
                                amount={xrdAmount}
                                symbol="XRD"
                                valueColor="text-[var(--color-accent)]"
                                marketData={marketData}
                                locale={locale}
                                rawFiatAmount={Number(xrdAmount) || 0}
                                isModal={isModal}
                            />
                            <BalanceCard
                                title={accT?.total_lsu || 'TOTAL LSU'}
                                amount={String(totalLsuAmount)}
                                symbol="LSU"
                                valueColor="text-[var(--color-secondary)]"
                                marketData={marketData}
                                locale={locale}
                                rawFiatAmount={totalLsuXrdEquivalent}
                                isModal={isModal}
                            />
                            <BalanceCard
                                title={accT?.stake_xrd || 'STAKE XRD'}
                                amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInStake, 0))}
                                symbol="XRD"
                                valueColor="text-[var(--color-primary)]"
                                marketData={marketData}
                                locale={locale}
                                rawFiatAmount={stakingRows.reduce((acc, row) => acc + row.xrdInStake, 0)}
                                isModal={isModal}
                            />
                            <BalanceCard
                                title={accT?.unstake_xrd || 'UNSTAKE XRD'}
                                amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInUnstake, 0))}
                                symbol="XRD"
                                valueColor="text-[var(--color-secondary)]"
                                marketData={marketData}
                                locale={locale}
                                rawFiatAmount={stakingRows.reduce((acc, row) => acc + row.xrdInUnstake, 0)}
                                isModal={isModal}
                            />
                            <BalanceCard
                                title={accT?.claim_xrd || 'CLAIM XRD'}
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
                                title={accT?.total_xrd || 'TOTAL XRD'}
                                amount={xrdAmount}
                                symbol="XRD"
                                valueColor="text-[var(--color-accent)]"
                                marketData={marketData}
                                locale={locale}
                            />
                            <BalanceCard
                                title={accT?.total_lsu || 'TOTAL LSU'}
                                amount={String(totalLsuAmount)}
                                symbol="LSU"
                                valueColor="text-[var(--color-secondary)]"
                                marketData={marketData}
                                locale={locale}
                                rawFiatAmount={totalLsuXrdEquivalent}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
                            <BalanceCard
                                title={accT?.stake_xrd || 'STAKE XRD'}
                                amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInStake, 0))}
                                symbol="XRD"
                                valueColor="text-[var(--color-primary)]"
                                marketData={marketData}
                                locale={locale}
                            />
                            <BalanceCard
                                title={accT?.unstake_xrd || 'UNSTAKE XRD'}
                                amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInUnstake, 0))}
                                symbol="XRD"
                                valueColor="text-[var(--color-secondary)]"
                                marketData={marketData}
                                locale={locale}
                            />
                            <BalanceCard
                                title={accT?.claim_xrd || 'CLAIM XRD'}
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
            <AccountStakingSection
                address={address}
                entityData={entityData}
                network={network}
                locale={locale}
                tt={tt}
                onCopy={onCopy}
                copiedAddress={copiedAddress}
                isModal={isModal}
                stakingErrors={stakingErrors}
                onOpenCsvModal={(addr) => setCsvModalAddress(addr)}
            />

            {/* Assets */}
            <AssetSection title={`Tokens (${tokens.length})`} items={tokens} onCopy={onCopy} copiedAddress={copiedAddress} locale={locale} isModal={isModal} />
            <AssetSection title={`NFTs (${activeNfts.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)})`} items={activeNfts} onCopy={onCopy} copiedAddress={copiedAddress} locale={locale} isModal={isModal} />

            {burnedNfts.length > 0 && (
                <AssetSection
                    title={`${accT?.burned_nfts || 'NFTs quemados, enviados o depositados'} (${burnedNfts.length})`}
                    items={burnedNfts}
                    onCopy={onCopy}
                    copiedAddress={copiedAddress}
                    burned
                    titleClassName="text-red-500/80"
                    locale={locale}
                    isModal={isModal}
                />
            )}
            <AssetSection title={`${accT?.pool_units || 'Pool Units'} (${poolUnits.length})`} items={poolUnits} onCopy={onCopy} copiedAddress={copiedAddress} locale={locale} isModal={isModal} />

            {/* Account Rewards CSV Modal */}
            {csvModalAddress && (
                <AccountRewardsCsvModal
                    accountAddress={csvModalAddress}
                    isOpen={!!csvModalAddress}
                    onClose={() => setCsvModalAddress(null)}
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
        
        // Dynamically reduce font size for large numbers to prevent grid overlap
        const amountLen = formattedAmount.length;
        const textSizeClass = amountLen > 12 ? 'text-sm' : amountLen > 8 ? 'text-base' : 'text-xl';

        return (
            <div className={`flex flex-col gap-0.5 w-full py-2 min-w-0 overflow-hidden ${alignClass}`}>
                <span className="text-[10px] uppercase font-black text-[var(--color-text-muted)] tracking-wider mb-0.5 truncate max-w-full">
                    {title}
                </span>
                <div className="flex items-baseline gap-1.5 min-w-0 max-w-full">
                    <span className={`${textSizeClass} font-black font-mono tracking-tight ${valueColor} truncate`} title={amount}>
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
            <div className={isModal ? "grid grid-cols-2 gap-3 items-stretch" : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar items-stretch"}>
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
                    <div className="flex flex-wrap items-center justify-between gap-1 mt-0.5 w-full">
                        <div className="flex items-center gap-1 min-w-0">
                            <span className="text-[10px] font-mono font-bold text-[var(--color-text-main)]">
                                {isNft ? formatNumber(parseInt(amount, 10), 0, locale) : (parseFloat(amount) >= 1000 ? formatNumber(parseFloat(amount), 2, locale) : formatNumber(parseFloat(amount), 4, locale))}
                            </span>
                            {symbol && <span className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider truncate shrink-0">{symbol}</span>}
                        </div>
                        {(item.isClaim || item.isOwnerBadge) && (
                            <div className="flex items-baseline gap-1.5 shrink-0">
                                {(item.validatorName || item.validatorAddress) && (
                                    <span className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[100px]" title={item.validatorName || item.validatorAddress}>
                                        {item.validatorName || truncateAddress(item.validatorAddress || '', 4, 4)}
                                    </span>
                                )}
                                {item.isClaim && item.claimXrdTotal !== undefined && item.claimXrdTotal > 0 && (
                                    <span className="text-[10px] font-mono font-bold text-[var(--color-accent)] whitespace-nowrap">
                                        ~{item.claimXrdTotal.toLocaleString(locale || 'en-US', { maximumFractionDigits: 4 })} XRD
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between mt-auto pt-2 border-t border-[var(--color-card-border)]">
                <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                    <span className="text-[9px] font-mono text-[var(--color-text-muted)] truncate">{truncateAddress(address, 13, 12)}</span>
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
