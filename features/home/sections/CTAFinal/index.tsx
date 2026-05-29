/**
 * CTAFinal — RSC
 *
 * The btn_inst button now opens InstitutionalPilotModal.
 * Only InstitutionalPilotButton is hydrated — the rest of this section
 * is pure server-rendered HTML with zero JS bundle cost.
 */
import React from 'react';
import Link from 'next/link';
import { FadeIn } from '@/components/ui/FadeIn';
import { GlowBlob } from '@/components/ui/GlowBlob';
import InstitutionalPilotButton from '../../components/InstitutionalPilotButton';
import type { LocaleSectionProps } from '../../types';

export default function CTAFinal({ t, locale }: LocaleSectionProps) {
  return (
    <section className="py-32 bg-[var(--color-bg)] relative overflow-hidden">
      <GlowBlob color="var(--color-primary)" position="center" size={800} opacity={0.2} blur={120} />

      <div className="max-w-4xl mx-auto px-12 sm:px-16 lg:px-24 relative z-10 text-center">
        <FadeIn className="text-5xl md:text-7xl font-extrabold text-[var(--color-text-main)] mb-8 tracking-tight leading-tight">
          <h2>
            {t.cta?.h2a}<br />
            <span className="text-white">{t.cta?.h2b}</span>
          </h2>
        </FadeIn>

        <FadeIn delay={0.1} className="text-xl text-[var(--color-text-muted)] mb-12 max-w-2xl mx-auto leading-relaxed">
          <p>{t.cta?.sub}</p>
        </FadeIn>

        <FadeIn delay={0.2} className="flex flex-col sm:flex-row justify-center gap-6">
          {/* Client island — modal trigger */}
          <InstitutionalPilotButton
            label={t.cta?.btn_inst}
            className="inline-flex justify-center items-center px-10 py-5 rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-secondary)] text-[var(--color-bg)] font-bold text-lg hover:opacity-90 transition-opacity shadow-xl"
          />
          <Link
            href={`/${locale}/docs`}
            className="inline-flex justify-center items-center px-10 py-5 rounded-full bg-[var(--color-card-border)] text-[var(--color-text-main)] font-bold text-lg hover:bg-[var(--color-surface)] transition-colors border border-[var(--color-card-border)] backdrop-blur-sm"
          >
            {t.cta?.btn_dev}
          </Link>
        </FadeIn>
      </div>
    </section>
  );
}
