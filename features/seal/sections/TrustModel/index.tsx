/**
 * TrustModel — RSC
 *
 * How Radix Seal works: four numbered pillars (wallet as CA, local
 * cryptography, peer-to-peer transport, public proof) plus a panel explaining
 * the on-ledger standard behind the seal.
 */
import { KeyRound, MonitorSmartphone, Waypoints, Landmark } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import { FeatureCard } from '../../components/FeatureCard';
import type { SealSectionProps } from '../../types';

const PILLAR_ICONS = [
  <KeyRound key="wallet" className="size-10 text-[var(--color-primary)]" />,
  <MonitorSmartphone key="local" className="size-10 text-[var(--color-secondary)]" />,
  <Waypoints key="p2p" className="size-10 text-[var(--color-primary)]" />,
  <Landmark key="ledger" className="size-10 text-[var(--color-secondary)]" />,
];

export default function TrustModel({ t }: SealSectionProps) {
  const trust = t.seal.trust;

  return (
    <section id="trust-model" className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<KeyRound className="size-3.5 text-[var(--color-primary)]" />}
          badge={trust.label}
          title={trust.h2a}
          titleAccent={trust.h2b}
          subtitle={trust.sub}
          gradient="from-[var(--color-accent)] to-[var(--color-secondary)]"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 mb-16">
          {trust.pillars.map((pillar, i) => (
            <FeatureCard
              key={pillar.title}
              icon={PILLAR_ICONS[i]}
              tag={pillar.tag}
              title={pillar.title}
              desc={pillar.desc}
              delay={i * 0.1}
            />
          ))}
        </div>

        {/* On-ledger standard panel */}
        <FadeIn className="bg-gradient-to-br from-[var(--color-primary)]/10 to-transparent border border-[var(--color-secondary)]/30 p-8 md:p-12 rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 size-48 bg-[var(--color-secondary)]/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center relative z-10">
            <div>
              <h3 className="text-2xl font-bold text-[var(--color-text-main)] mb-4">{trust.standard_title}</h3>
              <p className="text-[var(--color-text-muted)] leading-relaxed">{trust.standard_sub}</p>
            </div>
            <ul className="space-y-4">
              {trust.standard_points.map((point) => (
                <li key={point.title} className="flex items-start gap-4">
                  <span className="size-2 mt-2 rounded-full bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)] shrink-0" />
                  <div>
                    <div className="font-bold text-[var(--color-text-main)]">{point.title}</div>
                    <div className="text-sm text-[var(--color-text-muted)] leading-relaxed">{point.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
