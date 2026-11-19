import type { ReactNode } from 'react';

interface DaoSectionProps {
  id: string;
  surface?: 'default' | 'muted';
  containerClassName?: string;
  children: ReactNode;
}

export function DaoSection({
  id,
  surface = 'default',
  containerClassName,
  children,
}: DaoSectionProps) {
  const surfaceClass =
    surface === 'muted' ? 'bg-[var(--color-surface)]/50' : 'bg-[var(--color-bg)]';

  return (
    <section id={id} className={`dao-section py-24 ${surfaceClass} relative overflow-hidden`}>
      <div
        className={`max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10${
          containerClassName ? ` ${containerClassName}` : ''
        }`}
      >
        {children}
      </div>
    </section>
  );
}
