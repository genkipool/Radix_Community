/**
 * Architecture — RSC
 *
 * The technical pillars (Cerberus research → Xi'an engineering) and the
 * cross-shard atomic commitment flow, explained step by step.
 */
import Link from 'next/link';
import { Network, Radio, Split, Boxes, Blocks, Server, ArrowUpRight } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import { FeatureCard } from '../../components/FeatureCard';
import { HYPERSCALE_LINKS } from '../../data/links';
import type { HyperscaleSectionProps } from '../../types';

const PILLAR_ICONS = [
  <Network key="cerberus" className="size-10 text-[var(--color-primary)]" />,
  <Radio key="polaris" className="size-10 text-[var(--color-secondary)]" />,
  <Split key="resharding" className="size-10 text-[var(--color-primary)]" />,
  <Boxes key="trie" className="size-10 text-[var(--color-secondary)]" />,
  <Blocks key="engine" className="size-10 text-[var(--color-primary)]" />,
  <Server key="validators" className="size-10 text-[var(--color-secondary)]" />,
];

export default function Architecture({ t }: HyperscaleSectionProps) {
  const architecture = t.hyperscale.architecture;

  return (
    <section id="architecture" className="py-24 bg-[var(--color-surface)]/50 relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<span className="size-2 rounded-full bg-[var(--color-secondary)]" />}
          badge={architecture.label}
          title={architecture.h2a}
          titleAccent={architecture.h2b}
          subtitle={architecture.sub}
        />

        {/* Design-generation note — keeps old and new claims clearly separated */}
        <FadeIn className="bg-[var(--color-card-bg)] border border-[var(--color-card-border)] border-l-4 border-l-[var(--color-accent)] p-8 rounded-2xl mb-16 max-w-4xl mx-auto">
          <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-3">{architecture.note_title}</h3>
          <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">{architecture.note_p}</p>
          <Link
            href={HYPERSCALE_LINKS.site}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors"
          >
            {architecture.note_link}
            <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </FadeIn>

        {/* Technical pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mb-24">
          {architecture.pillars.map((pillar, i) => (
            <FeatureCard
              key={pillar.title}
              icon={PILLAR_ICONS[i]}
              tag={pillar.tag}
              title={pillar.title}
              desc={pillar.desc}
              delay={i * 0.08}
            />
          ))}
        </div>

        {/* Cross-shard commitment flow */}
        <div className="text-center mb-12">
          <FadeIn as="h2" className="text-3xl md:text-4xl font-bold text-[var(--color-text-main)] mb-4 tracking-tight">
            {architecture.flow_title}
          </FadeIn>
          <FadeIn as="p" delay={0.05} className="text-lg text-[var(--color-text-muted)] max-w-3xl mx-auto leading-relaxed">
            {architecture.flow_sub}
          </FadeIn>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
          {architecture.steps.map((step, i) => (
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
