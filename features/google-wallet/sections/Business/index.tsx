/**
 * Business — RSC
 *
 * The pitch in Google's language: Google Cloud node infrastructure (Digital
 * Assets Team / Blockchain Node Engine), per-validation micro-revenue,
 * secondary-market royalties and the moat against Apple.
 */
import { Cloud, Coins, Repeat, Swords } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StatStrip } from '../../components/StatStrip';
import { FeatureCard } from '../../components/FeatureCard';
import { BUSINESS_ID } from '../../data/links';
import type { GoogleWalletSectionProps } from '../../types';

const CARD_ICONS = [
  <Cloud key="cloud" className="size-10 text-[var(--color-primary)]" />,
  <Coins key="micro" className="size-10 text-[var(--color-secondary)]" />,
  <Repeat key="royalties" className="size-10 text-[var(--color-primary)]" />,
  <Swords key="moat" className="size-10 text-[var(--color-secondary)]" />,
];

export default function Business({ t }: GoogleWalletSectionProps) {
  const business = t.googleWallet.business;

  return (
    <section id={BUSINESS_ID} className="py-24 bg-[var(--color-surface)]/50 relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<Cloud className="size-3.5 text-[var(--color-primary)]" />}
          badge={business.label}
          title={business.h2a}
          titleAccent={business.h2b}
          subtitle={business.sub}
          gradient="from-[var(--color-accent)] to-[var(--color-secondary)]"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {business.cards.map((card, i) => (
            <FeatureCard
              key={card.title}
              icon={CARD_ICONS[i]}
              title={card.title}
              desc={card.desc}
              delay={i * 0.1}
            />
          ))}
        </div>

        <StatStrip items={business.strip} />
      </div>
    </section>
  );
}
