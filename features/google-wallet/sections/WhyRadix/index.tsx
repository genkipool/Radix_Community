/**
 * WhyRadix — RSC
 *
 * The six protocol-native capabilities that make the invisible-wallet
 * architecture possible on Radix specifically, plus the highlighted
 * comparison panel on permissions and mutable NFTs, where Radix differs
 * from other networks.
 */
import { UserCircle2, HandCoins, Fingerprint, Gem, ScrollText, TrendingUp, XCircle, CheckCircle2 } from 'lucide-react';
import { FadeIn } from '@/components/ui/FadeIn';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FeatureCard } from '../../components/FeatureCard';
import type { GoogleWalletSectionProps } from '../../types';

const PILLAR_ICONS = [
  <UserCircle2 key="accounts" className="size-10 text-[var(--color-primary)]" />,
  <HandCoins key="fees" className="size-10 text-[var(--color-secondary)]" />,
  <Fingerprint key="rola" className="size-10 text-[var(--color-primary)]" />,
  <Gem key="assets" className="size-10 text-[var(--color-secondary)]" />,
  <ScrollText key="rules" className="size-10 text-[var(--color-primary)]" />,
  <TrendingUp key="scale" className="size-10 text-[var(--color-secondary)]" />,
];

export default function WhyRadix({ t }: GoogleWalletSectionProps) {
  const whyRadix = t.googleWallet.whyRadix;

  return (
    <section id="why-radix" className="py-24 bg-[var(--color-surface)]/50 relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<span className="size-2 rounded-full bg-[var(--color-primary)]" />}
          badge={whyRadix.label}
          title={whyRadix.h2a}
          titleAccent={whyRadix.h2b}
          subtitle={whyRadix.sub}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mb-16">
          {whyRadix.pillars.map((pillar, i) => (
            <FeatureCard
              key={pillar.title}
              icon={PILLAR_ICONS[i]}
              tag={pillar.tag}
              title={pillar.title}
              desc={pillar.desc}
              delay={i * 0.08}
            />
          ))}
        </div>

        {/* Highlighted differentiator: permissions and mutable NFTs */}
        <FadeIn className="bg-gradient-to-br from-[var(--color-primary)]/10 to-transparent border border-[var(--color-secondary)]/30 p-8 md:p-12 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 size-48 bg-[var(--color-secondary)]/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
          <div className="relative z-10">
            <h3 className="text-2xl md:text-3xl font-bold text-[var(--color-text-main)] mb-4">
              {whyRadix.diff_title}
            </h3>
            <p className="text-[var(--color-text-muted)] leading-relaxed mb-10 max-w-4xl">{whyRadix.diff_p}</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[var(--color-card-bg)] border border-[var(--color-card-border)] p-8 rounded-2xl">
                <h4 className="text-lg font-bold text-[var(--color-text-muted)] mb-6">{whyRadix.diff_others_title}</h4>
                <ul className="space-y-4">
                  {whyRadix.diff_others.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <XCircle className="size-5 shrink-0 text-red-400/80 mt-0.5" />
                      <span className="text-sm text-[var(--color-text-muted)] leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-[var(--color-card-bg)] border border-[var(--color-secondary)]/40 p-8 rounded-2xl">
                <h4 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)] mb-6">
                  {whyRadix.diff_radix_title}
                </h4>
                <ul className="space-y-4">
                  {whyRadix.diff_radix.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <CheckCircle2 className="size-5 shrink-0 text-emerald-500 mt-0.5" />
                      <span className="text-sm text-[var(--color-text-main)]/85 leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
