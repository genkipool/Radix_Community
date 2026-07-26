'use client';

/**
 * Three dots riding a wave, the universal "the other side is writing" cue.
 * Pinned to the bottom-left corner of the room so it stays visible wherever
 * the message log happens to be scrolled.
 *
 * The animation lives in `app/_themes/utilities.css` (`.chat-typing-dot`), the
 * repo's home for keyframes, which also means it survives the clone into the
 * Picture-in-Picture window.
 */
export function TypingIndicator({ label }: { label: string }) {
  return (
    <div
      className="pointer-events-none absolute bottom-2 left-4 z-10 flex items-center gap-1.5 rounded-full border px-3 py-2 shadow-sm"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-card-border)',
      }}
      role="status"
      aria-live="polite"
      aria-label={label}
      title={label}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="chat-typing-dot size-2 rounded-full"
          style={{
            background: 'var(--color-primary)',
            animationDelay: `${index * 0.16}s`,
          }}
        />
      ))}
    </div>
  );
}
