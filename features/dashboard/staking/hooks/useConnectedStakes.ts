'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';

/**
 * Hook optimizado para extraer rápidamente las direcciones de los validadores 
 * a los que una cuenta está delegando fondos (tanto LSU como NFTs de Claim).
 */
export function useConnectedStakes(accountAddress: string | null, network: 'mainnet' | 'stokenet') {
  const { data: entityData, isLoading } = useQuery({
    queryKey: ['entity-details', accountAddress, network],
    queryFn: () => apiFetchEntityDetails(accountAddress!, network),
    enabled: !!accountAddress,
    staleTime: 60000, // 1 minute cache
  });

  const validatorAddresses = new Set<string>();

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

  return {
    pinnedValidatorAddresses: Array.from(validatorAddresses),
    isLoading,
  };
}
