'use client';

import { useQueries } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { dashboardKeys } from '@/features/dashboard/utils/entityCache';
import { CACHE_TIMES } from '@/features/dashboard/utils/queryCache';

/**
 * Hook optimizado para extraer rápidamente las direcciones de los validadores 
 * a los que una o varias cuentas están delegando fondos (tanto LSU como NFTs de Claim).
 */
export function useConnectedStakes(accountAddresses: string[], network: 'mainnet' | 'stokenet') {
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
      });
    }
  });

  return {
    pinnedValidatorAddresses: Array.from(validatorAddresses),
    isLoading,
  };
}
