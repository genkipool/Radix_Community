'use client';
import { getConfigEntries } from '../../utils/resourceUtils';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, ChevronDown, Check, Copy, Activity } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { entityKeys } from '@/features/dashboard/hooks/useEntityData';
import type { GatewayEntityDetails, TranslationsT, DashboardDict, MetadataItem } from '@/features/dashboard/types';
import { getMetaValue } from '../utils/metadataUtils';
import { SafeImage } from '@/components/ui/SafeImage';
import { formatXRD, formatNumber } from '@/utils/formatters';
import {
    PanelTabBar,
    PanelLoadingState,
    PanelMetadataTab,
    PanelConfigurationTab,
    PanelRawTab,
} from './EntityPanelShared';

/* ─────────────────────────────────────
   Props
───────────────────────────────────── */
import { ValidatorInlinePanelProps } from '../types';

type ValidatorTab = 'summary' | 'metadata' | 'configuration' | 'raw';

/* ─────────────────────────────────────
   ValidatorInlinePanel
───────────────────────────────────── */
export function ValidatorInlinePanel({
    validatorAddress, isStake, isUnstake, isClaim,
    stakeXrd, unstakeLsu, unstakeXrdExpected, unstakeXrd, claimXrd,
    tt, dt, onCopy, copiedAddress, network,
    rightLabel, rightContent,
}: ValidatorInlinePanelProps) {
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
    const amountColor = isStake ? 'text-green-700 dark:text-green-400' : isUnstake ? 'text-amber-700 dark:text-amber-400' : 'text-[var(--color-primary)]';
    const amountSign = isStake ? '+' : '−';
    const numericAmount = primaryAmount != null && primaryAmount > 0
        ? `${amountSign}${parseFloat(String(primaryAmount)).toFixed(4).replace(/\.?0+$/, '')}` : null;

    const headerMessage = (() => {
        if (!numericAmount) return null;
        if (isUnstake) {
            const xrdStr = unstakeXrdExpected != null && unstakeXrdExpected > 0
                ? parseFloat(String(unstakeXrdExpected)).toFixed(4).replace(/\.?0+$/, '') : null;
            const tpl = tt?.validator_info_unstake || 'Has iniciado el retiro de {lsu} LSU {xrd} de este validador. Los tokens estarán disponibles tras el período de desvinculación.';
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
        ...META_ORDER.map(key => enrichedMeta.find((m) => m.key === key)).filter(Boolean),
        ...enrichedMeta.filter((m) => !META_ORDER.includes(m.key)),
    ] as MetadataItem[];

    const tabs: { key: ValidatorTab; label: string }[] = [
        { key: 'summary', label: tt?.resource_panel_summary || 'Summary' },
        { key: 'metadata', label: tt?.resource_panel_metadata || 'Metadata' },
        { key: 'configuration', label: tt?.resource_panel_configuration || 'Configuration' },
        { key: 'raw', label: tt?.resource_panel_raw || 'Raw' },
    ];

    const cd = dt?.card || ({} as TranslationsT['dashboard']['card']);
    const dd = dt?.details || ({} as DashboardDict['details']);

    return (
        <div className="bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-card-border)] overflow-hidden">
            {/* Header */}
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--color-card-border)] bg-[var(--color-surface)] flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                {tt?.validator_info_title || 'Validator'}
            </h3>

            {/* Clickable card row */}
            <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors"
                onClick={e => { e.stopPropagation(); if (window.getSelection()?.toString()) return; setExpanded(v => !v); }}
            >
                <div className="w-9 h-9 rounded-xl overflow-hidden border border-[var(--color-card-border)] shrink-0 bg-[var(--color-surface)]">
                    {isLoading ? (
                        <div className="w-full h-full flex items-center justify-center">
                            <Activity className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
                        </div>
                    ) : (
                        <SafeImage src={iconUrl as string} alt={name as string} fallbackName={name as string} className="w-full h-full object-cover" />
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-[var(--color-text-main)] truncate">{name as string}</p>
                        <ChevronDown className={`w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform duration-200 shrink-0 ${expanded ? 'rotate-180 text-[var(--color-primary)]' : ''}`} />
                    </div>
                    {headerMessage ? (
                        <p className={`text-[11px] font-medium leading-snug mt-0.5 ${amountColor}`}>{headerMessage}</p>
                    ) : (
                        <p className="text-[10px] font-mono text-[var(--color-text-muted)] truncate" title={validatorAddress}>{validatorAddress.slice(0, 14)}...{validatorAddress.slice(-6)}</p>
                    )}
                </div>

                {(rightContent || numericAmount) && (
                    <div className="shrink-0 text-right">
                        {rightLabel && (
                            <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)] font-black opacity-70 mb-0.5">{rightLabel}</div>
                        )}
                        {rightContent ?? (
                            <>
                                <span className={`text-base font-black font-mono ${amountColor} tabular-nums`}>
                                    {numericAmount} <span className="text-xs font-semibold opacity-70">{primaryUnit}</span>
                                </span>
                                {isUnstake && unstakeXrdExpected != null && unstakeXrdExpected > 0 && (
                                    <div className="font-mono font-semibold text-[var(--color-primary)] tabular-nums mt-0.5">
                                        ~{parseFloat(String(unstakeXrdExpected)).toFixed(4).replace(/\.?0+$/, '')} <span className="text-xs opacity-70">XRD</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Expandable tabs */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-[var(--color-card-border)] bg-[var(--color-surface)]" onClick={e => e.stopPropagation()}>
                            <PanelTabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

                            <div className="px-5 py-4">
                                {isLoading ? (
                                    <PanelLoadingState tt={tt} />
                                ) : (
                                    <>
                                        {/* ── SUMMARY ── */}
                                        {activeTab === 'summary' && (
                                            <div>
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-[var(--color-card-border)] shrink-0">
                                                        <SafeImage src={iconUrl as string} alt={name as string} fallbackName={name as string} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-sm text-[var(--color-text-main)]">{name as string}</p>
                                                        <div className="flex items-center gap-1 mt-0.5">
                                                            <span className="text-[10px] font-mono text-[var(--color-text-muted)] truncate max-w-[180px]" title={validatorAddress}>{validatorAddress.slice(0, 14)}...{validatorAddress.slice(-6)}</span>
                                                            <button onClick={e => { e.stopPropagation(); onCopy(validatorAddress); }} className={`p-0.5 rounded transition-colors ${copiedAddress === validatorAddress ? 'text-green-500' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}>
                                                                {copiedAddress === validatorAddress ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {getMeta('description') && (
                                                    <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mb-4 italic border-l-2 border-[var(--color-primary)]/30 pl-3">{getMeta('description')}</p>
                                                )}

                                                <div className="border-t border-[var(--color-card-border)] mb-4" />

                                                <dl className="space-y-3">
                                                    {isStake && stakeXrd != null && stakeXrd > 0 && (
                                                        <div className="flex items-center justify-between gap-4 pb-3 border-b border-[var(--color-card-border)]/60">
                                                            <dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{tt?.validator_info_stake_amount || 'XRD Delegado'}</dt>
                                                            <dd className="text-sm font-bold font-mono text-green-700 dark:text-green-400">+{parseFloat(String(stakeXrd)).toFixed(4).replace(/\.?0+$/, '')} XRD</dd>
                                                        </div>
                                                    )}
                                                    {isUnstake && (unstakeLsu ?? 0) > 0 && (
                                                        <div className="flex items-center justify-between gap-4 pb-1 border-b border-[var(--color-card-border)]/60">
                                                            <dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{tt?.validator_info_lsu_burned || 'LSU Quemados'}</dt>
                                                            <dd className="text-sm font-bold font-mono text-amber-600">−{parseFloat(String(unstakeLsu)).toFixed(4).replace(/\.?0+$/, '')} LSU</dd>
                                                        </div>
                                                    )}
                                                    {isUnstake && unstakeXrdExpected != null && unstakeXrdExpected > 0 && (
                                                        <div className="flex items-center justify-between gap-4 pb-3 border-b border-[var(--color-card-border)]/60">
                                                            <dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{tt?.validator_info_xrd_expected || 'XRD a Reclamar'}</dt>
                                                            <dd className="text-sm font-bold font-mono text-[var(--color-primary)]">~{parseFloat(String(unstakeXrdExpected)).toFixed(4).replace(/\.?0+$/, '')} XRD</dd>
                                                        </div>
                                                    )}
                                                    {isClaim && claimXrd != null && claimXrd > 0 && (
                                                        <div className="flex items-center justify-between gap-4 pb-3 border-b border-[var(--color-card-border)]/60">
                                                            <dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{tt?.validator_info_claim_amount || 'XRD Reclamados'}</dt>
                                                            <dd className="text-sm font-bold font-mono text-[var(--color-primary)]">+{parseFloat(String(claimXrd)).toFixed(4).replace(/\.?0+$/, '')} XRD</dd>
                                                        </div>
                                                    )}
                                                    {validator?.delegatedStake != null && (
                                                        <div className="flex items-center justify-between gap-4">
                                                            <dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{dd.delegated_stake || 'Stake Delegado'}</dt>
                                                            <dd className="text-xs font-semibold text-[var(--color-text-main)] font-mono">{formatXRD(validator.delegatedStake)} XRD</dd>
                                                        </div>
                                                    )}
                                                    {validator?.delegators != null && (
                                                        <div className="flex items-center justify-between gap-4">
                                                            <dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{cd.delegators || 'Delegadores'}</dt>
                                                            <dd className="text-xs font-semibold text-[var(--color-text-main)]">{validator.delegators.toLocaleString()}</dd>
                                                        </div>
                                                    )}
                                                    {validator?.nominalFee != null && (
                                                        <div className="flex items-center justify-between gap-4">
                                                            <dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{dd.nominal_fee || 'Comisión'}</dt>
                                                            <dd className="text-xs font-semibold text-[var(--color-text-main)]">{validator.nominalFee.toFixed(2)}%</dd>
                                                        </div>
                                                    )}
                                                    {validator?.apyProjection != null && (
                                                        <div className="flex items-center justify-between gap-4">
                                                            <dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{dd.apy_projection || 'APY Proyección'}</dt>
                                                            <dd className="text-xs font-semibold text-green-700 dark:text-green-400">{validator.apyProjection.toFixed(2)}%</dd>
                                                        </div>
                                                    )}
                                                    {validator?.lsu2xrdFactor != null && validator.lsu2xrdFactor !== 1 && (
                                                        <div className="flex items-center justify-between gap-4">
                                                            <dt className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-text-muted)] shrink-0">{dd.lsu_factor || 'Factor LSU → XRD'}</dt>
                                                            <dd className="text-xs font-semibold text-[var(--color-text-main)] font-mono">1 LSU = {formatNumber(validator.lsu2xrdFactor, 8)} XRD</dd>
                                                        </div>
                                                    )}
                                                </dl>
                                            </div>
                                        )}

                                        {/* ── METADATA (ordered) ── */}
                                        {activeTab === 'metadata' && (
                                            <PanelMetadataTab metadataItems={orderedMeta} tt={tt} />
                                        )}

                                        {activeTab === 'configuration' && (
                                            <PanelConfigurationTab configEntries={configEntries} tt={tt} onCopy={onCopy} copiedAddress={copiedAddress} />
                                        )}

                                        {activeTab === 'raw' && <PanelRawTab data={entityData} />}
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
