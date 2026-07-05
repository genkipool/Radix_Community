/**
 * Problem — RSC
 *
 * The four structural failures of today's ticketing: cloneable QRs, the
 * resale black market, centralized custody and Web3 friction.
 */
import { QrCode, Banknote, Database, KeyRound } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FeatureCard } from '../../components/FeatureCard';
import type { GoogleWalletSectionProps } from '../../types';

const CARD_ICONS = [
  <QrCode key="qr" className="size-10 text-[var(--color-primary)]" />,
  <Banknote key="resale" className="size-10 text-[var(--color-secondary)]" />,
  <Database key="custody" className="size-10 text-[var(--color-primary)]" />,
  <KeyRound key="friction" className="size-10 text-[var(--color-secondary)]" />,
];

export default function Problem({ t }: GoogleWalletSectionProps) {
  const problem = t.googleWallet.problem;

  return (
    <section id="problem" className="py-24 bg-[var(--color-surface)]/50 relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<span className="size-2 rounded-full bg-red-500" />}
          badge={problem.label}
          title={problem.h2a}
          titleAccent={problem.h2b}
          subtitle={problem.sub}
          gradient="from-[var(--color-accent)] to-[var(--color-secondary)]"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {problem.cards.map((card, i) => (
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
