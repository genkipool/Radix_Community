/**
 * WinWin — RSC
 *
 * Why the incentives align: what the user, the club/issuer and Google each
 * gain concretely, plus the minimal-cost panel that answers the usual
 * "blockchain is expensive" objection.
 */
import { User, Trophy, Cloud, CheckCircle2 } from 'lucide-react';
import { FadeIn } from '@/components/ui/FadeIn';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FeatureCard } from '../../components/FeatureCard';
import type { GoogleWalletSectionProps } from '../../types';

const CARD_ICONS = [
  <User key="user" className="size-10 text-[var(--color-primary)]" />,
  <Trophy key="club" className="size-10 text-[var(--color-secondary)]" />,
  <Cloud key="google" className="size-10 text-[var(--color-primary)]" />,
];

export default function WinWin({ t }: GoogleWalletSectionProps) {
  const winwin = t.googleWallet.winwin;

  return (
    <section id="winwin" className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<span className="size-2 rounded-full bg-emerald-500" />}
          badge={winwin.label}
          title={winwin.h2a}
          titleAccent={winwin.h2b}
          subtitle={winwin.sub}
          gradient="from-[var(--color-accent)] to-[var(--color-secondary)]"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {winwin.cards.map((card, i) => (
            <FeatureCard
              key={card.title}
              icon={CARD_ICONS[i]}
              title={card.title}
              desc={card.desc}
              delay={i * 0.1}
            />
          ))}
        </div>

        {/* Minimal-cost panel */}
        <FadeIn className="bg-gradient-to-br from-[var(--color-primary)]/10 to-transparent border border-[var(--color-secondary)]/30 p-8 md:p-12 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 size-48 bg-[var(--color-secondary)]/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
          <div className="relative z-10">
            <h3 className="text-2xl font-bold text-[var(--color-text-main)] mb-3">{winwin.cost_title}</h3>
            <p className="text-[var(--color-text-muted)] leading-relaxed mb-8 max-w-3xl">{winwin.cost_sub}</p>
            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-4">
              {winwin.cost.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-500 mt-0.5" />
                  <span className="text-sm text-[var(--color-text-main)]/85 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
