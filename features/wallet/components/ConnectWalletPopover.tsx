'use client';

import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '../hooks/useRadixWallet';
import { WalletNetworkPopoverContent } from './WalletNetworkPopoverContent';
import { placePopup } from '@/components/layout/placePopup';

const PANEL_WIDTH = 280;
/** Until the panel has been measured once: about what the network picker is. */
const PANEL_HEIGHT_GUESS = 140;

/**
 * Centred under the word, kept inside the window, and above it when there is
 * no room below: the same rules as the navbar popups (see placePopup).
 */
function spotFor(trigger: HTMLElement | null, panel: HTMLElement | null): { top: number; left: number } | null {
  const rect = trigger?.getBoundingClientRect();
  if (!rect) return null;
  const spot = placePopup({
    trigger: rect,
    width: panel?.offsetWidth || PANEL_WIDTH,
    height: panel?.offsetHeight || PANEL_HEIGHT_GUESS,
    viewportWidth: document.documentElement.clientWidth,
    viewportHeight: window.innerHeight,
    align: 'center',
  });
  return { top: spot.top, left: spot.left };
}

/**
 * Wraps an inline "connect wallet" trigger (a text-button living inside a
 * paragraph) with the same network-select popup the Navbar wallet button
 * shows: it opens on hover (desktop) or tap (mobile).
 *
 * The panel is rendered through a portal to `document.body` for two reasons:
 *  1. HTML validity — the trigger sits inside a <p>, and a block-level panel
 *     nested there would auto-close the paragraph and break hydration.
 *  2. Overflow — the popover can escape clipped/overflow-hidden ancestors.
 *
 * Because the panel lives outside the trigger's subtree, CSS `group-hover`
 * can't reach it, so open/close is driven in JS (with a small close delay so
 * the cursor can travel from the trigger into the panel).
 */
export function ConnectWalletPopover({ children }: { children: ReactNode }) {
  const { connect, sessions, switchNetwork, isLoading, cancelConnection } = useRadixWallet();
  const { t } = useLanguage();

  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const computePos = () => {
    const spot = spotFor(triggerRef.current, panelRef.current);
    if (spot) setPos((prev) => (prev && prev.top === spot.top && prev.left === spot.left ? prev : spot));
  };

  // Once the panel is on the page its real size is known: placed again with it.
  useLayoutEffect(() => {
    if (!open) return;
    const spot = spotFor(triggerRef.current, panelRef.current);
    if (spot) setPos((prev) => (prev && prev.top === spot.top && prev.left === spot.left ? prev : spot));
  }, [open]);

  const openPopover = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    computePos();
    setOpen(true);
  };

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: Event) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const reposition = () => computePos();
    document.addEventListener('pointerdown', onOutside, true);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      document.removeEventListener('pointerdown', onOutside, true);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex align-baseline"
      onMouseEnter={openPopover}
      onMouseLeave={scheduleClose}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (open) setOpen(false);
        else openPopover();
      }}
    >
      {children}
      {mounted && open && pos &&
        createPortal(
          <div
            ref={panelRef}
            onMouseEnter={openPopover}
            onMouseLeave={scheduleClose}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              zIndex: 60,
            }}
            className="bg-[var(--color-card-bg)] border border-[var(--color-card-border)] rounded-2xl shadow-2xl shadow-black/20"
          >
            <WalletNetworkPopoverContent
              connect={connect}
              t={t}
              sessions={sessions}
              switchNetwork={switchNetwork}
              isLoading={isLoading}
              cancelConnection={cancelConnection}
            />
          </div>,
          document.body,
        )}
    </span>
  );
}
