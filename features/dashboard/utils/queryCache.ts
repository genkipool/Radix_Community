/**
 * features/dashboard/utils/queryCache.ts
 *
 * Semantic constants for React Query staleTime and gcTime configurations.
 * This standardizes caching behavior across the application while remaining 
 * explicit within individual query hooks.
 */

export const CACHE_TIMES = {
    /** 0 ms - Data that changes constantly or must always be fresh (e.g., live prices, current block) */
    VOLATILE: 0,
    
    /** 1 minute (60,000 ms) - Short-lived data that can tolerate slight delays (e.g., pending balances, rapid status changes) */
    SHORT: 1000 * 60,
    
    /** 5 minutes (300,000 ms) - Standard polling interval for fairly static data (e.g., validator lists, general network stats) */
    MEDIUM: 1000 * 60 * 5,
    
    /** 1 hour (3,600,000 ms) - Rarely changing data (e.g., configuration, large token lists) */
    LONG: 1000 * 60 * 60,
    
    /** Infinity - Immutable or strictly on-chain static data (e.g., entity metadata, contract ABIs) */
    INFINITY: Infinity,
} as const;
