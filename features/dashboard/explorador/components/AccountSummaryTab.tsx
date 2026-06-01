
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState } from 'react';
import { Copy, Check, Info, Download, Landmark, X } from 'lucide-react';
import { m, AnimatePresence } from "motion/react";
import { Portal } from '@/components/ui/Portal';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { AccountRewardsCsvModal } from './AccountRewardsCsvModal';
import { usePrefetchRewards } from '@/features/dashboard/hooks/usePrefetchRewards';
import { SafeImage } from '@/components/ui/SafeImage';
import { AccountValidatorStakeAction } from './AccountValidatorStakeAction';
import { BatchValidatorStakeAction } from './BatchValidatorStakeAction';
import { ValidatorCarouselSelector } from './ValidatorCarouselSelector';
import { PanelLoadingState } from './EntityPanelShared';
import { formatNumber, truncateAddress } from '@/utils/formatters';
import type { GatewayEntityDetails, TranslationsT, MarketData } from '@/features/dashboard/types';
import { getCurrencyForLocale, formatCurrency } from '../../../../utils/currencyUtils';
import { type AccountRewardsCsvModalDict } from '../types/components.types';
import { useAccountStats } from '../hooks/useAccountStats';
import type { StakingEntry } from '../types/models.types';
import { useValidatorsQuery } from '@/features/dashboard/staking/hooks/useValidatorsQuery';
import { useStakingTransaction } from '@/features/dashboard/staking/hooks/useStakingTransaction';
import { BatchStakeItem, BatchUnstakeItem, BatchClaimItem, MixedBatchItem } from '@/features/wallet/lib/manifest-builders';
import { StakingAction } from '@/features/dashboard/staking/types/staking-operations.types';
import { useQueryClient } from '@tanstack/react-query';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { apiFetchTransactionDetails, apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';

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
    isClaim: boolean;
    ids?: string[];
    isNft: boolean;
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
    isModal = false
}: AccountSummaryTabProps & { isBadge?: boolean }) {
    const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
    const { prefetchAccountRewards } = usePrefetchRewards();
    const queryClient = useQueryClient();
    const { activeNetworkId } = useRadixWallet();
    const { data: validatorsData } = useValidatorsQuery(network);

    const [selectedValidatorAddresses, setSelectedValidatorAddresses] = useState<string[]>([]);
    const [hasInitializedSelections, setHasInitializedSelections] = useState(false);
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

    const [globalAmountStr, setGlobalAmountStr] = useState('');
    const [actionError, setActionError] = useState<string | null>(null);
    const [transactingAction, setTransactingAction] = useState<StakingAction | null>(null);

    type ValidatorSelections = { amountStr?: string; stake?: string; unstake?: string; claim?: boolean };
    const [validatorSelections, setValidatorSelections] = useState<Record<string, ValidatorSelections>>({});

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

            const activeAddresses = Object.keys(updated).filter(addr => {
                const s = updated[addr];
                return s && (s.amountStr || s.stake || s.unstake || s.claim);
            });

            if (activeAddresses.length > 1) {
                activeAddresses.forEach(addr => {
                    const sel = updated[addr];
                    if (sel && sel.amountStr && !sel.stake && !sel.unstake && !sel.claim) {
                        sel.stake = sel.amountStr;
                        delete sel.amountStr;
                    }
                });
            }

            return updated;
        });
    };

    const activeValidatorAddresses = Object.keys(validatorSelections).filter(vAddr => {
        const s = validatorSelections[vAddr];
        return (s.amountStr && parseFloat(s.amountStr) > 0) || s.stake || s.unstake || s.claim;
    });

    // MultiMode se activa si más de un validador tiene alguna cantidad o selección manual, o si un validador tiene múltiples selecciones.
    const isMultiMode = activeValidatorAddresses.length > 1 ||
        Object.values(validatorSelections).some(s => (s.stake ? 1 : 0) + (s.unstake ? 1 : 0) + (s.claim ? 1 : 0) > 1);

    const { submitBatchTransaction, submitMixedBatchTransaction, isTransacting, error: batchError, clearError } = useStakingTransaction();

    const description = getMeta('description');
    const {
        isLoading,
        xrdAmount,
        tokens,
        lsuTokens,
        activeNfts,
        burnedNfts,
        poolUnits,
        stakingRows,
        totalLsuAmount,
        totalLsuXrdEquivalent,
    } = useAccountStats(address, network, entityData);

    if (isLoading) {
        return <PanelLoadingState tt={tt} />;
    }

    // Initialize selections with existing delegations once data loads
    if (!hasInitializedSelections && !isLoading && stakingRows.length > 0) {
        setSelectedValidatorAddresses(stakingRows.map(r => r.validatorAddress));
        setHasInitializedSelections(true);
    }
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

    const handleBatchAction = async (actionToPerform: StakingAction) => {
        setActionError(null);
        setTransactingAction(actionToPerform);

        const items: BatchStakeItem[] | BatchUnstakeItem[] | BatchClaimItem[] = [];

        // Global Batch Action
        const globalAmount = parseFloat(globalAmountStr || '0');
        if (actionToPerform !== 'Claim' && globalAmount <= 0) {
            setActionError('Ingresa una cantidad válida.');
            setTransactingAction(null);
            return;
        }

        const count = selectedValidatorAddresses.length;
        if (count === 0) {
            setActionError('Selecciona al menos un validador.');
            setTransactingAction(null);
            return;
        }

        const amountPerValidator = globalAmount / count;

        for (const vAddr of selectedValidatorAddresses) {
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
                    setActionError(`Saldo insuficiente en validador ${vAddr.slice(0, 8)}...`);
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
            setActionError('No hay acciones válidas a realizar.');
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
                    setActionError(`Saldo insuficiente en validador ${vAddr.slice(0, 8)}... para Unstake.`);
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
            setActionError('No hay acciones válidas configuradas.');
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
                queryClient.invalidateQueries({ queryKey: ['entity'] });
                queryClient.invalidateQueries({ queryKey: ['account-transactions'] });
                queryClient.invalidateQueries({ queryKey: ['account-claim-nfts'] });
                queryClient.invalidateQueries({ queryKey: ['account-entity-details'] });
                queryClient.invalidateQueries({ queryKey: ['validators'] });
                setTransactingAction(null);
                return;
            }

            try {
                const details = await apiFetchTransactionDetails(hash, netName);
                if (details && (details.transaction_status === 'CommittedSuccess' || details.transaction_status === 'Committed')) {
                    try {
                        await apiFetchEntityDetails(address, netName, true);
                    } catch (e) {
                        console.error('Failed to pre-fetch entity details after transaction', e);
                    }
                    queryClient.invalidateQueries({ queryKey: ['entity'] });
                    queryClient.invalidateQueries({ queryKey: ['account-transactions'] });
                    queryClient.invalidateQueries({ queryKey: ['account-claim-nfts'] });
                    queryClient.invalidateQueries({ queryKey: ['account-entity-details'] });
                    queryClient.invalidateQueries({ queryKey: ['validators'] });
                    setTransactingAction(null);
                    return;
                } else if (details && details.transaction_status === 'CommittedFailure') {
                    setActionError('La transacción falló.');
                    setTransactingAction(null);
                    return;
                } else if (details && details.transaction_status === 'Rejected') {
                    setActionError('La transacción fue rechazada.');
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
                <div className="min-w-0">
                    <p className="font-bold text-sm text-[var(--color-text-main)] truncate">
                        {entityName || tt?.account_summary?.account || 'Account'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono text-[var(--color-text-muted)] truncate select-all">
                            {address}
                        </span>
                        {address.startsWith('account_') && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setIsCsvModalOpen(true); }}
                                onPointerEnter={() => prefetchAccountRewards(address)}
                                className="p-1 rounded transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                                title={tt?.account_summary?.download_rewards_tooltip || 'Download Rewards'}
                            >
                                <Download className="size-3" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onCopy(address); }}
                            className={`p-1 rounded transition-colors ${copiedAddress === address ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                        >
                            {copiedAddress === address ? <Check className="size-3" /> : <Copy className="size-3" />}
                        </button>
                    </div>
                </div>
            </div>

            {description && (
                <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed italic border-l-2 border-[var(--color-primary)]/30 pl-3">
                    {description}
                </p>
            )}

            {/* Principal Balance */}
            <div>
                <h4 className={`text-xs font-black uppercase text-[var(--color-text-muted)] tracking-wider mb-3 ${isModal ? 'pb-2 border-b border-[var(--color-border)]' : ''}`}>{isModal ? 'Balance' : (tt?.account_summary?.principal_balance || 'Principal Balance')}</h4>
                {!isBadge ? (
                    isModal ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3 items-stretch">
                                <BalanceCard
                                    title={tt?.account_summary?.total_xrd || 'TOTAL XRD'}
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
                                    title={tt?.account_summary?.total_lsu || 'TOTAL LSU'}
                                    amount={String(totalLsuAmount)}
                                    symbol="LSU"
                                    valueColor="text-blue-500 dark:text-blue-400"
                                    marketData={marketData}
                                    locale={locale}
                                    rawFiatAmount={totalLsuXrdEquivalent}
                                    isModal={isModal}
                                    align="right"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-3 items-stretch">
                                <BalanceCard
                                    title={tt?.account_summary?.stake_xrd || 'STAKE XRD'}
                                    amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInStake, 0))}
                                    symbol="XRD"
                                    valueColor="text-[var(--color-text-main)]"
                                    marketData={marketData}
                                    locale={locale}
                                    rawFiatAmount={stakingRows.reduce((acc, row) => acc + row.xrdInStake, 0)}
                                    isModal={isModal}
                                    align="left"
                                />
                                <BalanceCard
                                    title={tt?.account_summary?.unstake_xrd || 'UNSTAKE XRD'}
                                    amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInUnstake, 0))}
                                    symbol="XRD"
                                    valueColor="text-orange-500"
                                    marketData={marketData}
                                    locale={locale}
                                    rawFiatAmount={stakingRows.reduce((acc, row) => acc + row.xrdInUnstake, 0)}
                                    isModal={isModal}
                                    align="center"
                                />
                                <BalanceCard
                                    title={tt?.account_summary?.claim_xrd || 'CLAIM XRD'}
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
                                title={tt?.account_summary?.total_xrd || 'TOTAL XRD'}
                                amount={xrdAmount}
                                symbol="XRD"
                                valueColor="text-[var(--color-accent)]"
                                marketData={marketData}
                                locale={locale}
                                rawFiatAmount={Number(xrdAmount) || 0}
                                isModal={isModal}
                            />
                            <BalanceCard
                                title={tt?.account_summary?.total_lsu || 'TOTAL LSU'}
                                amount={String(totalLsuAmount)}
                                symbol="LSU"
                                valueColor="text-blue-500 dark:text-blue-400"
                                marketData={marketData}
                                locale={locale}
                                rawFiatAmount={totalLsuXrdEquivalent}
                                isModal={isModal}
                            />
                            <BalanceCard
                                title={tt?.account_summary?.stake_xrd || 'STAKE XRD'}
                                amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInStake, 0))}
                                symbol="XRD"
                                valueColor="text-[var(--color-text-main)]"
                                marketData={marketData}
                                locale={locale}
                                rawFiatAmount={stakingRows.reduce((acc, row) => acc + row.xrdInStake, 0)}
                                isModal={isModal}
                            />
                            <BalanceCard
                                title={tt?.account_summary?.unstake_xrd || 'UNSTAKE XRD'}
                                amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInUnstake, 0))}
                                symbol="XRD"
                                valueColor="text-orange-500"
                                marketData={marketData}
                                locale={locale}
                                rawFiatAmount={stakingRows.reduce((acc, row) => acc + row.xrdInUnstake, 0)}
                                isModal={isModal}
                            />
                            <BalanceCard
                                title={tt?.account_summary?.claim_xrd || 'CLAIM XRD'}
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
                                title={tt?.account_summary?.total_xrd || 'TOTAL XRD'}
                                amount={xrdAmount}
                                symbol="XRD"
                                valueColor="text-[var(--color-accent)]"
                                marketData={marketData}
                                locale={locale}
                            />
                            <BalanceCard
                                title={tt?.account_summary?.total_lsu || 'TOTAL LSU'}
                                amount={String(totalLsuAmount)}
                                symbol="LSU"
                                valueColor="text-blue-500 dark:text-blue-400"
                                marketData={marketData}
                                locale={locale}
                                rawFiatAmount={totalLsuXrdEquivalent}
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch">
                            <BalanceCard
                                title={tt?.account_summary?.stake_xrd || 'STAKE XRD'}
                                amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInStake, 0))}
                                symbol="XRD"
                                valueColor="text-[var(--color-text-main)]"
                                marketData={marketData}
                                locale={locale}
                            />
                            <BalanceCard
                                title={tt?.account_summary?.unstake_xrd || 'UNSTAKE XRD'}
                                amount={String(stakingRows.reduce((acc, row) => acc + row.xrdInUnstake, 0))}
                                symbol="XRD"
                                valueColor="text-orange-500"
                                marketData={marketData}
                                locale={locale}
                            />
                            <BalanceCard
                                title={tt?.account_summary?.claim_xrd || 'CLAIM XRD'}
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
            {displayRows.length > 0 && (
                <div className="mb-8">
                    <h4 className={`text-xs font-black uppercase text-[var(--color-text-muted)] tracking-wider flex items-center gap-2 ${isModal ? 'pb-2 mb-4 border-b border-[var(--color-card-border)] w-full' : 'mb-4'}`}>
                        {tt?.account_summary?.staking_validators_title || 'STAKING'} ({displayRows.length})
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setIsInfoModalOpen(true); }}
                            className="hover:text-[var(--color-primary)] transition-colors p-1"
                            title="Información sobre acciones globales y mixtas"
                        >
                            <Info className="size-4" />
                        </button>
                    </h4>

                    {isModal && stakingRows.length > 0 && (
                        <div className="mb-6 space-y-4">
                            <BatchValidatorStakeAction
                                selectedValidatorsCount={selectedValidatorAddresses.length}
                                xrdBalance={Number(xrdAmount) || 0}
                                totalStakedXrdSelected={selectedValidatorAddresses.reduce((acc, address) => acc + (stakingRows.find(row => row.validatorAddress === address)?.xrdInStake || 0), 0)}
                                globalAmountStr={globalAmountStr}
                                setGlobalAmountStr={(val) => {
                                    setValidatorSelections({});
                                    setGlobalAmountStr(val);
                                }}
                                onBatchAction={handleBatchAction}
                                isTransacting={isTransacting}
                                transactingAction={transactingAction}
                                actionError={actionError || batchError}
                                setActionError={setActionError}
                                clearError={clearError}
                            >
                                <ValidatorCarouselSelector
                                    options={carouselOptions}
                                    selectedValues={selectedValidatorAddresses}
                                    onChange={setSelectedValidatorAddresses}
                                    placeholder="Buscar validadores para delegar..."
                                />
                            </BatchValidatorStakeAction>
                        </div>
                    )}

                    <div className="space-y-4">
                        {displayRows.map((row) => (
                            <div key={row.validatorAddress} className={isModal ? "flex flex-col gap-4 py-2" : "flex flex-col gap-4 p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-card-border)] hover:border-[var(--color-primary)]/30 transition-all shadow-sm"}>
                                {/* Validator Header */}
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-full shrink-0 overflow-hidden bg-[var(--color-card-border)] flex items-center justify-center shadow-inner">
                                        {row.validatorIcon ? (
                                            <SafeImage src={row.validatorIcon} alt={row.validatorName || 'Validator'} fallbackName={row.validatorName || 'Validator'} className="w-full h-full object-cover" />
                                        ) : (
                                            <Landmark className="size-5 text-[var(--color-text-muted)]" />
                                        )}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-black text-sm text-[var(--color-text-main)] truncate">{row.validatorName || 'Unknown Validator'}</span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs font-mono text-[var(--color-text-muted)] truncate select-all">{row.validatorAddress}</span>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); onCopy(row.validatorAddress); }}
                                                className={`p-1 rounded transition-colors ${copiedAddress === row.validatorAddress ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                            >
                                                {copiedAddress === row.validatorAddress ? <Check className="size-3" /> : <Copy className="size-3" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Staking Grid */}
                                <div className="grid grid-cols-3 gap-4 py-2 border-t border-[var(--color-card-border)]/50">
                                    <div className="flex flex-col items-center text-center">
                                        <span className="text-[10px] uppercase font-black text-[var(--color-text-muted)] tracking-widest mb-1">{tt?.account_summary?.stake_xrd || 'STAKE XRD'}</span>
                                        <span className="text-sm font-mono font-black text-[var(--color-text-main)]">{formatNumber(row.xrdInStake, 2, locale)} XRD</span>
                                    </div>
                                    <div className="flex flex-col items-center text-center">
                                        <span className="text-[10px] uppercase font-black text-[var(--color-text-muted)] tracking-widest mb-1">{tt?.account_summary?.unstake_xrd || 'UNSTAKE XRD'}</span>
                                        <span className="text-sm font-mono font-black text-orange-500">{formatNumber(row.xrdInUnstake, 2, locale)} XRD</span>
                                    </div>
                                    <div className="flex flex-col items-center text-center">
                                        <span className="text-[10px] uppercase font-black text-[var(--color-text-muted)] tracking-widest mb-1">{tt?.account_summary?.claim_xrd || 'CLAIM XRD'}</span>
                                        <span className="text-sm font-mono font-black text-[var(--color-accent)]">{formatNumber(row.xrdInClaim, 2, locale)} XRD</span>
                                    </div>
                                </div>

                                {/* Interactive Staking Actions */}
                                {isModal && (
                                    <AccountValidatorStakeAction
                                        accountAddress={address}
                                        validatorAddress={row.validatorAddress}
                                        network={network}
                                        entityData={entityData}
                                        xrdBalance={parseFloat(xrdAmount)}
                                        stakedXrd={row.xrdInStake}
                                        claimableXrd={row.xrdInClaim}
                                        lsuBalance={lsuTokens.find(t => t.validatorAddress === row.validatorAddress)?.amount ? parseFloat(lsuTokens.find(t => t.validatorAddress === row.validatorAddress)!.amount) : 0}
                                        ghostAmount={globalAmountStr && selectedValidatorAddresses.includes(row.validatorAddress) ? (parseFloat(globalAmountStr) / selectedValidatorAddresses.length).toString() : undefined}
                                        selections={validatorSelections[row.validatorAddress] || {}}
                                        onUpdateSelections={(newSels) => {
                                            setGlobalAmountStr(''); // Reset global lote para forzar modo individual
                                            handleUpdateSelections(row.validatorAddress, newSels);
                                        }}
                                        isMultiMode={isMultiMode}
                                    />
                                )}
                            </div>
                        ))}

                        {isMultiMode && Object.keys(validatorSelections).some(k => Object.keys(validatorSelections[k]).length > 0) && (
                            <m.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-6 pt-4 border-t border-[var(--color-border)]"
                            >
                                <h5 className="text-xs font-bold text-[var(--color-text-main)] mb-3 uppercase tracking-wider">Resumen de Operaciones</h5>
                                <div className="space-y-3 mb-6">
                                    {Object.keys(validatorSelections).map(vAddr => {
                                        const selections = validatorSelections[vAddr];
                                        if (!selections || Object.keys(selections).length === 0) return null;

                                        const row = displayRows.find(r => r.validatorAddress === vAddr);
                                        if (!row) return null;

                                        const actions = [];
                                        const stakeNum = parseFloat(selections.stake || '0');
                                        const unstakeNum = parseFloat(selections.unstake || '0');

                                        if (selections.stake && stakeNum > 0) actions.push({ label: 'Stake', value: `${selections.stake} XRD`, color: 'text-[var(--color-primary)]' });
                                        if (selections.unstake && unstakeNum > 0) actions.push({ label: 'Unstake', value: `${selections.unstake} XRD`, color: 'text-red-400' });
                                        if (selections.claim && row.xrdInClaim > 0) actions.push({ label: 'Claim', value: `${formatNumber(row.xrdInClaim, 2, locale)} XRD`, color: 'text-green-400' });

                                        if (actions.length === 0) return null;

                                        return (
                                            <div key={vAddr} className="flex flex-col text-sm border-b border-[var(--color-border)] pb-3 last:border-0 last:pb-0">
                                                {actions.length === 1 ? (
                                                    <div className="flex justify-between items-center w-full">
                                                        <span className="font-bold text-[var(--color-text-main)] truncate max-w-[60%]">{row.validatorName || vAddr.slice(0, 8) + '...'}</span>
                                                        <span className="font-bold whitespace-nowrap">
                                                            {actions[0].label}: <span className={actions[0].color}>{actions[0].value}</span>
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span className="font-bold text-[var(--color-text-main)] mb-2 truncate">{row.validatorName || vAddr.slice(0, 8) + '...'}</span>
                                                        <ul className="space-y-1 w-full">
                                                            {actions.map(act => (
                                                                <li key={act.label} className="flex justify-end items-center text-xs">
                                                                    <span className="font-bold mr-1">{act.label}:</span> <span className={`${act.color} font-bold`}>{act.value}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleMixedBatchAction}
                                    disabled={isTransacting}
                                    className="w-full font-bold py-3 px-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] text-white flex justify-center items-center gap-2"
                                >
                                    {isTransacting ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 size-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            Enviando a la Billetera...
                                        </>
                                    ) : (
                                        'Enviar a la billetera'
                                    )}
                                </button>

                                {actionError && (
                                    <div className="text-xs text-red-500 mt-3 p-2 bg-red-500/10 rounded border border-red-500/20 text-center">
                                        {actionError.replace(/^Error:\s*/, '')}
                                    </div>
                                )}
                                {(batchError && !actionError) && (
                                    <div className="text-xs text-red-500 mt-3 p-2 bg-red-500/10 rounded border border-red-500/20 text-center">
                                        {batchError.replace(/^Error:\s*/, '')}
                                    </div>
                                )}
                            </m.div>
                        )}
                    </div>
                </div>
            )}


            {/* Assets */}
            <AssetSection title={`Tokens (${tokens.length})`} items={tokens} onCopy={onCopy} copiedAddress={copiedAddress} locale={locale} isModal={isModal} />
            <AssetSection title={`NFTs (${activeNfts.length})`} items={activeNfts} onCopy={onCopy} copiedAddress={copiedAddress} locale={locale} isModal={isModal} />

            {burnedNfts.length > 0 && (
                <AssetSection
                    title={`${tt?.account_summary?.burned_nfts || 'NFTs Quemados'} (${burnedNfts.length})`}
                    items={burnedNfts}
                    onCopy={onCopy}
                    copiedAddress={copiedAddress}
                    burned
                    titleClassName="text-red-500/80"
                    locale={locale}
                    isModal={isModal}
                />
            )}
            <AssetSection title={`${tt?.account_summary?.pool_units || 'Pool Units'} (${poolUnits.length})`} items={poolUnits} onCopy={onCopy} copiedAddress={copiedAddress} locale={locale} isModal={isModal} />

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
                                        <h3 className="text-lg font-black tracking-tight">Acción Global y Mixta</h3>
                                    </div>

                                    <div className="space-y-4 text-sm text-[var(--color-text-main)] leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
                                        <p>
                                            El panel de Staking te permite realizar acciones masivas y mixtas sobre varios validadores en una sola transacción, ahorrando tiempo y firmas.
                                        </p>

                                        <h4 className="font-bold text-[var(--color-text-main)] border-b border-[var(--color-border)] pb-1">ACCIÓN GLOBAL (LOTES)</h4>
                                        <ul className="list-disc pl-5 space-y-2 text-[var(--color-text-muted)]">
                                            <li><strong className="text-[var(--color-text-main)]">Staking Masivo:</strong> Ingresa la cantidad de XRD en el campo superior. Esta se dividirá por igual entre todos los validadores seleccionados. <br /><span className="italic text-xs">Ejemplo: Si tienes 3 validadores seleccionados y pones 300 XRD, se enviarán 100 XRD a cada uno.</span></li>
                                            <li><strong className="text-[var(--color-text-main)]">Unstaking Masivo:</strong> Ingresa la cantidad TOTAL que deseas retirar. Se intentará extraer a partes iguales de cada validador. <br /><span className="italic text-xs">Ejemplo: Si pones 150 XRD y tienes 3 validadores, se extraerán 50 XRD de cada uno. Ojo: Ningún validador puede tener menos saldo del que le pides.</span></li>
                                            <li><strong className="text-[var(--color-text-main)]">Claim Masivo:</strong> No necesitas ingresar cantidad. Simplemente selecciona los validadores y haz clic en &quot;CLAIM TODOS&quot;.</li>
                                        </ul>

                                        <h4 className="font-bold text-[var(--color-text-main)] border-b border-[var(--color-border)] mt-4 pb-1">OPERACIONES MIXTAS MANUALES</h4>
                                        <ul className="list-disc pl-5 space-y-2 text-[var(--color-text-muted)]">
                                            <li><strong className="text-[var(--color-text-main)]">Modo Carrito:</strong> Si ingresas una cantidad de XRD en <strong>más de un validador</strong> de forma manual, se activa el modo carrito.</li>
                                            <li><strong className="text-[var(--color-text-main)]">Selección de Acción:</strong> Al hacer clic en Stake, Unstake o Claim, el botón se quedará marcado en lugar de abrir la billetera.</li>
                                            <li><strong className="text-[var(--color-text-main)]">Transacción Única:</strong> Una vez hayas seleccionado las acciones que deseas para cada validador (ej. Stake en uno, Unstake en otro, Claim en un tercero), aparecerá un resumen en la parte inferior con un botón de <strong>Enviar a la billetera</strong> que ejecutará todo en una sola transacción.</li>
                                        </ul>
                                    </div>
                                </div>
                            </m.div>
                        </>
                    )}
                </AnimatePresence>
            </Portal>

            {/* Account Rewards CSV Modal */}
            {isCsvModalOpen && (
                <AccountRewardsCsvModal
                    accountAddress={address}
                    isOpen={isCsvModalOpen}
                    onClose={() => setIsCsvModalOpen(false)}
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

        return (
            <div className={`flex flex-col gap-0.5 w-full py-2 ${alignClass}`}>
                <span className="text-[10px] uppercase font-black text-[var(--color-text-muted)] tracking-wider mb-0.5">
                    {title}
                </span>
                <div className="flex items-baseline gap-1.5 min-w-0">
                    <span className={`text-2xl font-black font-mono tracking-tight ${valueColor} truncate`} title={amount}>
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
            <div className={isModal ? "grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar items-stretch" : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar items-stretch"}>
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
                    <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] font-mono font-bold text-[var(--color-text-main)]">
                            {isNft ? formatNumber(parseInt(amount, 10), 0, locale) : (parseFloat(amount) >= 1000 ? formatNumber(parseFloat(amount), 2, locale) : formatNumber(parseFloat(amount), 4, locale))}
                        </span>
                        {symbol && <span className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider truncate">{symbol}</span>}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between mt-auto pt-2 border-t border-[var(--color-card-border)]">
                <div className="flex items-center gap-1">
                    <span className="text-[9px] font-mono text-[var(--color-text-muted)]">{truncateAddress(address, 13, 12)}</span>
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
