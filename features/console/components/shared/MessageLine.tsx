'use client';

import type { ReactNode } from 'react';

const TONES = {
  error: 'var(--color-danger)',
  warning: 'var(--color-warning)',
  muted: 'var(--color-text-muted)',
} as const;

interface MessageLineProps {
  children?: ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
}

/**
 * A status or error line that keeps its height while empty, so a message
 * showing up or going away does not move the rest of the page.
 */
export function MessageLine({ children, tone = 'muted', className = '' }: MessageLineProps) {
  return (
    <p
      role={children ? (tone === 'error' ? 'alert' : 'status') : undefined}
      className={`min-h-[1rem] text-xs leading-4 ${className}`}
      style={{ color: TONES[tone] }}
    >
      {children}
    </p>
  );
}
