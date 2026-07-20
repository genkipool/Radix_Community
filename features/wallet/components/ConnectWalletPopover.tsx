'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '../hooks/useRadixWallet';
import { WalletNetworkPopoverContent } from './WalletNetworkPopoverContent';

const PANEL_WIDTH = 280;

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
  const { connect, sessions, switchNetwork, isLoading, disconnect } = useRadixWallet();
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
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const half = PANEL_WIDTH / 2;
    const margin = 8;
    const centre = rect.left + rect.width / 2;
    const clamped = Math.min(
      Math.max(centre, half + margin),
      window.innerWidth - half - margin,
    );
    setPos({ top: rect.bottom + margin, left: clamped });
  };

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
              transform: 'translateX(-50%)',
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
              disconnect={disconnect}
            />
          </div>,
          document.body,
        )}
    </span>
  );
}
