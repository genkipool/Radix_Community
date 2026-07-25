'use client';

/**
 * A second, independent window to portal live DOM into, opened with
 * `window.open`.
 *
 * Why not another Picture-in-Picture window: the Document PiP API allows only
 * ONE such window per tab, and requesting a second one closes the first. So
 * when the chat already occupies the PiP window, anything that needs its own
 * window (the send-transaction form) gets a real detached window instead. It
 * can be moved and resized freely next to the floating chat; what it cannot be
 * is pinned always on top, which browsers only grant to PiP.
 *
 * Opening must happen inside a user gesture or the popup blocker stops it.
 */
import { useEffect, useRef, useState } from 'react';
import { prepareWindow } from '../lib/window-clone';

export function useDetachedWindow() {
  const [detached, setDetached] = useState<Window | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const close = () => {
    stopPolling();
    try {
      detached?.close();
    } catch {
      /* already gone */
    }
    setDetached(null);
  };

  // Never let the window outlive the component that owns it.
  useEffect(() => {
    return () => {
      stopPolling();
      try {
        detached?.close();
      } catch {
        /* already gone */
      }
    };
  }, [detached]);

  const open = (options?: { title?: string; width?: number; height?: number }) => {
    if (detached) {
      detached.focus();
      return;
    }
    const width = options?.width ?? 560;
    const height = options?.height ?? 760;
    // Centre it on the screen the user is actually looking at.
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
    const target = window.open(
      '',
      '_blank',
      `popup=yes,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)}`,
    );
    if (!target) return; // Blocked by the browser: caller falls back inline.

    prepareWindow(target, options?.title);
    // `pagehide` is unreliable for popups closed from the OS chrome, so the
    // `closed` flag is polled as well to bring the UI back reliably.
    target.addEventListener('pagehide', () => setDetached(null), { once: true });
    stopPolling();
    pollRef.current = setInterval(() => {
      if (target.closed) {
        stopPolling();
        setDetached(null);
      }
    }, 500);
    setDetached(target);
  };

  return { detached, open, close };
}
