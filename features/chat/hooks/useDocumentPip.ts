'use client';

/**
 * Document Picture-in-Picture: moves live DOM into a small always-on-top OS
 * window, so a conversation stays visible while the user works in other tabs or
 * apps. Unlike video PiP this carries real, interactive DOM, which is what lets
 * the chat keep its composer and file transfers.
 *
 * The API is Chromium-only today (Chrome/Edge 116+), so `supported` is checked
 * before offering it anywhere; everywhere else the chat simply stays inline.
 *
 * The PiP window starts with an EMPTY document, so the page's stylesheets and
 * the theme markers on <html> are copied across; otherwise every CSS variable
 * the design relies on would resolve to nothing.
 */
import { useEffect, useRef, useState } from 'react';
import { prepareWindow } from '../lib/window-clone';

interface DocumentPictureInPicture {
  requestWindow(options?: {
    width?: number;
    height?: number;
    disallowReturnToOpener?: boolean;
    preferInitialWindowPlacement?: boolean;
  }): Promise<Window>;
  window: Window | null;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

export function useDocumentPip() {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [supported, setSupported] = useState(false);
  const openingRef = useRef(false);

  // Feature detection has to wait for the client, and must not run in the
  // effect body as a synchronous setState.
  useEffect(() => {
    const timer = setTimeout(
      () => setSupported(typeof window !== 'undefined' && !!window.documentPictureInPicture),
      0,
    );
    return () => clearTimeout(timer);
  }, []);

  // Close the floating window if the component goes away, so it can never
  // outlive the conversation it belongs to.
  useEffect(() => {
    return () => {
      try {
        pipWindow?.close();
      } catch {
        /* already gone */
      }
    };
  }, [pipWindow]);

  const open = async (size?: { width?: number; height?: number }) => {
    const api = window.documentPictureInPicture;
    if (!api || openingRef.current || pipWindow) return;
    openingRef.current = true;
    try {
      const target = await api.requestWindow({
        width: size?.width ?? 420,
        height: size?.height ?? 620,
      });
      prepareWindow(target);
      // The user closing the OS window must bring the chat back inline.
      target.addEventListener('pagehide', () => setPipWindow(null), { once: true });
      setPipWindow(target);
    } catch {
      // Denied or unsupported: the chat stays inline.
    } finally {
      openingRef.current = false;
    }
  };

  const close = () => {
    try {
      pipWindow?.close();
    } catch {
      /* already gone */
    }
    setPipWindow(null);
  };

  return { supported, pipWindow, open, close };
}
