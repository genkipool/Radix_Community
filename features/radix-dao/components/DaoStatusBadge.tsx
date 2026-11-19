import type { ReactNode } from 'react';

interface DaoStatusBadgeProps {
  variant: 'primary' | 'accent' | 'neutral';
  size?: 'xs' | 'sm';
  title?: string;
  className?: string;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<DaoStatusBadgeProps['variant'], string> = {
  primary:
    'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-[var(--color-primary)]/25',
  accent:
    'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/30',
  neutral:
    'bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-card-border)]',
};

const SIZE_CLASSES: Record<NonNullable<DaoStatusBadgeProps['size']>, string> = {
  xs: 'text-[10px] tracking-widest px-2.5 py-0.5',
  sm: 'text-[11px] tracking-wider px-2.5 py-0.5',
};

export function DaoStatusBadge({
  variant,
  size = 'xs',
  title,
  className,
  children,
}: DaoStatusBadgeProps) {
  return (
    <span
      title={title}
      className={[
        'inline-flex items-center font-bold uppercase rounded-full border',
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        title ? 'cursor-help' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}
