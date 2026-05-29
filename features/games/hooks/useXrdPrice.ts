'use client';

/**
 * features/games/hooks/useXrdPrice.ts
 *
 * React Query hook para obtener el precio actual de XRD en USD/EUR.
 * Consolida los tres useEffect de fetch dispersos en:
 *   - LeaderboardSidebar.tsx
 *   - TournamentModal.tsx
 *   - RadixInvaders/RadixInvadersGame.tsx  (IntroScreen)
 *
 * Ventajas sobre los useEffect manuales:
 *  - Deduplicación: si varios componentes montan al mismo tiempo, solo
 *    se realiza una petición de red (misma queryKey).
 *  - Caché compartida: los tres componentes leen el mismo valor ya que
 *    comparten la instancia de QueryClient (via Providers.tsx).
 *  - Stale-while-revalidate: el usuario ve el precio anterior mientras
 *    se refresca en segundo plano.
 *  - Re-intentos automáticos con back-off exponencial (configurado en
 *    makeQueryClient).
 *  - Sin memory leaks: no hay que gestionar AbortController ni cleanup
 *    manual porque React Query lo hace internamente.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchXRDPrice } from '../utils/xrdPrice';
import { XRDPrice } from '../types/data.types';
import { UseXrdPriceResult } from '../types/hooks.types';

/** Tiempo que el precio se considera "fresco" antes de refetching: 2 minutos. */
const XRD_PRICE_STALE_MS = 2 * 60 * 1000;

/** Maximum time in cache without active use: 10 minutes. */
const XRD_PRICE_GC_MS = 10 * 60 * 1000;

/**
 * Hook principal.
 *
 * @param enabled - Permite diferir la petición (p.ej. TournamentModal solo
 *                  la necesita cuando el modal está abierto).
 *
 * @example
 * // Carga inmediata
 * const { price, isLoading } = useXrdPrice();
 *
 * @example
 * // Lazy load (only when the modal is open)
 * const { price, isLoading } = useXrdPrice({ enabled: isOpen });
 */
export function useXrdPrice({ enabled = true }: { enabled?: boolean } = {}): UseXrdPriceResult {
  const { data, isLoading, isFetching, error } = useQuery<XRDPrice, Error>({
    queryKey: ['xrd-price'],
    queryFn: fetchXRDPrice,
    staleTime: XRD_PRICE_STALE_MS,
    gcTime: XRD_PRICE_GC_MS,
    // Do not retry in a modal that may close quickly; the global limit (2)
    // applies outside — here we use 1 fast retry.
    retry: 1,
    enabled,
  });

  return {
    price: data ?? null,
    isLoading,
    isFetching,
    error: (error as Error | null) ?? null,
  };
}
