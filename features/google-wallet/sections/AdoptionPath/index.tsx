/**
 * AdoptionPath — RSC
 *
 * Integration roadmap in the visual format of the home "How to acquire XRD"
 * section: numbered step guide on the left, "what Google already has" panel
 * on the right, and a bottom row with open source resources and the assets
 * this unlocks beyond ticketing.
 */
import { Map, CheckCircle2, ExternalLink, Rocket } from 'lucide-react';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { GOOGLE_WALLET_LINKS } from '../../data/links';
import type { GoogleWalletSectionProps } from '../../types';

const RESOURCES = [
  { name: 'ROLA (TypeScript)', url: GOOGLE_WALLET_LINKS.rolaTs },
  { name: 'Babylon Gateway', url: GOOGLE_WALLET_LINKS.babylonGateway },
  { name: 'Scrypto Examples', url: GOOGLE_WALLET_LINKS.scryptoExamples },
  { name: 'RadixDLT Rust SDK', url: GOOGLE_WALLET_LINKS.rustSdk },
];

export default function AdoptionPath({ t }: GoogleWalletSectionProps) {
  const adoption = t.googleWallet.adoption;

  return (
    <section id="adoption" className="py-24 bg-[var(--color-surface)]/50 relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<Map className="size-4" />}
          badge={adoption.label}
          badgeClassName="bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20 text-[var(--color-primary)]"
          title={adoption.h2a}
          titleAccent={adoption.h2b}
          subtitle={adoption.sub}
          gradient="from-[var(--color-primary)] via-[var(--color-secondary)] to-[var(--color-accent)]"
        />

        {/* Top Row: Step guide + what Google already has */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-12">
          <ScrollReveal from={{ opacity: 0, x: -50 }}>
            <h3 className="text-2xl font-bold text-[var(--color-text-main)] mb-8">{adoption.guideTitle}</h3>
            <div className="space-y-8">
              {adoption.steps.map((step) => (
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
            <div className="flex items-center gap-3 mb-6">
              <h3 className="text-2xl font-bold text-[var(--color-text-main)]">{adoption.haveTitle}</h3>
              <Rocket className="size-5 text-[var(--color-primary)]" />
            </div>
            <div className="bg-[var(--color-card-bg)] border border-[var(--color-card-border)] p-8 rounded-2xl shadow-lg relative overflow-hidden flex-grow">
              <div className="absolute top-0 right-0 size-32 bg-[var(--color-primary)]/5 blur-3xl rounded-full -mr-16 -mt-16" />
              <div className="space-y-5 relative z-10">
                {adoption.have.map((item) => (
                  <div key={item} className="flex items-start gap-3 text-[var(--color-text-main)]/80 group">
                    <CheckCircle2 className="size-5 shrink-0 text-[var(--color-primary)] group-hover:scale-110 transition-transform" />
                    <span className="group-hover:text-[var(--color-text-main)] transition-colors leading-snug">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>

        {/* Bottom Row: Resources & what it unlocks */}
        <ScrollReveal
          from={{ opacity: 0, y: 30 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-8"
        >
          {/* Resources Card */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-card-border)] p-8 rounded-2xl shadow-lg relative overflow-hidden h-full flex flex-col">
            <div className="absolute top-0 right-0 size-32 bg-[var(--color-primary)]/5 blur-3xl rounded-full -mr-16 -mt-16" />

            <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-6 relative z-10">{adoption.resourcesTitle}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 relative z-10 flex-grow">
              {RESOURCES.map((resource) => (
                <a
                  key={resource.name}
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-5 py-3 w-full bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-xl text-sm font-bold text-[var(--color-text-main)] hover:bg-[var(--color-primary)]/10 hover:border-[var(--color-primary)]/50 hover:text-[var(--color-primary)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all active:scale-[0.98] group"
                >
                  <span>{resource.name}</span>
                  <ExternalLink className="size-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </a>
              ))}
            </div>
            <div className="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/10 p-4 rounded-xl relative z-10 mt-auto">
              <p className="text-sm text-[var(--color-text-main)]/90 leading-relaxed">
                <strong className="text-[var(--color-primary)]">{adoption.tip}</strong> {adoption.tipDesc}
              </p>
            </div>
          </div>

          {/* Unlocks Card */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-card-border)] p-8 rounded-2xl shadow-lg h-full">
            <h3 className="text-xl font-bold text-[var(--color-text-main)] mb-6">{adoption.unlocksTitle}</h3>
            <div className="space-y-4">
              {adoption.unlocks.map((item) => (
                <div key={item} className="flex items-start gap-3 text-[var(--color-text-main)]/80 group">
                  <CheckCircle2 className="size-5 shrink-0 text-[var(--color-primary)] group-hover:scale-110 transition-transform" />
                  <span className="group-hover:text-[var(--color-text-main)] transition-colors leading-snug">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
