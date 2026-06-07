'use client';
import { SafeImage } from '@/components/ui/SafeImage';
import { parseTags, deriveBehaviors, getConfigEntries, parseProgrammaticJson } from '../../utils/resourceUtils';
import React, { useState } from 'react';
import { m, AnimatePresence } from "motion/react";
import { Check, Copy, ChevronDown, Box, FileJson, Activity } from 'lucide-react';
import { Pill } from '@/components/ui/Pill';
import { getMetaValue } from '../utils/metadataUtils';
import {
    PanelTabBar,
    PanelMetadataTab,
    PanelConfigurationTab,
    PanelRawTab,
} from './EntityPanelShared';

import { NftCollectionPanelProps } from '../types/components.types';

export type NftPanelTab = 'items' | 'summary' | 'metadata' | 'configuration' | 'raw';

export function NftCollectionPanel({
    resourceAddress: _resourceAddress, meta, nftData, nftLoading, ids, type,
    onCopy, copiedAddress, tt, claimXrdTotal, isClaim, isStakeClaimOverride, isClaimRedeemed, isClaimAuthorized, unstakeXrdExpected, network: _network,
    locale, validatorAddress, validatorName
}: NftCollectionPanelProps) {
    const [activeTab, setActiveTab] = useState<NftPanelTab>(ids.length > 0 ? 'items' : 'summary');
    const [expandedNfts, setExpandedNfts] = useState<Set<string>>(new Set());

    const metadataItems = meta?.metadata?.items || [];
    const name = getMetaValue(metadataItems, 'name') || tt?.nft_collection || 'NFT Collection';
    const symbol = getMetaValue(metadataItems, 'symbol') || '';
    const description = getMetaValue(metadataItems, 'description');
    const iconUrl = getMetaValue(metadataItems, 'icon_url');
    const totalSupply = meta?.details?.total_supply;
    const totalMinted = meta?.details?.total_minted;
    const totalBurned = meta?.details?.total_burned;
    const resourceType = meta?.details?.type;
    const divisibility = meta?.details?.divisibility;
    const ra = meta?.details?.role_assignments;
    const behaviors = deriveBehaviors(ra, tt);
    const configEntries = getConfigEntries(ra, tt);
    const fmt = (v: string | number) => parseFloat(String(v)).toLocaleString(locale);

    // Detect if this collection is a Stake Claim resource
    const isStakeClaim = isStakeClaimOverride || /stake.?claim/i.test(name) || /stake.?claim/i.test(getMetaValue(metadataItems, 'description') || '');

    /* ── NFT item helpers ── */
    const getNftImage = (nft: Record<string, unknown>): string | null => {
        const fields = ((nft?.data as Record<string, unknown>)?.programmatic_json as Record<string, unknown>)?.fields;
        if (!Array.isArray(fields)) return null;
        for (const f of fields) {
            if (f.field_name === 'key_image_url' || f.field_name === 'icon_url') return f.value || f.fields?.[0]?.value || null;
        }
        return null;
    };
    const getNftName = (nft: Record<string, unknown>): string | null => {
        const fields = ((nft?.data as Record<string, unknown>)?.programmatic_json as Record<string, unknown>)?.fields;
        if (!Array.isArray(fields)) return null;
        const f = fields.find((f) => (f as Record<string, string>).field_name === 'name');
        return f?.value ? String(f.value) : null;
    };
    const getNftFields = (nft: Record<string, unknown>): { name: string; value: unknown }[] => {
        const fields = ((nft?.data as Record<string, unknown>)?.programmatic_json as Record<string, unknown>)?.fields;
        if (!Array.isArray(fields)) return [];
        return fields.map((f) => {
            let parsedVal: unknown;
            if (f.value != null) {
                parsedVal = f.value;
            } else if (f.fields?.[0]?.value != null) {
                parsedVal = f.fields[0].value;
            } else {
                parsedVal = parseProgrammaticJson(f);
            }
            return {
                name: f.field_name || f.type_name || 'field',
                value: parsedVal,
            };
        });
    };
    const getStakeClaimXrd = (nft: Record<string, unknown>): number | null => {
        const fields = ((nft?.data as Record<string, unknown>)?.programmatic_json as Record<string, unknown>)?.fields;
        if (!Array.isArray(fields)) return null;
        const namedField = fields.find((f) =>
            f.field_name === 'claim_amount' || f.field_name === 'claimable_amount' ||
            f.field_name === 'xrd_amount' || f.field_name === 'amount'
        );
        const decimalField = namedField || fields.find((f) =>
            (f.kind === 'Decimal' || f.kind === 'PreciseDecimal') && f.value
        );
        if (!decimalField?.value) return null;
        const n = parseFloat(String(decimalField.value));
        return isNaN(n) || n <= 0 ? null : n;
    };

    const tabs: { key: NftPanelTab; label: string; tooltip?: string }[] = ([
        {
            key: 'items',
            label: `${(type === 'neutral' ? tt?.nft_panel_items_account : tt?.nft_panel_items) || 'Items'} (${ids.length})`,
            tooltip: tt?.tab_tokens_tooltip
        },
        { key: 'summary', label: tt?.nft_panel_summary || 'Summary', tooltip: tt?.tab_summary_tooltip },
        { key: 'metadata', label: tt?.nft_panel_metadata || 'Metadata', tooltip: tt?.tab_metadata_tooltip },
        { key: 'configuration', label: tt?.nft_panel_configuration || 'Configuration', tooltip: tt?.tab_configuration_tooltip },
        { key: 'raw', label: tt?.nft_panel_raw || 'Raw', tooltip: tt?.tab_raw_tooltip },
    ] as { key: NftPanelTab; label: string; tooltip?: string }[]).filter(tab => tab.key !== 'items' || ids.length > 0);

    return (
        <div role="presentation"
            className="border border-t-0 border-[var(--color-card-border)] rounded-b-xl overflow-hidden bg-[var(--color-surface)] w-full text-left cursor-auto block"
            onClick={e => e.stopPropagation()}
        >
            <PanelTabBar
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                layoutId="nftCollectionTabs"
            />

            <div className="px-5 py-4">
                {/* ── ITEMS ── */}
                {activeTab === 'items' && (
                    nftLoading ? (
                        <div className="flex items-center gap-2 py-3 text-[var(--color-text-muted)]">
                            <Activity className="size-3.5 animate-spin text-[var(--color-primary)]" />
                            <span className="text-xs">{tt?.loading_nft_data || 'Loading NFT data...'}</span>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {ids.map((id) => {
                                const nftItem = nftData.find((n) => n.non_fungible_id === id);
                                const imageUrl = nftItem ? getNftImage(nftItem) : null;
                                const nftName = nftItem ? getNftName(nftItem) : null;
                                const fields = nftItem ? getNftFields(nftItem) : [];
                                const claimXrd = (nftItem ? getStakeClaimXrd(nftItem) : null) ?? (isClaim ? claimXrdTotal : null) ?? (isStakeClaim ? unstakeXrdExpected : null);
                                const hasData = !!nftItem && (!!imageUrl || !!nftName || fields.length > 0);
                                const shortId = id.length > 20 ? `${id.slice(0, 8)}...${id.slice(-8)}` : id;
                                const isOpen = expandedNfts.has(id);
                                const isReceived = type === 'added';
                                return (
                                    <div key={id} className={`rounded-xl border border-[var(--color-card-border)] overflow-hidden transition-all ${isOpen ? 'border-[var(--color-primary)]/30' : ''}`}>
                                        <div role="button" tabIndex={hasData ? 0 : -1}
                                            className={`flex items-center gap-3 p-3 transition-colors ${hasData ? 'cursor-pointer hover:bg-[var(--color-surface-hover)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]' : 'cursor-auto'} w-full text-left`}
                                            onClick={hasData ? (e => { e.stopPropagation(); if (window.getSelection()?.toString()) return; setExpandedNfts(prev => { const n = new Set(prev); void (n.has(id) ? n.delete(id) : n.add(id)); return n; }); }) : undefined}
                                            onKeyDown={hasData ? (e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (window.getSelection()?.toString()) return; setExpandedNfts(prev => { const n = new Set(prev); void (n.has(id) ? n.delete(id) : n.add(id)); return n; }); } }) : undefined}
                                        >
                                            <div className="size-10 rounded-lg shrink-0 border border-[var(--color-card-border)] overflow-hidden bg-[var(--color-bg)]/50 flex items-center justify-center">
                                                {imageUrl ? <SafeImage src={imageUrl} alt={shortId} fallbackName={shortId} className="w-full h-full object-cover" />
                                                    : <Box className="size-4 text-[var(--color-text-muted)] opacity-40" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <div className="font-bold text-xs text-[var(--color-text-main)] truncate">{nftName || `#${shortId}`}</div>
                                                    {hasData && <ChevronDown className={`size-3 text-[var(--color-text-muted)] transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-[var(--color-primary)]' : ''}`} />}
                                                </div>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <span className="text-[9px] text-[var(--color-text-muted)] font-mono truncate max-w-[100px]" title={id}>{shortId}</span>
                                                    <button type="button" onClick={e => { e.stopPropagation(); onCopy?.(id); }} className={`p-0.5 rounded transition-colors ${copiedAddress === id ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}>
                                                        {copiedAddress === id ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
                                                    </button>
                                                </div>

                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                {isClaim && type === 'removed' ? (
                                                    <div className="text-right" title={isClaimRedeemed ? (tt?.claim_nft_redeemed_tooltip || 'NFT Burned/Redeemed') : isClaimAuthorized ? (tt?.claim_nft_authorized_tooltip || 'Claim Authorized') : (tt?.stake_claim_nft_claimed_title || 'Este NFT fue presentado para reclamar los XRD')}>
                                                        <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-black opacity-70 mb-0.5">{tt?.stake_claim_xrd_claimed || 'XRD Reclamados'}</div>
                                                        {claimXrd != null ? (
                                                            <div className="font-mono font-bold text-base tabular-nums text-[var(--color-accent)]">{parseFloat(String(claimXrd)).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 4 })} <span className="text-xs font-semibold opacity-70">XRD</span></div>
                                                        ) : (
                                                            <div className="font-mono font-bold text-base tabular-nums text-red-600 dark:text-red-400">−1 <span className="text-xs font-semibold opacity-70">NFT</span></div>
                                                        )}
                                                    </div>
                                                ) : isClaim && type === 'added' ? (
                                                    <div className="text-right" title={isClaimRedeemed ? (tt?.claim_nft_redeemed_tooltip || 'NFT Burned/Redeemed') : isClaimAuthorized ? (tt?.claim_nft_authorized_tooltip || 'Claim Authorized') : (tt?.stake_claim_nft_claimed_title || 'Este NFT fue presentado para reclamar los XRD')}>
                                                        <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-black opacity-70 mb-0.5">{tt?.stake_claim_xrd_claimed || 'XRD Reclamados'}</div>
                                                        {claimXrd != null ? (
                                                            <div className="font-mono font-bold text-base tabular-nums text-[var(--color-accent)]">{parseFloat(String(claimXrd)).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 4 })} <span className="text-xs font-semibold opacity-70">XRD</span></div>
                                                        ) : (
                                                            <div className="font-mono font-bold text-base tabular-nums text-[var(--color-accent)]">+1 <span className="text-xs font-semibold opacity-70">NFT</span></div>
                                                        )}
                                                    </div>
                                                ) : (isStakeClaim || claimXrd != null) ? (
                                                    <div className="text-right" title={tt?.stake_claim_nft_title || 'Present this NFT to claim your XRD after the unbonding period'}>
                                                        <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-black opacity-70 mb-0.5">{tt?.stake_claim_xrd_amount || 'XRD Reclamables'}</div>
                                                        {claimXrd != null ? (
                                                            <div className="font-mono font-bold text-base tabular-nums text-[var(--color-accent)]">~{parseFloat(String(claimXrd)).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 4 })} <span className="text-xs font-semibold opacity-70">XRD</span></div>
                                                        ) : (
                                                            <div className={`font-mono font-bold text-sm tabular-nums ${isReceived ? 'text-[var(--color-accent)]' : 'text-red-600 dark:text-red-400'}`}>{isReceived ? '+' : '-'}1 <span className="text-xs font-semibold opacity-70">NFT</span></div>
                                                        )}
                                                    </div>
                                                ) : null}
                                            </div>
                                        </div>
                                        <AnimatePresence>
                                            {isOpen && hasData && (
                                                <m.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                                    <div className="border-t border-[var(--color-card-border)] px-4 py-3 space-y-3">

                                                        {imageUrl && (
                                                            <div className="rounded-xl overflow-hidden border border-[var(--color-card-border)] max-w-[140px]">
                                                                <SafeImage src={imageUrl} alt={shortId} fallbackName={shortId} className="w-full object-cover" />
                                                            </div>
                                                        )}
                                                        {(fields.length > 0 || ((isStakeClaim || isClaim) && validatorAddress)) && (
                                                            <div>
                                                                <p className="text-[9px] uppercase tracking-widest font-black text-[var(--color-text-muted)] opacity-60 mb-2 flex items-center gap-1">
                                                                    <FileJson className="size-3" />{tt?.nft_data_fields || 'NFT Data Fields'}
                                                                </p>
                                                                <div className="space-y-2">
                                                                    {(isStakeClaim || isClaim) && validatorAddress && (
                                                                        <div>
                                                                            <p className="text-[9px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-0.5">{((tt as unknown) as Record<string, string>)?.staking_validator || 'validator'}</p>
                                                                            <p className="text-xs text-[var(--color-primary)] break-words leading-relaxed truncate pl-3">
                                                                                {validatorName || validatorAddress}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                    {fields.map((f) => {
                                                                        const valArray = Array.isArray(f.value) ? f.value : [f.value];
                                                                        const isClaimField = f.name === 'claim_amount' || f.name === 'claimable_amount' || f.name === 'xrd_amount' || f.name === 'amount';
                                                                        return (
                                                                            <div key={f.name}>
                                                                                <p className="text-[9px] uppercase tracking-wider font-bold text-[var(--color-text-muted)] mb-0.5">{f.name}</p>
                                                                                <div className="text-xs text-[var(--color-text-main)] break-words leading-relaxed space-y-1 pl-3">
                                                                                    {valArray.map((vItem, vi) => {
                                                                                        const strVal = typeof vItem === 'object' && vItem !== null ? JSON.stringify(vItem) : String(vItem);
                                                                                        const isUrl = strVal.startsWith('http') || strVal.startsWith('ipfs');
                                                                                        return (
                                                                                            <div key={vi}>
                                                                                                {isUrl ? <a href={strVal} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline" onClick={e => e.stopPropagation()}>{strVal.length > 60 ? strVal.slice(0, 60) + '...' : strVal}</a> : strVal}
                                                                                                {isClaimField && !isUrl ? ' XRD' : ''}
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </m.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    )
                )}

                {/* ── SUMMARY ── */}
                {activeTab === 'summary' && (
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            {iconUrl ? <SafeImage src={iconUrl} alt={name} fallbackName={name} className="size-9 rounded-full shrink-0 object-cover border border-[var(--color-card-border)]" />
                                : <div className="size-9 rounded-full bg-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center border border-[var(--color-primary)]/20 shrink-0"><Box className="size-4" /></div>}
                            <div className="min-w-0 flex-1">
                                <p className="font-bold text-sm text-[var(--color-text-main)] truncate">{name}</p>
                                {symbol && <p className="text-[10px] text-[var(--color-primary)] font-mono truncate">{symbol}</p>}
                            </div>
                        </div>
                        {description && <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-4 italic border-l-2 border-[var(--color-primary)]/30 pl-3">{description}</p>}
                        <div className="border-t border-[var(--color-card-border)] mb-4" />
                        <dl className="space-y-3">
                            {resourceType && <div className="flex items-center justify-between gap-4"><dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{tt?.resource_panel_type || 'Type'}</dt><dd className="text-xs font-semibold text-[var(--color-text-main)]">{String(resourceType)}</dd></div>}
                            {divisibility !== undefined && divisibility !== null && <div className="flex items-center justify-between gap-4"><dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{tt?.resource_panel_divisibility || 'Divisibility'}</dt><dd className="text-xs font-semibold text-[var(--color-text-main)] font-mono">{String(divisibility)}</dd></div>}
                            {totalSupply && <div className="flex items-center justify-between gap-4"><dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{tt?.nft_panel_total_supply || 'Total Supply'}</dt><dd className="text-xs font-semibold text-[var(--color-text-main)] font-mono">{fmt(totalSupply as number)}</dd></div>}
                            {totalMinted && <div className="flex items-center justify-between gap-4"><dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{tt?.resource_panel_total_minted || 'Total Minted'}</dt><dd className="text-xs font-semibold text-[var(--color-accent)] font-mono">+{fmt(totalMinted as number)}</dd></div>}
                            {totalBurned && parseFloat(String(totalBurned)) > 0 && <div className="flex items-center justify-between gap-4"><dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{tt?.resource_panel_total_burned || 'Total Burned'}</dt><dd className="text-xs font-semibold text-red-400 font-mono">−{fmt(totalBurned as number)}</dd></div>}
                            {(() => {
                                const tagList = parseTags(metadataItems.find((m) => m.key === 'tags') || null);
                                return tagList.length > 0 ? (
                                    <div className="flex items-start justify-between gap-4">
                                        <dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0 pt-0.5">{tt?.nft_panel_tags || 'Tags'}</dt>
                                        <dd className="flex flex-wrap gap-1.5 justify-end">{tagList.map((tag: string) => <Pill key={tag}>{tag}</Pill>)}</dd>
                                    </div>
                                ) : null;
                            })()}
                        </dl>
                        {behaviors.length > 0 && (
                            <>
                                <div className="border-t border-[var(--color-card-border)] mt-4 mb-3" />
                                <p className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] mb-2">{tt?.nft_panel_behavior || 'Behavior'}</p>
                                <ul className="space-y-1.5">{behaviors.map((b) => <li key={b} className="flex items-start gap-2 text-xs text-[var(--color-text-muted)]"><span className="size-1 rounded-full bg-[var(--color-primary)]/60 mt-1.5 shrink-0" />{b}</li>)}</ul>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'metadata' && (
                    <PanelMetadataTab metadataItems={metadataItems} tt={tt} onCopy={onCopy ?? (() => {})} copiedAddress={copiedAddress} />
                )}

                {activeTab === 'configuration' && (
                    <PanelConfigurationTab
                        configEntries={configEntries}
                        tt={tt}
                        onCopy={onCopy ?? (() => { })}
                        copiedAddress={copiedAddress}
                    />
                )}

                {activeTab === 'raw' && (
                    <PanelRawTab
                        data={meta}
                        tt={tt}
                        onCopy={onCopy ?? (() => { })}
                        copiedAddress={copiedAddress}
                    />
                )}
            </div>
        </div>
    );
}

