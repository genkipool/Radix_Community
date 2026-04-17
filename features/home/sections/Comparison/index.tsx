import { BarChart3, Sparkles } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import type { BaseSectionProps } from '../../types';

export default function Comparison({ t }: BaseSectionProps) {
  const rows: { feature: string; swift: string; evm: string; bce: string; radix: string }[] =
    t.comparativa.rows;

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
                <th className="p-4 font-bold text-[var(--color-secondary)] bg-[var(--color-secondary)]/10">
                  <div className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Radix</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-[var(--color-card-border)] hover:bg-[var(--color-bg)] transition-colors">
                  <td className="p-4 text-[var(--color-text-main)] font-medium">{row.feature}</td>
                  {competitors.map((c) => (
                    <td key={c.key} className="p-4 text-[var(--color-text-muted)] text-sm">{row[c.key]}</td>
                  ))}
                  <td className="p-4 text-[var(--color-accent)] font-bold text-sm bg-[var(--color-secondary)]/5">{row.radix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </FadeIn>

        {/* ── Mobile cards (< md) ── */}
        <div className="md:hidden space-y-4">
          {rows.map((row, i) => (
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
                    <span className="text-xs text-[var(--color-text-muted)] text-right">{row[c.key]}</span>
                  </div>
                ))}

                {/* Radix highlight row */}
                <div className="flex items-start justify-between gap-3 px-4 py-3 bg-[var(--color-secondary)]/5">
                  <span className="text-xs font-bold text-[var(--color-secondary)] shrink-0 w-28 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Radix
                  </span>
                  <span className="text-xs font-bold text-[var(--color-accent)] text-right">{row.radix}</span>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
