'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Landmark, Download } from 'lucide-react';
import { formatNumber } from '@/utils/formatters';
import { getCurrencyForLocale, formatCurrency } from '@/utils/currencyUtils';

/* Dashboard & Common Components */
import { Card } from '@/components/ui/Card';
import { CloseButton } from '@/components/ui/CloseButton';
import { CopyButton } from '@/components/ui/CopyButton';
import { AccountRewardsCsvModal } from './AccountRewardsCsvModal';
import { AccountTokensTab, AccountNftsTab, AccountPoolUnitsTab } from './AccountAssetsTabs';
import { AccountTransactionsTab } from './AccountTransactionsTab';
import { apiFetchEntityDetails, apiFetchTransactions } from '@/features/dashboard/services/apiClient';
import { entityKeys } from '@/features/dashboard/utils/entityCache';
import { usePrefetchRewards } from '@/features/dashboard/hooks/usePrefetchRewards';
import { useValidatorsQuery } from '@/features/dashboard/staking/hooks/useValidatorsQuery';
import { useAccountStats } from '../hooks/useAccountStats';

import {
    PanelTabBar,
    PanelMetadataTab,
    PanelConfigurationTab,
    PanelRawTab,
    getConfigEntries
} from './EntityPanelShared';
import { AccountSummaryTab } from './AccountSummaryTab';
import { getMetaValue } from '../utils/metadataUtils';

/* Types */
import type { AccountCardProps } from '../types/components.types';
import type { MetadataItem } from '@/features/dashboard/types';

type EntityTab = 'summary' | 'tokens' | 'nfts' | 'pool_units' | 'transactions' | 'metadata' | 'configuration' | 'raw';
export function AccountCard({
    address,
    columns,
    isExpanded,
    onExpand,
    onCopy,
    copiedAddress,
    t,
    network,
    locale,
    marketData,
    readingMode: _readingMode,
    isModal
}: AccountCardProps) {
    const tt = t?.dashboard?.transactions;
    const accT = tt?.account_summary;

    const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<EntityTab>('summary');

    // Layout logic matching TransactionCard
    // AccountCard has a fixed layout regardless of grid columns
    const isVertical = false;

    const { data: entityData } = useQuery({
        queryKey: entityKeys.detail(address, network),
        queryFn: () => apiFetchEntityDetails(address, network as 'mainnet' | 'stokenet'),
        enabled: true, // Always fetch for the card
        staleTime: Infinity,
        gcTime: 10 * 60_000,
    });

    const {
        isLoading: statsLoading,
        xrdAmount,
        totalLsuAmount,
        totalLsuXrdEquivalent,
        stakedTotal,
        unstakeTotal,
        claimTotal,
    } = useAccountStats(address, network as 'mainnet' | 'stokenet', entityData || null);

    const { prefetchAccountRewards } = usePrefetchRewards();
    const { data: validatorsData } = useValidatorsQuery(network);

    const isCopied = copiedAddress === address;

    const renderFiatValue = (amount: number) => {
        if (!marketData || statsLoading) return null;
        const currency = getCurrencyForLocale(locale);
        const price = currency === 'EUR' ? marketData.priceEur : marketData.priceUsd;
        return (
            <span className="text-[10px] text-[var(--color-text-muted)] font-mono whitespace-nowrap">
                ({formatCurrency(amount * price, currency, locale)})
            </span>
        );
    };

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        onCopy(address);
    };

    const handleDownloadClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsCsvModalOpen(true);
    };

    const handleDownloadMouseEnter = () => {
        if (!validatorsData) return;
        prefetchAccountRewards(address);
    };

    const queryClient = useQueryClient();
    const handleTransactionsMouseEnter = () => {
        queryClient.prefetchInfiniteQuery({
            queryKey: ['account-transactions', address, network],
            queryFn: async ({ pageParam }) =>
                apiFetchTransactions({
                    cursor: pageParam as string | undefined,
                    limit: 15,
                    address: address,
                    network: network as 'mainnet' | 'stokenet'
                }),
            initialPageParam: undefined as string | undefined,
        });
    };

    // Expandable Tabs Data Processing
    const metadataItems: MetadataItem[] = entityData?.metadata?.items ?? [];
    const getMeta = (key: string) => getMetaValue(metadataItems, key) ?? '';
    const entityName = getMeta('name');
    const iconUrl = getMeta('icon_url');

    // Construct Tabs
    const tabsData: { key: EntityTab; label: string; tooltip?: string }[] = [
        { key: 'summary', label: tt?.resource_panel_summary || 'Resumen', tooltip: tt?.tab_summary_tooltip },
        { key: 'tokens', label: accT?.tokens_tab || 'Tokens', tooltip: tt?.tab_tokens_tooltip },
        { key: 'nfts', label: accT?.nfts_tab || 'NFTs', tooltip: tt?.tab_nfts_tooltip },
        { key: 'pool_units', label: accT?.pool_units || 'Pool Units', tooltip: tt?.tab_pool_units_tooltip },
        { key: 'transactions', label: accT?.transactions_tab || 'Transactions', tooltip: tt?.tab_transactions_tooltip },
        { key: 'metadata', label: tt?.resource_panel_metadata || 'Metadatos', tooltip: tt?.tab_metadata_tooltip },
        { key: 'configuration', label: tt?.resource_panel_configuration || 'Configuración', tooltip: tt?.tab_configuration_tooltip },
        { key: 'raw', label: tt?.resource_panel_raw || 'Raw', tooltip: tt?.tab_raw_tooltip }
    ];

    const ra = (entityData?.details as Record<string, unknown>)?.role_assignments;
    const configEntries = getConfigEntries(ra, tt);

    return (
        <>
            <Card
                onClick={(!isModal && onExpand) ? () => onExpand(address) : undefined}
                className={`p-0 shadow-md transition-all duration-300 group ${(!isModal && onExpand) ? 'cursor-pointer' : 'cursor-default'} overflow-hidden col-span-full border border-[var(--color-accent)]/30 ${isModal ? 'bg-[var(--color-bg)]' : 'bg-[var(--color-surface)]'} ${isExpanded ? 'ring-2 ring-[var(--color-primary)]' : 'hover:shadow-lg'}`}
            >
                <div className={`flex ${isVertical ? 'flex-col' : 'flex-col sm:flex-row'}`}>
                    {/* ── AVATAR / SIDEBAR (Matching TransactionCard) ── */}
                    <div onClick={() => undefined}
                        className={`${isVertical ? 'w-full p-3' : 'w-full sm:w-[140px] p-4 sm:p-6 border-r'} shrink-0 border-b sm:border-b-0 border-[var(--color-card-border)] bg-[var(--color-surface)] flex flex-row ${isVertical ? 'justify-between' : 'sm:flex-col'} items-center gap-3 text-center relative overflow-hidden cursor-pointer self-stretch justify-center`}>
                        <div className="absolute top-0 inset-x-0 h-1/2 opacity-10" style={{ background: `radial-gradient(circle at top, var(--color-accent), transparent)` }} />
                        <div className="relative z-10 p-3 sm:p-4 rounded-2xl border-2 shadow-lg bg-[var(--color-bg)] transition-all duration-300 flex items-center justify-center border-[var(--color-accent)]" style={{ boxShadow: `0 0 15px var(--color-accent)30` }}>
                            <Landmark className="w-8 h-8" style={{ color: 'var(--color-accent)' }} />
                        </div>
                    </div>

                    {/* ── MAIN CONTENT ── */}
                    <div className="flex-1 flex flex-col min-w-0">
                        <div className={`${isVertical ? 'p-3 pt-4' : 'p-5'} flex-1 min-w-0`}>
                            {/* Header: Address + Download Button */}
                            <div className={`flex items-start justify-between gap-4 mb-3 sm:flex-nowrap`}>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <div className="flex items-center gap-2 overflow-hidden shrink min-w-0 pr-2">
                                        <h3 className={`${isVertical ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'} font-mono font-black text-[var(--color-text-main)] group-hover:text-[var(--color-secondary)] transition-colors truncate flex items-center gap-1.5 sm:gap-2 mr-2`}
                                            title={address}>
                                            <span className="truncate">{address}</span>
                                        </h3>
                                        <CopyButton
                                            value={address}
                                            variant="card-inline"
                                            size="sm"
                                            forceCopied={isCopied}
                                            onClick={handleCopy}
                                            className="shrink-0"
                                        />
                                    </div>
                                </div>
                                <div className="shrink-0 flex items-center mt-1 sm:mt-0 gap-3">
                                    <button
                                        onClick={handleDownloadClick}
                                        onMouseEnter={handleDownloadMouseEnter}
                                        className="inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider leading-none align-middle box-border border backdrop-blur-md transition-all duration-300 h-[22px] bg-[var(--color-surface)] border-[var(--color-card-border)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/40 gap-1.5"
                                        title={accT?.download_rewards_tooltip}
                                    >
                                        <Download className="w-3 h-3" />
                                        <span className="mt-[0.5px]">CSV</span>
                                    </button>

                                    {isModal && onExpand && (
                                        <CloseButton
                                            onClose={() => onExpand(address)}
                                            title={t?.dashboard?.reading?.close || 'Cerrar'}
                                            iconSize={20}
                                            className="shrink-0 ml-1"
                                        />
                                    )}

                                </div>
                            </div>

                            {/* Stats Rows - 5 grid items corresponding to main balance */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4 text-sm mt-3 items-center">
                                <div>
                                    <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold truncate flex items-center gap-1">
                                        {accT?.total_xrd || 'TOTAL XRD'}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-green-500 font-mono">
                                            {statsLoading ? '-' : formatNumber(parseFloat(xrdAmount), 2, locale)}
                                        </span>
                                        {renderFiatValue(parseFloat(xrdAmount))}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold truncate flex items-center gap-1">
                                        {accT?.total_lsu || 'TOTAL LSU'}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-blue-500 font-mono">
                                            {statsLoading ? '-' : formatNumber(totalLsuAmount, 2, locale)}
                                        </span>
                                        {renderFiatValue(totalLsuXrdEquivalent)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold truncate flex items-center gap-1">
                                        {accT?.stake_xrd || 'STAKE XRD'}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-[var(--color-text-main)] font-mono">
                                            {statsLoading ? '-' : formatNumber(stakedTotal, 2, locale)}
                                        </span>
                                        {renderFiatValue(stakedTotal)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold truncate flex items-center gap-1">
                                        {accT?.unstake_xrd || 'UNSTAKE XRD'}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-orange-500 font-mono">
                                            {statsLoading ? '-' : formatNumber(unstakeTotal, 2, locale)}
                                        </span>
                                        {renderFiatValue(unstakeTotal)}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold truncate flex items-center gap-1">
                                        {accT?.claim_xrd || 'CLAIM XRD'}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-green-500 font-mono">
                                            {statsLoading ? '-' : formatNumber(claimTotal, 2, locale)}
                                        </span>
                                        {renderFiatValue(claimTotal)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <AnimatePresence initial={false}>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="overflow-hidden bg-[var(--color-bg)] w-full border-t border-[var(--color-card-border)]"
                        >
                            <div onClick={(e) => e.stopPropagation()} className="cursor-auto w-full">
                                <PanelTabBar 
                                    tabs={tabsData} 
                                    activeTab={activeTab} 
                                    onTabChange={(t) => setActiveTab(t as EntityTab)} 
                                    onTabHover={(t) => {
                                        if (t === 'transactions') {
                                            handleTransactionsMouseEnter();
                                        }
                                    }}
                                    layoutId="accountCardTabs"
                                />

                                <div className="px-4 py-3 pb-6">
                                    {/* CSS Grid Wrapper injecting logic specifically for Token/NFT tabs */}
                                    <div className={`account-assets-grid-wrapper 
                                        ${columns === 1 ? 'is-grid-1' : 'is-grid-multi'} 
                                        ${isExpanded ? 'is-expanded-card' : ''}
                                    `}>
                                        <style dangerouslySetInnerHTML={{
                                            __html: `
                                            .is-expanded-card .account-assets-grid-wrapper > div > div.flex.flex-col.gap-2 {
                                                display: grid !important;
                                                grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
                                                gap: 0.75rem !important;
                                            }
                                            .is-grid-1:not(.is-expanded-card) .account-assets-grid-wrapper > div > div.flex.flex-col.gap-2 {
                                                display: grid !important;
                                                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                                                gap: 0.75rem !important;
                                            }
                                            .is-grid-multi:not(.is-expanded-card) .account-assets-grid-wrapper > div > div.flex.flex-col.gap-2 {
                                                display: grid !important;
                                                grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
                                                gap: 0.75rem !important;
                                            }
                                            @media (max-width: 1280px) {
                                                .account-assets-grid-wrapper > div > div.flex.flex-col.gap-2 {
                                                    grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                                                }
                                            }
                                            @media (max-width: 640px) {
                                                    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                                                }
                                            }
                                        `}} />

                                        {/* ── SUMMARY ── */}
                                        {activeTab === 'summary' && (
                                            <AccountSummaryTab
                                                address={address}
                                                entityData={entityData ?? null}
                                                entityName={entityName}
                                                iconUrl={iconUrl}
                                                getMeta={getMeta}
                                                tt={tt}
                                                onCopy={onCopy}
                                                copiedAddress={copiedAddress}
                                                network={network as 'mainnet' | 'stokenet'}
                                                marketData={marketData}
                                                locale={locale}
                                            />
                                        )}

                                        {/* ── TOKENS ── */}
                                        {activeTab === 'tokens' && (
                                            <AccountTokensTab
                                                entityData={entityData ?? null}
                                                tt={tt}
                                                onCopy={onCopy}
                                                copiedAddress={copiedAddress}
                                                network={network as 'mainnet' | 'stokenet'}
                                                locale={locale}
                                            />
                                        )}

                                        {/* ── NFTS ── */}
                                        {activeTab === 'nfts' && (
                                            <AccountNftsTab
                                                entityData={entityData ?? null}
                                                tt={tt}
                                                onCopy={onCopy}
                                                copiedAddress={copiedAddress}
                                                network={network as 'mainnet' | 'stokenet'}
                                                locale={locale}
                                            />
                                        )}

                                        {/* ── POOL UNITS ── */}
                                        {activeTab === 'pool_units' && (
                                            <AccountPoolUnitsTab
                                                entityData={entityData ?? null}
                                                tt={tt}
                                                onCopy={onCopy}
                                                copiedAddress={copiedAddress}
                                                network={network as 'mainnet' | 'stokenet'}
                                                locale={locale}
                                            />
                                        )}

                                        {/* ── TRANSACTIONS ── */}
                                        {activeTab === 'transactions' && (
                                            <AccountTransactionsTab
                                                accountAddress={address}
                                                network={network as 'mainnet' | 'stokenet'}
                                                tt={tt}
                                                locale={locale}
                                            />
                                        )}

                                        {/* ── METADATA ── */}
                                        {activeTab === 'metadata' && (
                                            <PanelMetadataTab metadataItems={metadataItems} tt={tt} />
                                        )}

                                        {/* ── CONFIGURATION ── */}
                                        {activeTab === 'configuration' && (
                                            <PanelConfigurationTab
                                                configEntries={configEntries}
                                                tt={tt}
                                                onCopy={onCopy}
                                                copiedAddress={copiedAddress}
                                            />
                                        )}

                                        {/* ── RAW ── */}
                                        {activeTab === 'raw' && (
                                            <PanelRawTab 
                                                data={entityData} 
                                                tt={tt} 
                                                onCopy={onCopy} 
                                                copiedAddress={copiedAddress} 
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Card>

            <AccountRewardsCsvModal
                isOpen={isCsvModalOpen}
                onClose={() => setIsCsvModalOpen(false)}
                accountAddress={address}
                tt={accT}
                locale={locale}
                marketData={marketData}
            />
        </>
    );
}
