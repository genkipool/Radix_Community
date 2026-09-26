'use client';

import { useSyncExternalStore } from 'react';

const MINUTE = 60_000;

function subscribe(onChange: () => void) {
    const id = setInterval(onChange, MINUTE);
    return () => clearInterval(id);
}

/** Current time in unix seconds, rounded to the minute so snapshots stay stable. */
const snapshot = () => Math.floor(Date.now() / MINUTE) * (MINUTE / 1000);

/**
 * "Now" for time-dependent UI (open/closed, countdowns). The server's time is
 * used while hydrating, so the first client render matches the HTML; after
 * that it follows the clock, ticking every minute.
 */
export function useNow(serverNow: number): number {
    return useSyncExternalStore(subscribe, snapshot, () => serverNow);
}
