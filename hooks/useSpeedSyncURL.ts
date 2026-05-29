'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * useSpeedSyncURL Hook
 * 
 * Replicates the high-performance navigation technique used in the Community section.
 * - Single local state updates INSTANTLY for immediate UI response.
 * - URL persistence via router.push happens in the background.
 * - Synchronizes URL -> Local State for browser navigation (back/forward).
 */
export function useSpeedSyncURL<T extends string>(
    paramName: string,
    defaultValue: T | null = null
) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [, startTransition] = useTransition();
    
    // Optimistic state for instant UI response during URL push
    const [optimisticState, setOptimisticState] = useState<T | null>(() => {
        return (searchParams.get(paramName) as T) || defaultValue;
    });

    // Track the last value we pushed to the URL so we can detect when it's caught up
    const [lastPushedValue, setLastPushedValue] = useState<T | null | undefined>(undefined);

    // Derive pending flag by comparing URL with last pushed value — no useEffect needed
    const urlValue = searchParams.get(paramName) as T | null;
    const hasPendingPush = lastPushedValue !== undefined && urlValue !== lastPushedValue;

    // Update local state + background URL sync
    const setFastValue = (newValue: T | null) => {
        // Instant visual update
        setOptimisticState(newValue);
        setLastPushedValue(newValue);

        // Sync to URL
        const params = new URLSearchParams(searchParams.toString());
        if (newValue) {
            params.set(paramName, newValue);
        } else {
            params.delete(paramName);
        }
        
        const query = params.toString();
        const url = query ? `?${query}` : window.location.pathname;
        startTransition(() => {
            router.push(url, { scroll: false });
        });
    };

    // Compute derived value during render instead of syncing via useEffect
    
    // During a pending push transition, use the optimistic value to prevent
    // the stale searchParams from reverting the UI. Otherwise, derive from URL.
    const state = hasPendingPush
        ? optimisticState
        : (urlValue || defaultValue);

    return [state, setFastValue] as const;
}
