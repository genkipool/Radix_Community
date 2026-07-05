import type { ReactNode } from 'react';
import { FadeIn } from '@/components/ui/FadeIn';

interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  desc: string;
  /** Optional small pill rendered above the title (e.g., architecture pillar tag). */
  tag?: string;
  delay?: number;
}

/**
 * FeatureCard — RSC
 *
 * Standard card of the Hyperscale page: icon, optional tag pill, title and
 * description, following the card style of the home sections.
 */
export function FeatureCard({ icon, title, desc, tag, delay = 0 }: FeatureCardProps) {
  return (
    <FadeIn
      delay={delay}
      className="bg-[var(--color-card-bg)] border border-[var(--color-card-border)] p-8 rounded-2xl relative overflow-hidden group hover:border-[var(--color-secondary)]/40 transition-colors"
    >
      <div className="absolute top-0 right-0 size-32 bg-[var(--color-secondary)]/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
      <div className="mb-6 relative z-10">{icon}</div>
      {tag && (
        <span className="inline-block px-3 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-card-border)] text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-3 relative z-10">
          {tag}
        </span>
      )}
      <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-3 relative z-10">{title}</h3>
      <p className="text-[var(--color-text-muted)] text-sm leading-relaxed relative z-10">{desc}</p>
    </FadeIn>
  );
}
