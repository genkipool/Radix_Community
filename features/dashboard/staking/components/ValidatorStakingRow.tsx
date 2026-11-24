/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState } from 'react';
import { Copy, Check, Download, Landmark } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { SafeImage } from '@/components/ui/SafeImage';
import { useLanguage } from '@/context/LanguageContext';
import type { GatewayEntityDetails, TranslationsT } from '@/features/dashboard/types';
import type { AccountRewardsCsvModalDict } from '@/features/dashboard/explorador/types/components.types';
import type { StakingEntry, ParsedResource } from '@/features/dashboard/explorador/types/models.types';
import { AccountValidatorStakeAction, type ValidatorSelections } from '@/features/dashboard/explorador/components/AccountValidatorStakeAction';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { dashboardKeys } from '@/features/dashboard/utils/entityCache';
import { CACHE_TIMES } from '@/features/dashboard/utils/queryCache';
import { computeOwnerStakingData } from '../hooks/useAccountStakingData';
import { useStakingLocale } from '../hooks/useStakingLocale';
import { StakingMetricsBar } from './StakingMetricsBar';
import dashboardExploradorEn from '@/features/dashboard/explorador/locales/en.json';

const DEFAULT_ACC_SUMMARY = dashboardExploradorEn.dashboard.transactions.account_summary;

export type StakingTranslations = Partial<TranslationsT['dashboard']['transactions']> & {
    account_summary?: AccountRewardsCsvModalDict;
};

interface ValidatorStakingRowProps {
    row: StakingEntry;
    /** Matured claim NFTs of this validator: the only ones a claim may carry. */
    claimableNftIds: string[];
    isModal: boolean;
    tt?: StakingTranslations;
    entityData: GatewayEntityDetails | null;
    address: string;
    network: 'mainnet' | 'stokenet';
    validatorsData: any;
    accounts: any[];
    lsuTokens: ParsedResource[];
    activeNfts: any[];
    xrdAmount: string;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    mountTime: number;
    globalAmountStr: string;
    selectedValidatorAddresses: string[];
    validatorSelections: Record<string, ValidatorSelections>;
    onUpdateSelections: (vAddr: string, sels: ValidatorSelections) => void;
    setGlobalAmountStr: (v: string) => void;
    locale: string;
    isTransacting?: boolean;
    onOwnerModeChange?: (addr: string, isOwnerMode: boolean) => void;
    hideStakingControls?: boolean;
    onOpenCsvModal?: (address: string) => void;
    advancedOwnerControls?: boolean;
}

export function ValidatorStakingRow({
    row,
    isModal,
    tt,
    entityData,
    address,
    network,
    validatorsData,
    accounts,
    lsuTokens,
    activeNfts,
    xrdAmount,
    onCopy,
    copiedAddress,
    mountTime,
    globalAmountStr,
    selectedValidatorAddresses,
    validatorSelections,
    onUpdateSelections,
    setGlobalAmountStr,
    locale,
    isTransacting = false,
    onOwnerModeChange,
    hideStakingControls,
    onOpenCsvModal,
    claimableNftIds,
    advancedOwnerControls = false,
}: ValidatorStakingRowProps) {
    const { t: contextT } = useLanguage();
    const accT = tt?.account_summary || contextT?.dashboard?.transactions?.account_summary;
    const stakingT = useStakingLocale(locale);
    const [ownerMode, setOwnerMode] = useState(false);

    const valInfo = validatorsData?.validators.find((v: any) => v.address === row.validatorAddress);
    const connectedAccount = accounts?.find((a: any) => a.address === address);
    const isOwner = !!connectedAccount && (
        valInfo?.ownerBadge
            ? !!activeNfts?.some((nft: any) => nft.ids?.includes(valInfo.ownerBadge!))
            : valInfo?.ownerAddress === address
    );
    const validator = valInfo;

    const { data: validatorEntityData } = useQuery({
        queryKey: dashboardKeys.entities.detail(row.validatorAddress, network),
        queryFn: () => apiFetchEntityDetails(row.validatorAddress, network, true),
        enabled: ownerMode && !!row.validatorAddress,
        staleTime: CACHE_TIMES.VOLATILE,
    });

    const currentEpoch = (entityData as any)?.ledger_state?.epoch ?? 0;
    const ownerData = ownerMode && validatorEntityData && validator
        ? computeOwnerStakingData(validatorEntityData as any, validator, currentEpoch, mountTime)
        : null;
    const ownerLockedStakeXrd = ownerData?.ownerLockedStakeXrd ?? 0;
    const ownerUnlockedXrd = ownerData?.ownerUnlockedXrd ?? 0;
    const ownerPendingUnlockXrd = ownerData?.ownerPendingUnlockXrd ?? 0;

    const ownerToggleLabel = stakingT?.owner_toggle || (locale === 'es' ? 'Propietario' : 'Owner');
    const delegatorLabel = stakingT?.delegator || (locale === 'es' ? 'Delegador' : 'Delegator');

    const unstakeTooltip = !ownerMode
        ? (() => {
            const lines = (row.unstakes || []).reduce<string[]>((acc, u) => {
                if (u.epoch > currentEpoch) {
                    const epochsRemaining = u.epoch - currentEpoch;
                    const date = new Date(mountTime + epochsRemaining * 5 * 60 * 1000);
                    const dateStr = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    acc.push(`Epoch ${u.epoch} ~ ${dateStr}`);
                }
                return acc;
            }, []);
            return lines.length > 0 ? lines.join('\n') : undefined;
        })()
        : (ownerData?.unstakeTooltip || undefined);

    const claimTooltip = ownerMode ? stakingT.claim_tooltip : undefined;

    const otherValidatorsStakeXrd = Object.entries(validatorSelections).reduce(
        (sum, [addr, sel]) => (addr === row.validatorAddress ? sum : sum + parseFloat(sel?.stake || '0')),
        0,
    );

    return (
        <div className={isModal ? 'flex flex-col gap-4 py-2' : 'flex flex-col gap-4 p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-card-border)] hover:border-[var(--color-primary)]/30 transition-all shadow-sm'}>
            <div className="flex items-start gap-3">
                <div className="size-10 rounded-full shrink-0 overflow-hidden bg-[var(--color-card-border)] flex items-center justify-center shadow-inner">
                    {row.validatorIcon ? (
                        <SafeImage src={row.validatorIcon} alt={row.validatorName || 'Validator'} fallbackName={row.validatorName || 'Validator'} className="w-full h-full object-cover" />
                    ) : (
                        <Landmark className="size-5 text-[var(--color-text-muted)]" />
                    )}
                </div>
                <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                    {/* Fixed h-8 in console mode keeps the exact same row height whether the [Delegator|Owner] pill is mounted or not */}
                    <div className={`flex items-center justify-between gap-2 ${advancedOwnerControls ? 'h-8' : ''}`}>
                        <span className="font-black text-sm text-[var(--color-text-main)] truncate">{row.validatorName || row.validatorAddress}</span>
                        {isModal && isOwner && (
                            advancedOwnerControls ? (
                                <div
                                    role="group"
                                    aria-label={ownerToggleLabel}
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center rounded-lg border border-[var(--color-card-border)] bg-[var(--color-bg)] p-0.5 shrink-0"
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (ownerMode) {
                                                setOwnerMode(false);
                                                onOwnerModeChange?.(row.validatorAddress, false);
                                            }
                                        }}
                                        className={`px-2 py-1.5 leading-none rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                                            !ownerMode
                                                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                                        }`}
                                    >
                                        {delegatorLabel}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!ownerMode) {
                                                setOwnerMode(true);
                                                onOwnerModeChange?.(row.validatorAddress, true);
                                            }
                                        }}
                                        className={`px-2 py-1.5 leading-none rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                                            ownerMode
                                                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                                        }`}
                                    >
                                        {ownerToggleLabel}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const next = !ownerMode;
                                        setOwnerMode(next);
                                        onOwnerModeChange?.(row.validatorAddress, next);
                                    }}
                                    className={`text-[10px] font-bold uppercase tracking-wider transition-opacity shrink-0 ${ownerMode ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:opacity-70'}`}
                                >
                                    {ownerToggleLabel}
                                </button>
                            )
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[var(--color-text-muted)] truncate select-all">{row.validatorAddress}</span>
                        {isOwner && onOpenCsvModal && network === 'mainnet' && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onOpenCsvModal(row.validatorAddress); }}
                                className="p-1 rounded transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-primary)] shrink-0"
                                title={accT?.download_rewards_tooltip || DEFAULT_ACC_SUMMARY.download_rewards_tooltip}
                            >
                                <Download className="size-3" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onCopy(row.validatorAddress); }}
                            className={`p-1 rounded transition-colors shrink-0 ${copiedAddress === row.validatorAddress ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                        >
                            {copiedAddress === row.validatorAddress ? <Check className="size-3" /> : <Copy className="size-3" />}
                        </button>
                    </div>
                </div>
            </div>

            <StakingMetricsBar
                balanceXrd={advancedOwnerControls ? parseFloat(xrdAmount || '0') : undefined}
                stakeXrd={ownerMode ? ownerLockedStakeXrd : row.xrdInStake}
                unstakeXrd={ownerMode ? ownerPendingUnlockXrd : row.xrdInUnstake}
                claimXrd={ownerMode ? ownerUnlockedXrd : row.xrdInClaim}
                locale={locale}
                stakeLabel={accT?.stake_xrd || DEFAULT_ACC_SUMMARY.stake_xrd}
                unstakeLabel={accT?.unstake_xrd || DEFAULT_ACC_SUMMARY.unstake_xrd}
                claimLabel={accT?.claim_xrd || DEFAULT_ACC_SUMMARY.claim_xrd}
                unstakeTooltip={unstakeTooltip}
                claimTooltip={claimTooltip}
                borderPosition="top"
            />

            {isModal && !hideStakingControls && (
                <AccountValidatorStakeAction
                    xrdBalance={parseFloat(xrdAmount)}
                    otherValidatorsStakeXrd={otherValidatorsStakeXrd}
                    stakedXrd={ownerMode ? ownerLockedStakeXrd : row.xrdInStake}
                    claimableXrd={ownerMode ? ownerUnlockedXrd : row.xrdInClaim}
                    claimableNftIds={ownerMode ? undefined : claimableNftIds}
                    lsuBalance={lsuTokens.find((t: any) => t.validatorAddress === row.validatorAddress)?.amount ? parseFloat(lsuTokens.find((t: any) => t.validatorAddress === row.validatorAddress)!.amount) : 0}
                    ghostAmount={!advancedOwnerControls && !ownerMode && globalAmountStr && selectedValidatorAddresses.includes(row.validatorAddress) ? (parseFloat(globalAmountStr) / selectedValidatorAddresses.length).toString() : undefined}
                    selections={validatorSelections[row.validatorAddress] || {}}
                    onUpdateSelections={(newSels) => {
                        if (!advancedOwnerControls) setGlobalAmountStr('');
                        onUpdateSelections(row.validatorAddress, newSels);
                    }}
                    ownerMode={ownerMode}
                    advancedOwnerControls={advancedOwnerControls}
                    isTransacting={isTransacting}
                    tt={tt}
                />
            )}
        </div>
    );
}
