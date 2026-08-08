'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Where a floating panel should be drawn so that it is fully visible.
 *
 * The panels this serves — a menu, a QR — hang off small controls inside cards
 * that clip their own overflow, so they are rendered through a portal in FIXED
 * coordinates rather than positioned against their trigger. This works those
 * coordinates out: under the trigger when there is room under it, above it when
 * there is not, and always inside the window horizontally, so a control in the
 * last row or the last column opens exactly as well as one in the middle.
 *
 * The size is given rather than measured. Measuring means rendering first and
 * correcting after, which is a frame of the panel in the wrong place; these
 * panels have a known shape, and the result is clamped to the window anyway, so
 * an estimate a few pixels out cannot push anything off screen.
 */
export interface AnchoredPosition {
  top: number;
  left: number;
}

/** Distance from the trigger, and from the edges of the window. */
const MARGIN = 8;

export function useAnchoredPosition({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<AnchoredPosition | null>(null);
  const open = position !== null;

  const close = () => setPosition(null);

  const place = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const fitsBelow = rect.bottom + MARGIN + height <= window.innerHeight;
    setPosition({
      top: fitsBelow
        ? rect.bottom + MARGIN
        : Math.max(MARGIN, rect.top - MARGIN - height),
      left: Math.min(
        Math.max(MARGIN, rect.right - width),
        window.innerWidth - width - MARGIN,
      ),
    });
  };

  // A panel positioned from a rectangle that has since moved is worse than no
  // panel: it closes rather than following.
  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return { anchorRef, position, open, place, close };
}
