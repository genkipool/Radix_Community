import { CheckCircle2, FileText } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import { DAO_EXTERNAL_LINKS } from '../data/radixDaoData';
import type { DaoCopy } from '../types/radixDao.types';
import { DaoSection } from './DaoSection';
import { DaoStatusBadge } from './DaoStatusBadge';

interface DaoFoundingSequenceProps {
  sequence: DaoCopy['sequence'];
}

/**
 * Equal-height 2-column Founding Sequence:
 *  - Left column: 2 completed milestones (aligned row-for-row with right column)
 *  - Right column: 2 upcoming milestones (GP-ELECT-1 & GP-ACTIVATE-1)
 */
export function DaoFoundingSequence({ sequence }: DaoFoundingSequenceProps) {
  const completedSteps = sequence.steps.filter((s) => s.status === 'completed');
  const upcomingSteps = sequence.steps.filter((s) => s.status !== 'completed');

  return (
    <DaoSection id="sequence">
        <SectionHeader
          icon={<span className="size-2 rounded-full bg-[var(--color-primary)]" aria-hidden="true" />}
          badge={sequence.badge}
          title={sequence.title}
          titleAccent={sequence.titleAccent}
          subtitle={sequence.subtitle}
        />

        <FadeIn className="flex justify-center mb-16">
          <a
            href={DAO_EXTERNAL_LINKS.proposalsHistory}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-[var(--color-card-bg)] border border-[var(--color-secondary)]/40 text-[var(--color-text-main)] font-semibold hover:border-[var(--color-secondary)] hover:shadow-lg transition-all"
          >
            <FileText className="size-4 text-[var(--color-secondary)]" aria-hidden="true" />
            <span>{sequence.proposalsLinkLabel}</span>
          </a>
        </FadeIn>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-stretch">
          {/* Left: Completed Milestones — matched row height */}
          <div className="flex flex-col">
            <FadeIn className="mb-8">
              <h3 className="text-2xl font-bold text-[var(--color-text-main)]">
                {sequence.statusLabels.completed}
              </h3>
            </FadeIn>

            <div className="flex-1 grid grid-rows-2 gap-5">
              {completedSteps.map((step, i) => (
                <FadeIn
                  key={step.code}
                  delay={i * 0.08}
                  className="h-full p-6 rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-surface)]/50 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-lg bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30 text-xs font-black shrink-0">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        <span>{step.code}</span>
                      </span>
                      <h4 className="text-base font-bold text-[var(--color-text-main)]">
                        {step.title}
                      </h4>
                      <DaoStatusBadge variant="accent" className="ml-auto px-3 py-1">
                        {sequence.statusLabels.completed}
                      </DaoStatusBadge>
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                      {step.desc}
                    </p>
                  </div>

                  <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide pt-4 mt-4 border-t border-[var(--color-card-border)]">
                    {step.date}
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>

          {/* Right: Upcoming Milestones — matched row height */}
          <div className="flex flex-col">
            <FadeIn className="mb-8">
              <h3 className="text-2xl font-bold text-[var(--color-text-main)]">
                {sequence.statusLabels.next} &amp; {sequence.statusLabels.upcoming}
              </h3>
            </FadeIn>

            <div className="flex-1 grid grid-rows-2 gap-5">
              {upcomingSteps.map((step, i) => {
                const isNext = step.status === 'next';
                return (
                  <FadeIn
                    key={step.code}
                    delay={i * 0.08}
                    className={`h-full p-6 rounded-2xl border flex flex-col justify-between transition-colors ${
                      isNext
                        ? 'bg-gradient-to-br from-[var(--color-primary)]/10 to-transparent border-[var(--color-secondary)]/40'
                        : 'bg-[var(--color-card-bg)] border-[var(--color-card-border)]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <span className="flex items-center justify-center px-2.5 h-7 rounded-lg bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary)] text-white text-xs font-black shrink-0">
                          {step.code}
                        </span>
                        <h4 className="text-base font-bold text-[var(--color-text-main)]">
                          {step.title}
                        </h4>
                        <DaoStatusBadge
                          variant={isNext ? 'primary' : 'neutral'}
                          className="ml-auto px-3 py-1"
                        >
                          {isNext ? sequence.statusLabels.next : sequence.statusLabels.upcoming}
                        </DaoStatusBadge>
                      </div>
                      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                        {step.desc}
                      </p>
                    </div>

                    <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide pt-4 mt-4 border-t border-[var(--color-card-border)]">
                      {step.date}
                    </div>
                  </FadeIn>
                );
              })}
            </div>
          </div>
        </div>
    </DaoSection>
  );
}
