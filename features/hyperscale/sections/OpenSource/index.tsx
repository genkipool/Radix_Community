/**
 * OpenSource — RSC
 *
 * Verifiability section: repositories, the research paper and community
 * documentation backing every claim made on this page.
 */
import Link from 'next/link';
import { Github, Radio, FileText, BookOpen, ExternalLink, Scale } from 'lucide-react';
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

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 mb-12">
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
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[var(--color-secondary)] break-all">
                  <ExternalLink className="size-3.5 shrink-0" />
                  {card.linkLabel}
                </span>
              </Link>
            </FadeIn>
          ))}
        </div>

        <FadeIn className="flex items-start sm:items-center justify-center gap-3 max-w-3xl mx-auto text-center sm:text-left">
          <Scale className="size-5 text-[var(--color-text-muted)] shrink-0 hidden sm:block" />
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{openSource.license_note}</p>
        </FadeIn>
      </div>
    </section>
  );
}
