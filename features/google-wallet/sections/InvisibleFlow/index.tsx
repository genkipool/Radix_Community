/**
 * InvisibleFlow — RSC
 *
 * The end-to-end "invisible" journey: Web2 purchase → background Radix
 * account → fee-delegated NFT delivery → ROLA + NFC pass → ledger-checked
 * gate.
 */
import { FadeIn } from '@/components/ui/FadeIn';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { INVISIBLE_FLOW_ID } from '../../data/links';
import type { GoogleWalletSectionProps } from '../../types';

export default function InvisibleFlow({ t }: GoogleWalletSectionProps) {
  const invisible = t.googleWallet.invisible;

  return (
    <section id={INVISIBLE_FLOW_ID} className="py-24 bg-[var(--color-surface)]/50 relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<span className="size-2 rounded-full bg-[var(--color-secondary)]" />}
          badge={invisible.label}
          title={invisible.h2a}
          titleAccent={invisible.h2b}
          subtitle={invisible.sub}
        />

        {/* Step-by-step flow */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
          {invisible.steps.map((step, i) => (
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
      </div>
    </section>
  );
}
