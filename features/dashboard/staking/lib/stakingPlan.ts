import { formatNumber } from '@/utils/formatters';
import type { StakingEntry, ParsedResource } from '@/features/dashboard/explorador/types/models.types';
import type { ValidatorSelections } from '@/features/dashboard/explorador/components/AccountValidatorStakeAction';
import type { StakingAction } from '../types/staking-operations.types';
import {
    buildBatchStakeManifest,
    buildBatchUnstakeManifest,
    buildBatchClaimManifest,
    buildMixedBatchManifest,
    type BatchStakeItem,
    type BatchUnstakeItem,
    type BatchClaimItem,
    type MixedBatchItem,
} from '@/features/wallet/lib/manifest-builders';
import { minRadixDecimal, splitRadixDecimal, toRadixDecimal } from '@/features/wallet/lib/radix-decimal';

export interface ValidatorMeta {
    address: string;
    name?: string;
    iconUrl?: string;
    lsu2xrdFactor?: number;
    lsuResource: string;
    claimTokenResourceAddress?: string;
    ownerBadge?: string;
    ownerAddress?: string;
}

export type ClaimableNftsMap = Record<string, { ids: string[]; resource?: string }>;

export interface SummaryActionItem {
    label: string;
    badge?: string;
    value: string;
    subText?: string;
    error?: string;
    color: string;
}

export interface SummaryGroup {
    validatorAddress: string;
    validatorName: string;
    actions: SummaryActionItem[];
}

export interface DistributedPlan {
    stakeItems: BatchStakeItem[];
    unstakeItems: BatchUnstakeItem[];
    claimItems: BatchClaimItem[];
    groups: SummaryGroup[];
    manifest: string;
    canSend: boolean;
    error: string | null;
}

export interface MixedPlan {
    items: MixedBatchItem[];
    groups: SummaryGroup[];
    manifest: string;
    canSend: boolean;
    error: string | null;
}

export interface StakingPlanLabels {
    stakeLockedBadge: string;
    stakeUnlockedBadge: string;
    lockLsu: string;
    ownerUnstake: string;
    ownerClaim: string;
    unlocked: string;
    insufficientStake: string;
    insufficientLsu: string;
    insufficientBalanceValidator: string;
    insufficientBalanceValidatorUnstake: string;
}

function resolveLsuAmount(
    targetXrd: number,
    maxStakedXrd: number,
    xrdPerLsu: number,
    lsuToken: ParsedResource | undefined,
): string {
    const computedLsu = targetXrd / xrdPerLsu;
    if (!lsuToken?.amount) return toRadixDecimal(computedLsu);
    return Math.abs(targetXrd - maxStakedXrd) <= 1e-6
        ? toRadixDecimal(lsuToken.amount)
        : minRadixDecimal(computedLsu, lsuToken.amount);
}

/**
 * Pure planner for Distributed (batch) staking: computes the exact per-validator
 * items, summary rows, validation state and RTM manifest in one pass so live
 * preview, simulation and wallet submission can never drift apart.
 */
export function buildDistributedPlan(params: {
    accountAddress: string;
    action: StakingAction | null;
    globalAmountStr: string;
    targetAddresses: string[];
    displayRows: StakingEntry[];
    validators: ValidatorMeta[];
    lsuTokens: ParsedResource[];
    claimableNfts: ClaimableNftsMap;
    xrdAmount: string;
    xrdResourceAddress?: string;
    locale: string;
    labels: StakingPlanLabels;
}): DistributedPlan {
    const {
        accountAddress,
        action,
        globalAmountStr,
        targetAddresses,
        displayRows,
        validators,
        lsuTokens,
        claimableNfts,
        xrdAmount,
        xrdResourceAddress,
        locale,
        labels,
    } = params;

    if (!action) {
        return { stakeItems: [], unstakeItems: [], claimItems: [], groups: [], manifest: '', canSend: false, error: null };
    }

    const empty: DistributedPlan = {
        stakeItems: [],
        unstakeItems: [],
        claimItems: [],
        groups: [],
        manifest: '',
        canSend: false,
        error: null,
    };

    const count = targetAddresses.length;
    if (count === 0) return empty;

    const globalAmount = parseFloat(globalAmountStr || '0');
    const availableXrd = parseFloat(xrdAmount || '0');

    if (action === 'Stake') {
        if (!(globalAmount > 0)) return empty;
        const exceedsBalance = globalAmount > availableXrd + 1e-6;
        const exactShares = splitRadixDecimal(globalAmountStr, count);
        const stakeItems: BatchStakeItem[] = [];
        const groups: SummaryGroup[] = [];

        targetAddresses.forEach((vAddr, idx) => {
            const row = displayRows.find(r => r.validatorAddress === vAddr);
            const valInfo = validators.find(v => v.address === vAddr);
            if (!row || !valInfo) return;
            const shareStr = exactShares[idx];
            const shareNum = parseFloat(shareStr);
            const xrdPerLsu = valInfo.lsu2xrdFactor || 1;
            stakeItems.push({ validatorAddress: vAddr, amountXrd: shareStr });
            groups.push({
                validatorAddress: vAddr,
                validatorName: row.validatorName || `${vAddr.slice(0, 8)}...`,
                actions: [
                    {
                        label: 'Stake',
                        value: `${formatNumber(shareNum, 4, locale)} XRD`,
                        subText: `~${formatNumber(shareNum / xrdPerLsu, 2, locale)} LSU`,
                        color: 'text-[var(--color-primary)]',
                    },
                ],
            });
        });

        const manifest = stakeItems.length > 0 && xrdResourceAddress
            ? buildBatchStakeManifest(accountAddress, stakeItems, xrdResourceAddress)
            : '';
        return {
            ...empty,
            stakeItems,
            groups,
            manifest,
            canSend: !!manifest && !exceedsBalance,
            error: null,
        };
    }

    if (action === 'Unstake') {
        if (!(globalAmount > 0)) return empty;
        const amountPerValidator = globalAmount / count;
        const unstakeItems: BatchUnstakeItem[] = [];
        const groups: SummaryGroup[] = [];
        let firstError: string | null = null;

        targetAddresses.forEach((vAddr) => {
            const row = displayRows.find(r => r.validatorAddress === vAddr);
            const valInfo = validators.find(v => v.address === vAddr);
            if (!row || !valInfo) return;
            const xrdPerLsu = valInfo.lsu2xrdFactor || 1;
            const maxStaked = row.xrdInStake;
            const exceeds = amountPerValidator > maxStaked + 1e-6;
            if (exceeds && !firstError) {
                firstError = labels.insufficientBalanceValidator.replace('{address}', `${vAddr.slice(0, 8)}...`);
            }
            const lsuToken = lsuTokens.find(
                t => t.validatorAddress === vAddr || t.address === valInfo.lsuResource,
            );
            const computedLsu = amountPerValidator / xrdPerLsu;
            if (!exceeds) {
                unstakeItems.push({
                    validatorAddress: vAddr,
                    amountLsu: resolveLsuAmount(amountPerValidator, maxStaked, xrdPerLsu, lsuToken),
                    lsuResourceAddress: valInfo.lsuResource,
                });
            }
            groups.push({
                validatorAddress: vAddr,
                validatorName: row.validatorName || `${vAddr.slice(0, 8)}...`,
                actions: [
                    {
                        label: 'Unstake',
                        value: `${formatNumber(amountPerValidator, 4, locale)} XRD`,
                        subText: `~${formatNumber(computedLsu, 2, locale)} LSU`,
                        error: exceeds ? labels.insufficientStake : undefined,
                        color: 'text-[var(--color-secondary)]',
                    },
                ],
            });
        });

        const manifest = !firstError && unstakeItems.length > 0
            ? buildBatchUnstakeManifest(accountAddress, unstakeItems)
            : '';
        return {
            ...empty,
            unstakeItems,
            groups,
            manifest,
            canSend: !!manifest && !firstError,
            error: firstError,
        };
    }

    // Claim
    const claimItems: BatchClaimItem[] = [];
    const groups: SummaryGroup[] = [];

    targetAddresses.forEach((vAddr) => {
        const row = displayRows.find(r => r.validatorAddress === vAddr);
        const valInfo = validators.find(v => v.address === vAddr);
        if (!row || !valInfo) return;
        const nfts = claimableNfts[vAddr]?.ids ?? [];
        const claimRes = claimableNfts[vAddr]?.resource || valInfo.claimTokenResourceAddress;
        if (nfts.length > 0 && claimRes) {
            claimItems.push({
                validatorAddress: vAddr,
                claimNftLocalIds: nfts,
                claimNftResourceAddress: claimRes,
            });
            groups.push({
                validatorAddress: vAddr,
                validatorName: row.validatorName || `${vAddr.slice(0, 8)}...`,
                actions: [
                    {
                        label: 'Claim',
                        value: `${formatNumber(row.xrdInClaim, 2, locale)} XRD`,
                        color: 'text-[var(--color-accent)]',
                    },
                ],
            });
        }
    });

    const manifest = claimItems.length > 0
        ? buildBatchClaimManifest(accountAddress, claimItems)
        : '';
    return {
        ...empty,
        claimItems,
        groups,
        manifest,
        canSend: !!manifest,
        error: null,
    };
}

/**
 * Pure planner for Multiple (mixed) staking: builds every delegator & owner
 * operation, summary groups, validation status and RTM manifest in one pass.
 */
export function buildMixedPlan(params: {
    accountAddress: string;
    validatorSelections: Record<string, ValidatorSelections>;
    ownerModeAddresses: Set<string>;
    displayRows: StakingEntry[];
    validators: ValidatorMeta[];
    lsuTokens: ParsedResource[];
    claimableNfts: ClaimableNftsMap;
    xrdAmount: string;
    xrdResourceAddress?: string;
    ownerBadgeResourceAddress?: string;
    locale: string;
    labels: StakingPlanLabels;
}): MixedPlan {
    const {
        accountAddress,
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
        labels,
    } = params;

    const items: MixedBatchItem[] = [];
    const groups: SummaryGroup[] = [];
    const availableXrd = parseFloat(xrdAmount || '0');
    let totalStakeXrd = 0;
    let hasValidationError = false;
    let firstError: string | null = null;

    for (const vAddr of Object.keys(validatorSelections)) {
        const selections = validatorSelections[vAddr];
        const row = displayRows.find(r => r.validatorAddress === vAddr);
        const valInfo = validators.find(v => v.address === vAddr);
        if (!row || !valInfo || !selections) continue;

        const isRowOwner = ownerModeAddresses.has(vAddr);
        const canOwnerCall = isRowOwner && !!valInfo.ownerBadge && !!ownerBadgeResourceAddress;
        const xrdPerLsu = valInfo.lsu2xrdFactor || 1;
        const actions: SummaryActionItem[] = [];

        // Stake / OwnerStake
        const stakeNum = parseFloat(selections.stake || '0');
        if (selections.stake && stakeNum > 0) {
            totalStakeXrd += stakeNum;
            if (canOwnerCall) {
                items.push({
                    action: 'OwnerStake',
                    validatorAddress: vAddr,
                    amountXrd: toRadixDecimal(selections.stake),
                    lsuResourceAddress: valInfo.lsuResource,
                    ownerBadgeId: valInfo.ownerBadge!,
                    ownerBadgeResourceAddress: ownerBadgeResourceAddress!,
                    lock: selections.ownerLockOnStake !== false,
                });
            } else if (!isRowOwner) {
                items.push({
                    action: 'Stake',
                    validatorAddress: vAddr,
                    amountXrd: toRadixDecimal(selections.stake),
                });
            }
            actions.push({
                label: isRowOwner ? 'Owner Stake' : 'Stake',
                badge: isRowOwner
                    ? (selections.ownerLockOnStake === false ? labels.stakeUnlockedBadge : labels.stakeLockedBadge)
                    : undefined,
                value: `${selections.stake} XRD`,
                subText: `~${formatNumber(stakeNum / xrdPerLsu, 2, locale)} LSU`,
                color: 'text-[var(--color-primary)]',
            });
        }

        // OwnerLock (existing liquid LSUs)
        const ownerLockNum = parseFloat(selections.ownerLock || '0');
        if (canOwnerCall && selections.ownerLock && ownerLockNum > 0) {
            const lsuToken = lsuTokens.find(
                t => t.validatorAddress === vAddr || t.address === valInfo.lsuResource,
            );
            const maxLsu = lsuToken?.amount ? parseFloat(lsuToken.amount) : 0;
            const exceeds = ownerLockNum > maxLsu + 1e-6;
            if (exceeds) {
                hasValidationError = true;
                if (!firstError) firstError = labels.insufficientLsu;
            } else {
                const exactLsu = lsuToken?.amount
                    ? (Math.abs(ownerLockNum - maxLsu) <= 1e-6
                        ? toRadixDecimal(lsuToken.amount)
                        : minRadixDecimal(ownerLockNum, lsuToken.amount))
                    : toRadixDecimal(ownerLockNum);
                items.push({
                    action: 'OwnerLock',
                    validatorAddress: vAddr,
                    amountLsu: exactLsu,
                    lsuResourceAddress: valInfo.lsuResource,
                    ownerBadgeId: valInfo.ownerBadge!,
                    ownerBadgeResourceAddress: ownerBadgeResourceAddress!,
                });
            }
            actions.push({
                label: labels.lockLsu,
                value: `${selections.ownerLock} LSU`,
                subText: `~${formatNumber(ownerLockNum * xrdPerLsu, 2, locale)} XRD`,
                error: exceeds ? labels.insufficientLsu : undefined,
                color: 'text-[var(--color-primary)]',
            });
        }

        // Unstake / OwnerUnstake
        const unstakeNum = parseFloat(selections.unstake || '0');
        if (selections.unstake && unstakeNum > 0) {
            if (canOwnerCall) {
                items.push({
                    action: 'OwnerUnstake',
                    validatorAddress: vAddr,
                    amountLsu: toRadixDecimal(unstakeNum / xrdPerLsu),
                    ownerBadgeId: valInfo.ownerBadge!,
                    ownerBadgeResourceAddress: ownerBadgeResourceAddress!,
                });
            } else if (!isRowOwner) {
                const exceeds = unstakeNum > row.xrdInStake + 1e-6;
                if (exceeds) {
                    hasValidationError = true;
                    if (!firstError) {
                        firstError = labels.insufficientBalanceValidatorUnstake.replace('{address}', `${vAddr.slice(0, 8)}...`);
                    }
                } else {
                    const lsuToken = lsuTokens.find(
                        t => t.validatorAddress === vAddr || t.address === valInfo.lsuResource,
                    );
                    items.push({
                        action: 'Unstake',
                        validatorAddress: vAddr,
                        amountLsu: resolveLsuAmount(unstakeNum, row.xrdInStake, xrdPerLsu, lsuToken),
                        lsuResourceAddress: valInfo.lsuResource,
                    });
                }
            }
            actions.push({
                label: isRowOwner ? labels.ownerUnstake : 'Unstake',
                value: `${selections.unstake} XRD`,
                color: 'text-[var(--color-secondary)]',
            });
        }

        // Claim / OwnerClaim
        if (selections.claim && (row.xrdInClaim > 0 || isRowOwner)) {
            if (canOwnerCall) {
                items.push({
                    action: 'OwnerClaim',
                    validatorAddress: vAddr,
                    ownerBadgeId: valInfo.ownerBadge!,
                    ownerBadgeResourceAddress: ownerBadgeResourceAddress!,
                });
            } else if (!isRowOwner) {
                const nfts = claimableNfts[vAddr]?.ids ?? [];
                const claimRes = claimableNfts[vAddr]?.resource || valInfo.claimTokenResourceAddress;
                if (nfts.length > 0 && claimRes) {
                    items.push({
                        action: 'Claim',
                        validatorAddress: vAddr,
                        claimNftLocalIds: nfts,
                        claimNftResourceAddress: claimRes,
                    });
                }
            }
            actions.push({
                label: isRowOwner ? labels.ownerClaim : 'Claim',
                value: isRowOwner ? labels.unlocked : `${formatNumber(row.xrdInClaim, 2, locale)} XRD`,
                color: 'text-[var(--color-accent)]',
            });
        }

        // Check untoggled raw amountStr overflow (modal legacy safeguard)
        const rawAmount = parseFloat(selections.amountStr || '0');
        if (
            selections.stake === undefined &&
            selections.unstake === undefined &&
            selections.ownerLock === undefined &&
            !selections.claim &&
            rawAmount > availableXrd + 1e-6
        ) {
            hasValidationError = true;
        }

        if (actions.length > 0) {
            groups.push({
                validatorAddress: vAddr,
                validatorName: row.validatorName || `${vAddr.slice(0, 8)}...`,
                actions,
            });
        }
    }

    if (totalStakeXrd > availableXrd + 1e-6) {
        hasValidationError = true;
    }

    const manifest = items.length > 0 && xrdResourceAddress
        ? buildMixedBatchManifest(accountAddress, items, xrdResourceAddress)
        : '';

    return {
        items,
        groups,
        manifest,
        canSend: !!manifest && !hasValidationError,
        error: firstError,
    };
}
