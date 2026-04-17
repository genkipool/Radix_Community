import React, { Fragment } from 'react';
import { BarChart3 } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import type { BaseSectionProps } from '../../types';

type ComparisonRow = {
  feature: string;
  swift: string;
  evm: string;
  bce: string;
  radix: string;
};

type ComparisonCategory = {
  title: string;
  rows: ComparisonRow[];
};

export default function Comparison({ t }: BaseSectionProps) {
  const categories: ComparisonCategory[] = t.comparativa.categories || [];

  const competitors = [
    { key: 'swift', label: 'SWIFT', className: 'text-red-400' },
    { key: 'evm', label: 'Ethereum (EVM)', className: 'text-red-400' },
    { key: 'bce', label: 'Appia / Pontes (BCE)', className: 'text-red-400' },
  ] as const;

  return (
    <section id="comparativa" className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<BarChart3 className="w-4 h-4" />}
          badge={t.comparativa.label}
          title={t.comparativa.h2a}
          titleAccent={t.comparativa.h2b}
          subtitle={t.comparativa.description}
        />

        {/* ── Desktop table (md+) ── */}
        <FadeIn className="hidden md:block overflow-x-auto rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-surface)] shadow-2xl">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-[var(--color-card-border)] bg-[var(--color-bg)]">
                <th className="p-4 font-bold text-[var(--color-text-main)]">{t.comparativa.thFeature}</th>
                {competitors.map((c) => (
                  <th key={c.key} className={`p-4 font-bold ${c.className}`}>{c.label}</th>
                ))}
                <th className="p-4 font-bold text-[var(--color-secondary)] bg-[var(--color-secondary)]/10 text-center">
                  Radix DLT
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, catIdx) => (
                <Fragment key={catIdx}>
                  {/* Category separator row */}
                  <tr className="bg-[var(--color-bg)]/50 border-b border-[var(--color-card-border)]">
                    <td colSpan={5} className="px-4 py-2 text-[var(--color-text-muted)] font-bold text-xs tracking-wider uppercase bg-[var(--color-bg)]/30 text-center">
                      {cat.title}
                    </td>
                  </tr>
                  {cat.rows.map((row, i) => (
                    <tr key={i} className="border-b border-[var(--color-card-border)] hover:bg-[var(--color-bg)] transition-colors">
                      <td className="p-4 text-[var(--color-text-main)] font-medium">{row.feature}</td>
                      {competitors.map((c) => (
                        <td key={c.key} className="p-4 text-[var(--color-text-muted)] text-sm">{row[c.key as keyof ComparisonRow]}</td>
                      ))}
                      <td className="p-4 text-[var(--color-accent)] font-bold text-sm bg-[var(--color-secondary)]/5">{row.radix}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </FadeIn>

        {/* ── Mobile cards (< md) ── */}
        <div className="md:hidden space-y-10">
          {categories.map((cat, catIdx) => (
            <div key={catIdx} className="space-y-4">
              {/* Mobile category heading */}
              <div className="px-2 text-center">
                <h3 className="text-sm font-bold text-[var(--color-text-muted)] tracking-widest uppercase pb-2">
                  {cat.title}
                </h3>
              </div>

              {cat.rows.map((row, i) => (
                <FadeIn
                  key={i}
                  className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-surface)] shadow-lg overflow-hidden"
                >
                  {/* Feature header */}
                  <div className="px-4 py-3 bg-[var(--color-bg)] border-b border-[var(--color-card-border)]">
                    <p className="text-sm font-bold text-[var(--color-text-main)]">{row.feature}</p>
                  </div>

                  {/* Competitor rows */}
                  <div className="divide-y divide-[var(--color-card-border)]">
                    {competitors.map((c) => (
                      <div key={c.key} className="flex items-start justify-between gap-3 px-4 py-2.5">
                        <span className={`text-xs font-bold shrink-0 w-28 ${c.className}`}>{c.label}</span>
                        <span className="text-xs text-[var(--color-text-muted)] text-right">{row[c.key as keyof ComparisonRow]}</span>
                      </div>
                    ))}

                    {/* Radix highlight row */}
                    <div className="flex items-start justify-between gap-3 px-4 py-3 bg-[var(--color-secondary)]/5">
                      <span className="text-xs font-bold text-[var(--color-secondary)] shrink-0 w-28">
                        Radix DLT
                      </span>
                      <span className="text-xs font-bold text-[var(--color-accent)] text-right">{row.radix}</span>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
