/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Info, ChevronDown } from 'lucide-react';
import { m, AnimatePresence } from 'motion/react';

import { Portal } from '@/components/ui/Portal';
import { useLanguage } from '@/context/LanguageContext';

import type { GatewayEntityDetails } from '@/features/dashboard/types';
import type { StakingEntry } from '@/features/dashboard/explorador/types/models.types';
import { useAccountStats } from '@/features/dashboard/explorador/hooks/useAccountStats';
import type { ValidatorSelections } from '@/features/dashboard/explorador/components/AccountValidatorStakeAction';
import { BatchValidatorStakeAction } from '@/features/dashboard/explorador/components/BatchValidatorStakeAction';
import { ValidatorCarouselSelector } from '@/features/dashboard/explorador/components/ValidatorCarouselSelector';
import { useValidatorsQuery } from '../hooks/useValidatorsQuery';
import { useStakingTransaction } from '../hooks/useStakingTransaction';
import { useStakingTxPoller } from '../hooks/useStakingTxPoller';
import type { StakingAction } from '../types/staking-operations.types';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { RADIX_TOKEN_ADDRESSES } from '@/features/wallet/constants/radix-addresses';
import { stakingErrorMessage } from '@/features/dashboard/staking/lib/stakingErrorMessage';
import { buildDistributedPlan, buildMixedPlan, type StakingPlanLabels } from '../lib/stakingPlan';
import { useStakingLocale } from '../hooks/useStakingLocale';
import { StakingMetricsBar } from './StakingMetricsBar';
import { StakingSummaryCard } from './StakingSummaryCard';
import { StakingInfoModal } from './StakingInfoModal';
import { ValidatorStakingRow, type StakingTranslations } from './ValidatorStakingRow';

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
    /**
     * Lets the host wrap each zone in its own container.
     *
     * The batch controls act on ALL selected validators while the rows below
     * act on one each, so they are two different things sharing one state.
     * Given this slot the component emits them as SEPARATE boxes (the console
     * puts each in its own `ToolSection`) instead of burying the batch panel
     * inside the staking box. Without it nothing changes: the modal keeps the
     * single compact block it has always had.
     */
    sectionWrapper?: (section: {
        key: string;
        title: string;
        hint?: string;
        action?: React.ReactNode;
        children: React.ReactNode;
    }) => React.ReactNode;
    /**
     * Heading for the validator list. Hosts that already name this zone keep
     * their own wording (the console's box is "Account staking", not
     * "Validators"); the delegation count is appended either way.
     */
    listTitle?: string;
    /**
     * Validators to start with selected (a link from a validator's profile).
     * When given they replace the default, which selects every validator the
     * account already stakes with.
     */
    initialValidators?: string[];
    /**
     * Console-only mode: shared full-width validator picker, Operations Summary
     * in Distributed tab, advanced owner controls, and live manifest sync.
     */
    consoleMode?: boolean;
    /** Active tab when hosted in consoleMode, so the manifest matches what is visible. */
    activeConsoleTab?: 'distributed' | 'multiple';
    /** Called whenever the active console tab's RTM manifest changes. */
    onConsoleManifestChange?: (manifest: string) => void;
    /** Console-only: runs a dry-run simulation of the given manifest from inside the summary box. */
    onConsoleSimulate?: (manifest: string) => void;
    /** Console-only: whether a simulation is currently in flight. */
    isConsoleSimulating?: boolean;
    /** Console-only: simulation result card rendered directly below the Simulate button. */
    consoleSimulateResult?: React.ReactNode;
    /** WalletProfileModal: shared portal host for centered non-overlapping floating summary cards. */
    summaryPortalTarget?: HTMLElement | null;
    /** WalletProfileModal: notifies when this account's floating summary card is open/closed. */
    onFloatingSummaryChange?: (address: string, active: boolean) => void;
    /** Display label for this account shown on floating summary cards when several accounts are active. */
    accountLabel?: string;
}

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
    sectionWrapper,
    listTitle,
    initialValidators,
    consoleMode = false,
    activeConsoleTab = 'distributed',
    onConsoleManifestChange,
    onConsoleSimulate,
    isConsoleSimulating = false,
    consoleSimulateResult,
    summaryPortalTarget = null,
    onFloatingSummaryChange,
    accountLabel,
}: AccountStakingSectionProps) {
    const { activeNetworkId, accounts } = useRadixWallet();
    const { data: validatorsData } = useValidatorsQuery(network);
    const { t: contextT } = useLanguage();
    const accT = tt?.account_summary || contextT?.dashboard?.transactions?.account_summary;
    const stakingT = useStakingLocale(locale);

    const { xrdAmount, lsuTokens, activeNfts, stakingRows, isLoading, claimableNfts = {} } = useAccountStats(address, network, entityData);
    const { submitBatchTransaction, submitMixedBatchTransaction, isTransacting, error: batchError, clearError } = useStakingTransaction();
    const { pollTransactionStatus } = useStakingTxPoller(address);

    const [selectedValidatorAddresses, setSelectedValidatorAddresses] = useState<string[]>(initialValidators ?? []);
    const [mountTime] = useState(() => Date.now());
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [hideStakingControls, setHideStakingControls] = useState(false);
    const [sectionOpen, setSectionOpen] = useState(true);
    const [globalAmountStr, setGlobalAmountStr] = useState('');
    const [batchAction, setBatchAction] = useState<StakingAction>('Stake');
    const [modalBatchActive, setModalBatchActive] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [transactingAction, setTransactingAction] = useState<StakingAction | null>(null);
    const [validatorSelections, setValidatorSelections] = useState<Record<string, ValidatorSelections>>({});
    const [ownerModeAddresses, setOwnerModeAddresses] = useState<Set<string>>(() => new Set());
    const [hasInitializedSelections, setHasInitializedSelections] = useState(!!initialValidators?.length);

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
        if (summaryPortalTarget) setModalBatchActive(false);

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

    const getStakingError = (err: string) => stakingErrorMessage(err, {
        ...stakingErrors,
        failedToPrepareTransaction: stakingErrors?.failedToPrepareTransaction || accT?.failed_to_prepare,
        rejectedByUser: stakingErrors?.rejectedByUser || accT?.rejected_by_user,
    });

    const validators = validatorsData?.validators ?? [];

    // Show all staked validators always, plus any additionally selected ones
    const displayRows: StakingEntry[] = [...new Set([
        ...stakingRows.map(r => r.validatorAddress),
        ...selectedValidatorAddresses,
    ])].map(vAddr => {
        const existing = stakingRows.find(r => r.validatorAddress === vAddr);
        if (existing) return existing;

        const valInfo = validators.find(v => v.address === vAddr);
        return {
            validatorName: valInfo?.name || 'Unknown Validator',
            validatorIcon: valInfo?.iconUrl || '',
            validatorAddress: vAddr,
            xrdInStake: 0,
            xrdInUnstake: 0,
            xrdInClaim: 0,
            unstakes: [],
        };
    });

    const carouselOptions = validators.map(v => ({
        value: v.address,
        label: v.name || 'Unknown',
        iconUrl: v.iconUrl,
    }));

    const batchTargetAddresses = consoleMode
        ? selectedValidatorAddresses
        : selectedValidatorAddresses.filter(addr => !ownerModeAddresses.has(addr));
    const canDistribute = batchTargetAddresses.length > 0;
    const canBatchUnstake = batchTargetAddresses.length > 0 && batchTargetAddresses.every(addr => {
        const staked = stakingRows.find(row => row.validatorAddress === addr)?.xrdInStake ?? 0;
        return Number.isFinite(staked) && Number(staked.toFixed(2)) > 0;
    });

    const resolvedNetworkId = activeNetworkId ?? (network === 'mainnet' ? RadixNetworkId.Mainnet : RadixNetworkId.Stokenet);
    const xrdResourceAddress = RADIX_TOKEN_ADDRESSES[resolvedNetworkId]?.XRD;
    const ownerBadgeResourceAddress = RADIX_TOKEN_ADDRESSES[resolvedNetworkId]?.OWNER_BADGE;

    const planLabels: StakingPlanLabels = {
        stakeLockedBadge: stakingT.badge_locks_lsu,
        stakeUnlockedBadge: stakingT.badge_unlocked,
        lockLsu: stakingT.lock_lsu,
        ownerUnstake: stakingT.owner_unstake,
        ownerClaim: stakingT.owner_claim,
        unlocked: stakingT.unlocked,
        insufficientStake: stakingT.insufficient_stake,
        insufficientLsu: stakingT.insufficient_lsu,
        insufficientBalanceValidator: accT?.insufficient_balance_validator || 'Insufficient balance in validator {address}',
        insufficientBalanceValidatorUnstake: accT?.insufficient_balance_validator_unstake || 'Insufficient balance in validator {address} for Unstake.',
    };

    const distributedPlan = buildDistributedPlan({
        accountAddress: address,
        action: batchAction,
        globalAmountStr,
        targetAddresses: batchTargetAddresses,
        displayRows,
        validators,
        lsuTokens,
        claimableNfts,
        xrdAmount,
        xrdResourceAddress,
        locale,
        labels: planLabels,
    });

    const mixedPlan = buildMixedPlan({
        accountAddress: address,
        validatorSelections,
        ownerModeAddresses,
        displayRows,
        validators,
        lsuTokens,
        claimableNfts,
        xrdAmount,
        xrdResourceAddress,
        ownerBadgeResourceAddress,
        locale,
        labels: planLabels,
    });

    const hasMixedSelections = mixedPlan.groups.length > 0;

    const activeManifest = activeConsoleTab === 'distributed' ? distributedPlan.manifest : mixedPlan.manifest;
    useEffect(() => {
        if (!consoleMode || !onConsoleManifestChange) return;
        onConsoleManifestChange(activeManifest);
    }, [consoleMode, onConsoleManifestChange, activeManifest]);

    const hasFloatingBatchSummary =
        !!summaryPortalTarget &&
        !hasMixedSelections &&
        modalBatchActive &&
        (batchAction === 'Claim'
            ? distributedPlan.groups.length > 0
            : parseFloat(globalAmountStr || '0') > 0 && batchTargetAddresses.length > 0);

    const isFloatingSummaryOpen =
        (displayRows.length > 0 || alwaysShowControls) &&
        !!summaryPortalTarget &&
        (hasMixedSelections || hasFloatingBatchSummary);

    const onFloatingSummaryChangeRef = useRef(onFloatingSummaryChange);
    useEffect(() => {
        onFloatingSummaryChangeRef.current = onFloatingSummaryChange;
    }, [onFloatingSummaryChange]);

    useEffect(() => {
        onFloatingSummaryChangeRef.current?.(address, isFloatingSummaryOpen);
        return () => onFloatingSummaryChangeRef.current?.(address, false);
    }, [address, isFloatingSummaryOpen]);

    const handleBatchAction = async (actionToPerform: StakingAction) => {
        setActionError(null);
        setTransactingAction(actionToPerform);

        const plan = actionToPerform === batchAction
            ? distributedPlan
            : buildDistributedPlan({
                accountAddress: address,
                action: actionToPerform,
                globalAmountStr,
                targetAddresses: batchTargetAddresses,
                displayRows,
                validators,
                lsuTokens,
                claimableNfts,
                xrdAmount,
                xrdResourceAddress,
                locale,
                labels: planLabels,
            });

        if (actionToPerform !== 'Claim' && parseFloat(globalAmountStr || '0') <= 0) {
            setActionError(accT?.enter_valid_amount || 'Enter a valid amount.');
            setTransactingAction(null);
            return;
        }
        if (plan.error) {
            setActionError(plan.error);
            setTransactingAction(null);
            return;
        }

        const items =
            actionToPerform === 'Stake'
                ? plan.stakeItems
                : actionToPerform === 'Unstake'
                    ? plan.unstakeItems
                    : plan.claimItems;

        if (items.length === 0) {
            setActionError(accT?.no_valid_actions || 'No valid actions to perform.');
            setTransactingAction(null);
            return;
        }

        const hash = await submitBatchTransaction(address, actionToPerform, items as any);
        if (hash) {
            setGlobalAmountStr('');
            setModalBatchActive(false);
            setSelectedValidatorAddresses([]);
            pollTransactionStatus(hash, {
                onDone: () => setTransactingAction(null),
                onError: setActionError,
                failedText: accT?.transaction_failed,
                rejectedText: accT?.transaction_rejected,
            });
        } else {
            setTransactingAction(null);
        }
    };

    const handleMixedBatchAction = async () => {
        setActionError(null);
        setTransactingAction('Stake');

        if (mixedPlan.error) {
            setActionError(mixedPlan.error);
            setTransactingAction(null);
            return;
        }
        if (mixedPlan.items.length === 0) {
            setActionError(accT?.no_valid_actions_configured || 'No valid actions configured.');
            setTransactingAction(null);
            return;
        }

        const hash = await submitMixedBatchTransaction(address, mixedPlan.items);
        if (hash) {
            setValidatorSelections({});
            pollTransactionStatus(hash, {
                onDone: () => setTransactingAction(null),
                onError: setActionError,
                failedText: accT?.transaction_failed,
                rejectedText: accT?.transaction_rejected,
            });
        } else {
            setTransactingAction(null);
        }
    };

    if (displayRows.length === 0 && !alwaysShowControls) return null;

    const resetLabel = (contextT?.dashboard as any)?.calendar?.reset_button || 'Reset';
    const summaryTitle = accT?.info_modal_title_operations || 'Operation Summary';
    const sendLabel = accT?.send_to_wallet || 'Send to wallet';
    const sendingLabel = accT?.sending_to_wallet || 'Sending to Wallet...';
    const resolvedError = actionError ? getStakingError(actionError) : batchError ? getStakingError(batchError) : null;

    const closeFloatingSummary = () => {
        setValidatorSelections({});
        setGlobalAmountStr('');
        setModalBatchActive(false);
        setActionError(null);
        if (clearError) clearError();
    };

    const renderMixedSummaryCard = (variant: 'inline' | 'side' | 'floating') => (
        <StakingSummaryCard
            variant={variant}
            title={summaryTitle}
            resetLabel={resetLabel}
            closeLabel={stakingT.close}
            sendLabel={sendLabel}
            sendingLabel={sendingLabel}
            simulateLabel={stakingT.simulate}
            accountAddress={address}
            accountLabel={accountLabel}
            groups={mixedPlan.groups}
            canSend={mixedPlan.canSend}
            isTransacting={isTransacting}
            onSend={() => void handleMixedBatchAction()}
            onReset={() => {
                setValidatorSelections({});
                if (!consoleMode) {
                    setGlobalAmountStr('');
                    setModalBatchActive(false);
                }
            }}
            onClose={variant === 'floating' ? closeFloatingSummary : undefined}
            onSimulate={consoleMode && onConsoleSimulate ? () => onConsoleSimulate(mixedPlan.manifest) : undefined}
            simulateDisabled={!mixedPlan.manifest.trim()}
            isSimulating={isConsoleSimulating}
            simulateResult={consoleMode && activeConsoleTab === 'multiple' ? consoleSimulateResult : undefined}
            errorMessage={resolvedError}
        />
    );

    const distributedEmptyHint =
        batchTargetAddresses.length === 0
            ? stakingT.empty_select_validator
            : batchAction === 'Claim'
                ? stakingT.empty_no_claimable
                : stakingT.empty_enter_amount;

    const renderDistributedSummaryCard = (variant: 'side' | 'floating') => (
        <StakingSummaryCard
            variant={variant}
            title={summaryTitle}
            resetLabel={resetLabel}
            closeLabel={stakingT.close}
            sendLabel={sendLabel}
            sendingLabel={sendingLabel}
            simulateLabel={stakingT.simulate}
            accountAddress={address}
            accountLabel={accountLabel}
            groups={distributedPlan.groups}
            emptyHint={distributedEmptyHint}
            canSend={distributedPlan.canSend}
            isTransacting={isTransacting}
            onSend={() => void handleBatchAction(batchAction)}
            onReset={() => {
                setGlobalAmountStr('');
                setModalBatchActive(false);
                setActionError(null);
                if (clearError) clearError();
            }}
            resetDisabled={!globalAmountStr && batchAction !== 'Claim'}
            onClose={variant === 'floating' ? closeFloatingSummary : undefined}
            onSimulate={consoleMode && onConsoleSimulate ? () => onConsoleSimulate(distributedPlan.manifest) : undefined}
            simulateDisabled={!distributedPlan.manifest.trim()}
            isSimulating={isConsoleSimulating}
            simulateResult={consoleMode && activeConsoleTab === 'distributed' ? consoleSimulateResult : undefined}
            errorMessage={resolvedError}
        />
    );

    const showBatchControls = isModal && !hideStakingControls && (stakingRows.length > 0 || alwaysShowControls);

    const batchTotalStakedXrd = batchTargetAddresses.reduce((acc, addr) => acc + (stakingRows.find(row => row.validatorAddress === addr)?.xrdInStake || 0), 0);
    const batchTotalUnstakingXrd = batchTargetAddresses.reduce((acc, addr) => acc + (stakingRows.find(row => row.validatorAddress === addr)?.xrdInUnstake || 0), 0);
    const batchTotalClaimableXrd = batchTargetAddresses.reduce((acc, addr) => acc + (stakingRows.find(row => row.validatorAddress === addr)?.xrdInClaim || 0), 0);

    const validatorSelector = (
        <ValidatorCarouselSelector
            options={carouselOptions}
            selectedValues={selectedValidatorAddresses}
            onChange={setSelectedValidatorAddresses}
            placeholder={accT?.validator_search_placeholder || 'Search validators to delegate...'}
            headerTitle={accT?.select_validator_title || 'Select validator'}
            footerActionText={accT?.add_validator_btn || 'Add'}
        />
    );

    const batchActionNode = showBatchControls ? (
        <div className="space-y-4">
            {consoleMode && (
                <StakingMetricsBar
                    balanceXrd={parseFloat(xrdAmount || '0')}
                    stakeXrd={batchTotalStakedXrd}
                    unstakeXrd={batchTotalUnstakingXrd}
                    claimXrd={batchTotalClaimableXrd}
                    locale={locale}
                    stakeLabel={accT?.stake_xrd || 'STAKE XRD'}
                    unstakeLabel={accT?.unstake_xrd || 'UNSTAKE XRD'}
                    claimLabel={accT?.claim_xrd || 'CLAIM XRD'}
                    borderPosition="bottom"
                />
            )}
            <BatchValidatorStakeAction
                selectedValidatorsCount={selectedValidatorAddresses.length}
                xrdBalance={Number(xrdAmount) || 0}
                totalStakedXrdSelected={batchTotalStakedXrd}
                totalClaimableXrdSelected={batchTotalClaimableXrd}
                globalAmountStr={globalAmountStr}
                setGlobalAmountStr={(val) => {
                    if (!consoleMode) setValidatorSelections({});
                    setGlobalAmountStr(val);
                    if (summaryPortalTarget) {
                        setModalBatchActive(parseFloat(val || '0') > 0 || batchAction === 'Claim');
                    }
                }}
                onBatchAction={consoleMode
                    ? (action) => {
                        setBatchAction(action);
                        setActionError(null);
                        if (clearError) clearError();
                    }
                    : summaryPortalTarget
                        ? (action) => {
                            setValidatorSelections({});
                            setBatchAction(action);
                            setModalBatchActive(action === 'Claim' || parseFloat(globalAmountStr || '0') > 0);
                            setActionError(null);
                            if (clearError) clearError();
                        }
                        : handleBatchAction}
                selectedAction={consoleMode || summaryPortalTarget ? batchAction : undefined}
                isTransacting={isTransacting}
                transactingAction={transactingAction}
                actionError={actionError || getStakingError(batchError || '')}
                setActionError={setActionError}
                clearError={clearError}
                tt={tt}
                canDistribute={canDistribute}
                canUnstake={canBatchUnstake}
                unstyled={!!sectionWrapper}
            >
                {!consoleMode && validatorSelector}
            </BatchValidatorStakeAction>
        </div>
    ) : null;

    const batchControls = batchActionNode
        ? (consoleMode && summaryPlacement === 'side' ? (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_21rem] gap-6 items-start">
                <div className="min-w-0">{batchActionNode}</div>
                <aside className="min-w-0 xl:sticky xl:top-24">{renderDistributedSummaryCard('side')}</aside>
            </div>
        ) : batchActionNode)
        : null;

    const infoButton = (
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsInfoModalOpen(true); }}
            className="hover:text-[var(--color-primary)] transition-colors p-1"
            title={accT?.info_tooltip || 'Information about global and mixed actions'}
        >
            <Info className="size-4" />
        </button>
    );

    const hideToggle = isModal ? (
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setHideStakingControls(!hideStakingControls); }}
            title={hideStakingControls ? ((accT as any)?.show_staking_tooltip || (locale === 'es' ? 'Mostrar controles de staking' : 'Show staking controls')) : ((accT as any)?.hide_staking_tooltip || (locale === 'es' ? 'Ocultar controles de staking' : 'Hide staking controls'))}
            className={`text-[10px] font-bold uppercase tracking-wider transition-opacity shrink-0 ${hideStakingControls ? 'text-[var(--color-text-muted)] hover:opacity-70' : 'text-[var(--color-primary)]'}`}
        >
            {hideStakingControls ? ((accT as any)?.show_staking || (locale === 'es' ? 'Mostrar Staking' : 'Show Staking')) : ((accT as any)?.hide_staking || (locale === 'es' ? 'Ocultar Staking' : 'Hide Staking'))}
        </button>
    ) : null;

    const validatorList = (
        <div className={summaryPlacement === 'side' && hasMixedSelections ? 'grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_21rem] gap-6 items-start' : ''}>
            <div className="min-w-0">
                <div className="space-y-4">
                    {displayRows.map((row) => (
                        <ValidatorStakingRow
                            key={row.validatorAddress}
                            row={row}
                            claimableNftIds={claimableNfts[row.validatorAddress]?.ids ?? []}
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
                            locale={locale}
                            isTransacting={isTransacting}
                            onOwnerModeChange={handleOwnerModeChange}
                            hideStakingControls={hideStakingControls}
                            onOpenCsvModal={onOpenCsvModal}
                            advancedOwnerControls={consoleMode}
                        />
                    ))}

                    {summaryPlacement === 'inline' && !summaryPortalTarget && hasMixedSelections && renderMixedSummaryCard('inline')}
                </div>
            </div>

            {summaryPlacement === 'side' && hasMixedSelections && (
                <aside className="min-w-0 xl:sticky xl:top-24">
                    {renderMixedSummaryCard('side')}
                </aside>
            )}
        </div>
    );

    const floatingSummaryPortal =
        isFloatingSummaryOpen && summaryPortalTarget ? (
            <Portal target={summaryPortalTarget}>
                {hasMixedSelections ? renderMixedSummaryCard('floating') : renderDistributedSummaryCard('floating')}
            </Portal>
        ) : null;

    const stakingTitle = `${listTitle || accT?.staking_validators_title || 'STAKING'} (${displayRows.length})`;

    const infoModal = (
        <StakingInfoModal
            isOpen={isInfoModalOpen}
            onClose={() => setIsInfoModalOpen(false)}
            accT={accT}
        />
    );

    const selectedCountPill = (
        <span className="shrink-0 rounded-full border border-[var(--color-card-border)] bg-[var(--color-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)]">
            {selectedValidatorAddresses.length} {accT?.selected_validators || 'Selected Validators'}
        </span>
    );

    // Hosted layout (Console): separate boxes per zone
    if (sectionWrapper) {
        return (
            <>
                {consoleMode &&
                    sectionWrapper({
                        key: 'selector',
                        title: accT?.select_validator_title || 'Select validator',
                        hint: stakingT.select_validators_hint,
                        action: selectedCountPill,
                        children: validatorSelector,
                    })}
                {batchControls &&
                    sectionWrapper({
                        key: 'batch',
                        title: accT?.global_batch_title_short || 'XRD Distribution',
                        hint: accT?.batch_select_hint || 'Select the validators you want to distribute an amount of XRD to.',
                        action: selectedCountPill,
                        children: batchControls,
                    })}
                {sectionWrapper({
                    key: 'validators',
                    title: stakingTitle,
                    action: (
                        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                            {infoButton}
                            {hideToggle}
                        </div>
                    ),
                    children: validatorList,
                })}
                {infoModal}
            </>
        );
    }

    return (
        <div className="mb-8">
            <h4 className={`text-xs font-black uppercase text-[var(--color-text-muted)] tracking-wider flex items-center justify-between gap-2 ${isModal ? 'pb-2 mb-4 w-full border-b border-[var(--color-card-border)]' : 'mb-4'}`}>
                {isModal ? (
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button
                            type="button"
                            onClick={() => setSectionOpen(v => !v)}
                            aria-expanded={sectionOpen}
                            className="flex items-center gap-2 text-left hover:text-[var(--color-text-main)] transition-colors min-w-0"
                        >
                            <span>{stakingTitle}</span>
                        </button>
                        {infoButton}
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        {stakingTitle}
                        {infoButton}
                    </div>
                )}
                <div className="flex items-center gap-2 shrink-0">
                    {(!isModal || sectionOpen) && hideToggle}
                    {isModal && (
                        <button
                            type="button"
                            onClick={() => setSectionOpen(v => !v)}
                            aria-expanded={sectionOpen}
                            className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors"
                        >
                            <ChevronDown className={`size-3.5 transition-transform duration-200 ${sectionOpen ? 'rotate-180' : ''}`} />
                        </button>
                    )}
                </div>
            </h4>

            {isModal ? (
                <AnimatePresence initial={false}>
                    {sectionOpen && (
                        <m.div
                            initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
                            animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
                            exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
                            transition={{ duration: 0.2 }}
                        >
                            {batchControls && <div className="mb-6 space-y-4">{batchControls}</div>}
                            {validatorList}
                        </m.div>
                    )}
                </AnimatePresence>
            ) : (
                <>
                    {batchControls && <div className="mb-6 space-y-4">{batchControls}</div>}
                    {validatorList}
                </>
            )}
            {infoModal}
            {floatingSummaryPortal}
        </div>
    );
}
