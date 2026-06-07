import { useQuery } from '@tanstack/react-query';
import { apiFetchNonFungibleData } from '@/features/dashboard/services/apiClient';
import { useValidatorsQuery } from '@/features/dashboard/staking/hooks/useValidatorsQuery';
import type { GatewayEntityDetails, MetadataItem } from '@/features/dashboard/types';
import type { Validator } from '@/types/radix';
import type { ParsedResource, StakingEntry, FungibleItem, NonFungibleItem } from '../types/models.types';
import { getXrdAddress } from '../constants';

// Function to safely extract explicit metadata
function extractMetadata(items: MetadataItem[] | undefined, key: string): string {
    const meta = items?.find((m) => m.key === key);
    if (meta?.value?.typed?.value) {
        return meta.value.typed.value;
    }
    return '';
}

import { parseProgrammaticJson } from '@/features/dashboard/utils/resourceUtils';

// Function to safely extract tags
function extractTags(items: MetadataItem[] | undefined): string[] {
    const meta = items?.find((m) => m.key === 'tags');
    if (meta?.value?.typed?.values) {
        return meta.value.typed.values;
    }
    if (meta?.value?.programmatic_json) {
        const parsed = parseProgrammaticJson(meta.value.programmatic_json);
        if (Array.isArray(parsed)) {
            return parsed.map(String);
        }
    }
    return [];
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

    const getNonFungibleAmount = (res: NonFungibleItem & { vaults?: { items?: { total_count?: number, items?: unknown[] }[] } }, defaultItemsLength: number) => {
        if (res.amount !== undefined) return Number(res.amount);
        if (res.vaults?.items?.length && res.vaults.items.length > 0) {
            let totalCount = 0;
            res.vaults.items.forEach((vaultObj) => {
                const v = vaultObj as { total_count?: number; items?: unknown[] };
                if (v.total_count) {
                    totalCount += v.total_count;
                } else if (v.items && Array.isArray(v.items)) {
                    totalCount += v.items.length;
                }
            });
            if (totalCount > 0) return totalCount;
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
            isPoolUnit: !!meta.find((m: MetadataItem) => m.key === 'pool_unit') || extractTags(meta).some((tag: string) => ['lp', 'liquidity-pool', 'pool_unit'].includes(tag.toLowerCase())),
            isLsu: !!meta.find((m: MetadataItem) => m.key === 'validator') || !!valByLsu || extractTags(meta).some((tag: string) => tag.toLowerCase() === 'lsu'),
            validatorAddress: extractMetadata(meta, 'validator') || valByLsu?.address,
            validatorName: valByLsu?.name,
            isClaim: false,
            isNft: false
        };

        if (r.isLsu) {
            r.symbol = 'LSU';
            lsuTokens.push(r);
            tokens.push(r);
        }
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
        const nftWithVaults = nft as NonFungibleItem & { vaults?: { items?: { items?: string[], total_count?: number }[] } };
        
        let allIds: string[] = [];
        let totalCount = 0;
        const vaults = nftWithVaults.vaults?.items || [];
        
        vaults.forEach((vaultObj: { items?: string[], non_fungible_ids?: { items?: string[], total_count?: number }, total_count?: number }) => {
            const items = vaultObj.items || vaultObj.non_fungible_ids?.items || [];
            const count = vaultObj.total_count || vaultObj.non_fungible_ids?.total_count || 0;
            
            if (count > 0) {
                totalCount += count;
            } else if (items.length > 0) {
                totalCount += items.length;
            }
            
            if (items.length > 0) {
                allIds = [...allIds, ...items];
            }
        });

        const nftAmount = getNonFungibleAmount(nftWithVaults, totalCount);

        const nftName = extractMetadata(meta, 'name') || 'Unknown NFT';
        const isOwnerBadgeCollection = nftName.toLowerCase().includes('owner badge');
        let valAddress = extractMetadata(meta, 'validator') || valByClaim?.address;
        let valName = valByClaim?.name || (valAddress ? validatorsData?.validators.find((v: Validator) => v.address === valAddress)?.name : undefined);

        if (isOwnerBadgeCollection && allIds.length > 0) {
            const firstVal = validatorsData?.validators.find((v: Validator) => v.ownerBadge === allIds[0]);
            if (firstVal) {
                valAddress = firstVal.address;
                valName = allIds.length > 1 ? `${firstVal.name} (+${allIds.length - 1})` : firstVal.name;
            }
        }

        const r: ParsedResource = {
            address: nft.resource_address,
            name: nftName,
            symbol: extractMetadata(meta, 'symbol') || '',
            iconUrl: extractMetadata(meta, 'icon_url') || '',
            amount: String(nftAmount),
            isPoolUnit: false,
            isLsu: false,
            validatorAddress: valAddress,
            validatorName: valName,
            isClaim: !!meta.find((m: MetadataItem) => m.key === 'claim_nft' || m.key === 'validator') || !!valByClaim,
            ids: allIds,
            isNft: true,
            isOwnerBadge: isOwnerBadgeCollection
        };

        if (r.isClaim && r.validatorAddress && r.ids && r.ids.length > 0) {
            claimCollections[r.address] = r.ids;
        }
        
        if (nftAmount === 0) {
            burnedNfts.push(r);
        } else {
            activeNfts.push(r);
        }
    });

    const claimCollectionAddresses = Object.keys(claimCollections).sort();
    // Include the actual IDs in the query key so it refetches when new claim NFTs are minted
    const claimCollectionIds = claimCollectionAddresses
        .map(addr => `${addr}:${claimCollections[addr].toSorted().join('|')}`)
        .join('||');

    const { data: claimsData, isLoading: isLoadingClaims } = useQuery({
        queryKey: ['account-claim-nfts', address, network, claimCollectionIds],
        queryFn: async () => {
            const results: Record<string, Record<string, unknown>[]> = {};
            await Promise.all(claimCollectionAddresses.map(async (resAddr) => {
                results[resAddr] = await apiFetchNonFungibleData(resAddr, claimCollections[resAddr], network);
            }));
            return results;
        },
        enabled: claimCollectionAddresses.length > 0,
        staleTime: 0,
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

            let totalXrdForThisClaimNFT = 0;

            if (valAddr) {
                const entry = getStakingEntry(valAddr);
                items.forEach((item: Record<string, unknown>) => {
                    const data = item.data as { programmatic_json?: { fields?: { field_name: string; value: string }[] } } | undefined;
                    const fields = data?.programmatic_json?.fields;
                    const amt = parseFloat(fields?.find(f => f.field_name === 'claim_amount')?.value || '0');
                    totalXrdForThisClaimNFT += amt;
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

            const resourceInActive = activeNfts.find(n => n.address === resAddr);
            if (resourceInActive) {
                resourceInActive.claimXrdTotal = totalXrdForThisClaimNFT;
            }
        });
    }

    // Ensure validators where the user is an owner are included
    validatorsData?.validators.forEach(v => {
        if (
            (v.ownerBadge && activeNfts.some(nft => nft.ids?.includes(v.ownerBadge!))) ||
            v.ownerAddress === address
        ) {
            getStakingEntry(v.address);
        }
    });

    const isOwner = (vAddr: string) => {
        const val = validatorsData?.validators.find(v => v.address === vAddr);
        if (!val) return false;
        if (val.ownerBadge && activeNfts.some(nft => nft.ids?.includes(val.ownerBadge!))) return true;
        if (val.ownerAddress === address) return true;
        return false;
    };

    const stakingRows = Array.from(stakingMap.values()).toSorted((a, b) => {
        const ownerA = isOwner(a.validatorAddress);
        const ownerB = isOwner(b.validatorAddress);
        if (ownerA && !ownerB) return -1;
        if (!ownerA && ownerB) return 1;
        return b.xrdInStake - a.xrdInStake;
    });
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
