'use client';

import { ReactNode } from 'react';

interface ToolSectionProps {
  title?: string;
  hint?: string;
  /** Optional control rendered at the right of the title row */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Card-styled section used to group the controls of a console tool. */
export function ToolSection({ title, hint, action, children, className = '' }: ToolSectionProps) {
  return (
    <section
      className={`rounded-2xl border p-5 sm:p-6 space-y-4 ${className}`}
      style={{ background: 'var(--color-card-bg)', borderColor: 'var(--color-card-border)' }}
    >
      {(title || action) && (
        <header className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            {title && (
              <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-main)' }}>
                {title}
              </h3>
            )}
            {action}
          </div>
          {hint && (
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              {hint}
            </p>
          )}
        </header>
      )}
      {children}
    </section>
  );
}
