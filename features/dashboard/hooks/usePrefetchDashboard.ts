'use client';

import { useQueryClient } from '@tanstack/react-query';
import { apiFetchValidators } from '@/features/dashboard/services/apiClient';

/**
 * usePrefetchDashboard
 *
 * Returns a `prefetch` function that warms up the React Query cache with
 * dashboard data (validators + network stats) when called.
 *
 * Usage: attach to `onMouseEnter` / `onFocus` on the Dashboard nav link
 * so data starts loading before the user clicks.
 *
 * Design decisions:
 * - Usa el mismo queryKey ['validators', network] que useValidatorsQuery para
 *   que el Dashboard use la caché pre-calentada al montar.
 * - staleTime: 60_000 coincide con el staleTime del Dashboard — los datos
 *   prefetcheados no dispararán un doble-fetch si aún están frescos.
 * - Solo prefetchea 'mainnet' por defecto (la red de aterrizaje más común).
 *
 * React Compiler memoiza la función `prefetch` automáticamente.
 */
export function usePrefetchDashboard() {
    const queryClient = useQueryClient();

    const prefetch = (network: 'mainnet' | 'stokenet' = 'mainnet') => {
        queryClient.prefetchQuery({
            queryKey: ['validators', network],
            queryFn:  () => apiFetchValidators(network),
            staleTime: 300_000,
        });
    };

    return { prefetch };
}
