'use client';
import { SafeImage } from '@/components/ui/SafeImage';
import { parseTags, deriveBehaviors, getConfigEntries } from '../../utils/resourceUtils';
import React, { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
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
import { ResourceInlinePanelProps } from '../types/components.types';
import { getWellKnownKey, getGenericTooltipKey } from '../constants/wellKnownAddresses';
import dynamic from 'next/dynamic';
const UnderlyingTokensTab = dynamic(() => import('./UnderlyingTokensTab').then(m => m.UnderlyingTokensTab));
import { useEntityBadge } from './EntityBadgeContext';
import type { GatewayEntityDetails, MetadataItem } from '@/features/dashboard/types';

function resolvePoolAddressFromEntity(entity: GatewayEntityDetails | null): string | undefined {
    if (!entity) return undefined;

    const meta = entity.metadata?.items ?? [];
    const metaByKey = new Map(meta.map((m: MetadataItem) => [m.key, m] as const));

    for (const key of ['pool', 'pool_address']) {
        const item = metaByKey.get(key);
        if (item?.value?.typed?.value) return item.value.typed.value;
    }

    const dappDefs = metaByKey.get('dapp_definitions');
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

    const dappDef = meta.find((m: MetadataItem) => m.key === 'dapp_definition');
    if (dappDef?.value?.typed?.value) return dappDef.value.typed.value;

    const state = entity.details?.state as Record<string, unknown> | undefined;
    if (state) {
        for (const key of ['liquidity_pool', 'pool', 'pool_address']) {
            const val = state[key];
            if (typeof val === 'string' && (val.startsWith('pool_') || val.startsWith('component_'))) {
                return val;
            }
        }

        const fields = state.fields as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(fields)) {
            for (const field of fields) {
                const fVal = field.value as string | undefined;
                if (typeof fVal === 'string' && (fVal.startsWith('pool_') || fVal.startsWith('component_'))) {
                    return fVal;
                }
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

    const infoUrl = meta.find((m: MetadataItem) => m.key === 'info_url');
    const urlStr = infoUrl?.value?.typed?.value ?? infoUrl?.value?.typed?.url ?? '';
    const poolMatch = urlStr.match(/(pool_[a-z0-9]+)/i);
    if (poolMatch) return poolMatch[1];
    const compMatch = urlStr.match(/(component_[a-z0-9]+)/i);
    if (compMatch) return compMatch[1];

    return undefined;
}

const BASE_RESOURCE_TABS = ['summary', 'metadata', 'configuration', 'raw'] as const;
type ResourceTab = 'summary' | 'contributed_tokens' | 'pool' | 'metadata' | 'configuration' | 'raw';

export function ResourceInlinePanel({ address, details, loading, onCopy, copiedAddress, tt, network, locale, isPoolUnit, userBalance, poolAddress }: ResourceInlinePanelProps) {
    const badgeComp = useEntityBadge();
    const [activeTab, setActiveTab] = useState<ResourceTab>('summary');

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

    const resolvedPoolAddress = poolAddress || resolvePoolAddressFromEntity(details);

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
        <button type="button"
            className="block w-full text-left border border-t-0 border-[var(--color-card-border)] rounded-b-xl overflow-hidden bg-[var(--color-surface)] cursor-auto"
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
                                        ? <SafeImage src={iconUrl} alt={name} fallbackName={symbol || name} className="size-9 rounded-full shrink-0 object-cover border border-[var(--color-card-border)]" />
                                        : <div className="size-9 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center font-bold text-xs border border-[var(--color-primary)]/20 shrink-0">{(symbol || name).slice(0, 2).toUpperCase()}</div>
                                    }
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-sm text-[var(--color-text-main)] truncate">{name}</span>
                                            {symbol && <TokenBadge className="shrink-0">{symbol}</TokenBadge>}
                                        </div>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <span className="text-[10px] font-mono text-[var(--color-text-muted)] truncate max-w-[160px]" title={wellKnownTip || address}>{address.slice(0, 14)}...{address.slice(-6)}</span>
                                            <button type="button" onClick={e => { e.stopPropagation(); onCopy(address); }} className={`p-0.5 rounded transition-colors ${copiedAddress === address ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}>
                                                {copiedAddress === address ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
                                            </button>
                                            <a href={`https://dashboard.radixdlt.com/resource/${address}`} target="_blank" rel="noopener noreferrer" className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors" onClick={e => e.stopPropagation()}><ExternalLink className="size-2.5" /></a>
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
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); onCopy(resolvedPoolAddress); }}
                                                    className={`p-0.5 rounded transition-colors ${copiedAddress === resolvedPoolAddress ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                                >
                                                    {copiedAddress === resolvedPoolAddress ? <Check className="size-2.5 text-[var(--color-accent)]" /> : <Copy className="size-2.5" />}
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
                                                {tagList.map((tag: string) => <Pill key={tag}>{tag}</Pill>)}
                                            </dd>
                                        </div>
                                    )}
                                </dl>
                                {behaviors.length > 0 && (
                                    <>
                                        <div className="border-t border-[var(--color-card-border)] mt-4 mb-3" />
                                        <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] mb-2">{tt?.resource_panel_behavior || 'Behavior'}</p>
                                        <ul className="space-y-1.5">
                                            {behaviors.map((b) => <li key={b} className="flex items-start gap-2 text-xs text-[var(--color-text-muted)]"><span className="size-1 rounded-full bg-[var(--color-primary)]/60 mt-1.5 shrink-0" />{b}</li>)}
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
                                {React.createElement(badgeComp, {
                                    address: resolvedPoolAddress,
                                    tt: tt,
                                    onCopy: onCopy,
                                    copiedAddress: copiedAddress,
                                    network: network || 'mainnet',
                                    locale: locale
                                })}
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
        </button>
    );
}
