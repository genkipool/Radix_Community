/**
 * Hero — RSC shell (same split strategy as the home hero)
 *
 *  ┌─ Hero (RSC) ─────────────────────────────────────────────────────────┐
 *  │  Static layout, cross-shard settlement panel, metrics bar            │
 *  │  ┌─ HeroCarousel ('use client') ──────────────────────────────────┐  │
 *  │  │  Slides with useReducer/useEffect + CSS animations              │  │
 *  │  └────────────────────────────────────────────────────────────────┘  │
 *  └──────────────────────────────────────────────────────────────────────┘
 */
import Link from 'next/link';
import { Zap } from 'lucide-react';
import HeroCarousel from './components/HeroCarousel';
import { HYPERSCALE_LINKS, XIAN_ROADMAP_ID } from '../../data/links';
import type { HyperscaleSectionProps } from '../../types';

/** One row of the settlement log: shard badge + action + payload + result. */
function ShardLogRow({
  shard,
  action,
  payload,
  result,
}: {
  shard: string;
  action: string;
  payload: string;
  result: string;
}) {
  return (
    <div className="flex items-baseline gap-2 whitespace-nowrap">
      <span className="font-bold text-[var(--code-keyword)]">SHARD</span>
      <span className="text-[var(--code-type)]">{shard}</span>
      <span className="font-semibold text-[var(--code-string)]">{action}</span>
      <span className="text-[var(--code-punct)] truncate">{payload}</span>
      <span className="ml-auto font-bold text-[var(--code-type)]">{result}</span>
    </div>
  );
}

export default function Hero({ t }: HyperscaleSectionProps) {
  const hero = t.hyperscale.hero;

  const metrics = [
    { value: hero.metric1_value, label: hero.metric1, gradient: true },
    { value: hero.metric2_value, label: hero.metric2, gradient: false },
    { value: hero.metric3_value, label: hero.metric3, gradient: true },
    { value: hero.metric4_value, label: hero.metric4, gradient: false },
  ];

  return (
    <section
      id="hero"
      className="relative min-h-screen pt-32 pb-20 overflow-hidden flex flex-col justify-center"
    >
      {/* Ambient background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 -left-64 size-[500px] bg-[var(--color-primary)]/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 -right-64 size-[500px] bg-[var(--color-secondary)]/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-end">

          {/* LEFT COLUMN */}
          <div className="lg:col-span-7">
            {/* Theme-adaptive badge */}
            <div className="inline-flex items-center gap-2 px-4 h-8 rounded-full bg-[var(--color-bg)] border border-[var(--color-card-border)] text-sm font-medium text-[var(--color-primary)] mb-5 shadow-sm">
              <Zap className="size-3.5 shrink-0" fill="currentColor" />
              <span className="leading-none">{hero.badge}</span>
            </div>

            {/* Client island — animated carousel */}
            <HeroCarousel t={t} />

            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <a
                href={`#${XIAN_ROADMAP_ID}`}
                className="inline-flex justify-center items-center px-8 py-4 rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-secondary)] text-[var(--color-bg)] font-bold hover:opacity-90 transition-opacity"
              >
                {hero.btn_roadmap}
              </a>
              <Link
                href={HYPERSCALE_LINKS.hyperscaleRs}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex justify-center items-center px-8 py-4 rounded-full bg-[var(--color-card-border)] text-[var(--color-text-main)] font-bold hover:bg-[var(--color-surface)] transition-colors border border-[var(--color-card-border)]"
              >
                {hero.btn_github}
              </Link>
            </div>
          </div>

          {/* RIGHT COLUMN — Cross-shard atomic settlement log */}
          <div className="relative lg:col-span-5 hidden lg:block">
            <div className="absolute inset-0 bg-gradient-to-tr from-[var(--color-primary)]/10 to-[var(--color-secondary)]/10 rounded-2xl blur-2xl" />
            <div
              title={hero.panel.tooltip}
              className="relative bg-[var(--code-bg)] border border-[var(--color-card-border)] rounded-2xl overflow-hidden font-mono text-[11px] shadow-xl cursor-default"
            >

              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-card-border)] bg-[var(--color-text-main)]/5">
                <span className="relative flex size-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-xs font-bold tracking-wider text-[var(--color-text-muted)] opacity-80 uppercase shrink-0 leading-none mt-[2px]">
                  {hero.panel.title}
                </span>
              </div>

              {/* Log container */}
              <div className="px-5 py-4 space-y-3 leading-relaxed text-[var(--code-punct)]">

                {/* Step 1 — declare & lock */}
                <div className="space-y-1">
                  <div className="mb-1 text-[10px] text-[var(--code-comment)]">{hero.panel.comment1}</div>
                  <ShardLogRow shard="0x2E" action={hero.panel.lock} payload='resource_rdx1_eur_cbdc…' result="✓" />
                  <ShardLogRow shard="0x71" action={hero.panel.lock} payload='resource_rdx1_rwa_bond…' result="✓" />
                </div>

                <div className="border-t border-[var(--color-card-border)] opacity-30" />

                {/* Step 2 — independent execution */}
                <div className="space-y-1">
                  <div className="mb-1 text-[10px] text-[var(--code-comment)]">{hero.panel.comment2}</div>
                  <ShardLogRow shard="0x2E" action={hero.panel.exec} payload='swap 10,000,000 eurCBDC' result="cert_a91f…" />
                  <ShardLogRow shard="0x71" action={hero.panel.exec} payload='swap 200,000 T-BOND' result="cert_c47b…" />
                </div>

                <div className="border-t border-[var(--color-card-border)] opacity-30" />

                {/* Step 3 — certificate exchange & atomic commit */}
                <div className="space-y-1">
                  <div className="mb-1 text-[10px] text-[var(--code-comment)]">{hero.panel.comment3}</div>
                  <div className="flex items-baseline gap-2 whitespace-nowrap">
                    <span className="font-bold text-[var(--code-keyword)]">{hero.panel.cert}</span>
                    <span className="text-[var(--code-punct)]">{hero.panel.shards_agree}</span>
                    <span className="ml-auto font-black text-[var(--code-string)]">{hero.panel.commit}</span>
                  </div>
                  <div className="flex items-baseline gap-2 whitespace-nowrap">
                    <span className="font-bold text-[var(--code-keyword)]">{hero.panel.finality}</span>
                    <span className="font-bold text-[var(--code-type)]">1.9s</span>
                    <span className="ml-auto font-black text-[var(--code-type)]">{hero.panel.atomic}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Metrics bar — RSC */}
        <div className="mt-24 pt-12 border-t border-[var(--color-card-border)]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {metrics.map((metric) => (
              <div key={metric.label}>
                <div
                  className={`text-3xl font-bold mb-2 ${
                    metric.gradient
                      ? 'text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-secondary)] to-[var(--color-primary)]'
                      : 'text-[var(--color-text-main)]'
                  }`}
                >
                  {metric.value}
                </div>
                <div className="text-sm text-[var(--color-text-muted)] font-medium min-h-[40px]">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
