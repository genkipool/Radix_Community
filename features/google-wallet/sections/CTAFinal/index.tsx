/**
 * CTAFinal — RSC
 *
 * Closing call to action, mirroring the Hyperscale CTAFinal format: big
 * gradient headline over a glow blob, one internal and one external action.
 */
import Link from 'next/link';
import { FadeIn } from '@/components/ui/FadeIn';
import { GlowBlob } from '@/components/ui/GlowBlob';
import { GOOGLE_WALLET_LINKS } from '../../data/links';
import type { GoogleWalletLocaleSectionProps } from '../../types';

export default function CTAFinal({ t, locale }: GoogleWalletLocaleSectionProps) {
  const cta = t.googleWallet.cta;

  return (
    <section className="py-32 bg-[var(--color-bg)] relative overflow-hidden">
      <GlowBlob color="var(--color-primary)" position="center" size={800} opacity={0.2} blur={120} />

      <div className="max-w-4xl mx-auto px-12 sm:px-16 lg:px-24 relative z-10 text-center">
        <FadeIn className="text-5xl md:text-7xl font-extrabold text-[var(--color-text-main)] mb-8 tracking-tight leading-tight">
          <h2>
            {cta.h2a}<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)]">
              {cta.h2b}
            </span>
          </h2>
        </FadeIn>

        <FadeIn delay={0.1} className="text-xl text-[var(--color-text-muted)] mb-12 max-w-2xl mx-auto leading-relaxed">
          <p>{cta.sub}</p>
        </FadeIn>

        <FadeIn delay={0.2} className="flex flex-col sm:flex-row justify-center gap-6">
          <Link
            href={`/${locale}/hyperscale`}
            className="inline-flex justify-center items-center px-10 py-5 rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-secondary)] text-[var(--color-bg)] font-bold text-lg hover:opacity-90 transition-opacity shadow-xl"
          >
            {cta.btn_hyperscale}
          </Link>
          <Link
            href={GOOGLE_WALLET_LINKS.rustSdk}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex justify-center items-center px-10 py-5 rounded-full bg-[var(--color-card-border)] text-[var(--color-text-main)] font-bold text-lg hover:bg-[var(--color-surface)] transition-colors border border-[var(--color-card-border)] backdrop-blur-sm"
          >
            {cta.btn_sdk}
          </Link>
        </FadeIn>
      </div>
    </section>
  );
}
