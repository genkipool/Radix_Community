import { FadeIn } from '@/components/ui/FadeIn';
import React from 'react';

const GRADIENT_CLASSES = [
  'from-[var(--color-secondary)] to-[var(--color-primary)]',
  'from-[var(--color-accent)] to-[var(--color-secondary)]',
  'from-[var(--color-accent)] to-[var(--color-secondary)]',
  '',
];

import type { BaseSectionProps } from '../../types';

export default function LargeStats({ t }: BaseSectionProps) {

  return (
    <section id="stats-grande" className="py-24 bg-[var(--color-surface)] relative overflow-hidden border-t border-[var(--color-card-border)]">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 text-center">
          {(t.stats.items as Array<Record<string, string>>).map((stat, i: number) => (
            <FadeIn key={i} delay={i * 0.1}>
              <div className={`text-6xl md:text-7xl font-extrabold mb-4 ${GRADIENT_CLASSES[i] ? `text-transparent bg-clip-text bg-gradient-to-r ${GRADIENT_CLASSES[i]}` : 'text-[var(--color-text-main)]'}`}>
                {stat.value}
              </div>
              <div className="text-lg text-[var(--color-text-muted)] font-medium">{stat.label}</div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
