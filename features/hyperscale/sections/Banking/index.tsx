/**
 * Banking — RSC
 *
 * Institutional focus: how linear scalability with cross-shard atomicity
 * solves real settlement problems for banks (DvP, capacity, compliance,
 * infrastructure resilience).
 */
import { Landmark, TrendingUp, ScrollText, ShieldCheck } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StatStrip } from '../../components/StatStrip';
import { FeatureCard } from '../../components/FeatureCard';
import type { HyperscaleSectionProps } from '../../types';

const CARD_ICONS = [
  <Landmark key="dvp" className="size-10 text-[var(--color-primary)]" />,
  <TrendingUp key="headroom" className="size-10 text-[var(--color-secondary)]" />,
  <ScrollText key="compliance" className="size-10 text-[var(--color-primary)]" />,
  <ShieldCheck key="resilience" className="size-10 text-[var(--color-secondary)]" />,
];

export default function Banking({ t }: HyperscaleSectionProps) {
  const banking = t.hyperscale.banking;

  return (
    <section id="banking" className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<Landmark className="size-3.5 text-[var(--color-primary)]" />}
          badge={banking.label}
          title={banking.h2a}
          titleAccent={banking.h2b}
          subtitle={banking.sub}
          gradient="from-[var(--color-accent)] to-[var(--color-secondary)]"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {banking.cards.map((card, i) => (
            <FeatureCard
              key={card.title}
              icon={CARD_ICONS[i]}
              title={card.title}
              desc={card.desc}
              delay={i * 0.1}
            />
          ))}
        </div>

        <StatStrip items={banking.strip} />
      </div>
    </section>
  );
}
