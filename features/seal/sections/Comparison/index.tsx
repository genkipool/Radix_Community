/**
 * Comparison — RSC
 *
 * Radix Seal against today's mainstream alternatives (cloud e-signature /
 * storage SaaS, PKI with qualified certificates, PGP / S-MIME), following the
 * desktop-table + mobile-cards layout of the home Comparison section.
 *
 * Honest by design: each row declares its `winner` (which may NOT be Radix
 * Seal) and an `expKey` into `explanations`, shown as a tooltip on the green
 * check so the reader sees WHY that option is optimal, like on the home page.
 * Closes with an honesty note on the legal scope of the signature.
 */
import { Fragment } from 'react';
import { BarChart3, CheckCircle2, Info } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { COMPARISON_ID } from '../../data/links';
import type { SealSectionProps } from '../../types';

type ComparisonRow = {
  feature: string;
  saas: string;
  pki: string;
  pgp: string;
  seal: string;
  /** Winning column key(s); `a+b` marks a tie. May well not be `seal`. */
  winner?: string;
  /** Key into `explanations`: why the winner is the optimal option. */
  expKey?: string;
};

const COMPETITOR_KEYS = ['saas', 'pki', 'pgp'] as const;

function WinnerCell({
  content,
  colKey,
  row,
  explanations,
}: {
  content: string;
  colKey: string;
  row: ComparisonRow;
  explanations: Record<string, string>;
}) {
  const isWinner = !!row.winner && row.winner.split('+').includes(colKey);
  return (
    <div className="flex items-center justify-end md:justify-start gap-2">
      <span className="leading-tight">{content}</span>
      {isWinner && row.expKey && explanations[row.expKey] && (
        <InfoTooltip content={explanations[row.expKey]}>
          <CheckCircle2 className="size-4 text-green-500 shrink-0 cursor-help" />
        </InfoTooltip>
      )}
    </div>
  );
}

export default function Comparison({ t }: SealSectionProps) {
  const comp = t.seal.comparison;
  const categories: { title: string; rows: ComparisonRow[] }[] = comp.categories;
  const explanations: Record<string, string> = comp.explanations ?? {};
  const competitors = COMPETITOR_KEYS.map((key, i) => ({ key, label: comp.columns[i] }));

  return (
    <section id={COMPARISON_ID} className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<BarChart3 className="size-4" />}
          badge={comp.label}
          title={comp.h2a}
          titleAccent={comp.h2b}
          subtitle={comp.sub}
        />

        {/* ── Desktop table (md+) ── */}
        <FadeIn className="hidden md:block overflow-x-auto rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-surface)] shadow-2xl">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-[var(--color-card-border)] bg-[var(--color-bg)]">
                <th className="p-5 font-bold text-[var(--color-text-main)] w-1/5">{comp.thFeature}</th>
                {competitors.map((c) => (
                  <th key={c.key} className="p-5 font-bold text-[var(--color-text-main)]">{c.label}</th>
                ))}
                <th className="p-5 font-bold text-[var(--color-text-main)] bg-[var(--color-secondary)]/10">
                  Radix Seal
                </th>
              </tr>
            </thead>
            <tbody className="text-[var(--color-text-main)]">
              {categories.map((cat) => (
                <Fragment key={cat.title}>
                  <tr className="bg-[var(--color-bg)]/50 border-b border-[var(--color-card-border)]">
                    <td colSpan={5} className="px-5 py-3 text-[var(--color-text-muted)] font-bold text-[10px] tracking-[0.2em] uppercase bg-[var(--color-bg)]/30 text-center">
                      {cat.title}
                    </td>
                  </tr>
                  {cat.rows.map((row) => (
                    <tr key={row.feature} className="border-b border-[var(--color-card-border)] hover:bg-[var(--color-bg)]/50 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-sm">{row.feature}</td>
                      {competitors.map((c) => (
                        <td key={c.key} className="px-5 py-3.5 text-sm text-[var(--color-text-muted)]">
                          <WinnerCell content={row[c.key]} colKey={c.key} row={row} explanations={explanations} />
                        </td>
                      ))}
                      <td className="px-5 py-3.5 font-bold text-sm bg-[var(--color-secondary)]/5">
                        <WinnerCell content={row.seal} colKey="seal" row={row} explanations={explanations} />
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
          {categories.map((cat) => (
            <div key={cat.title} className="space-y-6">
              <div className="px-2 text-center">
                <h3 className="text-[12px] font-bold text-[var(--color-text-muted)] tracking-[0.3em] uppercase pb-4">
                  {cat.title}
                </h3>
              </div>

              {cat.rows.map((row) => (
                <FadeIn
                  key={row.feature}
                  className="rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-surface)] shadow-xl overflow-hidden"
                >
                  <div className="px-5 py-3 bg-[var(--color-bg)] border-b border-[var(--color-card-border)]">
                    <p className="text-sm font-bold text-[var(--color-text-main)]">{row.feature}</p>
                  </div>

                  <div className="divide-y divide-[var(--color-card-border)] text-[var(--color-text-main)]">
                    {competitors.map((c) => (
                      <div key={c.key} className="flex items-center justify-between gap-4 px-5 py-3.5">
                        <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider shrink-0">{c.label}</span>
                        <div className="text-sm text-right text-[var(--color-text-muted)]">
                          <WinnerCell content={row[c.key]} colKey={c.key} row={row} explanations={explanations} />
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center justify-between gap-4 px-5 py-4 bg-[var(--color-secondary)]/5">
                      <span className="text-[10px] font-bold text-[var(--color-secondary)] uppercase tracking-wider shrink-0">Radix Seal</span>
                      <div className="text-sm font-bold text-right">
                        <WinnerCell content={row.seal} colKey="seal" row={row} explanations={explanations} />
                      </div>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          ))}
        </div>

        {/* Legal-scope honesty note */}
        <FadeIn delay={0.1} className="mt-10 flex items-start gap-3 max-w-4xl mx-auto p-6 rounded-2xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)]">
          <Info className="size-5 text-[var(--color-primary)] shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{comp.note}</p>
        </FadeIn>
      </div>
    </section>
  );
}
