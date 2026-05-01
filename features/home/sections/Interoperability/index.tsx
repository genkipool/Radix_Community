import { Route } from 'lucide-react';
import React from 'react';
import Link from 'next/link';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { SectionHeader } from '@/components/layout/SectionHeader';
import RadixHyperlaneSVG from './components/RadixHyperlaneSVG';
import type { BaseSectionProps } from '../../types';

export default function Interoperability({ t }: BaseSectionProps) {

  return (
    <section id="interoperabilidad" className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<Route className="w-4 h-4 mr-1" />}
          badge={t.interoperabilidad?.label}
          badgeClassName="bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30 text-[var(--color-primary)]"
          title={t.interoperabilidad?.h2a}
          titleAccent={t.interoperabilidad?.h2b}
          subtitle={t.interoperabilidad?.sub}
          gradient="from-[var(--color-primary)] to-[var(--color-primary)]"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <ScrollReveal from={{ opacity: 0, x: -50 }}>
            <h3 className="text-2xl font-bold text-[var(--color-text-main)] mb-6">{t.interoperabilidad?.whatTitle}</h3>
            <p className="text-[var(--color-text-muted)] mb-8 leading-relaxed">{t.interoperabilidad?.whatDesc}</p>
            <div className="space-y-6">
              {(t.interoperabilidad?.features as Array<{ title: string; desc: string }> || []).map((feature: { title: string; desc: string }, i: number) => (
                <div key={i} className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 text-[var(--color-primary)] font-bold flex items-center justify-center">
                    ✓
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-[var(--color-text-main)] mb-1">{feature.title}</h4>
                    <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-10">
              <Link 
                href={t.interoperabilidad?.urlAstrolescent || '#'} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="inline-flex items-center px-6 py-3 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 text-[var(--color-primary)] font-bold hover:bg-[var(--color-primary)]/20 transition-all gap-2"
              >
                <Route className="w-4 h-4" />
                {t.interoperabilidad?.btnAstrolescent}
              </Link>
            </div>
          </ScrollReveal>

          <ScrollReveal
            from={{ opacity: 0, scale: 0.9 }}
            className="relative h-[400px] flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-[var(--color-primary)]/20 to-[var(--color-primary)]/20 rounded-full blur-[100px]" />
            <div className="relative z-10 w-full h-full flex items-center justify-center">
              <RadixHyperlaneSVG />
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
