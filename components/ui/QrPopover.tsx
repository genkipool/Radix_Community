'use client';

/**
 * A QR of a link, shown while the pointer rests on its icon.
 *
 * Two things make this more than a tooltip. It is drawn through a portal, in
 * fixed coordinates measured from the trigger, because the cards it lives in
 * clip their own overflow and a code that is half cut off cannot be scanned.
 * And it places itself: below the icon when there is room under it, above when
 * there is not, and always clamped inside the viewport horizontally, so a card
 * in the last row or the last column shows the same complete code as one in the
 * middle.
 *
 * The code inside drops its own hairline: the popover is already a panel, and
 * a frame within a frame is one line too many. Its white quiet zone stays,
 * because that is the margin a camera actually needs.
 *
 * Pointer only. A phone has no hover, and scanning a code with the device that
 * is displaying it is not a thing anyone does; the touch layouts offer the QR
 * as a menu entry instead.
 */
import { useEffect, useRef, useState } from 'react';
import { QrCode as QrIcon } from 'lucide-react';
import { Portal } from '@/components/ui/Portal';
import { QrCode } from '@/components/ui/QrCode';

/** Distance from the trigger, and from the edges of the window. */
const MARGIN = 8;

interface Position {
  top: number;
  left: number;
}

export function QrPopover({
  url,
  label,
  hint,
  size = 168,
  className = '',
  iconClassName = 'size-3.5',
}: {
  url: string;
  /** Accessible name of the trigger, and the QR's alt text. */
  label: string;
  /** Line under the code saying what to do with it. */
  hint?: string;
  size?: number;
  className?: string;
  iconClassName?: string;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const open = position !== null;

  // A popover positioned from a rectangle that has since moved is worse than
  // no popover: it closes rather than following.
  useEffect(() => {
    if (!open) return;
    const close = () => setPosition(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  if (!url) return null;

  /** Box the popover occupies: the code, its padding, and the line under it. */
  const boxWidth = size + 28;
  const boxHeight = size + 28 + (hint ? 38 : 0);

  const place = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const fitsBelow = rect.bottom + MARGIN + boxHeight <= window.innerHeight;
    setPosition({
      top: fitsBelow
        ? rect.bottom + MARGIN
        : Math.max(MARGIN, rect.top - MARGIN - boxHeight),
      left: Math.min(
        Math.max(MARGIN, rect.left + rect.width / 2 - boxWidth / 2),
        window.innerWidth - boxWidth - MARGIN,
      ),
    });
  };

  // Leaving the icon does not close it at once: the pointer may be on its way
  // to the code itself, which cancels the timer when it arrives.
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setPosition(null), 120);
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        title={label}
        onMouseEnter={place}
        onMouseLeave={scheduleClose}
        onFocus={place}
        onBlur={() => setPosition(null)}
        onClick={() => (open ? setPosition(null) : place())}
        className={`flex shrink-0 items-center justify-center rounded-md p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] ${
          open ? 'text-[var(--color-primary)]' : ''
        } ${className}`}
      >
        <QrIcon className={iconClassName} />
      </button>
      {open && (
        <Portal>
          <div
            className="fixed z-[100] flex flex-col items-center gap-1 rounded-2xl border p-3 shadow-2xl"
            style={{
              top: position.top,
              left: position.left,
              width: boxWidth,
              background: 'var(--color-card-bg, var(--color-surface))',
              borderColor: 'var(--color-card-border)',
            }}
            onMouseEnter={() => {
              if (closeTimer.current) clearTimeout(closeTimer.current);
            }}
            onMouseLeave={scheduleClose}
          >
            <QrCode value={url} alt={label} size={size} framed={false} />
            {hint && (
              <p
                className="text-center text-[10px] leading-snug"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {hint}
              </p>
            )}
          </div>
        </Portal>
      )}
    </>
  );
}
