import { Map, Clock, CheckCircle2 } from 'lucide-react';
import React from 'react';
import type { BaseSectionProps } from '../../types';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { SectionHeader } from '@/components/layout/SectionHeader';

const ERA_METADATA = [
  {
    color: 'var(--color-secondary)',
    milestoneDone: [false, false, false, true, true, true, true],
  },
  {
    color: 'var(--color-accent)',
    milestoneDone: [true, true, true, true, true, true, true, true, true],
  },
  {
    color: 'var(--color-primary)',
    milestoneDone: [true, true, true, true, true, true],
  },
  {
    color: 'var(--color-text-muted)',
    milestoneDone: [true, true, true, true, true, true, true],
  },
];

export default function Roadmap({ t }: BaseSectionProps) {

  return (
    <section id="roadmap" className="py-24 bg-[var(--color-surface)] relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<Map className="w-4 h-4 mr-1" />}
          badge={t.nav.roadmap}
          title={t.roadmap.title}
          titleAccent={t.roadmap.title_accent}
          subtitle={t.roadmap.subtitle}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {t.roadmap.eras.map((era, eraIdx: number) => {
            const meta = ERA_METADATA[eraIdx];
            return (
              <ScrollReveal
                key={era.title}
                from={{ opacity: 0, y: 30 }}
                delay={eraIdx * 0.1}
                className="bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-2xl p-6 relative overflow-hidden"
              >
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold tracking-widest uppercase" style={{ color: meta.color }}>{era.year}</span>
                    <div className={`flex items-center gap-1.5 px-3 h-6 rounded-full text-[10px] font-bold tracking-wider uppercase border shrink-0 ${era.status === 'done'
                      ? 'bg-green-500/10 border-green-500/20 text-green-500'
                      : 'bg-[var(--color-secondary)]/10 border-[var(--color-secondary)]/20 text-[var(--color-secondary)]'
                      }`}>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${era.status === 'done' ? 'bg-green-500' : 'bg-[var(--color-secondary)] animate-pulse'}`} />
                      <span className="leading-none whitespace-nowrap">
                        {t.roadmap_status[era.status as keyof typeof t.roadmap_status]}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-[var(--color-text-main)] leading-tight">{era.title}</h3>
                </div>

                <div className="relative pl-6">
                  <div className="absolute left-[7px] top-0 bottom-0 w-px" style={{ background: meta.color, opacity: 0.3 }} />
                  <div className="space-y-4">
                    {era.milestones.map((text: string, i: number) => {
                      const isDone = meta.milestoneDone[i];
                      return (
                        <div key={i} className="relative flex items-start">
                          <div className="absolute -left-6 w-4 h-5 flex items-center justify-center bg-[var(--color-bg)] z-10">
                            {isDone ? (
                              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                            ) : (
                              <Clock className="w-4 h-4 shrink-0" style={{ color: meta.color }} />
                            )}
                          </div>
                          <p className={`text-xs leading-5 ${isDone ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-main)] font-semibold'}`}>
                            {text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
