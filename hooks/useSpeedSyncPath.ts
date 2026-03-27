'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * useSpeedSyncPath Hook
 *
 * Path-segment equivalent of useSpeedSyncURL — same high-performance pattern:
 * - UI updates INSTANTLY via local state (no waiting for router).
 * - URL persistence (path-based) happens in the background via router.push.
 * - Back/forward browser navigation syncs the segment back to local state.
 *
 * Works correctly when CommunityClient lives in a layout: the layout is never
 * unmounted between community sub-routes, so router.push only causes a soft
 * re-render of the page slot (which returns null) — not a remount.
 *
 * @param basePath      The fixed prefix, e.g. '/en/community'
 * @param initialValue  The segment already in the URL at first render (from usePathname)
 */
export function useSpeedSyncPath(
    basePath: string,
    initialValue: string | null = null,
) {
    const router = useRouter();
    const pathname = usePathname();
    const [, startTransition] = useTransition();

    // Track values we pushed ourselves to ignore stale pathname echoes
    // during the router.push transition (same technique as useSpeedSyncURL).
    const lastPushedRef = useRef<string | null | undefined>(undefined);

    const [segment, setSegment] = useState<string | null>(initialValue);

    /** Instant UI update + background URL sync */
    const setFastSegment = (newSegment: string | null) => {
        setSegment(newSegment);
        lastPushedRef.current = newSegment;

        const url = newSegment ? `${basePath}/${newSegment}` : basePath;
        startTransition(() => {
            router.push(url, { scroll: false });
        });
    };

    // Sync local state when the URL changes externally (browser back/forward).
    useEffect(() => {
        const prefix = basePath + '/';
        const current: string | null = pathname.startsWith(prefix)
            ? (pathname.slice(prefix.length).split('/')[0] || null)
            : (pathname === basePath ? null : null);

        if (lastPushedRef.current !== undefined) {
            // URL has caught up to our last push — finish the sync guard.
            if (current === lastPushedRef.current) {
                lastPushedRef.current = undefined;
            }
            // While the transition is in flight, ignore stale pathname values
            // to prevent the optimistic state from reverting.
            return;
        }

        // Genuine external navigation (back/forward button).
        setSegment(current);
    }, [pathname, basePath]);

    return [segment, setFastSegment] as const;
}
