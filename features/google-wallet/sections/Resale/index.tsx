/**
 * Resale — RSC
 *
 * The atomic-swap resale flow (seller lists → buyer pays → single atomic
 * transaction with royalty split → issuer-controlled rules) plus the
 * 0 / 80% / 15% / 5% stat strip.
 */
import { FadeIn } from '@/components/ui/FadeIn';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { StatStrip } from '../../components/StatStrip';
import type { GoogleWalletSectionProps } from '../../types';

export default function Resale({ t }: GoogleWalletSectionProps) {
  const resale = t.googleWallet.resale;

  return (
    <section id="resale" className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<span className="size-2 rounded-full bg-emerald-500" />}
          badge={resale.label}
          title={resale.h2a}
          titleAccent={resale.h2b}
          subtitle={resale.sub}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-16">
          {resale.steps.map((step, i) => (
            <FadeIn
              key={step.title}
              delay={i * 0.1}
              className="relative bg-[var(--color-card-bg)] border border-[var(--color-card-border)] p-6 rounded-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center size-8 rounded-full bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary)] text-white text-sm font-black shrink-0">
                  {i + 1}
                </span>
                <h3 className="text-base font-bold text-[var(--color-text-main)] leading-tight">{step.title}</h3>
              </div>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{step.desc}</p>
            </FadeIn>
          ))}
        </div>

        <StatStrip items={resale.strip} />
      </div>
    </section>
  );
}
