import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useAccountStats } from '@/features/dashboard/explorador/hooks/useAccountStats';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { AccountStakingData } from '../types/staking-operations.types';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { Validator } from '@/types/radix';

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

    const isLoading = isLoadingEntity || isLoadingStats;

    let data: AccountStakingData = {
        xrdBalance: 0,
        lsuBalance: 0,
        pendingUnstake: 0,
        claimableXrd: 0,
        claimNftIds: [],
        ownerClaimNftIds: [],
        isOwner: false,
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

        const isOwner = validator.ownerAddress === accountAddress;

        data = {
            xrdBalance,
            lsuBalance,
            pendingUnstake,
            claimableXrd,
            claimNftIds,
            ownerClaimNftIds: [], // Future: Implement if owner claim NFTs are separate
            isOwner,
        };
    }

    return {
        data,
        isLoading,
    };
};
