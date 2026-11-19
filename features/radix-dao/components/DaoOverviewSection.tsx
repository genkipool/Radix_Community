import { BookOpen, ExternalLink, Scale } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import { DAO_EXTERNAL_LINKS } from '../data/radixDaoData';
import type { DaoCopy } from '../types/radixDao.types';
import { DaoSection } from './DaoSection';

interface DaoOverviewSectionProps {
  overview: DaoCopy['overview'];
}

export function DaoOverviewSection({ overview }: DaoOverviewSectionProps) {
  const guideLinks = [
    { label: overview.guides.charter, href: DAO_EXTERNAL_LINKS.charterGuide },
    { label: overview.guides.policy, href: DAO_EXTERNAL_LINKS.policyGuide },
    { label: overview.guides.elections, href: DAO_EXTERNAL_LINKS.electionGuide },
    { label: overview.guides.roles, href: DAO_EXTERNAL_LINKS.rolesRegistry },
  ];

  return (
    <DaoSection id="overview" surface="muted">
        <SectionHeader
          icon={<Scale className="size-3.5 text-[var(--color-primary)]" aria-hidden="true" />}
          badge={overview.badge}
          title={overview.title}
          titleAccent={overview.titleAccent}
          subtitle={overview.subtitle}
        />

        {/* Balanced 2-column layout (equal width, matched vertical rhythm) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-16 items-stretch">
          {/* Left: Authority Flow */}
          <div className="flex flex-col">
            <FadeIn>
              <h3 className="text-2xl font-bold text-[var(--color-text-main)] mb-2">
                {overview.authorityTitle}
              </h3>
              <p className="text-sm sm:text-base text-[var(--color-text-muted)] mb-8 leading-relaxed">
                {overview.authoritySubtitle}
              </p>
            </FadeIn>

            <ol className="flex-1 flex flex-col justify-between divide-y divide-[var(--color-card-border)] border-y border-[var(--color-card-border)]">
              {overview.tiers.map((tier, i) => (
                <FadeIn key={tier.step} delay={i * 0.05} className="flex-1 flex items-center">
                  <li className="py-5 flex items-start gap-4 w-full">
                    <span className="shrink-0 flex items-center justify-center size-8 rounded-lg bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary)] text-white text-xs font-black mt-0.5">
                      {tier.step}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-base font-bold text-[var(--color-text-main)]">
                        {tier.title}
                      </h4>
                      <p className="mt-1 text-sm text-[var(--color-text-muted)] leading-relaxed">
                        {tier.desc}
                      </p>
                    </div>
                  </li>
                </FadeIn>
              ))}
            </ol>
          </div>

          {/* Right: Document Precedence */}
          <div className="flex flex-col">
            <FadeIn>
              <h3 className="text-2xl font-bold text-[var(--color-text-main)] mb-2">
                {overview.precedenceTitle}
              </h3>
              <p className="text-sm sm:text-base text-[var(--color-text-muted)] mb-8 leading-relaxed">
                {overview.precedenceSubtitle}
              </p>
            </FadeIn>

            <ol className="flex-1 flex flex-col justify-between divide-y divide-[var(--color-card-border)] border-y border-[var(--color-card-border)]">
              {overview.precedence.map((item, i) => (
                <FadeIn key={item.rank} delay={i * 0.05} className="flex-1 flex items-center">
                  <li className="py-4 flex items-start gap-4 w-full">
                    <span className="shrink-0 font-mono text-xs font-bold text-[var(--color-primary)] pt-1 w-6">
                      {item.rank}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-base font-bold text-[var(--color-text-main)]">
                        {item.title}
                      </h4>
                      <p className="mt-0.5 text-sm text-[var(--color-text-muted)] leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </li>
                </FadeIn>
              ))}
            </ol>
          </div>
        </div>

        {/* Third element moved full-width below both columns — zero vertical voids */}
        <FadeIn delay={0.1} className="mt-14 pt-10 border-t border-[var(--color-card-border)]">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <BookOpen className="size-4 text-[var(--color-secondary)]" aria-hidden="true" />
                <h3 className="text-lg font-bold text-[var(--color-text-main)]">
                  {overview.guidesTitle}
                </h3>
              </div>
              <p className="text-sm text-[var(--color-text-muted)] max-w-3xl leading-relaxed">
                {overview.guidesNote}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {guideLinks.map((guide) => (
              <a
                key={guide.href}
                href={guide.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3 px-5 py-3.5 rounded-full bg-[var(--color-card-bg)] border border-[var(--color-card-border)] text-sm font-semibold text-[var(--color-text-main)] hover:border-[var(--color-secondary)]/60 transition-colors"
              >
                <span className="truncate">{guide.label}</span>
                <ExternalLink
                  className="size-4 shrink-0 text-[var(--color-secondary)] group-hover:translate-x-0.5 transition-transform"
                  aria-hidden="true"
                />
              </a>
            ))}
          </div>
        </FadeIn>
    </DaoSection>
  );
}
