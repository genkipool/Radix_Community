/* eslint-disable @next/next/no-img-element */
'use client';
import { parseTags, deriveBehaviors, getConfigEntries } from '../../utils/resourceUtils';
import React, { useState } from 'react';
import { Check, Copy, ChevronDown, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { entityKeys } from '@/features/dashboard/hooks/useEntityData';
import { Pill } from '@/components/ui/Pill';
import { TokenBadge } from '@/components/ui/TokenBadge';
import { getMetaValue } from '../utils/metadataUtils';
import {
    PanelTabBar,
    PanelLoadingState,
    PanelMetadataTab,
    PanelConfigurationTab,
    PanelRawTab,
} from './EntityPanelShared';



import { BalanceChangeRowProps, ResourceInlinePanelProps } from '../types';
import type { TranslationsT, MetadataItem, GatewayEntityDetails } from '@/features/dashboard/types';

/* ═══════ Resource Inline Panel ═══════ */
const RESOURCE_TABS = ['summary', 'metadata', 'configuration', 'raw'] as const;
type ResourceTab = typeof RESOURCE_TABS[number];

function ResourceInlinePanel({ address, details, loading, onCopy, copiedAddress, tt, locale }: ResourceInlinePanelProps) {
    const [activeTab, setActiveTab] = useState<ResourceTab>('summary');

    const metadataItems = details?.metadata?.items || [];
    const name = getMetaValue(metadataItems, 'name') || 'Unknown Entity';
    const symbol = getMetaValue(metadataItems, 'symbol') || '';
    const description = getMetaValue(metadataItems, 'description');
    const iconUrl = getMetaValue(metadataItems, 'icon_url');
    const tagList = parseTags(metadataItems.find((m: MetadataItem) => m.key === 'tags') || null);
    const divisibility = details?.details?.divisibility;
    const totalSupply = details?.details?.total_supply;
    const totalMinted = details?.details?.total_minted;
    const totalBurned = details?.details?.total_burned;
    const resourceType = details?.details?.type;
    const ra = details?.details?.role_assignments;
    const behaviors = deriveBehaviors(ra, tt);
    const configEntries = getConfigEntries(ra, tt);
    const fmt = (v: string | number) => parseFloat(String(v)).toLocaleString(locale);

    const tabs = RESOURCE_TABS.map(key => ({
        key,
        label: tt[`resource_panel_${key}`] || key.charAt(0).toUpperCase() + key.slice(1),
    }));

    return (
        <div
            className="border border-t-0 border-[var(--color-card-border)] rounded-b-xl overflow-hidden bg-[var(--color-surface)]"
            onClick={e => e.stopPropagation()}
        >
            <PanelTabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
            <div className="px-5 py-4">
                {loading ? (
                    <PanelLoadingState tt={tt} />
                ) : !details ? (
                    <p className="text-xs text-[var(--color-text-muted)] py-3">Failed to load.</p>
                ) : (
                    <>
                        {activeTab === 'summary' && (
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    {iconUrl
                                        ? <img src={iconUrl} alt={name} className="w-9 h-9 rounded-full shrink-0 object-cover border border-[var(--color-card-border)]" onError={e => { e.currentTarget.style.display = 'none'; }} />
                                        : <div className="w-9 h-9 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center font-bold text-xs border border-[var(--color-primary)]/20 shrink-0">{(symbol || name).slice(0, 2).toUpperCase()}</div>
                                    }
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-sm text-[var(--color-text-main)] truncate">{name}</span>
                                            {symbol && <TokenBadge className="shrink-0">{symbol}</TokenBadge>}
                                        </div>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <span className="text-[10px] font-mono text-[var(--color-text-muted)] truncate max-w-[160px]" title={address}>{address.slice(0, 14)}...{address.slice(-6)}</span>
                                            <button onClick={e => { e.stopPropagation(); onCopy(address); }} className={`p-0.5 rounded transition-colors ${copiedAddress === address ? 'text-green-600' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}>
                                                {copiedAddress === address ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                                            </button>
                                            <a href={`https://dashboard.radixdlt.com/resource/${address}`} target="_blank" rel="noopener noreferrer" className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors" onClick={e => e.stopPropagation()}><ExternalLink className="w-2.5 h-2.5" /></a>
                                        </div>
                                    </div>
                                </div>
                                {description && <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-4 italic border-l-2 border-[var(--color-primary)]/30 pl-3">{description}</p>}
                                <div className="border-t border-[var(--color-card-border)] mb-4" />
                                <dl className="space-y-3">
                                    {resourceType && <div className="flex items-center justify-between gap-4"><dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{tt.resource_panel_type || 'Type'}</dt><dd className="text-xs font-semibold text-[var(--color-text-main)]">{resourceType}</dd></div>}
                                    {divisibility !== undefined && divisibility !== null && <div className="flex items-center justify-between gap-4"><dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{tt.resource_panel_divisibility || 'Divisibility'}</dt><dd className="text-xs font-semibold text-[var(--color-text-main)] font-mono">{divisibility}</dd></div>}
                                    {totalSupply && <div className="flex items-center justify-between gap-4"><dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{tt.resource_panel_total_supply || 'Total Supply'}</dt><dd className="text-xs font-semibold text-[var(--color-text-main)] font-mono">{fmt(totalSupply)}{symbol ? ` ${symbol}` : ''}</dd></div>}
                                    {totalMinted && <div className="flex items-center justify-between gap-4"><dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{tt.resource_panel_total_minted || 'Total Minted'}</dt><dd className="text-xs font-semibold text-green-600 font-mono">+{fmt(totalMinted)}{symbol ? ` ${symbol}` : ''}</dd></div>}
                                    {totalBurned && parseFloat(String(totalBurned)) > 0 && <div className="flex items-center justify-between gap-4"><dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{tt.resource_panel_total_burned || 'Total Burned'}</dt><dd className="text-xs font-semibold text-red-400 font-mono">−{fmt(totalBurned)}{symbol ? ` ${symbol}` : ''}</dd></div>}
                                    {tagList.length > 0 && (
                                        <div className="flex items-start justify-between gap-4">
                                            <dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0 pt-0.5">{tt.resource_panel_tags || 'Tags'}</dt>
                                            <dd className="flex items-center gap-1.5 flex-wrap justify-end">
                                                {tagList.map((tag: string, i: number) => <Pill key={i}>{tag}</Pill>)}
                                            </dd>
                                        </div>
                                    )}
                                </dl>
                                {behaviors.length > 0 && (
                                    <>
                                        <div className="border-t border-[var(--color-card-border)] mt-4 mb-3" />
                                        <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] mb-2">{tt.resource_panel_behavior || 'Behavior'}</p>
                                        <ul className="space-y-1.5">
                                            {behaviors.map((b, i) => <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-text-muted)]"><span className="w-1 h-1 rounded-full bg-[var(--color-primary)]/60 mt-1.5 shrink-0" />{b}</li>)}
                                        </ul>
                                    </>
                                )}
                            </div>
                        )}
                        {activeTab === 'metadata' && <PanelMetadataTab metadataItems={metadataItems} tt={tt} />}
                        {activeTab === 'configuration' && <PanelConfigurationTab configEntries={configEntries} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} />}
                        {activeTab === 'raw' && <PanelRawTab data={details} />}
                    </>
                )}
            </div>
        </div>
    );
}

/* ═══════ BALANCE CHANGE ROW ═══════ */
const BalanceChangeRow = ({
    change, t, tt: ttProp, onResourceClick: _onResourceClick, onCopy, copiedAddress, readingMode: _readingMode, network = 'mainnet', side: _side, locale,
    iconOverride, colorOverride, hideSign,
}: BalanceChangeRowProps) => {
    const tt = ttProp ?? (t?.dashboard?.transactions ?? {}) as TranslationsT['dashboard']['transactions'];
    const [expanded, setExpanded] = useState(false);

    const { data: metadata, isLoading } = useQuery({
        queryKey: entityKeys.full(change.resource_address, network),
        queryFn: () => apiFetchEntityDetails(change.resource_address, network as 'mainnet' | 'stokenet'),
        staleTime: Infinity, gcTime: 1000 * 60 * 10, retry: 2, retryOnMount: true,
    });

    const isPositive = parseFloat(change.balance_change || '0') > 0;
    const isNegative = parseFloat(change.balance_change || '0') < 0;
    const color = colorOverride ?? (isPositive ? 'text-green-600' : isNegative ? 'text-red-500 dark:text-red-400' : 'text-[var(--color-text-main)]');
    const sign = hideSign ? '' : isPositive ? '+' : '';

    const metaItems: MetadataItem[] = (metadata as GatewayEntityDetails | null)?.metadata?.items ?? [];
    const rawName = getMetaValue(metaItems, 'name');
    const rawSymbol = getMetaValue(metaItems, 'symbol');
    const iconUrl = getMetaValue(metaItems, 'icon_url');
    const isFee = change.is_fee;

    const name = rawName
        || (metadata && !isLoading ? `${change.resource_address.slice(0, 10)}...${change.resource_address.slice(-6)}` : '...');
    const symbol = rawSymbol
        || (rawName && /liquid.?stake|lsu/i.test(rawName) ? 'LSU' : '');

    let titleStr = '';
    const feeTitle = t?.dashboard?.transactions?.fee_deduction_title || 'Fee deduction of {amount} {token} from account {account}';
    const sentTitle = t?.dashboard?.transactions?.sent_title || 'Account {account} sent {amount} {token}';
    const receivedTitle = t?.dashboard?.transactions?.received_title || 'Account {account} received {amount} {token}';

    if (isFee) {
        titleStr = feeTitle
            .replace('{amount}', change.balance_change.replace('-', ''))
            .replace('{token}', symbol || name)
            .replace('{account}', change.entity_address);
    } else {
        titleStr = isNegative
            ? sentTitle.replace('{account}', change.entity_address).replace('{amount}', change.balance_change.replace('-', '')).replace('{token}', symbol || name)
            : receivedTitle.replace('{account}', change.entity_address).replace('{amount}', change.balance_change).replace('{token}', symbol || name);
    }

    const handleCardClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFee) return;
        if (window.getSelection()?.toString()) return;
        setExpanded(prev => !prev);
    };

    const isRoyalty = change.type === 'RoyaltyDistributed';

    return (
        <div className="mb-2">
            <div
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-[var(--color-surface)] border border-[var(--color-card-border)] group transition-all hover:bg-[var(--color-surface-hover)] gap-3 ${!isFee ? 'cursor-pointer' : ''} ${!isFee && expanded ? 'rounded-t-xl border-b-transparent' : 'rounded-xl'}`}
                title={titleStr} onClick={handleCardClick}
            >
                <div className="flex items-center gap-3 min-w-0">
                    {iconUrl
                        ? <img src={iconUrl} alt={symbol || name} className="w-10 h-10 rounded-full bg-white/10 shadow-sm border border-[var(--color-card-border)] shrink-0" onError={e => { e.currentTarget.style.display = 'none'; }} />
                        : <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center font-bold text-sm shadow-inner border border-[var(--color-primary)]/30 shrink-0">{(symbol || name).slice(0, 2).toUpperCase()}</div>
                    }
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0 flex-nowrap">
                            <div className={`font-bold text-sm sm:text-base text-[var(--color-text-main)] ${!isFee ? 'group-hover:text-[var(--color-primary)]' : ''} transition-colors truncate min-w-0`}>{name}</div>
                            {symbol && <TokenBadge className="shrink-0">{symbol}</TokenBadge>}
                            {!isFee && <ChevronDown className={`w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform duration-200 shrink-0 ${expanded ? 'rotate-180 text-[var(--color-primary)]' : ''}`} />}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                            <div className="text-[10px] text-[var(--color-text-muted)] font-mono truncate max-w-[150px] sm:max-w-[200px]" title={change.resource_address}>{change.resource_address.slice(0, 12)}...{change.resource_address.slice(-6)}</div>
                            <button onClick={e => { e.stopPropagation(); onCopy(change.resource_address); }} className={`p-1 rounded-md transition-colors ${copiedAddress === change.resource_address ? 'text-green-600' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-white/5'}`} title="Copy Address">
                                {copiedAddress === change.resource_address ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                        </div>
                    </div>
                </div>
                <div className={`font-mono font-bold lg:text-lg ${color} shrink-0 text-right flex flex-col justify-end`}>
                    <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-black mb-0.5 opacity-70">
                        {isRoyalty ? 'Royalties' : isFee ? (tt?.fee_label || 'Fees') : (tt?.amount_label || 'Amount')}
                    </div>
                    <div className="flex items-baseline gap-1.5 justify-end">
                        {iconOverride && <span className="shrink-0">{iconOverride}</span>}
                        <span>
                            {sign}
                            {(hideSign ? Math.abs(parseFloat(change.balance_change)) : parseFloat(change.balance_change))
                                .toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 18 })}
                        </span>
                        {isRoyalty && <span className="text-[10px] text-green-600 font-black ml-1">100%</span>}
                        {symbol && <span className="text-xs font-semibold opacity-70">{symbol}</span>}
                    </div>
                </div>
            </div>
            <AnimatePresence>
                {!isFee && expanded && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                        <ResourceInlinePanel address={change.resource_address} details={metadata || null} loading={isLoading} onCopy={onCopy} copiedAddress={copiedAddress} tt={tt} locale={locale} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export { BalanceChangeRow };
