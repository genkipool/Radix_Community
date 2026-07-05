/**
 * XianRoadmap — RSC
 *
 * Recent achievements (2026 public test → community transition) and the
 * community-funded delivery milestones toward the Xi'an production network.
 */
import { CheckCircle2 } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import { XIAN_ROADMAP_ID } from '../../data/links';
import type { HyperscaleSectionProps } from '../../types';

export default function XianRoadmap({ t }: HyperscaleSectionProps) {
  const roadmap = t.hyperscale.roadmap;

  const statusLabel = (status: string) =>
    status === 'progress' ? roadmap.status_progress : roadmap.status_planned;

  return (
    <section id={XIAN_ROADMAP_ID} className="py-24 bg-[var(--color-bg)] relative overflow-hidden scroll-mt-24">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<span className="size-2 rounded-full bg-[var(--color-primary)]" />}
          badge={roadmap.label}
          title={roadmap.h2a}
          titleAccent={roadmap.h2b}
          subtitle={roadmap.sub}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">

          {/* Achieved timeline */}
          <div>
            <FadeIn as="h2" className="text-2xl font-bold text-[var(--color-text-main)] mb-8">
              {roadmap.done_title}
            </FadeIn>
            <div className="space-y-8 border-l-2 border-[var(--color-card-border)] pl-8 relative">
              {roadmap.done.map((item, i) => (
                <FadeIn key={item.title} delay={i * 0.1} className="relative">
                  <span className="absolute -left-[41px] top-1 flex items-center justify-center size-6 rounded-full bg-[var(--color-bg)] border-2 border-emerald-500">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                  </span>
                  <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-1">
                    {item.date}
                  </div>
                  <h3 className="text-lg font-bold text-[var(--color-text-main)] mb-2">{item.title}</h3>
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{item.desc}</p>
                </FadeIn>
              ))}
            </div>
          </div>

          {/* Delivery milestones */}
          <div>
            <FadeIn as="h2" className="text-2xl font-bold text-[var(--color-text-main)] mb-8">
              {roadmap.milestones_title}
            </FadeIn>
            <div className="space-y-4">
              {roadmap.milestones.map((milestone, i) => {
                const inProgress = milestone.status === 'progress';
                return (
                  <FadeIn
                    key={milestone.tag}
                    delay={i * 0.08}
                    className={`p-6 rounded-2xl border transition-colors ${
                      inProgress
                        ? 'bg-gradient-to-br from-[var(--color-primary)]/10 to-transparent border-[var(--color-secondary)]/40'
                        : 'bg-[var(--color-card-bg)] border-[var(--color-card-border)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="flex items-center justify-center px-2.5 h-7 rounded-lg bg-gradient-to-br from-[var(--color-secondary)] to-[var(--color-primary)] text-white text-xs font-black shrink-0">
                        {milestone.tag}
                      </span>
                      <h3 className="text-base font-bold text-[var(--color-text-main)]">{milestone.title}</h3>
                      <span
                        className={`ml-auto px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          inProgress
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-card-border)]'
                        }`}
                      >
                        {statusLabel(milestone.status)}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-2">{milestone.desc}</p>
                    <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                      {milestone.eta}
                    </div>
                  </FadeIn>
                );
              })}
            </div>
            <FadeIn delay={0.5}>
              <p className="text-xs text-[var(--color-text-muted)] italic mt-6 leading-relaxed">{roadmap.disclaimer}</p>
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  );
}
