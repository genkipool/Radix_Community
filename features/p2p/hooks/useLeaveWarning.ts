'use client';

import { useEffect } from 'react';

/** Warns before unloading the page while a P2P session would be stranded. */
export function useLeaveWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active]);
}
