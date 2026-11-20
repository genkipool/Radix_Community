import Link from 'next/link';
import { ArrowDownToLine, ArrowUpRight, CheckCircle2, Clock, Landmark, ShieldCheck, Sparkles, Vote } from 'lucide-react';
import { FadeIn } from '@/components/ui/FadeIn';
import { DAO_DOCUMENTS, DAO_LEGAL_FACTS } from '../data/radixDaoData';
import type { DaoCopy } from '../types/radixDao.types';

interface DaoHeroProps {
  hero: DaoCopy['hero'];
  sequenceSteps: DaoCopy['sequence']['steps'];
  locale: string;
}

export function DaoHero({ hero, sequenceSteps, locale }: DaoHeroProps) {
  const tc4Href = `/${locale}/governance/radix-dao/temperature-check/4`;
  const stats = [
    { value: hero.facts.formedValue, label: hero.facts.formedLabel, gradient: true, title: undefined, href: undefined },
    { value: `${DAO_DOCUMENTS.length} PDFs`, label: hero.ctaDocs, gradient: false, title: undefined, href: '#documents' },
    {
      value: DAO_LEGAL_FACTS.midaoRegistration,
      label: hero.facts.registrationLabel,
      gradient: true,
      title: hero.facts.registrationTitle,
      href: '#doc-certificate-of-formation',
    },
    { value: hero.facts.statusValue, label: hero.facts.statusLabel, gradient: false, title: hero.facts.statusTitle, href: undefined },
  ];

  return (
    <section
      id="hero"
      className="relative min-h-[calc(100vh-4rem)] pt-36 pb-16 sm:pt-40 sm:pb-20 overflow-hidden bg-[var(--color-bg)] flex flex-col justify-between"
    >
      {/* Lightweight radial ambient glows (zero heavy CSS blur filters) */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(600px circle at 8% 28%, color-mix(in oklch, var(--color-primary) 7%, transparent), transparent 70%), radial-gradient(600px circle at 92% 72%, color-mix(in oklch, var(--color-secondary) 7%, transparent), transparent 70%)',
        }}
      />

      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10 w-full flex-1 flex flex-col justify-between">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center my-auto py-4">
          {/* LEFT COLUMN — Headline & CTAs */}
          <div className="lg:col-span-7">
            <div
              title={hero.facts.registrationTitle}
              className="inline-flex items-center gap-2 px-4 h-8 rounded-full bg-[var(--color-bg)] border border-[var(--color-card-border)] text-sm font-medium text-[var(--color-primary)] mb-6 shadow-sm cursor-help"
            >
              <Landmark className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="leading-none">{hero.badge}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[var(--color-text-main)] mb-4 leading-tight tracking-tighter">
              {hero.brand}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)]">
                {hero.title}
              </span>
            </h1>

            <p className="text-lg text-[var(--color-text-muted)] leading-relaxed max-w-xl mb-10">
              {hero.subtitle}
            </p>

            {/* Primary & Secondary CTAs */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-4">
              <Link
                href={tc4Href}
                className="inline-flex justify-center items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-secondary)] text-[var(--color-bg)] font-bold hover:opacity-90 transition-opacity"
              >
                <Vote className="size-4 shrink-0" aria-hidden="true" />
                <span>{hero.ctaVote}</span>
                <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
              </Link>
              <a
                href="#documents"
                className="inline-flex justify-center items-center gap-2 px-8 py-4 rounded-full bg-[var(--color-card-border)] text-[var(--color-text-main)] font-bold hover:bg-[var(--color-surface)] transition-colors border border-[var(--color-card-border)]"
              >
                <ArrowDownToLine className="size-4 shrink-0" aria-hidden="true" />
                <span>{hero.ctaDocs}</span>
              </a>
            </div>
          </div>

          {/* RIGHT COLUMN — Editorial Current Phase & Founding Progress */}
          <div className="lg:col-span-5">
            <div className="border-l-2 border-[var(--color-primary)] pl-6 sm:pl-8 py-2 space-y-5">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--color-primary)]">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                <span>{hero.phaseBannerLabel}</span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-text-main)] leading-snug">
                {hero.phaseBannerTitle}
              </h2>

              <p className="text-sm sm:text-base text-[var(--color-text-muted)] leading-relaxed">
                {hero.phaseBannerDesc}
              </p>

              {/* Compact 4-step milestone status list */}
              <ol className="pt-3 border-t border-[var(--color-card-border)] space-y-2.5">
                {sequenceSteps.map((step) => {
                  const isCompleted = step.status === 'completed';
                  const isNext = step.status === 'next';
                  const Icon = isCompleted ? CheckCircle2 : isNext ? Sparkles : Clock;

                  return (
                    <li key={step.code} className="flex items-center gap-3 text-sm">
                      <Icon
                        className={`size-4 shrink-0 ${
                          isCompleted
                            ? 'text-[var(--color-accent)]'
                            : isNext
                              ? 'text-[var(--color-primary)]'
                              : 'text-[var(--color-text-muted)]'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="font-mono text-xs font-bold text-[var(--color-text-muted)] w-28 shrink-0">
                        {step.code}
                      </span>
                      <span
                        className={`truncate ${
                          isCompleted || isNext
                            ? 'font-semibold text-[var(--color-text-main)]'
                            : 'text-[var(--color-text-muted)]'
                        }`}
                      >
                        {step.title}
                      </span>
                    </li>
                  );
                })}
              </ol>

              <div className="pt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <Link
                  href={tc4Href}
                  className="inline-flex items-center gap-1.5 font-bold text-[var(--color-primary)] hover:underline"
                >
                  <Vote className="size-4" aria-hidden="true" />
                  <span>{hero.ctaVote}</span>
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </Link>
                <a
                  href="#verify"
                  className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-secondary)] hover:underline"
                >
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  <span>{hero.ctaVerify}</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Metrics Strip */}
        <div className="mt-14 pt-10 border-t border-[var(--color-card-border)]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => {
              const content = (
                <>
                  <div
                    title={stat.title}
                    className={`text-2xl sm:text-3xl font-bold mb-1.5 whitespace-nowrap inline-flex items-center gap-2 ${
                      stat.title && !stat.href ? 'cursor-help' : ''
                    } ${
                      stat.gradient
                        ? 'text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)]'
                        : 'text-[var(--color-text-main)]'
                    }`}
                  >
                    <span>{stat.value}</span>
                  </div>
                  <div
                    title={stat.title}
                    className={`text-sm text-[var(--color-text-muted)] font-medium inline-flex items-center gap-1.5 ${
                      stat.href ? 'group-hover:text-[var(--color-secondary)] transition-colors' : ''
                    } ${stat.title && !stat.href ? 'cursor-help' : ''}`}
                  >
                    <span>{stat.label}</span>
                  </div>
                </>
              );

              return (
                <FadeIn key={stat.label} delay={i * 0.05}>
                  {stat.href ? (
                    <a href={stat.href} className="group flex flex-col items-start">
                      {content}
                    </a>
                  ) : (
                    <div className="flex flex-col items-start">{content}</div>
                  )}
                </FadeIn>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
