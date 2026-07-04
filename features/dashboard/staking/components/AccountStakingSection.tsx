/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState } from 'react';
import { Copy, Check, Info, Download, Landmark, X } from 'lucide-react';
import { m, AnimatePresence } from 'motion/react';
import { useQueryClient, useQuery } from '@tanstack/react-query';

import { Portal } from '@/components/ui/Portal';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { SafeImage } from '@/components/ui/SafeImage';
import { formatNumber } from '@/utils/formatters';
import { useLanguage } from '@/context/LanguageContext';

import type { GatewayEntityDetails, TranslationsT } from '@/features/dashboard/types';
import type { AccountRewardsCsvModalDict } from '@/features/dashboard/explorador/types/components.types';
import type { StakingEntry, ParsedResource } from '@/features/dashboard/explorador/types/models.types';
import { useAccountStats } from '@/features/dashboard/explorador/hooks/useAccountStats';
import { AccountValidatorStakeAction } from '@/features/dashboard/explorador/components/AccountValidatorStakeAction';
import { BatchValidatorStakeAction } from '@/features/dashboard/explorador/components/BatchValidatorStakeAction';
import { ValidatorCarouselSelector } from '@/features/dashboard/explorador/components/ValidatorCarouselSelector';
import { apiFetchTransactionDetails, apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { dashboardKeys } from '@/features/dashboard/utils/entityCache';
import { CACHE_TIMES } from '@/features/dashboard/utils/queryCache';
import { invalidateAccountStakingData } from '@/features/dashboard/utils/cacheInvalidation';
import { useValidatorsQuery } from '../hooks/useValidatorsQuery';
import { useStakingTransaction } from '../hooks/useStakingTransaction';
import { computeOwnerStakingData } from '../hooks/useAccountStakingData';
import type { StakingAction } from '../types/staking-operations.types';
import type { BatchStakeItem, BatchUnstakeItem, BatchClaimItem, MixedBatchItem } from '@/features/wallet/lib/manifest-builders';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { RadixNetworkId } from '@/features/wallet/constants/network';

type StakingTranslations = Partial<TranslationsT['dashboard']['transactions']> & {
    account_summary?: AccountRewardsCsvModalDict;
};

export interface AccountStakingSectionProps {
    address: string;
    entityData: GatewayEntityDetails | null;
    network: 'mainnet' | 'stokenet';
    locale: string;
    tt?: StakingTranslations;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    /** Compact, borderless layout with batch controls (profile modal / console) */
    isModal?: boolean;
    stakingErrors?: Record<string, string>;
    onOpenCsvModal?: (address: string) => void;
    /**
     * Render the section (with the batch controls) even when the account has
     * no delegations yet, so new stakes can be started from scratch.
     */
    alwaysShowControls?: boolean;
    /**
     * Where the mixed "operation summary" lives: inline below the validator
     * rows (default, used by the narrow profile modal) or as a sticky side
     * column that follows the scroll (wide layouts like the console tool).
     */
    summaryPlacement?: 'inline' | 'side';
}

type ValidatorSelections = { amountStr?: string; stake?: string; unstake?: string; claim?: boolean };

/**
 * Self-contained account staking section: per-validator rows with
 * stake/unstake/claim controls, global batch actions, mixed (cart) mode and
 * owner-mode support. Shared by the wallet profile modal, the explorer
 * account view and the console staking tool.
 */
export function AccountStakingSection({
    address,
    entityData,
    network,
    locale,
    tt,
    onCopy,
    copiedAddress,
    isModal = false,
    stakingErrors,
    onOpenCsvModal,
    alwaysShowControls = false,
    summaryPlacement = 'inline',
}: AccountStakingSectionProps) {
    const queryClient = useQueryClient();
    const { activeNetworkId, accounts } = useRadixWallet();
    const { data: validatorsData } = useValidatorsQuery(network);
    const { t: contextT } = useLanguage();
    const accT = tt?.account_summary || contextT?.dashboard?.transactions?.account_summary;

    const { xrdAmount, lsuTokens, activeNfts, stakingRows, isLoading } = useAccountStats(address, network, entityData);

    const [selectedValidatorAddresses, setSelectedValidatorAddresses] = useState<string[]>([]);
    const [mountTime] = useState(() => Date.now());
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [hideStakingControls, setHideStakingControls] = useState(false);
    const [globalAmountStr, setGlobalAmountStr] = useState('');
    const [actionError, setActionError] = useState<string | null>(null);
    const [transactingAction, setTransactingAction] = useState<StakingAction | null>(null);
    const [validatorSelections, setValidatorSelections] = useState<Record<string, ValidatorSelections>>({});
    const [ownerModeAddresses, setOwnerModeAddresses] = useState<Set<string>>(new Set());

    // El modo carrito (multiMode) está activado siempre por defecto
    const isMultiMode = true;

    const { submitBatchTransaction, submitMixedBatchTransaction, isTransacting, error: batchError, clearError } = useStakingTransaction();

    const [hasInitializedSelections, setHasInitializedSelections] = useState(false);
    // Initialize selections with existing delegations once data loads
    if (!hasInitializedSelections && !isLoading && stakingRows.length > 0) {
        setHasInitializedSelections(true);
        setSelectedValidatorAddresses(stakingRows.map(r => r.validatorAddress));
    }

    const handleOwnerModeChange = (addr: string, isOwnerMode: boolean) => {
        setOwnerModeAddresses(prev => {
            const next = new Set(prev);
            if (isOwnerMode) next.add(addr);
            else next.delete(addr);
            return next;
        });
    };

    const handleUpdateSelections = (vAddr: string, newSelections: ValidatorSelections) => {
        setActionError(null);
        if (clearError) clearError();

        setValidatorSelections(prev => {
            const updated = { ...prev };
            if (Object.keys(newSelections).length === 0) {
                delete updated[vAddr];
            } else {
                updated[vAddr] = newSelections;
            }
            return updated;
        });
    };

    const getStakingError = (err: string) => {
        const lower = err.toLowerCase();
        if (lower.includes('failed to prepare') || lower.includes('failedtoprepare')) return stakingErrors?.failedToPrepareTransaction || accT?.failed_to_prepare || err;
        if (lower.includes('rejected') || lower.includes('rejectedbyuser')) return stakingErrors?.rejectedByUser || accT?.rejected_by_user || err;
        if (lower.includes('failed to sign') || lower.includes('failedtosign')) return stakingErrors?.failedToSignTransaction || err;
        if (lower.includes('failed to submit') || lower.includes('failedtosubmit')) return stakingErrors?.failedToSubmitTransaction || err;
        if (lower.includes('failed to compile') || lower.includes('failedtocompile')) return stakingErrors?.failedToCompileTransaction || err;
        return err;
    };

    // Show all staked validators always, plus any additionally selected ones
    const displayRows: StakingEntry[] = [...new Set([
        ...stakingRows.map(r => r.validatorAddress),
        ...selectedValidatorAddresses
    ])].map(vAddr => {
        const existing = stakingRows.find(r => r.validatorAddress === vAddr);
        if (existing) return existing;

        const valInfo = validatorsData?.validators.find(v => v.address === vAddr);
        return {
            validatorName: valInfo?.name || 'Unknown Validator',
            validatorIcon: valInfo?.iconUrl || '',
            validatorAddress: vAddr,
            xrdInStake: 0,
            xrdInUnstake: 0,
            xrdInClaim: 0,
            unstakes: []
        };
    });

    const carouselOptions = validatorsData?.validators.map(v => ({
        value: v.address,
        label: v.name || 'Unknown',
        iconUrl: v.iconUrl
    })) || [];

    const canDistribute = selectedValidatorAddresses.some(addr => !ownerModeAddresses.has(addr));

    const handleBatchAction = async (actionToPerform: StakingAction) => {
        setActionError(null);
        setTransactingAction(actionToPerform);

        const items: BatchStakeItem[] | BatchUnstakeItem[] | BatchClaimItem[] = [];

        // Global Batch Action
        const globalAmount = parseFloat(globalAmountStr || '0');
        if (actionToPerform !== 'Claim' && globalAmount <= 0) {
            setActionError(accT?.enter_valid_amount || 'Enter a valid amount.');
            setTransactingAction(null);
            return;
        }

        const nonOwnerAddresses = selectedValidatorAddresses.filter(vAddr => {
            const row = displayRows.find(r => r.validatorAddress === vAddr);
            if (!row) return false;
            const valInfo = validatorsData?.validators.find(v => v.address === vAddr);
            const connectedAccount = accounts?.find((a: any) => a.address === address);
            const isOwner = !!connectedAccount && (
                valInfo?.ownerBadge
                    ? !!activeNfts?.some((nft: any) => nft.ids?.includes(valInfo.ownerBadge!))
                    : valInfo?.ownerAddress === address
            );
            return !ownerModeAddresses.has(vAddr) || !isOwner;
        });

        const count = nonOwnerAddresses.length;
        if (count === 0) {
            setActionError(accT?.no_valid_actions || 'No valid actions to perform.');
            setTransactingAction(null);
            return;
        }

        const amountPerValidator = globalAmount / count;

        for (const vAddr of nonOwnerAddresses) {
            const row = displayRows.find(r => r.validatorAddress === vAddr);
            const valInfo = validatorsData?.validators.find(v => v.address === vAddr);

            if (!row || !valInfo) continue;

            if (actionToPerform === 'Stake') {
                items.push({
                    validatorAddress: vAddr,
                    amountXrd: amountPerValidator
                } as any);
            } else if (actionToPerform === 'Unstake') {
                const xrdPerLsu = valInfo.lsu2xrdFactor || 1;
                const maxStaked = row.xrdInStake;
                if (amountPerValidator > maxStaked) {
                    setActionError((accT?.insufficient_balance_validator || 'Insufficient balance in validator {address}').replace('{address}', `${vAddr.slice(0, 8)}...`));
                    setTransactingAction(null);
                    return;
                }
                const lsuAmount = amountPerValidator / xrdPerLsu;

                items.push({
                    validatorAddress: vAddr,
                    amountLsu: lsuAmount,
                    lsuResourceAddress: valInfo.lsuResource
                } as any);
            } else if (actionToPerform === 'Claim') {
                const nfts: string[] = [];
                if (entityData?.non_fungible_resources?.items) {
                    const claimResource = entityData.non_fungible_resources.items.find(
                        (nft: any) => nft.resource_address === valInfo.claimTokenResourceAddress
                    );
                    if (claimResource && claimResource.vaults?.items?.[0]?.items) {
                        nfts.push(...claimResource.vaults.items[0].items);
                    }
                }
                if (nfts.length > 0) {
                    items.push({
                        validatorAddress: vAddr,
                        claimNftLocalIds: nfts,
                        claimNftResourceAddress: valInfo.claimTokenResourceAddress
                    } as any);
                }
            }
        }

        if (items.length === 0) {
            setActionError(accT?.no_valid_actions || 'No valid actions to perform.');
            setTransactingAction(null);
            return;
        }

        // Ejecutar global
        const hash = await submitBatchTransaction(address, actionToPerform, items as any);
        if (hash) {
            setGlobalAmountStr('');
            setSelectedValidatorAddresses([]);
            pollTransactionStatus(hash);
        } else {
            setTransactingAction(null);
        }
    };

    const handleMixedBatchAction = async () => {
        setActionError(null);
        setTransactingAction('Stake'); // genérico para spinner

        const items: MixedBatchItem[] = [];

        for (const vAddr of Object.keys(validatorSelections)) {
            const selections = validatorSelections[vAddr];
            const row = displayRows.find(r => r.validatorAddress === vAddr);
            const valInfo = validatorsData?.validators.find(v => v.address === vAddr);
            if (!row || !valInfo || !selections) continue;

            // Procesar Stake
            if (selections.stake && parseFloat(selections.stake) > 0) {
                items.push({
                    action: 'Stake',
                    validatorAddress: vAddr,
                    amountXrd: parseFloat(selections.stake)
                } as any);
            }

            // Procesar Unstake
            if (selections.unstake && parseFloat(selections.unstake) > 0) {
                const unstakeAmt = parseFloat(selections.unstake);
                const xrdPerLsu = valInfo.lsu2xrdFactor || 1;
                const maxStaked = row.xrdInStake;

                if (unstakeAmt > maxStaked) {
                    setActionError((accT?.insufficient_balance_validator_unstake || 'Insufficient balance in validator {address} for Unstake.').replace('{address}', `${vAddr.slice(0, 8)}...`));
                    setTransactingAction(null);
                    return;
                }

                const lsuAmount = unstakeAmt / xrdPerLsu;
                items.push({
                    action: 'Unstake',
                    validatorAddress: vAddr,
                    amountLsu: lsuAmount,
                    lsuResourceAddress: valInfo.lsuResource
                } as any);
            }

            // Procesar Claim
            if (selections.claim) {
                const nfts: string[] = [];
                if (entityData?.non_fungible_resources?.items) {
                    const claimResource = entityData.non_fungible_resources.items.find(
                        (nft: any) => nft.resource_address === valInfo.claimTokenResourceAddress
                    );
                    if (claimResource && claimResource.vaults?.items?.[0]?.items) {
                        nfts.push(...claimResource.vaults.items[0].items);
                    }
                }
                if (nfts.length > 0) {
                    items.push({
                        action: 'Claim',
                        validatorAddress: vAddr,
                        claimNftLocalIds: nfts,
                        claimNftResourceAddress: valInfo.claimTokenResourceAddress
                    } as any);
                }
            }
        }

        if (items.length === 0) {
            setActionError(accT?.no_valid_actions_configured || 'No valid actions configured.');
            setTransactingAction(null);
            return;
        }

        const hash = await submitMixedBatchTransaction(address, items);
        if (hash) {
            setValidatorSelections({});
            pollTransactionStatus(hash);
        } else {
            setTransactingAction(null);
        }
    };

    const pollTransactionStatus = async (hash: string) => {
        const netName = activeNetworkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
        const maxAttempts = 15;

        const pollOnce = async (attempt: number) => {
            if (attempt > maxAttempts) {
                invalidateAccountStakingData(queryClient, address, netName);
                setTransactingAction(null);
                return;
            }

            try {
                const details = await apiFetchTransactionDetails(hash, netName);
                if (details && (details.transaction_status === 'CommittedSuccess' || details.transaction_status === 'Committed')) {
                    // Wait 2 seconds for Gateway to sync new ledger state before refetching
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    try {
                        await Promise.all((accounts || []).map(async (acc) => {
                            await apiFetchEntityDetails(acc.address, netName, true);
                            invalidateAccountStakingData(queryClient, acc.address, netName);
                        }));
                    } catch (e) {
                        console.error('Failed to pre-fetch entity details after transaction for accounts', e);
                    }
                    setTransactingAction(null);
                    return;
                } else if (details && details.transaction_status === 'CommittedFailure') {
                    setActionError(accT?.transaction_failed || 'Transaction failed.');
                    setTransactingAction(null);
                    return;
                } else if (details && details.transaction_status === 'Rejected') {
                    setActionError(accT?.transaction_rejected || 'Transaction rejected.');
                    setTransactingAction(null);
                    return;
                }
            } catch (err) {
                console.warn('Failed to fetch transaction details', err);
            }

            setTimeout(() => pollOnce(attempt + 1), 2000);
        };

        pollOnce(1);
    };

    const hasMixedSelections = isMultiMode && Object.keys(validatorSelections).some(k => {
        const sel = validatorSelections[k];
        if (!sel) return false;
        const row = displayRows.find(r => r.validatorAddress === k);
        if (!row) return false;
        return (sel.stake && parseFloat(sel.stake) > 0) ||
               (sel.unstake && parseFloat(sel.unstake) > 0) ||
               (sel.claim && row.xrdInClaim > 0);
    });

    /** Mixed-operations summary, reused inline or as the sticky side column. */
    const renderOperationsSummary = (variant: 'inline' | 'side') => (
        <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={variant === 'side'
                ? 'rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-4 shadow-sm'
                : 'mt-6 pt-4 border-t border-[var(--color-border)]'}
        >
                        <div className="flex justify-between items-center mb-3">
                            <h5 className="text-xs font-bold text-[var(--color-text-main)] uppercase tracking-wider">{accT?.info_modal_title_operations || 'Operation Summary'}</h5>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setValidatorSelections({}); setGlobalAmountStr(''); }}
                                className="text-[10px] font-bold uppercase tracking-wider transition-opacity shrink-0 text-[var(--color-text-muted)] hover:opacity-70 flex items-center gap-1"
                            >
                                {(contextT?.dashboard as any)?.calendar?.reset_button || 'Reset'}
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                            </button>
                        </div>
                        <div className="space-y-3 mb-6">
                            {Object.keys(validatorSelections).map(vAddr => {
                                const selections = validatorSelections[vAddr];
                                if (!selections || Object.keys(selections).length === 0) return null;

                                const row = displayRows.find(r => r.validatorAddress === vAddr);
                                if (!row) return null;

                                const actions = [];
                                const stakeNum = parseFloat(selections.stake || '0');
                                const unstakeNum = parseFloat(selections.unstake || '0');

                                const valInfo = validatorsData?.validators.find((v: any) => v.address === vAddr);
                                const xrdPerLsu = valInfo?.lsu2xrdFactor || 1;

                                if (selections.stake && stakeNum > 0) actions.push({ label: 'Stake', value: `${selections.stake} XRD`, lsuText: `~${formatNumber(stakeNum / xrdPerLsu, 2, locale)} LSU`, color: 'text-[var(--color-primary)]' });
                                if (selections.unstake && unstakeNum > 0) actions.push({ label: 'Unstake', value: `${selections.unstake} XRD`, color: 'text-[var(--color-secondary)]' });
                                if (selections.claim && row.xrdInClaim > 0) actions.push({ label: 'Claim', value: `${formatNumber(row.xrdInClaim, 2, locale)} XRD`, color: 'text-[var(--color-accent)]' });

                                if (actions.length === 0) return null;

                                return (
                                    <div key={vAddr} className="flex flex-col text-sm border-b border-[var(--color-border)] pb-3 last:border-0 last:pb-0">
                                        {actions.length === 1 ? (
                                            <div className="flex justify-between items-center w-full">
                                                <span className="font-bold text-[var(--color-text-main)] truncate max-w-[60%]">{row.validatorName || vAddr.slice(0, 8) + '...'}</span>
                                                <div className="flex flex-col items-end">
                                                    <span className="font-bold whitespace-nowrap">
                                                        {actions[0].label}: <span className={actions[0].color}>{actions[0].value}</span>
                                                    </span>
                                                    {actions[0].lsuText && (
                                                        <span className="text-[10px] font-mono text-[var(--color-secondary)]">{actions[0].lsuText}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="font-bold text-[var(--color-text-main)] mb-2 truncate">{row.validatorName || vAddr.slice(0, 8) + '...'}</span>
                                                <ul className="space-y-1 w-full">
                                                    {actions.map(act => (
                                                        <li key={act.label} className="flex flex-col items-end">
                                                            <div className="flex justify-end items-center text-xs">
                                                                <span className="font-bold mr-1">{act.label}:</span> <span className={`${act.color} font-bold`}>{act.value}</span>
                                                            </div>
                                                            {act.lsuText && (
                                                                <span className="text-[10px] font-mono text-[var(--color-secondary)] leading-none mt-0.5">{act.lsuText}</span>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {(() => {
                            const hasAnyValidationError = Object.keys(validatorSelections).some(vAddr => {
                                const sel = validatorSelections[vAddr];
                                if (!sel) return false;
                                const row = displayRows.find(r => r.validatorAddress === vAddr);
                                if (!row) return false;

                                const unstakeAmt = parseFloat(sel.unstake || '0');
                                const maxStaked = ownerModeAddresses.has(vAddr) ? Number.POSITIVE_INFINITY : row.xrdInStake;
                                if (unstakeAmt > maxStaked) return true;

                                const amountStrAmt = parseFloat(sel.amountStr || '0');
                                if (sel.stake === undefined && sel.unstake === undefined && !sel.claim && amountStrAmt > parseFloat(xrdAmount)) {
                                    return true;
                                }
                                return false;
                            });
                            const totalStakeAmount = Object.values(validatorSelections).reduce((sum, sel) => sum + parseFloat(sel.stake || '0'), 0);
                            const isSendDisabled = isTransacting || hasAnyValidationError || totalStakeAmount > parseFloat(xrdAmount);

                            return (
                                <button
                                    type="button"
                                    onClick={handleMixedBatchAction}
                                    disabled={isSendDisabled}
                                    className="w-full font-bold py-3 px-4 rounded-xl shadow-lg transition-all transform enabled:hover:scale-[1.02] enabled:active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] text-white flex justify-center items-center gap-2"
                                >
                                    {isTransacting ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 size-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            {accT?.sending_to_wallet || 'Sending to Wallet...'}
                                        </>
                                    ) : (
                                        accT?.send_to_wallet || 'Send to wallet'
                                    )}
                                </button>
                            );
                        })()}

                        {actionError && (
                            <div className="text-xs text-red-500 mt-3 p-2 bg-red-500/10 rounded border border-red-500/20 text-center">
                                {getStakingError(actionError)}
                            </div>
                        )}
                        {(batchError && !actionError) && (
                            <div className="text-xs text-red-500 mt-3 p-2 bg-red-500/10 rounded border border-red-500/20 text-center">
                                {getStakingError(batchError)}
                            </div>
                        )}
                    </m.div>
    );

    if (displayRows.length === 0 && !alwaysShowControls) return null;

    const showBatchControls = isModal && !hideStakingControls && (stakingRows.length > 0 || alwaysShowControls);

    return (
        <div className="mb-8">
            <h4 className={`text-xs font-black uppercase text-[var(--color-text-muted)] tracking-wider flex items-center justify-between gap-2 ${isModal ? 'pb-2 mb-4 border-b border-[var(--color-card-border)] w-full' : 'mb-4'}`}>
                <div className="flex items-center gap-2">
                    {accT?.staking_validators_title || 'STAKING'} ({displayRows.length})
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setIsInfoModalOpen(true); }}
                        className="hover:text-[var(--color-primary)] transition-colors p-1"
                        title={accT?.info_tooltip || 'Information about global and mixed actions'}
                    >
                        <Info className="size-4" />
                    </button>
                </div>
                {isModal && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setHideStakingControls(!hideStakingControls); }}
                        title={hideStakingControls ? ((accT as any)?.show_staking_tooltip || (locale === 'es' ? 'Mostrar controles de staking' : 'Show staking controls')) : ((accT as any)?.hide_staking_tooltip || (locale === 'es' ? 'Ocultar controles de staking' : 'Hide staking controls'))}
                        className={`text-[10px] font-bold uppercase tracking-wider transition-opacity shrink-0 ${hideStakingControls ? 'text-[var(--color-text-muted)] hover:opacity-70' : 'text-[var(--color-primary)]'}`}
                    >
                        {hideStakingControls ? ((accT as any)?.show_staking || (locale === 'es' ? 'Mostrar Staking' : 'Show Staking')) : ((accT as any)?.hide_staking || (locale === 'es' ? 'Ocultar Staking' : 'Hide Staking'))}
                    </button>
                )}
            </h4>

            {/* The side column only exists while there is a summary to show, so no blank gutter is reserved */}
            <div className={summaryPlacement === 'side' && hasMixedSelections ? 'grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_21rem] gap-6 items-start' : ''}>
                <div className="min-w-0">
            {showBatchControls && (
                <div className="mb-6 space-y-4">
                    <BatchValidatorStakeAction
                        selectedValidatorsCount={selectedValidatorAddresses.length}
                        xrdBalance={Number(xrdAmount) || 0}
                        totalStakedXrdSelected={selectedValidatorAddresses.reduce((acc, addr) => acc + (stakingRows.find(row => row.validatorAddress === addr)?.xrdInStake || 0), 0)}
                        globalAmountStr={globalAmountStr}
                        setGlobalAmountStr={(val) => {
                            setValidatorSelections({});
                            setGlobalAmountStr(val);
                        }}
                        onBatchAction={handleBatchAction}
                        isTransacting={isTransacting}
                        transactingAction={transactingAction}
                        actionError={actionError || getStakingError(batchError || '')}
                        setActionError={setActionError}
                        clearError={clearError}
                        tt={tt}
                        canDistribute={canDistribute}
                    >
                        <ValidatorCarouselSelector
                            options={carouselOptions}
                            selectedValues={selectedValidatorAddresses}
                            onChange={setSelectedValidatorAddresses}
                            placeholder={accT?.validator_search_placeholder || 'Search validators to delegate...'}
                            headerTitle={accT?.select_validator_title || 'Select validator'}
                            footerActionText={accT?.add_validator_btn || 'Add'}
                        />
                    </BatchValidatorStakeAction>
                </div>
            )}

            <div className="space-y-4">
                {displayRows.map((row) => (
                    <ValidatorStakingRow
                        key={row.validatorAddress}
                        row={row}
                        isModal={isModal}
                        tt={tt}
                        entityData={entityData}
                        address={address}
                        network={network}
                        validatorsData={validatorsData}
                        accounts={accounts}
                        lsuTokens={lsuTokens}
                        activeNfts={activeNfts}
                        xrdAmount={xrdAmount}
                        onCopy={onCopy}
                        copiedAddress={copiedAddress}
                        mountTime={mountTime}
                        globalAmountStr={globalAmountStr}
                        selectedValidatorAddresses={selectedValidatorAddresses}
                        validatorSelections={validatorSelections}
                        onUpdateSelections={handleUpdateSelections}
                        setGlobalAmountStr={setGlobalAmountStr}
                        isMultiMode={isMultiMode}
                        locale={locale}
                        stakingErrors={stakingErrors}
                        onOwnerModeChange={handleOwnerModeChange}
                        hideStakingControls={hideStakingControls}
                        onOpenCsvModal={onOpenCsvModal}
                    />
                ))}

                {summaryPlacement === 'inline' && hasMixedSelections && renderOperationsSummary('inline')}
            </div>
                </div>

                {summaryPlacement === 'side' && hasMixedSelections && (
                    <aside className="min-w-0 xl:sticky xl:top-24">
                        {renderOperationsSummary('side')}
                    </aside>
                )}
            </div>

            {/* Info Modal */}
            <Portal>
                <AnimatePresence>
                    {isInfoModalOpen && (
                        <>
                            <ModalOverlay onClose={() => setIsInfoModalOpen(false)} blur="sm" className="z-[9999]" />
                            <m.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none"
                            >
                                <div
                                    className="w-full max-w-2xl bg-[var(--color-surface)]/95 backdrop-blur-2xl border border-[var(--color-card-border)] shadow-2xl rounded-3xl overflow-hidden pointer-events-auto relative p-6"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setIsInfoModalOpen(false)}
                                        className="absolute top-4 right-4 size-8 rounded-full hover:bg-[var(--color-bg)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                                    >
                                        <X className="size-4" />
                                    </button>

                                    <div className="flex items-center gap-3 mb-4 text-[var(--color-primary)]">
                                        <Info className="size-6" />
                                        <h3 className="text-lg font-black tracking-tight">{accT?.global_mixed_title || 'Global and Mixed Action'}</h3>
                                    </div>

                                    <div className="space-y-4 text-sm text-[var(--color-text-main)] leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
                                        <p>
                                            {accT?.info_modal_desc || 'The Staking panel allows you to perform combined staking operations. Below are the available modes:'}
                                        </p>

                                        <h4 className="font-bold text-[var(--color-text-main)] border-b border-[var(--color-border)] pb-1">{accT?.global_batch_title || 'GLOBAL ACTION (BATCHES)'}</h4>
                                        <ul className="list-disc pl-5 space-y-2 text-[var(--color-text-muted)]">
                                            <li><strong className="text-[var(--color-text-main)]">{accT?.global_batch_stake || 'Mass Staking:'}</strong> {accT?.global_batch_stake_desc || 'Enter the XRD amount in the top field. It will be divided equally among all selected validators.'}</li>
                                            <li><strong className="text-[var(--color-text-main)]">{accT?.global_batch_unstake || 'Mass Unstaking:'}</strong> {accT?.global_batch_unstake_desc || 'Enter the TOTAL amount you wish to withdraw. It will be split equally across each validator.'}</li>
                                            <li><strong className="text-[var(--color-text-main)]">{accT?.global_batch_claim || 'Mass Claim:'}</strong> {accT?.global_batch_claim_desc || 'No amount needed. Simply select validators and click Claim All.'}</li>
                                        </ul>

                                        <h4 className="font-bold text-[var(--color-text-main)] border-b border-[var(--color-border)] mt-4 pb-1">{accT?.mixed_operations_title || 'MANUAL MIXED OPERATIONS'}</h4>
                                        <ul className="list-disc pl-5 space-y-2 text-[var(--color-text-muted)]">
                                            <li><strong className="text-[var(--color-text-main)]">{accT?.mixed_cart_mode || 'Cart Mode:'}</strong> {accT?.mixed_cart_desc || 'Enter an XRD amount in more than one validator manually to activate cart mode.'}</li>
                                            <li><strong className="text-[var(--color-text-main)]">{accT?.mixed_action_selection || 'Action Selection:'}</strong> {accT?.mixed_action_desc || 'Clicking Stake, Unstake, or Claim will mark the action instead of opening the wallet.'}</li>
                                            <li><strong className="text-[var(--color-text-main)]">{accT?.mixed_single_tx || 'Single Transaction:'}</strong> {accT?.mixed_single_tx_desc || 'A summary appears at the bottom with a Send to wallet button that executes everything in one transaction.'}</li>
                                        </ul>
                                    </div>
                                </div>
                            </m.div>
                        </>
                    )}
                </AnimatePresence>
            </Portal>
        </div>
    );
}

function ValidatorStakingRow({
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
    isMultiMode,
    locale,
    stakingErrors,
    onOwnerModeChange,
    hideStakingControls,
    onOpenCsvModal,
}: {
    row: StakingEntry;
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
    validatorSelections: Record<string, any>;
    onUpdateSelections: (vAddr: string, sels: any) => void;
    setGlobalAmountStr: (v: string) => void;
    isMultiMode: boolean;
    locale: string;
    stakingErrors?: Record<string, string>;
    onOwnerModeChange?: (addr: string, isOwnerMode: boolean) => void;
    hideStakingControls?: boolean;
    onOpenCsvModal?: (address: string) => void;
}) {
    const { t: contextT } = useLanguage();
    const accT = tt?.account_summary || contextT?.dashboard?.transactions?.account_summary;
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

    const ownerToggleLabel = (tt as any)?.dashboard?.staking?.owner_toggle || (locale === 'es' ? 'Propietario' : 'Owner');

    return (
        <div className={isModal ? "flex flex-col gap-4 py-2" : "flex flex-col gap-4 p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-card-border)] hover:border-[var(--color-primary)]/30 transition-all shadow-sm"}>
            <div className="flex items-start gap-3">
                <div className="size-10 rounded-full shrink-0 overflow-hidden bg-[var(--color-card-border)] flex items-center justify-center shadow-inner">
                    {row.validatorIcon ? (
                        <SafeImage src={row.validatorIcon} alt={row.validatorName || 'Validator'} fallbackName={row.validatorName || 'Validator'} className="w-full h-full object-cover" />
                    ) : (
                        <Landmark className="size-5 text-[var(--color-text-muted)]" />
                    )}
                </div>
                <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                    <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-sm text-[var(--color-text-main)] truncate">{row.validatorName || 'Unknown Validator'}</span>
                        {isModal && isOwner && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); const next = !ownerMode; setOwnerMode(next); onOwnerModeChange?.(row.validatorAddress, next); }}
                                className={`text-[10px] font-bold uppercase tracking-wider transition-opacity shrink-0 ${ownerMode ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:opacity-70'}`}
                            >
                                {ownerToggleLabel}
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-[var(--color-text-muted)] truncate select-all">{row.validatorAddress}</span>
                        {isOwner && onOpenCsvModal && network === 'mainnet' && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onOpenCsvModal(row.validatorAddress); }}
                                className="p-1 rounded transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-primary)] shrink-0"
                                title={tt?.account_summary?.download_rewards_tooltip || 'Download Rewards'}
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
            <div className="grid grid-cols-3 gap-4 py-2 border-t border-[var(--color-card-border)]/50">
                <div className="flex flex-col items-center text-center">
                    <span className="text-[10px] uppercase font-black text-[var(--color-text-muted)] tracking-widest mb-1">{accT?.stake_xrd || 'STAKE XRD'}</span>
                    <span className="text-sm font-mono font-black text-[var(--color-primary)]">{formatNumber(ownerMode ? ownerLockedStakeXrd : row.xrdInStake, 2, locale)} XRD</span>
                </div>
                <div className="flex flex-col items-center text-center" title={!ownerMode ? (() => {
                    const epoch = (entityData as any)?.ledger_state?.epoch ?? 0;
                    const lines = (row.unstakes || []).reduce<string[]>((acc, u) => {
                        if (u.epoch > epoch) {
                            const epochsRemaining = u.epoch - epoch;
                            const date = new Date(mountTime + epochsRemaining * 5 * 60 * 1000);
                            const dateStr = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                            acc.push(`Epoch ${u.epoch} ~ ${dateStr}`);
                        }
                        return acc;
                    }, []);
                    return lines.length > 0 ? lines.join('\n') : undefined;
                })() : (ownerData?.unstakeTooltip || undefined)}>
                    <span className="text-[10px] uppercase font-black text-[var(--color-text-muted)] tracking-widest mb-1">{accT?.unstake_xrd || 'UNSTAKE XRD'}</span>
                    <span className="text-sm font-mono font-black text-[var(--color-secondary)]">{formatNumber(ownerMode ? ownerPendingUnlockXrd : row.xrdInUnstake, 2, locale)} XRD</span>
                </div>
                <div className="flex flex-col items-center text-center" title={ownerMode ? ((tt as any)?.dashboard?.staking?.claim_tooltip || 'The claimed LSU tokens are added to the delegator stake of this validator.') : undefined}>
                    <span className="text-[10px] uppercase font-black text-[var(--color-text-muted)] tracking-widest mb-1">{accT?.claim_xrd || 'CLAIM XRD'}</span>
                    <span className="text-sm font-mono font-black text-[var(--color-accent)]">{formatNumber(ownerMode ? ownerUnlockedXrd : row.xrdInClaim, 2, locale)} XRD</span>
                </div>
            </div>
            {isModal && !hideStakingControls && (
                <AccountValidatorStakeAction
                    accountAddress={address}
                    validatorAddress={row.validatorAddress}
                    network={network}
                    entityData={entityData}
                    xrdBalance={parseFloat(xrdAmount)}
                    stakedXrd={ownerMode ? ownerLockedStakeXrd : row.xrdInStake}
                    claimableXrd={ownerMode ? ownerUnlockedXrd : row.xrdInClaim}
                    lsuBalance={lsuTokens.find((t: any) => t.validatorAddress === row.validatorAddress)?.amount ? parseFloat(lsuTokens.find((t: any) => t.validatorAddress === row.validatorAddress)!.amount) : 0}
                    ghostAmount={!ownerMode && globalAmountStr && selectedValidatorAddresses.includes(row.validatorAddress) ? (parseFloat(globalAmountStr) / selectedValidatorAddresses.length).toString() : undefined}
                    selections={validatorSelections[row.validatorAddress] || {}}
                    onUpdateSelections={(newSels: any) => {
                        setGlobalAmountStr('');
                        onUpdateSelections(row.validatorAddress, newSels);
                    }}
                    isMultiMode={isMultiMode}
                    ownerMode={ownerMode}
                    tt={tt}
                    stakingErrors={stakingErrors}
                />
            )}
        </div>
    );
}
