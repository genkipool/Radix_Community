'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';

export interface MoreMenuButtonProps {
  ariaLabel: string;
  /** Menu panel width utility class. Defaults to `w-60`. Ignored when `customPanel` is true. */
  menuWidthClass?: string;
  /** Optional active indicator dot on the trigger button. */
  hasActiveIndicator?: boolean;
  /** Trigger button class overrides. */
  buttonClassName?: string;
  /**
   * When true, renders `children` directly inside `<AnimatePresence>` without
   * the default panel wrapper — ideal for composing with `SelectPopup`.
   */
  customPanel?: boolean;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
}

/**
 * Reusable vertical 3-dots (`MoreVertical`) trigger with a click-toggled
 * dropdown menu. Sized at 44×44px on touch viewports (36×36px on desktop) for
 * comfortable mobile tapping, with outside-click and Escape dismissal that
 * only attach listeners while open.
 */
export function MoreMenuButton({
  ariaLabel,
  menuWidthClass = 'w-60',
  hasActiveIndicator = false,
  buttonClassName = '',
  customPanel = false,
  children,
}: MoreMenuButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        className={[
          'relative flex items-center justify-center min-w-11 min-h-11 sm:min-w-9 sm:min-h-9 rounded-lg transition-colors duration-150',
          open
            ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface)]',
          buttonClassName,
        ].join(' ')}
      >
        <MoreVertical strokeWidth={2} className="size-5" />
        {hasActiveIndicator && (
          <span
            aria-hidden="true"
            className="absolute top-2 right-2 sm:top-1.5 sm:right-1.5 size-1.5 rounded-full bg-[var(--color-primary)]"
          />
        )}
      </button>

      <AnimatePresence>
        {open &&
          (customPanel ? (
            typeof children === 'function' ? children(close) : children
          ) : (
            <m.div
              role="menu"
              initial={{ opacity: 0, scale: 0.96, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className={`absolute top-full right-0 mt-1.5 ${menuWidthClass} rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)]/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden origin-top-right`}
            >
              {typeof children === 'function' ? children(close) : children}
            </m.div>
          ))}
      </AnimatePresence>
    </div>
  );
}
