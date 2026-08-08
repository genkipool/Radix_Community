'use client';

/**
 * A QR of a link, shown while the pointer rests on its icon.
 *
 * It is drawn through a portal, in coordinates worked out from the icon (see
 * useAnchoredPosition): the cards it lives in clip their own overflow, and a
 * code that is half cut off cannot be scanned. So it opens under the icon when
 * there is room under it and above it when there is not.
 *
 * The code inside drops its own hairline: the popover is already a panel, and
 * a frame within a frame is one line too many. Its white quiet zone stays,
 * because that is the margin a camera actually needs.
 *
 * Pointer only. A phone has no hover, and scanning a code with the device that
 * is displaying it is not a thing anyone does; the touch layouts offer the QR
 * as a menu entry instead.
 */
import { useEffect, useRef } from 'react';
import { QrCode as QrIcon } from 'lucide-react';
import { Portal } from '@/components/ui/Portal';
import { QrCode } from '@/components/ui/QrCode';
import { useAnchoredPosition } from '@/hooks/useAnchoredPosition';

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
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The code, its padding, and the line under it. */
  const boxWidth = size + 28;
  const { anchorRef, position, open, place, close } = useAnchoredPosition({
    width: boxWidth,
    height: size + 28 + (hint ? 38 : 0),
  });

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  if (!url) return null;

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  // Leaving the icon does not close it at once: the pointer may be on its way
  // to the code itself, which cancels the timer when it arrives.
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(close, 120);
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={label}
        title={label}
        onMouseEnter={() => {
          cancelClose();
          place();
        }}
        onMouseLeave={scheduleClose}
        onFocus={place}
        onBlur={close}
        onClick={() => (open ? close() : place())}
        className={`flex shrink-0 items-center justify-center rounded-md p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] ${
          open ? 'text-[var(--color-primary)]' : ''
        } ${className}`}
      >
        <QrIcon className={iconClassName} />
      </button>
      {open && position && (
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
            onMouseEnter={cancelClose}
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
