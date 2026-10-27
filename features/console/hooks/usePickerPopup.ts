'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

const MAX_HEIGHT = 420;
const DEFAULT_WIDTH = 440;

/**
 * The floating popup behind the console's "+" picker buttons: drawn through a
 * portal at fixed coordinates next to its button (below when there is room,
 * above otherwise), following it on scroll and resize, and closing on a click
 * outside or Escape. The address picker and the NFT id picker share it, so
 * every "+" opens and behaves the same.
 *
 * `width` is fixed, not fitted to the content, so the popup keeps its size
 * when the language changes; only a narrower screen shrinks it.
 */
export function usePickerPopup({ width: fixedWidth = DEFAULT_WIDTH }: { width?: number } = {}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const show = () => {
    if (buttonRef.current) setRect(buttonRef.current.getBoundingClientRect());
    setOpen(true);
  };
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const n = e.target as Node;
      if (!buttonRef.current?.contains(n) && !popupRef.current?.contains(n)) setOpen(false);
    };
    const reposition = () => {
      if (buttonRef.current) setRect(buttonRef.current.getBoundingClientRect());
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const style: CSSProperties = (() => {
    if (typeof window === 'undefined' || !rect) {
      return { position: 'fixed', left: 12, top: 72, width: 320, zIndex: 9999 };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(fixedWidth, vw - 24);
    const left = Math.min(Math.max(12, rect.right - width), Math.max(12, vw - width - 12));
    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const below = spaceBelow >= 240 || spaceBelow >= spaceAbove;
    const room = (space: number) => Math.min(MAX_HEIGHT, Math.max(200, space - 16));
    return below
      ? { position: 'fixed', left, top: rect.bottom + 6, width, height: room(spaceBelow), zIndex: 9999 }
      : { position: 'fixed', left, bottom: vh - rect.top + 6, width, height: room(spaceAbove), zIndex: 9999 };
  })();

  return { open, show, close, buttonRef, popupRef, style, direction: style.bottom !== undefined ? ('up' as const) : ('down' as const) };
}
