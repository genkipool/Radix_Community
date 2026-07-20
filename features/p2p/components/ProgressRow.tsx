'use client';

interface ProgressRowProps {
  label: string;
  /** Fraction in [0, 1]; omit for an indeterminate spinner-only row. */
  fraction?: number;
}

/** Progress row: phase label + animated gradient bar with percentage. */
export function ProgressRow({ label, fraction }: ProgressRowProps) {
  const pct = fraction == null ? null : Math.round(fraction * 100);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span
          className="flex items-center gap-2 text-sm font-semibold"
          style={{ color: 'var(--color-text-main)' }}
        >
          <span className="size-3.5 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
          {label}
        </span>
        {pct != null && (
          <span
            className="font-mono text-xs tabular-nums"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {pct}%
          </span>
        )}
      </div>
      {pct != null && (
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: 'var(--color-surface)' }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-200 ease-out"
            style={{
              width: `${pct}%`,
              background:
                'linear-gradient(to right, var(--color-accent), var(--color-primary))',
            }}
          />
        </div>
      )}
    </div>
  );
}
