'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { useRouter, useSearchParams as useSP } from 'next/navigation';
import type { AdminView } from '../types/data.types';

interface CommunityURLState {
    area: string | null;
    admin: AdminView;
}

/**
 * useCommunityURLState
 *
 * Manages the two Community URL params (`area` and `admin`) as a single
 * atomic unit — one router.push per event, never two conflicting pushes.
 *
 * Why not two separate useSpeedSyncURL instances?
 * ─────────────────────────────────────────────────
 * Both handleSelectArea and handleAdminViewChange need to update TWO params
 * in the same synchronous call (set one, clear the other). With two independent
 * useSpeedSyncURL instances each reads the same stale `searchParams` snapshot
 * and fires its own router.push. The second push (clearing the other param)
 * always sees empty params → pushes the bare pathname → overwrites the first
 * push → query params never appear in the URL bar.
 *
 * This hook solves it by building ONE combined URL from both values and calling
 * router.push exactly once per state change, no matter how many fields change.
 *
 * Pattern is identical to useSpeedSyncURL:
 * - UI state updates INSTANTLY (local setState, no router wait).
 * - URL sync happens in the background via startTransition + router.push.
 * - lastPushedRef guards against stale searchParams reverting optimistic state.
 * - Back/forward navigation is detected via useEffect on searchParams.
 */
export function useCommunityURLState(): [
    CommunityURLState,
    (next: CommunityURLState) => void,
] {
    const router = useRouter();
    const searchParams = useSP();
    const [, startTransition] = useTransition();

    // Guard: tracks the state we last pushed so the useEffect ignores stale
    // searchParams echoes while the transition is in flight.
    const lastPushedRef = useRef<CommunityURLState | undefined>(undefined);

    const [state, setState] = useState<CommunityURLState>(() => ({
        area: searchParams.get('area'),
        admin: (searchParams.get('admin') as AdminView) ?? null,
    }));

    const setFast = (next: CommunityURLState) => {
        // 1. Instant UI update
        setState(next);
        lastPushedRef.current = next;

        // 2. Build combined URL — one single push for both params
        const params = new URLSearchParams();
        if (next.area)  params.set('area',  next.area);
        if (next.admin) params.set('admin', next.admin);

        const query = params.toString();
        const url = query ? `?${query}` : window.location.pathname;

        // 3. Background URL sync
        startTransition(() => {
            router.push(url, { scroll: false });
        });
    };

    // Sync local state when URL changes externally (browser back/forward)
    useEffect(() => {
        const urlArea  = searchParams.get('area');
        const urlAdmin = searchParams.get('admin') as AdminView;

        if (lastPushedRef.current !== undefined) {
            const pushed = lastPushedRef.current;
            // URL has caught up to our last push — release the guard
            if (urlArea === pushed.area && urlAdmin === pushed.admin) {
                lastPushedRef.current = undefined;
            }
            // While the transition is in flight, ignore stale searchParams
            return;
        }

        // Genuine external navigation (back/forward button)
        setState({ area: urlArea, admin: urlAdmin });
    }, [searchParams]);

    return [state, setFast];
}
