'use client';

import { useQuery } from '@tanstack/react-query';

import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { parseValidatorState, type ValidatorState } from '../lib/validator-lookup';

export type { ValidatorState } from '../lib/validator-lookup';

/**
 * What the validator currently *is*, so the forms can talk about changes
 * instead of absolutes: a registered validator offers "unregister", and the
 * resources it mints are filled in rather than pasted by hand.
 */
export function useValidatorState(validator: string) {
  const { activeNetwork } = useRadixWallet();

  return useQuery({
    queryKey: ['console-validator-state', activeNetwork, validator],
    enabled: !!validator,
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<ValidatorState | null> =>
      parseValidatorState(await apiFetchEntityDetails(validator, activeNetwork)),
  });
}
