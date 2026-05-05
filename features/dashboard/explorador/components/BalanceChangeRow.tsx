'use client';
import { SafeImage } from '@/components/ui/SafeImage';
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
import type { MetadataItem, GatewayEntityDetails } from '@/features/dashboard/types';
import { getWellKnownKey, getGenericTooltipKey } from '../constants/wellKnownAddresses';
import { UnderlyingTokensTab } from './UnderlyingTokensTab';
import { ExpandableEntityBadge } from './ExpandableEntityBadge';

/* ═══════ Pool Address Resolution ═══════ */

/**
 * Extracts a pool or component address from the LP token's full entity details.
 * Checks metadata keys (pool, pool_address), details.state, and details.state.fields.
 */
function resolvePoolAddressFromEntity(entity: GatewayEntityDetails | null): string | undefined {
    if (!entity) return undefined;

    const meta = entity.metadata?.items ?? [];

    // 1. Check metadata keys: pool, pool_address
    for (const key of ['pool', 'pool_address']) {
        const item = meta.find((m: MetadataItem) => m.key === key);
        if (item?.value?.typed?.value) return item.value.typed.value;
    }

    // 2. Check dapp_definitions for pool_ or component_ addresses
    const dappDefs = meta.find((m: MetadataItem) => m.key === 'dapp_definitions');
    if (dappDefs?.value?.typed?.values) {
        const poolAddr = dappDefs.value.typed.values.find(
            (v: string) => v.startsWith('pool_')
        );
        if (poolAddr) return poolAddr;
        const compAddr = dappDefs.value.typed.values.find(
            (v: string) => v.startsWith('component_')
        );
        if (compAddr) return compAddr;
    }

    // 3. Single dapp_definition
    const dappDef = meta.find((m: MetadataItem) => m.key === 'dapp_definition');
    if (dappDef?.value?.typed?.value) return dappDef.value.typed.value;

    // 4. Check details.state for pool references (component entities)
    const state = entity.details?.state as Record<string, unknown> | undefined;
    if (state) {
        // Direct liquidity_pool or pool key
        for (const key of ['liquidity_pool', 'pool', 'pool_address']) {
            const val = state[key];
            if (typeof val === 'string' && (val.startsWith('pool_') || val.startsWith('component_'))) {
                return val;
            }
        }

        // Check state.fields array (Scrypto component state)
        const fields = state.fields as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(fields)) {
            for (const field of fields) {
                const fVal = field.value as string | undefined;
                if (typeof fVal === 'string' && (fVal.startsWith('pool_') || fVal.startsWith('component_'))) {
                    return fVal;
                }
                // Nested fields
                const nestedFields = field.fields as Array<Record<string, unknown>> | undefined;
                if (Array.isArray(nestedFields)) {
                    for (const nf of nestedFields) {
                        const nfVal = nf.value as string | undefined;
                        if (typeof nfVal === 'string' && (nfVal.startsWith('pool_') || nfVal.startsWith('component_'))) {
                            return nfVal;
                        }
                    }
                }
            }
        }
    }

    // 5. Extract from info_url
    const infoUrl = meta.find((m: MetadataItem) => m.key === 'info_url');
    const urlStr = infoUrl?.value?.typed?.value ?? infoUrl?.value?.typed?.url ?? '';
    const poolMatch = urlStr.match(/(pool_[a-z0-9]+)/i);
    if (poolMatch) return poolMatch[1];
    const compMatch = urlStr.match(/(component_[a-z0-9]+)/i);
    if (compMatch) return compMatch[1];

    return undefined;
}

/* ═══════ Resource Inline Panel ═══════ */
const BASE_RESOURCE_TABS = ['summary', 'metadata', 'configuration', 'raw'] as const;
type ResourceTab = 'summary' | 'contributed_tokens' | 'pool' | 'metadata' | 'configuration' | 'raw';

export function ResourceInlinePanel({ address, details, loading, onCopy, copiedAddress, tt, network, locale, isPoolUnit, userBalance, poolAddress }: ResourceInlinePanelProps) {
    const [activeTab, setActiveTab] = useState<ResourceTab>('summary');

    // Resolve tooltip for address
    const well_known = tt?.well_known_tooltips as Record<string, string> | undefined;
    const type_tooltips = tt?.type_tooltips as Record<string, string> | undefined;

    const wellKnownKey = getWellKnownKey(address, network || 'mainnet');
    const genericKey = getGenericTooltipKey(address);
    const wellKnownTip = wellKnownKey && well_known?.[wellKnownKey]
        ? well_known[wellKnownKey]
        : genericKey && type_tooltips?.[genericKey]
            ? type_tooltips[genericKey]
            : null;

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

    const accT = tt?.account_summary;

    // Resolve pool address: prefer prop, fallback to extraction from entity details
    const resolvedPoolAddress = poolAddress || resolvePoolAddressFromEntity(details);

    // Build tabs dynamically: insert 'contributed_tokens' and 'pool' after 'summary' for pool units
    const RESOURCE_TABS: ResourceTab[] = isPoolUnit && resolvedPoolAddress
        ? ['summary', 'contributed_tokens', 'pool', 'metadata', 'configuration', 'raw']
        : [...BASE_RESOURCE_TABS];

    const tabs = RESOURCE_TABS.map(key => ({
        key,
        label: key === 'contributed_tokens'
            ? (accT?.contributed_tokens || 'Contributed Tokens')
            : key === 'pool'
            ? (accT?.pool_tab || 'Pool')
            : (tt as Record<string, string | undefined>)?.[`resource_panel_${key}`] || (key.charAt(0).toUpperCase() + key.slice(1)),
        tooltip: key === 'contributed_tokens'
            ? tt?.tab_tokens_tooltip
            : key === 'pool'
            ? tt?.tab_pool_units_tooltip
            : (tt as Record<string, string | undefined>)?.[`tab_${key}_tooltip`],
    }));

    return (
        <div
            className="border border-t-0 border-[var(--color-card-border)] rounded-b-xl overflow-hidden bg-[var(--color-surface)]"
            onClick={e => e.stopPropagation()}
        >
            <PanelTabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} layoutId="resourceInlineTabs" />
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
                                        ? <SafeImage src={iconUrl} alt={name} fallbackName={symbol || name} className="w-9 h-9 rounded-full shrink-0 object-cover border border-[var(--color-card-border)]" />
                                        : <div className="w-9 h-9 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center font-bold text-xs border border-[var(--color-primary)]/20 shrink-0">{(symbol || name).slice(0, 2).toUpperCase()}</div>
                                    }
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-sm text-[var(--color-text-main)] truncate">{name}</span>
                                            {symbol && <TokenBadge className="shrink-0">{symbol}</TokenBadge>}
                                        </div>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <span className="text-[10px] font-mono text-[var(--color-text-muted)] truncate max-w-[160px]" title={wellKnownTip || address}>{address.slice(0, 14)}...{address.slice(-6)}</span>
                                            <button onClick={e => { e.stopPropagation(); onCopy(address); }} className={`p-0.5 rounded transition-colors ${copiedAddress === address ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}>
                                                {copiedAddress === address ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                                            </button>
                                            <a href={`https://dashboard.radixdlt.com/resource/${address}`} target="_blank" rel="noopener noreferrer" className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors" onClick={e => e.stopPropagation()}><ExternalLink className="w-2.5 h-2.5" /></a>
                                        </div>
                                    </div>
                                </div>
                                {description && <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-4 italic border-l-2 border-[var(--color-primary)]/30 pl-3">{description}</p>}
                                <div className="border-t border-[var(--color-card-border)] mb-4" />
                                <dl className="space-y-3">
                                    {isPoolUnit && resolvedPoolAddress && (
                                        <div className="flex items-center justify-between gap-4">
                                            <dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">
                                                {accT?.pool_address || 'Pool Address'}
                                            </dt>
                                            <dd className="text-xs font-semibold text-[var(--color-text-main)] font-mono flex items-center gap-2 select-all break-all">
                                                <span>{resolvedPoolAddress}</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onCopy(resolvedPoolAddress); }}
                                                    className={`p-0.5 rounded transition-colors ${copiedAddress === resolvedPoolAddress ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                                >
                                                    {copiedAddress === resolvedPoolAddress ? <Check className="w-2.5 h-2.5 text-[var(--color-accent)]" /> : <Copy className="w-2.5 h-2.5" />}
                                                </button>
                                            </dd>
                                        </div>
                                    )}
                                    {resourceType && <div className="flex items-center justify-between gap-4"><dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{tt?.resource_panel_type || 'Type'}</dt><dd className="text-xs font-semibold text-[var(--color-text-main)]">{resourceType}</dd></div>}
                                    {divisibility !== undefined && divisibility !== null && <div className="flex items-center justify-between gap-4"><dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{tt?.resource_panel_divisibility || 'Divisibility'}</dt><dd className="text-xs font-semibold text-[var(--color-text-main)] font-mono">{divisibility}</dd></div>}
                                    {totalSupply && <div className="flex items-center justify-between gap-4"><dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{tt?.resource_panel_total_supply || 'Total Supply'}</dt><dd className="text-xs font-semibold text-[var(--color-text-main)] font-mono">{fmt(totalSupply)}{symbol ? ` ${symbol}` : ''}</dd></div>}
                                    {totalMinted && <div className="flex items-center justify-between gap-4"><dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{tt?.resource_panel_total_minted || 'Total Minted'}</dt><dd className="text-xs font-semibold text-[var(--color-accent)] font-mono">+{fmt(totalMinted)}{symbol ? ` ${symbol}` : ''}</dd></div>}
                                    {totalBurned && parseFloat(String(totalBurned)) > 0 && <div className="flex items-center justify-between gap-4"><dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{tt?.resource_panel_total_burned || 'Total Burned'}</dt><dd className="text-xs font-semibold text-red-400 font-mono">−{fmt(totalBurned)}{symbol ? ` ${symbol}` : ''}</dd></div>}
                                    {tagList.length > 0 && (
                                        <div className="flex items-start justify-between gap-4">
                                            <dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0 pt-0.5">{tt?.resource_panel_tags || 'Tags'}</dt>
                                            <dd className="flex items-center gap-1.5 flex-wrap justify-end">
                                                {tagList.map((tag: string, i: number) => <Pill key={i}>{tag}</Pill>)}
                                            </dd>
                                        </div>
                                    )}
                                </dl>
                                {behaviors.length > 0 && (
                                    <>
                                        <div className="border-t border-[var(--color-card-border)] mt-4 mb-3" />
                                        <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] mb-2">{tt?.resource_panel_behavior || 'Behavior'}</p>
                                        <ul className="space-y-1.5">
                                            {behaviors.map((b, i) => <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-text-muted)]"><span className="w-1 h-1 rounded-full bg-[var(--color-primary)]/60 mt-1.5 shrink-0" />{b}</li>)}
                                        </ul>
                                    </>
                                )}
                            </div>
                        )}
                        {activeTab === 'metadata' && <PanelMetadataTab metadataItems={metadataItems} tt={tt} />}
                        {activeTab === 'contributed_tokens' && isPoolUnit && resolvedPoolAddress && totalSupply && (
                            <UnderlyingTokensTab
                                poolAddress={resolvedPoolAddress}
                                lpResourceAddress={address}
                                lpName={name}
                                userBalance={userBalance ?? 0}
                                lpTotalSupply={parseFloat(String(totalSupply)) || 0}
                                tt={tt}
                                onCopy={onCopy}
                                copiedAddress={copiedAddress}
                                network={address?.startsWith('tdx') ? 'stokenet' : 'mainnet'}
                                locale={locale}
                            />
                        )}
                        {activeTab === 'pool' && isPoolUnit && resolvedPoolAddress && (
                            <div className="space-y-4">
                                <ExpandableEntityBadge
                                    address={resolvedPoolAddress}
                                    tt={tt}
                                    onCopy={onCopy}
                                    copiedAddress={copiedAddress}
                                    network={network || 'mainnet'}
                                    locale={locale}
                                />
                            </div>
                        )}
                        {activeTab === 'configuration' && <PanelConfigurationTab configEntries={configEntries} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} />}
                        {activeTab === 'raw' && (
                            <PanelRawTab 
                                data={details} 
                                tt={tt} 
                                onCopy={onCopy} 
                                copiedAddress={copiedAddress} 
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

/* ═══════ BALANCE CHANGE ROW ═══════ */
const BalanceChangeRow = ({
    change, t, tt: ttProp, onResourceClick: _onResourceClick, onCopy, copiedAddress, readingMode: _readingMode, network = 'mainnet', side: _side, locale,
    iconOverride, colorOverride, hideSign, titleOverride,
}: BalanceChangeRowProps & { titleOverride?: string }) => {
    const tt = ttProp ?? t?.dashboard?.transactions;
    const [expanded, setExpanded] = useState(false);

    const { data: metadata, isLoading } = useQuery({
        queryKey: entityKeys.full(change.resource_address, network),
        queryFn: () => apiFetchEntityDetails(change.resource_address, network as 'mainnet' | 'stokenet'),
        staleTime: Infinity, gcTime: 1000 * 60 * 10, retry: 2, retryOnMount: true,
    });

    const isPositive = parseFloat(change.balance_change || '0') > 0;
    const isNegative = parseFloat(change.balance_change || '0') < 0;
    const color = colorOverride ?? (isPositive ? 'text-[var(--color-accent)]' : isNegative ? 'text-red-500 dark:text-red-400' : 'text-[var(--color-text-main)]');
    const sign = hideSign ? '' : isPositive ? '+' : '';

    const metaItems: MetadataItem[] = (metadata as GatewayEntityDetails | null)?.metadata?.items ?? [];
    const rawName = getMetaValue(metaItems, 'name');
    const rawSymbol = getMetaValue(metaItems, 'symbol');
    const iconUrl = getMetaValue(metaItems, 'icon_url');
    const isFee = change.is_fee;

    // Resolve tooltip for address
    const well_known = tt?.well_known_tooltips as Record<string, string> | undefined;
    const type_tooltips = tt?.type_tooltips as Record<string, string> | undefined;

    const wellKnownKey = getWellKnownKey(change.resource_address, network || 'mainnet');
    const genericKey = getGenericTooltipKey(change.resource_address);
    const wellKnownTip = wellKnownKey && well_known?.[wellKnownKey]
        ? well_known[wellKnownKey]
        : genericKey && type_tooltips?.[genericKey]
            ? type_tooltips[genericKey]
            : null;

    const name = rawName
        || (metadata && !isLoading ? `${change.resource_address.slice(0, 10)}...${change.resource_address.slice(-6)}` : '...');
    const symbol = rawSymbol
        || (rawName && /liquid.?stake|lsu/i.test(rawName) ? 'LSU' : '');

    let titleStr = '';
    const feeTitle = tt?.fee_deduction_title || 'Fee deduction of {amount} {token} from account {account}';
    const sentTitle = tt?.sent_title || 'Account {account} sent {amount} {token}';
    const receivedTitle = tt?.received_title || 'Account {account} received {amount} {token}';

    if (isFee) {
        titleStr = (feeTitle || 'Fee deduction of {amount} {token} from account {account}')
            .replace('{amount}', change.balance_change.replace('-', ''))
            .replace('{token}', symbol || name)
            .replace('{account}', change.entity_address);
    } else {
        titleStr = isNegative
            ? (sentTitle || 'Account {account} sent {amount} {token}').replace('{account}', change.entity_address).replace('{amount}', change.balance_change.replace('-', '')).replace('{token}', symbol || name)
            : (receivedTitle || 'Account {account} received {amount} {token}').replace('{account}', change.entity_address).replace('{amount}', change.balance_change).replace('{token}', symbol || name);
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
                title={titleOverride || titleStr} onClick={handleCardClick}
            >
                <div className="flex items-center gap-3 min-w-0">
                    {iconUrl
                        ? <SafeImage src={iconUrl} alt={symbol || name} fallbackName={symbol || name} className="w-10 h-10 rounded-full bg-white/10 shadow-sm border border-[var(--color-card-border)] shrink-0" />
                        : <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center font-bold text-sm shadow-inner border border-[var(--color-primary)]/30 shrink-0">{(symbol || name).slice(0, 2).toUpperCase()}</div>
                    }
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0 flex-nowrap">
                            <div className={`font-bold text-sm sm:text-base text-[var(--color-text-main)] ${!isFee ? 'group-hover:text-[var(--color-primary)]' : ''} transition-colors truncate min-w-0`}>{name}</div>
                            {symbol && <TokenBadge className="shrink-0">{symbol}</TokenBadge>}
                            {!isFee && <ChevronDown className={`w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform duration-200 shrink-0 ${expanded ? 'rotate-180 text-[var(--color-primary)]' : ''}`} />}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                            <div className="text-[10px] text-[var(--color-text-muted)] font-mono truncate max-w-[150px] sm:max-w-[200px]" title={wellKnownTip || change.resource_address}>{change.resource_address.slice(0, 12)}...{change.resource_address.slice(-6)}</div>
                            <button onClick={e => { e.stopPropagation(); onCopy(change.resource_address); }} className={`p-1 rounded-md transition-colors ${copiedAddress === change.resource_address ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-white/5'}`} title="Copy Address">
                                {copiedAddress === change.resource_address ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                        </div>
                    </div>
                </div>
                <div className={`font-mono font-bold lg:text-lg ${color} shrink-0 text-right flex flex-col justify-end`}>
                    <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-black mb-0.5 opacity-70">
                        {(() => {
                            const lbl = isRoyalty ? (tt?.fees_royalty || 'Royalties') : isFee ? (tt?.fee_label || 'Fees') : (tt?.amount_label || 'Amount');
                            return lbl.length > 10 ? lbl.slice(0, 8).trim() + '...' : lbl;
                        })()}
                    </div>
                    <div className="flex items-baseline gap-1.5 justify-end">
                        {iconOverride && <span className="shrink-0">{iconOverride}</span>}
                        <span>
                            {sign}
                            {(() => {
                                const val = hideSign ? Math.abs(parseFloat(change.balance_change)) : parseFloat(change.balance_change);
                                const truncated = Math.trunc(val * 10000) / 10000;
                                return truncated.toLocaleString(locale, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
                            })()}
                        </span>

                        {symbol && <span className="text-xs font-semibold opacity-70">{symbol}</span>}
                    </div>
                </div>
            </div>
            <AnimatePresence>
                {!isFee && expanded && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                        <ResourceInlinePanel address={change.resource_address} details={metadata || null} loading={isLoading} onCopy={onCopy} copiedAddress={copiedAddress} tt={tt} network={network} locale={locale} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export { BalanceChangeRow };
