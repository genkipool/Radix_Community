import { XRDPrice } from './data.types';

/**
 * Interfaces for Games feature hooks.
 */

export interface UseXrdPriceResult {
  /** Current price. `null` while loading or if it failed. */
  price: XRDPrice | null;
  /** `true` during the first load (no cached data). */
  isLoading: boolean;
  /** `true` mientras se refetcha en segundo plano (datos antiguos disponibles). */
  isFetching: boolean;
  /** Error si todas las fuentes fallaron. */
  error: Error | null;
}
