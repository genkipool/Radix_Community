'use client';

import { useQueries } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { dashboardKeys } from '@/features/dashboard/utils/entityCache';
import { CACHE_TIMES } from '@/features/dashboard/utils/queryCache';

import type { Validator } from '@/services/radixApi';

/**
 * Hook optimizado para extraer rápidamente las direcciones de los validadores 
 * a los que una o varias cuentas están delegando fondos (tanto LSU como NFTs de Claim).
 */
export function useConnectedStakes(accountAddresses: string[], network: 'mainnet' | 'stokenet', validators: Validator[] = []) {
  const queryResults = useQueries({
    queries: accountAddresses.map((address) => ({
      queryKey: dashboardKeys.entities.detail(address, network),
      queryFn: () => apiFetchEntityDetails(address, network),
      enabled: !!address,
      staleTime: CACHE_TIMES.MEDIUM,
      gcTime: CACHE_TIMES.LONG,
    }))
  });

  const validatorAddresses = new Set<string>();
  const ownerValidatorAddresses = new Set<string>();
  let isLoading = false;

  queryResults.forEach((result) => {
    if (result.isLoading) isLoading = true;
    const entityData = result.data;
    
    if (entityData) {
      const fungibles = entityData.fungible_resources?.items || [];
      fungibles.forEach(ft => {
        const meta = ft.explicit_metadata?.items || [];
        const valAddress = meta.find(m => m.key === 'validator')?.value?.typed?.value;
        if (valAddress) {
          validatorAddresses.add(valAddress as string);
        }
      });

      const nonFungibles = entityData.non_fungible_resources?.items || [];
      nonFungibles.forEach(nft => {
        const meta = nft.explicit_metadata?.items || [];
        const valAddress = meta.find(m => m.key === 'validator')?.value?.typed?.value;
        if (valAddress) {
          validatorAddresses.add(valAddress as string);
        }

        // Check for owner badges
        let allIds: string[] = [];
        const vaults = nft.vaults?.items || [];
        vaults.forEach((v: any) => {
            if (v.items && Array.isArray(v.items)) {
                allIds = [...allIds, ...v.items];
            }
        });

        if (allIds.length > 0) {
            validators.forEach(v => {
                if (v.ownerBadge && allIds.includes(v.ownerBadge)) {
                    validatorAddresses.add(v.address);
                    ownerValidatorAddresses.add(v.address);
                }
            });
        }
      });

      // Check for owner addresses directly
      const address = result.data?.address;
      if (address) {
          validators.forEach(v => {
              if (v.ownerAddress === address) {
                  validatorAddresses.add(v.address);
                  ownerValidatorAddresses.add(v.address);
              }
          });
      }
    }
  });

  return {
    pinnedValidatorAddresses: Array.from(validatorAddresses),
    ownerValidatorAddresses: Array.from(ownerValidatorAddresses),
    isLoading,
  };
}
