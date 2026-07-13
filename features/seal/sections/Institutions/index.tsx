/**
 * Institutions — RSC
 *
 * Institutional focus: why self-custody signing, encryption and messaging
 * matter for compliance, data sovereignty, procurement and continuity.
 */
import { ScrollText, ShieldCheck, Unplug, Scale } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StatStrip } from '../../components/StatStrip';
import { FeatureCard } from '../../components/FeatureCard';
import type { SealSectionProps } from '../../types';

const CARD_ICONS = [
  <ScrollText key="audit" className="size-10 text-[var(--color-primary)]" />,
  <ShieldCheck key="sovereignty" className="size-10 text-[var(--color-secondary)]" />,
  <Unplug key="lockin" className="size-10 text-[var(--color-primary)]" />,
  <Scale key="cost" className="size-10 text-[var(--color-secondary)]" />,
];

export default function Institutions({ t }: SealSectionProps) {
  const inst = t.seal.institutions;

  return (
    <section id="institutions" className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<ScrollText className="size-3.5 text-[var(--color-primary)]" />}
          badge={inst.label}
          title={inst.h2a}
          titleAccent={inst.h2b}
          subtitle={inst.sub}
          gradient="from-[var(--color-accent)] to-[var(--color-secondary)]"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {inst.cards.map((card, i) => (
            <FeatureCard
              key={card.title}
              icon={CARD_ICONS[i]}
              title={card.title}
              desc={card.desc}
              delay={i * 0.1}
            />
          ))}
        </div>

        <StatStrip items={inst.strip} />
      </div>
    </section>
  );
}
