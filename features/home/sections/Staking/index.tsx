import { Monitor, Droplet, ShieldCheck, Network, Building2, ExternalLink } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import Link from 'next/link';
import type { LanguageSectionProps } from '../../types';

export default function Staking({ t, language }: LanguageSectionProps) {
  return (
    <section id="staking" className="py-24 bg-[var(--color-surface)] relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<Monitor className="size-4 mr-1" />}
          badge={t.staking.label}
          title={t.staking.h2a}
          titleAccent={t.staking.h2b}
          subtitle={t.staking.sub}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {(t.staking.stats as Array<Record<string, string>>).map((stat, i: number) => (
            <FadeIn key={stat.title as string} delay={i * 0.1} className="bg-[var(--color-bg)] border border-[var(--color-card-border)] p-8 rounded-2xl text-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 size-24 bg-gradient-to-br from-[var(--color-primary)]/5 to-transparent blur-2xl -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500" />
              <div className="text-4xl font-bold text-[var(--color-text-main)] mb-2 relative z-10">{stat.value as string}</div>
              <h3 className="text-xl font-bold text-[var(--color-secondary)] mb-4 relative z-10">{stat.title as string}</h3>
              <p className="text-[var(--color-text-muted)] leading-relaxed relative z-10">{stat.desc as string}</p>
            </FadeIn>
          ))}
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          {(t.staking.features as Array<Record<string, string>>).map((feature, i: number) => (
            <FadeIn key={feature.title as string} delay={0.3 + i * 0.1} className="group p-8 rounded-2xl bg-[var(--color-bg)] border border-[var(--color-card-border)] hover:border-[var(--color-primary)]/50 transition-all duration-300 shadow-sm hover:shadow-xl">
              <div className="size-12 rounded-xl bg-[var(--color-surface)] border border-[var(--color-card-border)] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                {i === 0 && <ShieldCheck className="size-6 text-[var(--color-primary)]" />}
                {i === 1 && <Network className="size-6 text-[var(--color-secondary)]" />}
                {i === 2 && <Building2 className="size-6 text-[var(--color-accent)]" />}
              </div>
              {i === 0 ? (
                <Link href={`/${language}/dashboard`} className="block group/link">
                  <h4 className="text-xl font-bold text-[var(--color-text-main)] mb-3 group-hover/link:text-[var(--color-primary)] transition-colors duration-300 flex items-center gap-2">
                    {feature.title as string}
                    <ExternalLink className="size-4 opacity-50 group-hover/link:opacity-100 transition-opacity" />
                  </h4>
                </Link>
              ) : (
                <h4 className="text-xl font-bold text-[var(--color-text-main)] mb-3 group-hover:text-[var(--color-primary)] transition-colors duration-300">
                  {feature.title as string}
                </h4>
              )}
              <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">{feature.desc as string}</p>
            </FadeIn>
          ))}
        </div>

        <div className="mt-16 bg-gradient-to-br from-[var(--color-primary)]/10 to-transparent border border-[var(--color-secondary)]/30 p-8 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 size-64 bg-[var(--color-secondary)]/10 rounded-full blur-3xl -mr-20 -mt-20" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
            <div>
              <h3 className="text-2xl font-bold text-[var(--color-text-main)] mb-6">{t.staking.lsu.title}</h3>
              <p className="text-[var(--color-text-muted)] mb-6 leading-relaxed">{t.staking.lsu.desc}</p>
              <ul className="space-y-4 text-[var(--color-text-main)]/80">
                {(t.staking.lsu.items as Array<Record<string, string>>).map((item, i: number) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="text-[var(--color-accent)]">✓</span> <strong>{item.bold as string}</strong> {item.text as string}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center">
              <div className="size-48 rounded-full border-4 border-[var(--color-secondary)]/30 flex items-center justify-center relative">
                <div className="absolute inset-0 bg-[var(--color-secondary)]/10 rounded-full animate-pulse" />
                <Droplet className="size-10 text-[var(--color-secondary)]" />
                <div className="absolute -bottom-4 bg-[var(--color-surface)] border border-[var(--color-card-border)] px-4 py-1 rounded-full text-sm font-bold text-[var(--color-text-main)]">LSU Token</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
