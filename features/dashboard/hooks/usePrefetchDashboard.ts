'use client';

import { useQueryClient } from '@tanstack/react-query';
import { apiFetchValidators } from '@/features/dashboard/services/apiClient';

/**
 * usePrefetchDashboard
 *
 * Returns una función `prefetch` que pre-calienta la caché de React Query con
 * datos del dashboard (validators + network stats) cuando se llama.
 *
 * Uso: adjuntar a `onMouseEnter` / `onFocus` en el enlace de nav del Dashboard
 * para que los datos empiecen a cargarse antes de que el usuario haga clic.
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
