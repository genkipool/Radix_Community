'use client';

/**
 * ReactQueryHydrate
 *
 * Thin client-side wrapper around HydrationBoundary from @tanstack/react-query.
 *
 * Why this file exists:
 *   HydrationBoundary internally calls useQueryClient(). That hook throws when
 *   invoked outside a QueryClientProvider. In Next.js 15 + React Query v5, a
 *   Server Component that *directly* renders <HydrationBoundary> can trigger
 *   this during static generation or streaming — before the client-side
 *   QueryClientProvider (in Providers.tsx) has mounted.
 *
 *   Wrapping it in a 'use client' module ensures React defers the boundary to
 *   the client hydration phase, where QueryClientProvider is already in place.
 */
import { HydrationBoundary } from '@tanstack/react-query';
import type { DehydratedState } from '@tanstack/react-query';
import type { ReactNode } from 'react';

export function ReactQueryHydrate({
    state,
    children,
}: {
    state: DehydratedState;
    children: ReactNode;
}) {
    return <HydrationBoundary state={state}>{children}</HydrationBoundary>;
}
