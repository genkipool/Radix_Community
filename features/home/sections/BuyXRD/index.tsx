import { Coins, CheckCircle2, CreditCard } from 'lucide-react';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { SectionHeader } from '@/components/layout/SectionHeader';
import React from 'react';
import { BaseSectionProps } from '../../types/components.types';
import AlchemyPayWidget from './components/AlchemyPayWidget';

const EXCHANGES = [
  { name: "KuCoin", url: "https://www.kucoin.com/trade/XRD-USDT" },
  { name: "MEXC", url: "https://www.mexc.com/exchange/XRD_USDT" },
  { name: "CoinEx", url: "https://www.coinex.com/exchange/XRD-USDT" },
  { name: "Bit2Me", url: "https://bit2me.com/buy-radix" }
];

export default function BuyXRD({ t }: BaseSectionProps) {

  return (
    <section id="comprar-xrd" className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<Coins className="size-4" />}
          badge={t.comprarXRD.label}
          badgeClassName="bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20 text-[var(--color-primary)]"
          title={t.comprarXRD.h2a}
          titleAccent={t.comprarXRD.h2b}
          subtitle={t.comprarXRD.sub}
          gradient="from-[var(--color-primary)] via-[var(--color-secondary)] to-[var(--color-accent)]"
        />

        {/* Top Row: Guide + Alchemy Pay Widget */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-12">
          <ScrollReveal from={{ opacity: 0, x: -50 }}>
            <h3 className="text-2xl font-bold text-[var(--color-text-main)] mb-8">{t.comprarXRD.guideTitle}</h3>
            <div className="space-y-8">
              {(t.comprarXRD.steps as Array<Record<string, string>>).map((step) => (
                <div key={step.num} className="flex gap-6 group">
                  <div className="flex-shrink-0 size-12 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] font-bold flex items-center justify-center text-lg transition-transform group-hover:scale-110">
                    {step.num}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-[var(--color-text-main)] mb-2 group-hover:text-[var(--color-primary)] transition-colors">{step.title}</h4>
                    <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal from={{ opacity: 0, x: 50 }} className="flex flex-col">
            <div className="flex items-center gap-3 mb-0">
              <h3 className="text-xl font-bold text-[var(--color-text-main)]">
                {/* Fallback title if not in translation file */}
                {(t.comprarXRD as Record<string, unknown>).widgetTitle as string || 'Compra Rápida con Tarjeta'}
              </h3>
              <CreditCard className="size-5 text-[var(--color-primary)]" />
            </div>
            <AlchemyPayWidget />
          </ScrollReveal>
        </div>

        {/* Bottom Row: Exchanges & Utilities Cards */}
        <ScrollReveal
          from={{ opacity: 0, y: 30 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-8"
        >
          {/* Exchanges Card */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-card-border)] p-8 rounded-2xl shadow-lg relative overflow-hidden h-full flex flex-col">
            {/* Subtle background glow */}
            <div className="absolute top-0 right-0 size-32 bg-[var(--color-primary)]/5 blur-3xl rounded-full -mr-16 -mt-16" />

            <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-6 relative z-10">{t.comprarXRD.exchangesTitle}</h3>
            <div className="flex flex-wrap gap-3 mb-6 relative z-10 flex-grow">
              {EXCHANGES.map((exchange) => (
                <a
                  key={exchange.name}
                  href={exchange.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-lg text-sm font-medium text-[var(--color-text-main)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:shadow-md transition-all active:scale-95"
                >
                  {exchange.name}
                </a>
              ))}
            </div>
            <div className="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/10 p-4 rounded-xl relative z-10 mt-auto">
              <p className="text-sm text-[var(--color-text-main)]/90 leading-relaxed">
                <strong className="text-[var(--color-primary)]">{t.comprarXRD.tip}</strong> {t.comprarXRD.tipDesc}
              </p>
            </div>
          </div>

          {/* Utilities Card */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-card-border)] p-8 rounded-2xl shadow-lg h-full">
            <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-6">{t.comprarXRD.utilitiesTitle}</h3>
            <div className="space-y-4">
              {t.comprarXRD.utilities.map((utility: string) => (
                <div key={utility} className="flex items-start gap-3 text-[var(--color-text-main)]/80 group">
                  <CheckCircle2 className="size-5 shrink-0 text-[var(--color-primary)] group-hover:scale-110 transition-transform" />
                  <span className="group-hover:text-[var(--color-text-main)] transition-colors leading-snug">{utility}</span>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
