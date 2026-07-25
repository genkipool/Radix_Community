'use client';

import { BookOpen } from 'lucide-react';

/**
 * Reading-mode toggle.
 *
 * Extracted so the desktop toolbar and the mobile control row share one
 * implementation: the disabled rule below is easy to get subtly wrong, and two
 * copies of a control that must behave identically is how they drift apart.
 */
const BASE = 'p-2 rounded-full border transition-all';
const ACTIVE = 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]';
const INACTIVE =
  'border-[var(--color-card-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/40';

/**
 * Reading mode opens one card at a time in a modal, which stops making sense
 * once the grid is dense enough that cards are already small.
 */
export const isReadingModeDisabled = (columns: number) => columns >= 5;

export function ReadingModeButton({
  readingMode,
  setReadingMode,
  columns,
  label,
  className = '',
}: {
  readingMode: boolean;
  setReadingMode: (value: boolean) => void;
  /** Current grid density; dense grids disable the toggle. */
  columns: number;
  label: string;
  className?: string;
}) {
  const disabled = isReadingModeDisabled(columns);

  return (
    <button
      type="button"
      onClick={disabled ? undefined : () => setReadingMode(!readingMode)}
      title={label}
      aria-label={label}
      aria-pressed={readingMode}
      disabled={disabled}
      className={`${BASE} ${readingMode ? ACTIVE : INACTIVE} ${
        disabled ? (readingMode ? 'cursor-default' : 'cursor-default opacity-80') : ''
      } ${className}`}
    >
      <BookOpen className="size-4" />
    </button>
  );
}
