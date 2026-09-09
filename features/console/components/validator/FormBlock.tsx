'use client';

import type { ReactNode } from 'react';
import { Check, Lock } from 'lucide-react';

interface FormBlockProps {
  title: string;
  description: string;
  /** Whether this block contributes to the transaction. */
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  /** Set when the engine forbids this block right now; says why. */
  lockedReason?: string;
  children: ReactNode;
  disabled?: boolean;
}

/**
 * One switchable part of a validator form. Everything switched on goes into
 * the same transaction.
 *
 * Rendered as a row inside its section rather than a card of its own: the
 * section is already a box, and boxing every row inside it buried the fields
 * two frames deep. A hairline separates the rows and the checkbox carries the
 * state.
 *
 * The fields stay mounted when the block is off — collapsing them would move
 * everything below on every toggle, and would throw away what the operator had
 * already typed.
 */
export function FormBlock({
  title,
  description,
  enabled,
  onToggle,
  lockedReason,
  children,
  disabled,
}: FormBlockProps) {
  const locked = !!lockedReason;
  const active = enabled && !locked;

  return (
    <div
      className="py-4 border-t first:border-t-0 first:pt-0"
      style={{ borderColor: 'var(--color-card-border)' }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={active}
        onClick={() => onToggle(!enabled)}
        disabled={disabled || locked}
        title={lockedReason}
        className="w-full flex items-start gap-3 text-left cursor-pointer disabled:cursor-not-allowed"
      >
        <span
          className="shrink-0 mt-0.5 size-[18px] rounded-md border grid place-items-center transition-colors"
          style={{
            background: active ? 'var(--color-primary)' : 'transparent',
            borderColor: active ? 'var(--color-primary)' : 'var(--color-card-border)',
          }}
          aria-hidden
        >
          {locked ? (
            <Lock className="size-2.5" style={{ color: 'var(--color-text-muted)' }} />
          ) : active ? (
            <Check className="size-3 text-white" />
          ) : null}
        </span>

        <span className="min-w-0">
          <span
            className="block text-sm font-bold leading-tight"
            style={{ color: active ? 'var(--color-primary)' : 'var(--color-text-main)' }}
          >
            {title}
          </span>
          <span
            className="block text-[11px] mt-0.5 leading-snug"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {lockedReason ?? description}
          </span>
        </span>
      </button>

      <div
        className="mt-3 pl-[30px] grid grid-cols-1 sm:grid-cols-2 gap-3"
        aria-disabled={!active}
        style={{ opacity: active ? 1 : 0.4 }}
      >
        {children}
      </div>
    </div>
  );
}
