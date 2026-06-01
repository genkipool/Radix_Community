import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useAccountStats } from '@/features/dashboard/explorador/hooks/useAccountStats';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { AccountStakingData } from '../types/staking-operations.types';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { Validator } from '@/types/radix';
import type { GatewayEntityDetails } from '@/features/dashboard/types';

const HOOK_MOUNT_TIME = Date.now();

export const useAccountStakingData = (
    accountAddress: string | null,
    validator: Validator | null
) => {
    const { activeNetworkId } = useRadixWallet();
    const networkName = activeNetworkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';

    const { data: entityData, isLoading: isLoadingEntity } = useQuery({
        queryKey: ['account-entity-details', accountAddress, networkName],
        queryFn: () => {
            if (!accountAddress) return null;
            return apiFetchEntityDetails(accountAddress, networkName);
        },
        enabled: !!accountAddress,
    });

    const { 
        xrdAmount, 
        lsuTokens, 
        stakingRows,
        isLoading: isLoadingStats 
    } = useAccountStats(accountAddress || '', networkName, entityData || null);

    const isOwner = validator?.ownerAddress === accountAddress;

    const { data: validatorEntityData, isLoading: isLoadingValidator } = useQuery({
        queryKey: ['validator-entity-details', validator?.address, networkName],
        queryFn: () => {
            if (!validator?.address) return null;
            return apiFetchEntityDetails(validator.address, networkName);
        },
        enabled: !!validator?.address && isOwner,
    });

    const isLoading = isLoadingEntity || isLoadingStats || (isOwner && isLoadingValidator);

    let data: AccountStakingData = {
        xrdBalance: 0,
        lsuBalance: 0,
        pendingUnstake: 0,
        claimableXrd: 0,
        claimNftIds: [],
        ownerClaimNftIds: [],
        unstakeTooltip: '',
        isOwner: false,
        ownerLockedStakeXrd: 0,
        ownerPendingUnlockXrd: 0,
        ownerUnlockedLsu: 0,
        ownerUnlockedXrd: 0,
    };

    if (!isLoading && accountAddress && validator) {
        const xrdBalance = parseFloat(xrdAmount) || 0;
        
        const lsuToken = lsuTokens.find(t => t.address === validator.lsuResource);
        const lsuBalance = lsuToken ? parseFloat(lsuToken.amount) : 0;

        const stakingRow = stakingRows.find(r => r.validatorAddress === validator.address);
        const claimableXrd = stakingRow ? stakingRow.xrdInClaim : 0;
        const pendingUnstake = stakingRow ? stakingRow.xrdInUnstake : 0;

        const claimNftIds: string[] = [];
        if (entityData?.non_fungible_resources?.items) {
            const claimResource = entityData.non_fungible_resources.items.find(
                nft => nft.resource_address === validator.claimTokenResourceAddress
            );
            if (claimResource && claimResource.vaults?.items?.[0]?.items) {
                claimNftIds.push(...claimResource.vaults.items[0].items);
            }
        }

        let ownerLockedStakeXrd = 0;
        let ownerPendingUnlockXrd = 0;
        let ownerUnlockedLsu = 0;
        let ownerUnlockedXrd = 0;

        const currentEpoch = (entityData as GatewayEntityDetails & { ledger_state?: { epoch: number } })?.ledger_state?.epoch ?? 0;

        const formatEpochDate = (epoch: number) => {
            const epochsRemaining = epoch - currentEpoch;
            const date = new Date(HOOK_MOUNT_TIME + epochsRemaining * 5 * 60 * 1000);
            return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        };

        let unstakeTooltip = '';

        if (isOwner && validatorEntityData) {
            type WithdrawalEntry = {
                epoch_unlocked: number;
                stake_unit_amount: string;
            };

            type ValidatorState = {
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
            const vState = validatorEntityData as unknown as ValidatorState;
            const lsu2xrd = validator.lsu2xrdFactor || 1;

            const stateObj = vState.details?.state;
            if (!stateObj) {
                ownerLockedStakeXrd = 0;
                ownerPendingUnlockXrd = 0;
                ownerUnlockedXrd = 0;
            } else {
                const lockedVaultAddress = stateObj.locked_owner_stake_unit_vault?.entity_address;

                let lockedLsu = 0;

                const lsuResourceObj = vState.fungible_resources?.items?.find(item => item.resource_address === validator.lsuResource);
                if (lsuResourceObj?.vaults?.items) {
                    for (const vault of lsuResourceObj.vaults.items) {
                        if (vault.vault_address === lockedVaultAddress) {
                            lockedLsu = parseFloat(vault.amount);
                        }
                    }
                }

                ownerLockedStakeXrd = lockedLsu * lsu2xrd;

                const alreadyUnlocked = parseFloat(stateObj.already_unlocked_owner_stake_unit_amount || '0');
                let totalClaimableLsu = alreadyUnlocked;
                let totalPendingLsu = 0;
                const tooltipLines: string[] = [];

                if (stateObj.pending_owner_stake_unit_withdrawals) {
                    for (const w of stateObj.pending_owner_stake_unit_withdrawals) {
                        const amt = parseFloat(w.stake_unit_amount || '0');
                        if (w.epoch_unlocked <= currentEpoch) {
                            totalClaimableLsu += amt;
                        } else {
                            totalPendingLsu += amt;
                            tooltipLines.push(`Epoch ${w.epoch_unlocked} ~ ${formatEpochDate(w.epoch_unlocked)}`);
                        }
                    }
                }

                if (tooltipLines.length > 0) {
                    unstakeTooltip = tooltipLines.join('\n');
                }

                ownerPendingUnlockXrd = totalPendingLsu * lsu2xrd;
                ownerUnlockedLsu = totalClaimableLsu;
                ownerUnlockedXrd = totalClaimableLsu * lsu2xrd;
            }
        } else {
            const tooltipLines: string[] = [];
            if (stakingRow?.unstakes) {
                for (const u of stakingRow.unstakes) {
                    tooltipLines.push(`Epoch ${u.epoch} ~ ${formatEpochDate(u.epoch)}`);
                }
            }
            if (tooltipLines.length > 0) {
                unstakeTooltip = tooltipLines.join('\n');
            }
        }

        data = {
            xrdBalance,
            lsuBalance,
            pendingUnstake,
            claimableXrd,
            claimNftIds,
            ownerClaimNftIds: [], // Future: Implement if owner claim NFTs are separate
            unstakeTooltip,
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
