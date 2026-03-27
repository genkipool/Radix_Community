'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
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
    
    // We use a ref to track value changes we initiated, 
    // to avoid the stale searchParams reverting our optimistic state
    // during the router.push transition.
    const lastPushedValueRef = useRef<T | null | undefined>(undefined);
    
    // Initial state from URL
    const [state, setState] = useState<T | null>(() => {
        return (searchParams.get(paramName) as T) || defaultValue;
    });

    // Update local state + background URL sync
    const setFastValue = (newValue: T | null) => {
        // Instant visual update
        setState(newValue);
        lastPushedValueRef.current = newValue;

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

    // Sync local state when URL changes externally (back/forward)
    useEffect(() => {
        const urlValue = searchParams.get(paramName) as T | null;
        
        if (lastPushedValueRef.current !== undefined) {
             // If the URL has finally caught up to our last pushed value, finish the sync.
             if (urlValue === lastPushedValueRef.current) {
                 lastPushedValueRef.current = undefined;
             }
             // While transitioning, ignore stale searchParams to prevent reverting the UI
             return;
        }

        // Genuine external navigation (e.g. browser back button)
        setState(urlValue || defaultValue);
    }, [searchParams, paramName, defaultValue]);

    return [state, setFastValue] as const;
}
