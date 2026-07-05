/**
 * Solution — RSC
 *
 * Direct answer to each of the four Problem cards: uncopyable NFC pass,
 * automatic resale splits, public-ledger source of truth and total
 * invisibility for the user.
 */
import { Nfc, Split, Globe, EyeOff } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FeatureCard } from '../../components/FeatureCard';
import type { GoogleWalletSectionProps } from '../../types';

const CARD_ICONS = [
  <Nfc key="pass" className="size-10 text-[var(--color-primary)]" />,
  <Split key="split" className="size-10 text-[var(--color-secondary)]" />,
  <Globe key="ledger" className="size-10 text-[var(--color-primary)]" />,
  <EyeOff key="invisible" className="size-10 text-[var(--color-secondary)]" />,
];

export default function Solution({ t }: GoogleWalletSectionProps) {
  const solution = t.googleWallet.solution;

  return (
    <section id="solution" className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<span className="size-2 rounded-full bg-emerald-500" />}
          badge={solution.label}
          title={solution.h2a}
          titleAccent={solution.h2b}
          subtitle={solution.sub}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {solution.cards.map((card, i) => (
            <FeatureCard
              key={card.title}
              icon={CARD_ICONS[i]}
              title={card.title}
              desc={card.desc}
              delay={i * 0.1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
