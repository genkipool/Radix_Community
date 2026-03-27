import { QueryClient } from '@tanstack/react-query';

/**
 * Shared QueryClient factory.
 *
 * Used in two contexts:
 *  1. Client-side (Providers.tsx) — one instance per page load, created with
 *     useState so it is stable across re-renders but not shared across requests.
 *  2. Server-side (dashboard page.tsx) — one instance per request used to
 *     pre-populate the cache with ISR data, then serialised via `dehydrate()`
 *     and passed to the client through `HydrationBoundary`.
 *
 * Default settings rationale:
 *  - staleTime: 0   → treat all data as stale by default; per-query settings
 *                     override this for longer-lived data (validators: 60s, etc.).
 *  - gcTime: 5min   → keep unused cache entries for 5 min — good for navigating
 *                     back to the dashboard without a full refetch.
 *  - retry: 2       → retry failed requests twice with exponential backoff.
 *  - refetchOnWindowFocus: false → no surprise refetches when switching tabs.
 *  - dehydrate.shouldDehydrateQuery → also serialise pending queries so the
 *    server can stream promises to the client (React 19 / Next.js 15 pattern).
 */
let browserQueryClient: QueryClient | undefined = undefined;

export function makeQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 0,
                gcTime: 1000 * 60 * 5,
                retry: 2,
                retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
                refetchOnWindowFocus: false,
            },
            dehydrate: {
                // Serialize ALL successful and pending queries. We bypass defaultShouldDehydrateQuery 
                // because it discards queries with staleTime: 0 (the default), which was silently deleting 
                // our manually setQueryData caches (like tx-details and entity metadata) before SSR transmission.
                shouldDehydrateQuery: (query) =>
                    query.state.status === 'success' || query.state.status === 'pending',
            },
        },
    });
}

// Browser-side singleton to ensure cache survives route transitions (language changes)
export function getQueryClient() {
    if (typeof window === 'undefined') {
        // Server: always create a new client
        return makeQueryClient();
    }
    // Browser: create if not exists
    if (!browserQueryClient) {
        browserQueryClient = makeQueryClient();
    }
    return browserQueryClient;
}
