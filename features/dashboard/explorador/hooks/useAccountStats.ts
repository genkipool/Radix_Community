import { useQuery } from '@tanstack/react-query';
import { apiFetchNonFungibleData } from '@/features/dashboard/services/apiClient';
import { useValidatorsQuery } from '@/features/dashboard/staking/hooks/useValidatorsQuery';
import type { GatewayEntityDetails, MetadataItem } from '@/features/dashboard/types';
import type { Validator } from '@/types/radix';
import type { ParsedResource, StakingEntry, FungibleItem, NonFungibleItem } from '../types/models.types';
import { getXrdAddress } from '../constants';

// Function to safely extract explicit metadata
export function extractMetadata(items: MetadataItem[] | undefined, key: string): string {
    const meta = items?.find((m) => m.key === key);
    if (meta?.value?.typed?.value) {
        return meta.value.typed.value;
    }
    return '';
}


export function useAccountStats(address: string, network: 'mainnet' | 'stokenet', entityData: GatewayEntityDetails | null) {
    const { data: validatorsData, isLoading: isLoadingValidators } = useValidatorsQuery(network);

    const xrdAddress = getXrdAddress(network);

    // Parsing Logic
    const fungibles = entityData?.fungible_resources?.items || [];
    const nonFungibles = entityData?.non_fungible_resources?.items || [];

    let xrdAmount = '0';
    const tokens: ParsedResource[] = [];
    const lsuTokens: ParsedResource[] = [];
    const poolUnits: ParsedResource[] = [];
    const activeNfts: ParsedResource[] = [];
    const burnedNfts: ParsedResource[] = [];
    const claimCollections: Record<string, string[]> = {};

    const getFungibleAmount = (res: FungibleItem & { vaults?: { items?: { amount?: string }[] } }) => {
        if (res.amount !== undefined) return String(res.amount);
        if (res.vaults?.items?.length === 1) return String(res.vaults.items[0].amount || '0');
        if (res.vaults?.items?.length && res.vaults.items.length > 1) {
            return res.vaults.items.reduce((acc: number, v: { amount?: string }) => acc + parseFloat(v.amount || '0'), 0).toString();
        }
        return '0';
    };

    const getNonFungibleAmount = (res: NonFungibleItem & { vaults?: { items?: { total_count?: number }[] } }, defaultItemsLength: number) => {
        if (res.amount !== undefined) return Number(res.amount);
        if (res.vaults?.items?.length && res.vaults.items.length > 0) {
            return res.vaults.items.reduce((acc: number, v: { total_count?: number }) => acc + (v.total_count || 0), 0);
        }
        return defaultItemsLength;
    };

    // Process Fungibles
    fungibles.forEach((ft: FungibleItem) => {
        if (ft.resource_address === xrdAddress) {
            xrdAmount = getFungibleAmount(ft);
            return;
        }

        const meta = ft.explicit_metadata?.items || [];
        const valByLsu = validatorsData?.validators.find((v: Validator) => v.lsuResource === ft.resource_address);

        const r: ParsedResource = {
            address: ft.resource_address,
            name: extractMetadata(meta, 'name') || 'Unknown Token',
            symbol: extractMetadata(meta, 'symbol') || '',
            iconUrl: extractMetadata(meta, 'icon_url') || '',
            amount: getFungibleAmount(ft),
            isPoolUnit: !!meta.find((m: MetadataItem) => m.key === 'pool_unit'),
            isLsu: !!meta.find((m: MetadataItem) => m.key === 'validator') || !!valByLsu,
            validatorAddress: extractMetadata(meta, 'validator') || valByLsu?.address,
            isClaim: false,
            isNft: false
        };

        if (r.isLsu) lsuTokens.push(r);
        else if (r.isPoolUnit) poolUnits.push(r);
        else tokens.push(r);
    });

    // Add XRD as first token if balance > 0
    if (parseFloat(xrdAmount) > 0) {
        tokens.unshift({
            address: xrdAddress,
            name: 'Radix',
            symbol: 'XRD',
            iconUrl: 'https://assets.coingecko.com/coins/images/4374/standard/Radix.png',
            amount: xrdAmount,
            isPoolUnit: false,
            isLsu: false,
            isClaim: false,
            isNft: false
        });
    }

    // Process Non-Fungibles
    nonFungibles.forEach((nft: NonFungibleItem) => {
        const meta = nft.explicit_metadata?.items || [];
        const valByClaim = validatorsData?.validators.find((v: Validator) => v.claimTokenResourceAddress === nft.resource_address);
        const nftWithVaults = nft as NonFungibleItem & { vaults?: { items?: { items?: unknown[] }[] } };
        const nftItems = nftWithVaults.vaults?.items?.[0]?.items || [];
        const nftAmount = getNonFungibleAmount(nftWithVaults, nftItems.length);

        const r: ParsedResource = {
            address: nft.resource_address,
            name: extractMetadata(meta, 'name') || 'Unknown NFT',
            symbol: extractMetadata(meta, 'symbol') || '',
            iconUrl: extractMetadata(meta, 'icon_url') || '',
            amount: String(nftAmount),
            isPoolUnit: false,
            isLsu: false,
            validatorAddress: extractMetadata(meta, 'validator') || valByClaim?.address,
            isClaim: !!meta.find((m: MetadataItem) => m.key === 'claim_nft' || m.key === 'validator') || !!valByClaim,
            ids: nftItems,
            isNft: true
        };

        if (r.isClaim && r.validatorAddress && r.ids && r.ids.length > 0) {
            claimCollections[r.address] = r.ids;
        } else if (nftAmount === 0) {
            burnedNfts.push(r);
        } else {
            activeNfts.push(r);
        }
    });

    const claimCollectionAddresses = Object.keys(claimCollections);
    const { data: claimsData, isLoading: isLoadingClaims } = useQuery({
        queryKey: ['account-claim-nfts', address, network, claimCollectionAddresses.sort().join(',')],
        queryFn: async () => {
            const results: Record<string, Record<string, unknown>[]> = {};
            for (const resAddr of claimCollectionAddresses) {
                results[resAddr] = await apiFetchNonFungibleData(resAddr, claimCollections[resAddr], network);
            }
            return results;
        },
        enabled: claimCollectionAddresses.length > 0,
        staleTime: Infinity,
    });

    // Staking Aggregation
    const stakingMap = new Map<string, StakingEntry>();

    const getStakingEntry = (vAddr: string) => {
        if (!stakingMap.has(vAddr)) {
            const val = validatorsData?.validators.find(v => v.address === vAddr);
            stakingMap.set(vAddr, {
                validatorName: val?.name || 'Unknown Validator',
                validatorIcon: val?.iconUrl || '',
                validatorAddress: vAddr,
                xrdInStake: 0,
                xrdInUnstake: 0,
                xrdInClaim: 0,
                unstakes: []
            });
        }
        return stakingMap.get(vAddr)!;
    };

    lsuTokens.forEach(lsu => {
        if (!lsu.validatorAddress) return;
        const entry = getStakingEntry(lsu.validatorAddress);
        const val = validatorsData?.validators.find(v => v.address === lsu.validatorAddress);
        const lsuFactor = val?.lsu2xrdFactor || 1;
        entry.xrdInStake += parseFloat(lsu.amount) * lsuFactor;
    });

    if (claimsData) {
        Object.entries(claimsData).forEach(([resAddr, items]) => {
            const nftEntity = nonFungibles.find((n: NonFungibleItem) => n.resource_address === resAddr);
            const valAddr = extractMetadata(nftEntity?.explicit_metadata?.items || [], 'validator') ||
                validatorsData?.validators.find((v: Validator) => v.claimTokenResourceAddress === resAddr)?.address;

            if (valAddr) {
                const entry = getStakingEntry(valAddr);
                items.forEach((item: Record<string, unknown>) => {
                    const data = item.data as { programmatic_json?: { fields?: { field_name: string; value: string }[] } } | undefined;
                    const fields = data?.programmatic_json?.fields;
                    const amt = parseFloat(fields?.find(f => f.field_name === 'claim_amount')?.value || '0');
                    // The claim_epoch indicates when the tokens will be unlocked
                    const claimEpochStr = fields?.find(f => f.field_name === 'claim_epoch')?.value;
                    const claimEpoch = claimEpochStr ? parseInt(claimEpochStr, 10) : 0;
                    
                    const currentEpoch = (entityData as GatewayEntityDetails & { ledger_state?: { epoch: number } })?.ledger_state?.epoch || 0;

                    if (claimEpoch > currentEpoch) {
                        entry.xrdInUnstake += amt;
                        entry.unstakes.push({ amount: amt, epoch: claimEpoch });
                    } else if (amt > 0) {
                        entry.xrdInClaim += amt;
                    }
                });
            }
        });
    }

    const stakingRows = Array.from(stakingMap.values()).sort((a, b) => b.xrdInStake - a.xrdInStake);
    const totalLsuAmount = lsuTokens.reduce((acc, curr) => acc + parseFloat(curr.amount), 0);
    const totalLsuXrdEquivalent = lsuTokens.reduce((acc, lsu) => {
        if (!lsu.validatorAddress) return acc;
        const val = validatorsData?.validators.find(v => v.address === lsu.validatorAddress);
        const lsuFactor = val?.lsu2xrdFactor || 1;
        return acc + (parseFloat(lsu.amount) * lsuFactor);
    }, 0);
    
    // Derived values specifically required
    const stakedTotal = stakingRows.reduce((acc, row) => acc + row.xrdInStake, 0);
    const unstakeTotal = stakingRows.reduce((acc, row) => acc + row.xrdInUnstake, 0);
    const claimTotal = stakingRows.reduce((acc, row) => acc + row.xrdInClaim, 0);

    return {
        isLoading: isLoadingValidators || (claimCollectionAddresses.length > 0 && isLoadingClaims),
        xrdAmount,
        tokens,
        lsuTokens,
        poolUnits,
        activeNfts,
        burnedNfts,
        stakingRows,
        totalLsuAmount,
        totalLsuXrdEquivalent,
        stakedTotal,
        unstakeTotal,
        claimTotal,
        currentEpoch: (entityData as GatewayEntityDetails & { ledger_state?: { epoch: number } })?.ledger_state?.epoch || 0,
    };
}
