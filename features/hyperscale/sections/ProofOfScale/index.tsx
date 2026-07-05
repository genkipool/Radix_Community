/**
 * ProofOfScale — RSC
 *
 * The January 31, 2026 public test: headline stats, the linear-scaling
 * comparison (64 vs 128 shards) and the facts that make the result credible.
 */
import { FlaskConical, Cpu, Gauge, BookOpen } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import { FeatureCard } from '../../components/FeatureCard';
import type { HyperscaleSectionProps } from '../../types';

const FACT_ICONS = [
  <FlaskConical key="swaps" className="size-10 text-[var(--color-primary)]" />,
  <Cpu key="hardware" className="size-10 text-[var(--color-secondary)]" />,
  <Gauge key="bottleneck" className="size-10 text-[var(--color-primary)]" />,
  <BookOpen key="open" className="size-10 text-[var(--color-secondary)]" />,
];

/** Horizontal bar of the linear-scaling comparison. */
function ScalingBar({
  label,
  value,
  widthClass,
  gradientClass,
}: {
  label: string;
  value: string;
  widthClass: string;
  gradientClass: string;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-sm font-bold text-[var(--color-text-main)]">{label}</span>
        <span className="text-sm font-mono font-semibold text-[var(--color-text-muted)]">{value}</span>
      </div>
      <div className="h-4 rounded-full bg-[var(--color-surface)] border border-[var(--color-card-border)] overflow-hidden">
        <div className={`h-full rounded-full bg-gradient-to-r ${gradientClass} ${widthClass}`} />
      </div>
    </div>
  );
}

export default function ProofOfScale({ t }: HyperscaleSectionProps) {
  const proof = t.hyperscale.proof;

  return (
    <section id="proof" className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<span className="size-2 rounded-full bg-emerald-500" />}
          badge={proof.label}
          title={proof.h2a}
          titleAccent={proof.h2b}
          subtitle={proof.sub}
        />

        {/* Date badge */}
        <FadeIn className="text-center mb-12">
          <span className="inline-block px-6 py-2 bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-full text-xs sm:text-sm font-bold tracking-wide text-[var(--color-text-muted)] uppercase">
            {proof.date_badge}
          </span>
        </FadeIn>

        {/* Headline stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {proof.stats.map((stat, i) => (
            <FadeIn
              key={stat.label}
              delay={i * 0.1}
              className="bg-[var(--color-card-bg)] border border-[var(--color-card-border)] p-8 rounded-2xl text-center"
            >
              <div className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)] mb-2">
                {stat.value}
              </div>
              <div className="text-sm font-bold text-[var(--color-text-main)] mb-2">{stat.label}</div>
              <div className="text-xs text-[var(--color-text-muted)] leading-relaxed">{stat.detail}</div>
            </FadeIn>
          ))}
        </div>

        {/* Linear scaling panel */}
        <FadeIn className="bg-gradient-to-br from-[var(--color-primary)]/10 to-transparent border border-[var(--color-secondary)]/30 p-8 md:p-12 rounded-2xl relative overflow-hidden mb-16">
          <div className="absolute top-0 right-0 size-48 bg-[var(--color-secondary)]/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center relative z-10">
            <div>
              <h3 className="text-2xl font-bold text-[var(--color-text-main)] mb-4">{proof.linear_title}</h3>
              <p className="text-[var(--color-text-muted)] leading-relaxed">{proof.linear_sub}</p>
            </div>
            <div className="space-y-6">
              <ScalingBar
                label={proof.bar64_label}
                value={proof.bar64_value}
                widthClass="w-1/2"
                gradientClass="from-[var(--color-secondary)]/60 to-[var(--color-primary)]/60"
              />
              <ScalingBar
                label={proof.bar128_label}
                value={proof.bar128_value}
                widthClass="w-full"
                gradientClass="from-[var(--color-secondary)] to-[var(--color-primary)]"
              />
            </div>
          </div>
        </FadeIn>

        {/* Credibility facts */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
          {proof.facts.map((fact, i) => (
            <FeatureCard
              key={fact.title}
              icon={FACT_ICONS[i]}
              title={fact.title}
              desc={fact.desc}
              delay={i * 0.1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
