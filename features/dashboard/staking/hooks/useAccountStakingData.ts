import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useAccountStats } from '@/features/dashboard/explorador/hooks/useAccountStats';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { AccountStakingData } from '../types/staking-operations.types';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { entityKeys, dashboardKeys } from '@/features/dashboard/utils/entityCache';
import { CACHE_TIMES } from '@/features/dashboard/utils/queryCache';
import { Validator } from '@/types/radix';
import type { GatewayEntityDetails } from '@/features/dashboard/types';
import { useValidatorsQuery } from './useValidatorsQuery';

const FALLBACK_MOUNT_TIME = Date.now();

type WithdrawalEntry = {
    epoch_unlocked: number;
    stake_unit_amount: string;
};

export type ValidatorEntityState = {
    ledger_state?: { epoch?: number };
    details?: {
        state?: {
            locked_owner_stake_unit_vault?: { entity_address: string };
            pending_owner_stake_unit_unlock_vault?: { entity_address: string };
            already_unlocked_owner_stake_unit_amount?: string;
            pending_owner_stake_unit_withdrawals?: WithdrawalEntry[];
        }
    };
    fungible_resources?: {
        items: Array<{
            resource_address: string;
            vaults: {
                items: Array<{
                    vault_address: string;
                    amount: string;
                }>;
            };
        }>;
    };
};

export function computeOwnerStakingData(
    validatorEntityData: ValidatorEntityState,
    validator: Validator,
    currentEpoch: number,
    mountTime: number = FALLBACK_MOUNT_TIME,
): {
    ownerLockedStakeXrd: number;
    ownerPendingUnlockXrd: number;
    ownerUnlockedLsu: number;
    ownerUnlockedXrd: number;
    unstakeTooltip: string;
} {
    const lsu2xrd = validator.lsu2xrdFactor || 1;
    const stateObj = validatorEntityData.details?.state;
    const effectiveEpoch = Math.max(currentEpoch, validatorEntityData.ledger_state?.epoch ?? 0);

    if (!stateObj) {
        return { ownerLockedStakeXrd: 0, ownerPendingUnlockXrd: 0, ownerUnlockedLsu: 0, ownerUnlockedXrd: 0, unstakeTooltip: '' };
    }

    const lockedVaultAddress = stateObj.locked_owner_stake_unit_vault?.entity_address;
    let lockedLsu = 0;

    const lsuResourceObj = validatorEntityData.fungible_resources?.items?.find(
        item => item.resource_address === validator.lsuResource
    );
    if (lsuResourceObj?.vaults?.items) {
        for (const vault of lsuResourceObj.vaults.items) {
            if (vault.vault_address === lockedVaultAddress) {
                lockedLsu = parseFloat(vault.amount);
            }
        }
    }

    const ownerLockedStakeXrd = lockedLsu * lsu2xrd;

    const alreadyUnlocked = parseFloat(stateObj.already_unlocked_owner_stake_unit_amount || '0');
    let totalClaimableLsu = alreadyUnlocked;
    let totalPendingLsu = 0;
    const tooltipLines: string[] = [];

    const formatEpochDate = (epoch: number) => {
        const epochsRemaining = epoch - effectiveEpoch;
        const date = new Date(mountTime + epochsRemaining * 5 * 60 * 1000);
        return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    if (stateObj.pending_owner_stake_unit_withdrawals) {
        for (const w of stateObj.pending_owner_stake_unit_withdrawals) {
            const amt = parseFloat(w.stake_unit_amount || '0');
            if (w.epoch_unlocked <= effectiveEpoch) {
                totalClaimableLsu += amt;
            } else {
                totalPendingLsu += amt;
                tooltipLines.push(`Epoch ${w.epoch_unlocked} ~ ${formatEpochDate(w.epoch_unlocked)}`);
            }
        }
    }

    const unstakeTooltip = tooltipLines.length > 0 ? tooltipLines.join('\n') : '';
    const ownerPendingUnlockXrd = totalPendingLsu * lsu2xrd;
    const ownerUnlockedLsu = totalClaimableLsu;
    const ownerUnlockedXrd = totalClaimableLsu * lsu2xrd;

    return { ownerLockedStakeXrd, ownerPendingUnlockXrd, ownerUnlockedLsu, ownerUnlockedXrd, unstakeTooltip };
}

export const useAccountStakingData = (
    accountAddress: string | null,
    validator: Validator | null
) => {
    const { activeNetworkId } = useRadixWallet();
    const [mountTime] = useState(() => Date.now());
    const networkName: 'mainnet' | 'stokenet' = validator?.address?.startsWith('validator_tdx_2_')
        ? 'stokenet'
        : validator?.address?.startsWith('validator_rdx1')
            ? 'mainnet'
            : activeNetworkId === RadixNetworkId.Stokenet
                ? 'stokenet'
                : 'mainnet';

    const { data: validatorsData } = useValidatorsQuery(networkName);
    const resolvedValidator =
        validatorsData?.validators.find(v => v.address === validator?.address) ?? validator;

    const { data: entityData, isLoading: isLoadingEntity } = useQuery({
        queryKey: entityKeys.detail(accountAddress || '', networkName),
        queryFn: () => {
            if (!accountAddress) return null;
            return apiFetchEntityDetails(accountAddress, networkName, true);
        },
        enabled: !!accountAddress,
        staleTime: CACHE_TIMES.VOLATILE,
        gcTime: 10 * 60_000,
    });

    const {
        xrdAmount,
        lsuTokens,
        stakingRows,
        activeNfts,
        claimableNfts,
        currentEpoch: statsEpoch,
        isLoading: isLoadingStats
    } = useAccountStats(accountAddress || '', networkName, entityData || null);

    const isOwner = resolvedValidator?.ownerBadge
        ? !!activeNfts?.some(nft => nft.ids?.includes(resolvedValidator.ownerBadge!))
        : resolvedValidator?.ownerAddress === accountAddress;

    const { data: validatorEntityData, isLoading: isLoadingValidator } = useQuery({
        queryKey: dashboardKeys.entities.detail(resolvedValidator?.address || '', networkName),
        queryFn: () => {
            if (!resolvedValidator?.address) return null;
            return apiFetchEntityDetails(resolvedValidator.address, networkName, true);
        },
        enabled: !!resolvedValidator?.address && isOwner,
        staleTime: CACHE_TIMES.VOLATILE,
        gcTime: 10 * 60_000,
    });

    const isLoading = isLoadingEntity || isLoadingStats || (isOwner && isLoadingValidator);

    let data: AccountStakingData = {
        xrdBalance: 0,
        stakedXrd: 0,
        lsu2xrdFactor: resolvedValidator?.lsu2xrdFactor || 1,
        lsuBalance: 0,
        pendingUnstake: 0,
        claimableXrd: 0,
        claimNftIds: [],
        ownerClaimNftIds: [],
        unstakeTooltip: '',
        ownerUnstakeTooltip: '',
        isOwner: false,
        ownerLockedStakeXrd: 0,
        ownerPendingUnlockXrd: 0,
        ownerUnlockedLsu: 0,
        ownerUnlockedXrd: 0,
    };

    if (!isLoading && accountAddress && resolvedValidator) {
        const xrdBalance = parseFloat(xrdAmount) || 0;
        const lsu2xrdFactor = resolvedValidator.lsu2xrdFactor || 1;

        const lsuToken = lsuTokens.find(
            t => t.validatorAddress === resolvedValidator.address ||
                (!!resolvedValidator.lsuResource && t.address === resolvedValidator.lsuResource)
        );
        const lsuBalanceRaw = lsuToken?.amount ?? '0';
        const lsuBalance = lsuToken ? parseFloat(lsuToken.amount) : 0;

        const stakingRow = stakingRows.find(r => r.validatorAddress === resolvedValidator.address);
        const stakedXrd = stakingRow ? stakingRow.xrdInStake : (lsuBalance * lsu2xrdFactor);
        const claimableXrd = stakingRow ? stakingRow.xrdInClaim : 0;
        const pendingUnstake = stakingRow ? stakingRow.xrdInUnstake : 0;

        // Only NFTs whose claim_epoch <= currentEpoch: including one still unbonding aborts claim_xrd.
        const maturedClaims = claimableNfts[resolvedValidator.address];
        const claimNftIds: string[] = maturedClaims?.ids ?? [];
        const claimNftResourceAddress = maturedClaims?.resource || resolvedValidator.claimTokenResourceAddress;

        const currentEpoch = statsEpoch || (entityData as GatewayEntityDetails & { ledger_state?: { epoch: number } })?.ledger_state?.epoch || 0;

        const formatEpochDate = (epoch: number) => {
            const epochsRemaining = epoch - currentEpoch;
            const date = new Date(mountTime + epochsRemaining * 5 * 60 * 1000);
            return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        };

        const delegatorTooltipLines: string[] = [];
        if (stakingRow?.unstakes) {
            for (const u of stakingRow.unstakes) {
                if (u.epoch > currentEpoch) {
                    delegatorTooltipLines.push(`Epoch ${u.epoch} ~ ${formatEpochDate(u.epoch)}`);
                }
            }
        }
        const unstakeTooltip = delegatorTooltipLines.length > 0 ? delegatorTooltipLines.join('\n') : '';

        let ownerLockedStakeXrd = 0;
        let ownerPendingUnlockXrd = 0;
        let ownerUnlockedLsu = 0;
        let ownerUnlockedXrd = 0;
        let ownerUnstakeTooltip = '';

        if (isOwner && validatorEntityData) {
            const result = computeOwnerStakingData(
                validatorEntityData as unknown as ValidatorEntityState,
                resolvedValidator,
                currentEpoch,
                mountTime,
            );
            ownerLockedStakeXrd = result.ownerLockedStakeXrd;
            ownerPendingUnlockXrd = result.ownerPendingUnlockXrd;
            ownerUnlockedLsu = result.ownerUnlockedLsu;
            ownerUnlockedXrd = result.ownerUnlockedXrd;
            ownerUnstakeTooltip = result.unstakeTooltip;
        }

        data = {
            xrdBalance,
            stakedXrd,
            lsu2xrdFactor,
            lsuBalance,
            lsuBalanceRaw,
            pendingUnstake,
            claimableXrd,
            claimNftIds,
            claimNftResourceAddress,
            ownerClaimNftIds: [], // Future: Implement if owner claim NFTs are separate
            unstakeTooltip,
            ownerUnstakeTooltip,
            isOwner,
            ownerLockedStakeXrd,
            ownerPendingUnlockXrd,
            ownerUnlockedLsu,
            ownerUnlockedXrd,
        };
    }

    return {
        data,
        isLoading,
    };
};
