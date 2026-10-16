/**
 * A five-point star drawn for small sizes: rounded joins, a stroke thin
 * enough to stay crisp at 14px, and a fill that uses the same colour so the
 * filled state reads as "on" in any theme. The view box hugs the star, so
 * it fills the box like the other 14px icons instead of floating inside it.
 */
export function StarIcon({ filled = false, className = 'size-3.5' }: { filled?: boolean; className?: string }) {
  return (
    <svg viewBox="2.6 2.4 18.8 18.8" className={className} aria-hidden="true" focusable="false">
      <path
        d="M12 3.2l2.63 5.33 5.88.86-4.26 4.15 1 5.86L12 16.63 6.75 19.4l1-5.86-4.25-4.15 5.88-.86L12 3.2z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
