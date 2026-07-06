/**
 * OpenSource — RSC
 *
 * Verifiability section: repositories, the research paper and community
 * documentation backing every claim made on this page.
 */
import Link from 'next/link';
import { Github, Radio, FileText, BookOpen, ExternalLink, Scale, ArrowUpRight, Code2 } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import { HYPERSCALE_LINKS } from '../../data/links';
import type { HyperscaleSectionProps } from '../../types';

const RESOURCE_META = [
  { href: HYPERSCALE_LINKS.hyperscaleRs, icon: <Github className="size-8 text-[var(--color-primary)]" /> },
  { href: HYPERSCALE_LINKS.polaris, icon: <Radio className="size-8 text-[var(--color-secondary)]" /> },
  { href: HYPERSCALE_LINKS.paper, icon: <FileText className="size-8 text-[var(--color-primary)]" /> },
  { href: HYPERSCALE_LINKS.wiki, icon: <BookOpen className="size-8 text-[var(--color-secondary)]" /> },
];

export default function OpenSource({ t }: HyperscaleSectionProps) {
  const openSource = t.hyperscale.openSource;

  return (
    <section id="open-source" className="py-24 bg-[var(--color-surface)]/50 relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<Github className="size-3.5 text-[var(--color-primary)]" />}
          badge={openSource.label}
          title={openSource.h2a}
          titleAccent={openSource.h2b}
          subtitle={openSource.sub}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 mb-16">
          {openSource.cards.map((card, i) => (
            <FadeIn key={card.title} delay={i * 0.1}>
              <Link
                href={RESOURCE_META[i].href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col h-full bg-[var(--color-card-bg)] border border-[var(--color-card-border)] p-8 rounded-2xl hover:border-[var(--color-secondary)]/50 hover:shadow-lg transition-all group"
              >
                <div className="mb-6">{RESOURCE_META[i].icon}</div>
                <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-3 group-hover:text-[var(--color-primary)] transition-colors">
                  {card.title}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-6 flex-1">{card.desc}</p>
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[var(--color-secondary)] w-full min-w-0">
                  <span className="truncate leading-none pt-[1px]">{card.linkLabel}</span>
                  <ExternalLink className="size-3.5 shrink-0 -translate-y-[2px]" />
                </span>
              </Link>
            </FadeIn>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16 max-w-7xl mx-auto items-start">
          {/* Deeper technical detail — minimal, borderless pointer to the project site */}
          <FadeIn className="flex items-start gap-3 text-center sm:text-left">
            <Code2 className="size-5 text-[var(--color-text-muted)] shrink-0 hidden sm:block mt-0.5" />
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              {openSource.site_prompt}{' '}
              <Link
                href={HYPERSCALE_LINKS.site}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-1 font-semibold text-[var(--color-secondary)] hover:text-[var(--color-primary)] transition-colors"
              >
                <span>{openSource.site_label}</span>
                <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </p>
          </FadeIn>

          {/* License */}
          <FadeIn delay={0.1} className="flex items-start gap-3 text-center sm:text-left">
            <Scale className="size-5 text-[var(--color-text-muted)] shrink-0 hidden sm:block mt-0.5" />
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{openSource.license_note}</p>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
