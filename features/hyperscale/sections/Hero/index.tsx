/**
 * Hero — RSC shell (same split strategy as the home hero)
 *
 *  ┌─ Hero (RSC) ─────────────────────────────────────────────────────────┐
 *  │  Static layout, cross-shard settlement panel, metrics bar            │
 *  │  ┌─ HeroCarousel ('use client') ──────────────────────────────────┐  │
 *  │  │  Slides with useReducer/useEffect + CSS animations              │  │
 *  │  └────────────────────────────────────────────────────────────────┘  │
 *  └──────────────────────────────────────────────────────────────────────┘
 */
import Link from 'next/link';
import { Zap } from 'lucide-react';
import HeroCarousel from './components/HeroCarousel';
import { HeroIllustration } from './components/HeroIllustration';
import { HYPERSCALE_LINKS, XIAN_ROADMAP_ID } from '../../data/links';
import type { HyperscaleSectionProps } from '../../types';



export default function Hero({ t }: HyperscaleSectionProps) {
  const hero = t.hyperscale.hero;

  const metrics = [
    { value: hero.metric1_value, label: hero.metric1, gradient: true },
    { value: hero.metric2_value, label: hero.metric2, gradient: false },
    { value: hero.metric3_value, label: hero.metric3, gradient: true },
    { value: hero.metric4_value, label: hero.metric4, gradient: false },
  ];

  return (
    <section
      id="hero"
      className="relative min-h-screen pt-40 pb-20 overflow-hidden flex flex-col justify-start"
    >
      {/* Ambient background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 -left-64 size-[500px] bg-[var(--color-primary)]/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 -right-64 size-[500px] bg-[var(--color-secondary)]/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">

          {/* LEFT COLUMN */}
          <div className="lg:col-span-7">
            {/* Theme-adaptive badge */}
            <div className="inline-flex items-center gap-2 px-4 h-8 rounded-full bg-[var(--color-bg)] border border-[var(--color-card-border)] text-sm font-medium text-[var(--color-primary)] mb-5 shadow-sm">
              <Zap className="size-3.5 shrink-0" fill="currentColor" />
              <span className="leading-none">{hero.badge}</span>
            </div>

            {/* Client island — animated carousel */}
            <HeroCarousel t={t} />

            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <a
                href={`#${XIAN_ROADMAP_ID}`}
                className="inline-flex justify-center items-center px-8 py-4 rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-secondary)] text-[var(--color-bg)] font-bold hover:opacity-90 transition-opacity"
              >
                {hero.btn_roadmap}
              </a>
              <Link
                href={HYPERSCALE_LINKS.hyperscaleRs}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex justify-center items-center px-8 py-4 rounded-full bg-[var(--color-card-border)] text-[var(--color-text-main)] font-bold hover:bg-[var(--color-surface)] transition-colors border border-[var(--color-card-border)]"
              >
                {hero.btn_github}
              </Link>
            </div>
          </div>

          {/* RIGHT COLUMN — Premium SVG Illustration */}
          <div className="relative lg:col-span-5 hidden lg:block pt-6">
            <HeroIllustration />
            <p className="-mt-6 text-sm text-[var(--color-text-muted)] text-center px-2 leading-relaxed opacity-80 transition-opacity hover:opacity-100 relative z-20">
              {hero.illustration_caption}
            </p>
          </div>
        </div>

        {/* Metrics bar — RSC */}
        <div className="mt-24 pt-12 border-t border-[var(--color-card-border)]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {metrics.map((metric) => (
              <div key={metric.label}>
                <div
                  className={`text-3xl font-bold mb-2 ${
                    metric.gradient
                      ? 'text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)]'
                      : 'text-[var(--color-text-main)]'
                  }`}
                >
                  {metric.value}
                </div>
                <div className="text-sm text-[var(--color-text-muted)] font-medium min-h-[40px]">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
