import { Hourglass, Unlock, Building2, Zap, Shield, ClipboardList } from 'lucide-react';
import React from 'react';
import type { BaseSectionProps } from '../../types';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';

const PROBLEM_ICONS = [
  <Hourglass key={6} className="size-10 text-[var(--color-primary)]" />,
  <Unlock key={7} className="size-10 text-[var(--color-secondary)]" />,
  <Building2 key={8} className="size-10 text-[var(--color-primary)]" />
];

const SOLUTION_ICONS = [
  <Zap key={12} className="size-10 text-[var(--color-primary)]" />,
  <Shield key={13} className="size-10 text-[var(--color-primary)]" />,
  <ClipboardList key={14} className="size-10 text-[var(--color-primary)]" />
];

export default function TheProblem({ t }: BaseSectionProps) {

  const problems = [
    { title: t.problema.card1_title, desc: t.problema.card1_p },
    { title: t.problema.card2_title, desc: t.problema.card2_p },
    { title: t.problema.card3_title, desc: t.problema.card3_p }
  ];

  const solutions = [
    { title: t.problema.sol_card1_title, desc: t.problema.sol_card1_p },
    { title: t.problema.sol_card2_title, desc: t.problema.sol_card2_p },
    { title: t.problema.sol_card3_title, desc: t.problema.sol_card3_p }
  ];

  return (
    <section id="problema" className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<span className="size-2 rounded-full bg-red-500" />}
          badge={t.problema.label}
          title={t.problema.h2a}
          titleAccent={t.problema.h2b}
          subtitle={t.problema.sub}
          gradient="from-[var(--color-accent)] to-[var(--color-secondary)]"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {problems.map((item, i) => (
            <FadeIn key={item.title} delay={i * 0.1} className="bg-[var(--color-card-bg)] border border-[var(--color-card-border)] p-8 rounded-2xl">
              <div className="text-4xl mb-6">{PROBLEM_ICONS[i]}</div>
              <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-4">{item.title}</h3>
              <p className="text-[var(--color-text-muted)] leading-relaxed">{item.desc}</p>
            </FadeIn>
          ))}
        </div>

        <div className="text-center mb-12">
          <span className="inline-block px-6 py-2 bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-full text-sm font-bold tracking-widest text-sky-700 dark:text-sky-400 uppercase">
            {t.problema.vs}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {solutions.map((item, i) => (
            <FadeIn key={item.title} delay={i * 0.1} className="bg-gradient-to-br from-[var(--color-primary)]/10 to-transparent border border-[var(--color-secondary)]/30 p-8 rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 size-32 bg-[var(--color-secondary)]/10 rounded-full blur-2xl -mr-10 -mt-10" />
              <div className="text-3xl mb-4 relative z-10">{SOLUTION_ICONS[i]}</div>
              <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-3 relative z-10">{item.title}</h3>
              <p className="text-[var(--color-text-main)]/70 text-sm leading-relaxed relative z-10">{item.desc}</p>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
