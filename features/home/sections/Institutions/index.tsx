/**
 * Instituciones — RSC
 *
 * Previously 'use client' because of a single useState for the infrastructure
 * read-mode modal.  That state is now owned by InstitutionalPilotButton and
 * InfrastructureModal lives inside it, so this section becomes a pure RSC.
 *
 * RSC tree:
 *   Instituciones (RSC) — zero JS
 *     ├── InstitutionalPilotButton ('use client') — modal trigger only
 *     └── InfrastructureModal loaded inside that button
 */
import React from 'react';
import Link from 'next/link';
import type { BaseSectionProps } from '../../types';
import { Landmark, ScrollText, Globe, Lock, BarChart3, Zap, Building2, Search, ExternalLink, Info } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import InfraReadButton from './components/InfraReadButton';

const ICONS = [
  <Landmark key={19} className="size-7 text-[var(--color-primary)]" />,
  <ScrollText key={20} className="size-7 text-[var(--color-secondary)]" />,
  <Globe key={21} className="size-7 text-[var(--color-primary)]" />,
  <Lock key={22} className="size-7 text-[var(--color-accent)]" />,
  <BarChart3 key={23} className="size-7 text-[var(--color-primary)]" />,
  <Zap key={24} className="size-7 text-[var(--color-secondary)]" />,
  <Building2 key={25} className="size-7 text-[var(--color-primary)]" />,
  <Search key={26} className="size-7 text-[var(--color-accent)]" />
];

export default function Institutions({ t }: BaseSectionProps) {
  return (
    <section id="para-ceos" className="py-24 bg-[var(--color-surface)] relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<Building2 className="size-4 mr-1" />}
          badge={t.instituciones.label}
          badgeClassName="bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
          title={t.instituciones.h2a}
          titleAccent={t.instituciones.h2b}
          subtitle={t.instituciones.sub}
          gradient="from-[var(--color-accent)] to-[var(--color-secondary)]"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 mb-16">
          {t.instituciones.features.map((feature, i: number) => (
            <FadeIn key={`feature-${i}`} delay={i * 0.05} className="flex gap-6">
              <div className="flex-shrink-0 size-14 rounded-2xl flex items-center justify-center text-2xl bg-[var(--color-bg)] border border-[var(--color-card-border)] shadow-md">
                {ICONS[i]}
              </div>
              <div>
                <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-2">{feature.title}</h3>
                <p className="text-[var(--color-text-muted)] leading-relaxed text-sm">
                  {feature.desc}{'tooltip' in feature && feature.tooltip && (
                    <span className="inline-flex items-center ml-1.5 align-baseline translate-y-[1px]">
                      <InfoTooltip content={t.instituciones[feature.tooltip as keyof typeof t.instituciones] as string}>
                        <Info className="size-3.5 text-[var(--color-primary)] cursor-help shrink-0" />
                      </InfoTooltip>
                    </span>
                  )}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* ── CTA buttons ── */}
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          {/* Client island: opens InfrastructureModal */}
          <InfraReadButton label={t.instituciones.btnInfraRead} />

          {/* Pure anchor — no JS needed */}
          <Link
            href="/infrastructure"
            className="inline-flex justify-center items-center gap-2.5 px-8 py-4 rounded-full bg-[var(--color-bg)] text-[var(--color-text-main)] font-bold hover:bg-[var(--color-surface)] active:scale-[0.98] transition-all border border-[var(--color-card-border)] hover:border-[var(--color-primary)]/50"
          >
            <ExternalLink className="size-5 shrink-0" />
            {t.instituciones.btnInfraWeb}
          </Link>
        </div>
      </div>
    </section>
  );
}
