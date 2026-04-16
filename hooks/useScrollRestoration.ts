'use client';

import { useRef, useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Strips the language prefix (e.g., /en or /es) to determine the "core" path.
 */
function getCorePath(pathname: string) {
  const parts = pathname.split('/');
  if (parts.length > 1 && (parts[1] === 'en' || parts[1] === 'es')) {
    return '/' + parts.slice(2).join('/');
  }
  return pathname;
}

/**
 * Intelligent scroll restoration hook that forces scroll to top ONLY on real page changes 
 * (ignoring language changes which we want to keep at the same scroll position).
 */
export function useScrollRestoration() {
  const pathname = usePathname();
  const prevCorePathRef = useRef(getCorePath(pathname || ''));

  // useLayoutEffect runs synchronously *before* the browser paints the screen.
  // This guarantees the scroll position is reset before the new page is ever visible, eliminating the flash.
  useLayoutEffect(() => {
    if (typeof window === 'undefined' || !pathname) return;

    const currentCorePath = getCorePath(pathname);

    if (currentCorePath !== prevCorePathRef.current) {
      if (!window.location.hash) {
        window.scrollTo(0, 0); // Instant scroll, but perfectly hidden because it happens pre-paint
      }
      prevCorePathRef.current = currentCorePath;
    }
  }, [pathname]);
}
