/**
 * MachineEconomy — RSC
 *
 * AI focus: x402 micropayments, agents with wallets, machine-readable
 * ledger access via MCP, and deterministic intent for autonomous agents.
 */
import { Bot, Coins, Workflow, Lock, Quote } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import { StatStrip } from '../../components/StatStrip';
import { FeatureCard } from '../../components/FeatureCard';
import type { HyperscaleSectionProps } from '../../types';

const CARD_ICONS = [
  <Coins key="x402" className="size-10 text-[var(--color-primary)]" />,
  <Bot key="agents" className="size-10 text-[var(--color-secondary)]" />,
  <Workflow key="mcp" className="size-10 text-[var(--color-primary)]" />,
  <Lock key="intent" className="size-10 text-[var(--color-secondary)]" />,
];

export default function MachineEconomy({ t }: HyperscaleSectionProps) {
  const ai = t.hyperscale.ai;

  return (
    <section id="machine-economy" className="py-24 bg-[var(--color-surface)]/50 relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<Bot className="size-3.5 text-[var(--color-secondary)]" />}
          badge={ai.label}
          title={ai.h2a}
          titleAccent={ai.h2b}
          subtitle={ai.sub}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {ai.cards.map((card, i) => (
            <FeatureCard
              key={card.title}
              icon={CARD_ICONS[i]}
              title={card.title}
              desc={card.desc}
              delay={i * 0.1}
            />
          ))}
        </div>

        {/* Cloudflare quote */}
        <FadeIn className="relative bg-gradient-to-br from-[var(--color-primary)]/10 to-transparent border border-[var(--color-secondary)]/30 p-8 md:p-12 rounded-2xl overflow-hidden mb-16 max-w-4xl mx-auto">
          <div className="absolute top-0 right-0 size-40 bg-[var(--color-secondary)]/10 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none" />
          <Quote className="size-8 text-[var(--color-secondary)] mb-4 relative z-10" />
          <blockquote className="relative z-10">
            <p className="text-xl md:text-2xl font-bold text-[var(--color-text-main)] leading-relaxed mb-4">
              &ldquo;{ai.quote_p}&rdquo;
            </p>
            <footer className="text-sm font-semibold text-[var(--color-text-muted)] mb-4">
              — {ai.quote_author}
            </footer>
          </blockquote>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed relative z-10">{ai.quote_note}</p>
        </FadeIn>

        <StatStrip items={ai.strip} />
      </div>
    </section>
  );
}
