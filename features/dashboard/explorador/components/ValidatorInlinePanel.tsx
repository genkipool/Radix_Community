'use client';
import { getConfigEntries } from '../../utils/resourceUtils';
import React, { useState } from 'react';
import { m, AnimatePresence } from "motion/react";
import { Shield, ChevronDown, Check, Copy, Activity } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { entityKeys } from '@/features/dashboard/hooks/useEntityData';
import type { GatewayEntityDetails, TranslationsT, DashboardDict, MetadataItem } from '@/features/dashboard/types';
import { getMetaValue } from '../utils/metadataUtils';
import { SafeImage } from '@/components/ui/SafeImage';
import { IconFlame } from './TransactionIcons';
import {
    SummaryInlineRow,
    PanelTabBar,
    PanelLoadingState,
    PanelMetadataTab,
    PanelConfigurationTab,
    PanelRawTab,
} from './EntityPanelShared';
import { ValidatorSummaryMetrics } from './ValidatorSummaryMetrics';

/* ─────────────────────────────────────
   Props
───────────────────────────────────── */
// Removed unused import

type ValidatorTab = 'summary' | 'metadata' | 'configuration' | 'raw';

/* ─────────────────────────────────────
   ValidatorInlinePanel
───────────────────────────────────── */
export function ValidatorInlinePanel({
    validatorAddress, isStake, isUnstake, isClaim,
    stakeXrd, unstakeLsu, unstakeXrdExpected, unstakeXrd, claimXrd,
    tt, dt, onCopy, copiedAddress, network, locale,
    rightLabel, rightContent,
}: {
    validatorAddress: string; isStake?: boolean; isUnstake?: boolean; isClaim?: boolean;
    stakeXrd?: number; unstakeLsu?: number; unstakeXrdExpected?: number; unstakeXrd?: number; claimXrd?: number;
    tt?: Partial<TranslationsT['dashboard']['transactions']>;
    dt?: Partial<DashboardDict>;
    onCopy: (a: string) => void; copiedAddress: string | null; network: string; locale: string;
    rightLabel?: string; rightContent?: React.ReactNode;
}) {
    const [expanded, setExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<ValidatorTab>('summary');

    const { data: entityData, isLoading } = useQuery<GatewayEntityDetails | null>({
        queryKey: entityKeys.full(validatorAddress, network),
        queryFn: () => apiFetchEntityDetails(validatorAddress, network as 'mainnet' | 'stokenet'),
        staleTime: Infinity, gcTime: 10 * 60_000, retry: 1, retryOnMount: false,
    });

    // Read full validator data from the cache — no extra fetch needed
    const qc = useQueryClient();
    const validatorsData = qc.getQueryData<{ validators: import('@/types/radix').Validator[] }>(['validators', network]);
    const validator = validatorsData?.validators?.find((v) => v.address === validatorAddress);

    const metadataItems = entityData?.metadata?.items ?? [];
    const getMeta = (key: string) => getMetaValue(metadataItems, key) ?? '';

    const isFullShape = metadataItems.length > 0;
    const name = isFullShape ? (getMeta('name') || validator?.name || `${validatorAddress.slice(0, 10)}...`)
        : (entityData?.name || validator?.name || `${validatorAddress.slice(0, 10)}...`);
    const iconUrl = isFullShape ? (getMeta('icon_url') || validator?.iconUrl || '')
        : (entityData?.iconUrl || validator?.iconUrl || '');
    const ra = (entityData?.details as Record<string, unknown>)?.role_assignments;

    const primaryAmount = isStake ? stakeXrd
        : isUnstake ? (unstakeLsu ?? unstakeXrd)
            : claimXrd;
    const primaryUnit = isUnstake ? 'LSU' : 'XRD';
    const amountColor = (isStake || isClaim) ? 'text-[var(--color-accent)]' : isUnstake ? 'text-orange-600 dark:text-orange-400' : 'text-[var(--color-text-main)]';
    const amountSign = isStake ? '+' : '−';
    const numericAmount = primaryAmount != null && primaryAmount > 0
        ? `${parseFloat(String(primaryAmount)).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}` : null;

    const headerMessage = (() => {
        if (!numericAmount) return null;
        if (isUnstake) {
            const xrdStr = unstakeXrdExpected != null && unstakeXrdExpected > 0
                ? parseFloat(String(unstakeXrdExpected)).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 4 }) : null;
            const tpl = tt?.validator_info_unstake || 'You have initiated the withdrawal of {lsu} LSU {xrd} from this validator. Tokens will be available after the unbonding period.';
            return tpl.replace('{lsu}', numericAmount ?? '').replace('{xrd}', xrdStr ? `(~${xrdStr} XRD)` : '');
        }
        const tpl = isStake ? (tt?.validator_info_stake || 'You staked {amount} XRD to this validator')
            : (tt?.validator_info_claim || 'You claimed {amount} XRD from this validator');
        return tpl.replace('{amount}', numericAmount);
    })();

    const configEntries = getConfigEntries(ra, tt);

    // Metadata ordering
    const META_ORDER = ['name', 'description', 'info_url', 'icon_url', 'validator_address', 'claim_nft', 'pool_unit', 'owner_badge'];
    const syntheticValidatorAddress: MetadataItem | null = metadataItems.some((m) => m.key === 'validator_address')
        ? null
        : {
            key: 'validator_address',
            value: { typed: { value: validatorAddress } },
            is_locked: true,
            last_updated_at_state_version: 0
        };
    const enrichedMeta = syntheticValidatorAddress ? [...metadataItems, syntheticValidatorAddress] : metadataItems;
    const orderedMeta = [
        ...META_ORDER.flatMap(key => { const m = enrichedMeta.find((m) => m.key === key); return m ? [m] : []; }),
        ...enrichedMeta.filter((m) => !META_ORDER.includes(m.key)),
    ] as MetadataItem[];

    const tabs: { key: ValidatorTab; label: string; tooltip?: string }[] = [
        { key: 'summary', label: tt?.resource_panel_summary || 'Summary', tooltip: tt?.tab_summary_tooltip },
        { key: 'metadata', label: tt?.resource_panel_metadata || 'Metadata', tooltip: tt?.tab_metadata_tooltip },
        { key: 'configuration', label: tt?.resource_panel_configuration || 'Configuration', tooltip: tt?.tab_configuration_tooltip },
        { key: 'raw', label: tt?.resource_panel_raw || 'Raw', tooltip: tt?.tab_raw_tooltip },
    ];


    return (
        <div className="bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-card-border)] overflow-hidden">
            {/* Header */}
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--color-card-border)] bg-[var(--color-surface)] flex items-center gap-2">
                <Shield className="size-3.5 text-[var(--color-primary)]" />
                {tt?.validator_info_title || 'Validator'}
            </h3>

            {/* Clickable card row */}
            <button type="button"
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors w-full text-left"
                onClick={e => { e.stopPropagation(); if (window.getSelection()?.toString()) return; setExpanded(v => !v); }}
            >
                <div className="size-9 rounded-xl overflow-hidden border border-[var(--color-card-border)] shrink-0 bg-[var(--color-surface)]">
                    {isLoading ? (
                        <div className="w-full h-full flex items-center justify-center">
                            <Activity className="size-4 animate-spin text-[var(--color-primary)]" />
                        </div>
                    ) : (
                        <SafeImage src={iconUrl as string} alt={name as string} fallbackName={name as string} className="w-full h-full object-cover" />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-[var(--color-text-main)] truncate">{name as string}</p>
                        <ChevronDown className={`size-3.5 text-[var(--color-text-muted)] transition-transform duration-200 shrink-0 ${expanded ? 'rotate-180 text-[var(--color-primary)]' : ''}`} />
                    </div>
                    {headerMessage ? (
                        <p className={`text-[11px] font-medium leading-snug mt-0.5 ${amountColor}`}>{headerMessage}</p>
                    ) : (
                        <p className="text-[10px] font-mono text-[var(--color-text-muted)] truncate" title={validatorAddress}>
                            <span className="hidden sm:inline">{validatorAddress.slice(0, 14)}...{validatorAddress.slice(-6)}</span>
                            <span className="inline sm:hidden">{validatorAddress.slice(0, 8)}...{validatorAddress.slice(-8)}</span>
                        </p>
                    )}
                </div>

                {(rightContent || numericAmount) && (
                    <div className="shrink-0 text-right">
                        {rightLabel && (
                            <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-black opacity-70 mb-0.5">{rightLabel}</div>
                        )}
                        {rightContent ?? (
                            <>
                                <span className={`text-base font-black font-mono ${amountColor} tabular-nums flex items-center gap-1`}>
                                    {isUnstake && <IconFlame className="size-4 shrink-0" />}
                                    {!isUnstake && amountSign}
                                    {numericAmount} <span className="text-xs font-semibold opacity-70">{primaryUnit}</span>
                                </span>
                            </>
                        )}
                    </div>
                )}
            </button>

            {/* Expandable tabs */}
            <AnimatePresence>
                {expanded && (
                    <m.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                    >
                        <button type="button" className="border-t border-[var(--color-card-border)] bg-[var(--color-surface)] w-full text-left cursor-auto block" onClick={e => e.stopPropagation()}>
                            <PanelTabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} layoutId="validatorInlineTabs" />

                            <div className="px-5 py-4">
                                {isLoading ? (
                                    <PanelLoadingState tt={tt} />
                                ) : (
                                    <>
                                        {/* ── SUMMARY ── */}
                                        {activeTab === 'summary' && (
                                            <div>
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="size-10 rounded-xl overflow-hidden border border-[var(--color-card-border)] shrink-0">
                                                        <SafeImage src={iconUrl as string} alt={name as string} fallbackName={name as string} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-sm text-[var(--color-text-main)]">{name as string}</p>
                                                        <div className="flex items-center gap-1 mt-0.5">
                                                            <span className="text-[10px] font-mono text-[var(--color-text-muted)] truncate max-w-[180px]" title={validatorAddress}>
                                                                <span className="hidden sm:inline">{validatorAddress.slice(0, 14)}...{validatorAddress.slice(-6)}</span>
                                                                <span className="inline sm:hidden">{validatorAddress.slice(0, 8)}...{validatorAddress.slice(-8)}</span>
                                                            </span>
                                                            <button type="button" onClick={e => { e.stopPropagation(); onCopy(validatorAddress); }} className={`p-0.5 rounded transition-colors ${copiedAddress === validatorAddress ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}>
                                                                {copiedAddress === validatorAddress ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="border-t border-[var(--color-card-border)] mb-4" />

                                                <div className="space-y-0">
                                                    {isStake && stakeXrd != null && stakeXrd > 0 && (
                                                        <SummaryInlineRow
                                                            label={tt?.validator_info_stake_amount || 'Staked XRD'}
                                                        >
                                                            <span className="text-sm font-bold font-mono text-[var(--color-accent)]">+{parseFloat(String(stakeXrd)).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 4 })} XRD</span>
                                                        </SummaryInlineRow>
                                                    )}
                                                    {isClaim && claimXrd != null && claimXrd > 0 && (
                                                        <SummaryInlineRow
                                                            label={tt?.validator_info_claim_amount || 'Claimed XRD'}
                                                        >
                                                            <span className="text-sm font-bold font-mono text-[var(--color-accent)]">+{parseFloat(String(claimXrd)).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 4 })} XRD</span>
                                                        </SummaryInlineRow>
                                                    )}

                                                    {validator && (
                                                        <ValidatorSummaryMetrics
                                                            validator={validator}
                                                            address={validatorAddress}
                                                            onCopy={onCopy}
                                                            copiedAddress={copiedAddress}
                                                            locale={locale}
                                                            dt={dt}
                                                            isModal={true}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* ── METADATA (ordered) ── */}
                                        {activeTab === 'metadata' && (
                                            <PanelMetadataTab metadataItems={orderedMeta} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} />
                                        )}

                                        {activeTab === 'configuration' && (
                                            <PanelConfigurationTab configEntries={configEntries} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} />
                                        )}

                                        {activeTab === 'raw' && (
                                            <PanelRawTab
                                                data={entityData}
                                                tt={tt}
                                                onCopy={onCopy}
                                                copiedAddress={copiedAddress}
                                            />
                                        )}
                                    </>
                                )}
                            </div>
                        </button>
                    </m.div>
                )}
            </AnimatePresence>
        </div>
    );
}
