import React, { Fragment } from 'react';
import { BarChart3, CheckCircle2 } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import type { BaseSectionProps } from '../../types';

type ComparisonRow = {
  feature: string;
  swift: string;
  evm: string;
  bce: string;
  radix: string;
  winner?: string;
  expKey?: string;
};

type ComparisonCategory = {
  title: string;
  rows: ComparisonRow[];
};

export default function Comparison({ t }: BaseSectionProps) {
  const categories: ComparisonCategory[] = t.comparativa.categories || [];

  const competitors = [
    { key: 'swift', label: 'SWIFT' },
    { key: 'evm', label: 'Ethereum (EVM)' },
    { key: 'bce', label: 'Appia / Pontes (BCE)' },
  ] as const;

  const renderWinnerCell = (content: string, colKey: string, row: ComparisonRow) => {
    const isWinner = row.winner === colKey || (row.winner === 'shared' && (colKey === 'radix' || colKey === 'bce'));

    return (
      <div className="flex items-center justify-end md:justify-start gap-2">
        <span className="leading-tight">{content}</span>
        {isWinner && row.expKey && (
          <InfoTooltip content={t.comparativa.explanations[row.expKey as keyof typeof t.comparativa.explanations]}>
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 cursor-help" />
          </InfoTooltip>
        )}
      </div>
    );
  };

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
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-[var(--color-card-border)] bg-[var(--color-bg)]">
                <th className="p-5 font-bold text-[var(--color-text-main)] w-1/4">{t.comparativa.thFeature}</th>
                {competitors.map((c) => (
                  <th key={c.key} className="p-5 font-bold text-[var(--color-text-main)]">{c.label}</th>
                ))}
                <th className="p-5 font-bold text-[var(--color-text-main)] bg-[var(--color-secondary)]/10 text-center">
                  Radix DLT
                </th>
              </tr>
            </thead>
            <tbody className="text-[var(--color-text-main)]">
              {categories.map((cat, catIdx) => (
                <Fragment key={catIdx}>
                  <tr className="bg-[var(--color-bg)]/50 border-b border-[var(--color-card-border)]">
                    <td colSpan={5} className="px-5 py-3 text-[var(--color-text-muted)] font-bold text-[10px] tracking-[0.2em] uppercase bg-[var(--color-bg)]/30 text-center">
                      {cat.title}
                    </td>
                  </tr>
                  {cat.rows.map((row, i) => (
                    <tr key={i} className="border-b border-[var(--color-card-border)] hover:bg-[var(--color-bg)]/50 transition-colors">
                      <td className="p-5 font-semibold text-sm">{row.feature}</td>
                      {competitors.map((c) => (
                        <td key={c.key} className="p-5 text-sm">
                          {renderWinnerCell(row[c.key as keyof ComparisonRow] as string, c.key, row)}
                        </td>
                      ))}
                      <td className="p-5 font-bold text-sm bg-[var(--color-secondary)]/5">
                        {renderWinnerCell(row.radix, 'radix', row)}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </FadeIn>

        {/* ── Mobile cards (< md) ── */}
        <div className="md:hidden space-y-12">
          {categories.map((cat, catIdx) => (
            <div key={catIdx} className="space-y-6">
              <div className="px-2 text-center">
                <h3 className="text-[12px] font-bold text-[var(--color-text-muted)] tracking-[0.3em] uppercase pb-4">
                  {cat.title}
                </h3>
              </div>

              {cat.rows.map((row, i) => (
                <FadeIn
                  key={i}
                  className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-surface)] shadow-xl overflow-hidden"
                >
                  <div className="px-5 py-4 bg-[var(--color-bg)] border-b border-[var(--color-card-border)]">
                    <p className="text-sm font-bold text-[var(--color-text-main)]">{row.feature}</p>
                  </div>

                  <div className="divide-y divide-[var(--color-card-border)] text-[var(--color-text-main)]">
                    {competitors.map((c) => (
                      <div key={c.key} className="flex items-center justify-between gap-4 px-5 py-3.5">
                        <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider shrink-0">{c.label}</span>
                        <div className="text-sm">
                          {renderWinnerCell(row[c.key as keyof ComparisonRow] as string, c.key, row)}
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center justify-between gap-4 px-5 py-4 bg-[var(--color-secondary)]/5">
                      <span className="text-[10px] font-bold text-[var(--color-secondary)] uppercase tracking-wider shrink-0">Radix DLT</span>
                      <div className="text-sm font-bold">
                        {renderWinnerCell(row.radix, 'radix', row)}
                      </div>
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
