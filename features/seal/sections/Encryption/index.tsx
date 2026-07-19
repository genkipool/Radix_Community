/**
 * Encryption — RSC
 *
 * The self-custody encryption model in one section: how it works, why it fits
 * institutions, and an honest comparison with today's best encryption.
 */
import {
  CircleDollarSign,
  FolderLock,
  KeyRound,
  Landmark,
  Layers,
  Lock,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import type { SealSectionProps } from '../../types';

const STEP_ICONS = [
  <KeyRound key="key" className="size-6 text-[var(--color-primary)]" />,
  <Lock key="lock" className="size-6 text-[var(--color-secondary)]" />,
  <Share2 key="share" className="size-6 text-[var(--color-primary)]" />,
  <FolderLock key="ledger" className="size-6 text-[var(--color-secondary)]" />,
];

const COMPARE_ICONS = [
  <KeyRound key="nokeys" className="size-5 shrink-0 text-[var(--color-primary)]" />,
  <ShieldCheck key="onlyowner" className="size-5 shrink-0 text-[var(--color-primary)]" />,
  <CircleDollarSign key="free" className="size-5 shrink-0 text-[var(--color-primary)]" />,
  <Layers key="ledger" className="size-5 shrink-0 text-[var(--color-primary)]" />,
];

export default function Encryption({ t }: SealSectionProps) {
  const enc = t.seal.encryption;

  return (
    <section id="encryption" className="py-24 bg-[var(--color-surface)]/50 relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<Lock className="size-3.5 text-[var(--color-primary)]" />}
          badge={enc.label}
          title={enc.h2a}
          titleAccent={enc.h2b}
          subtitle={enc.sub}
        />

        {/* How it works */}
        <FadeIn className="mb-6">
          <h3 className="text-xl font-bold text-[var(--color-text-main)]">{enc.howTitle}</h3>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {enc.steps.map((step, i: number) => (
            <FadeIn
              key={step.title}
              delay={i * 0.08}
              className="bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-2xl p-6"
            >
              <div className="size-11 rounded-xl flex items-center justify-center bg-[var(--color-card-bg)] border border-[var(--color-card-border)] mb-4">
                {STEP_ICONS[i]}
              </div>
              <h4 className="text-base font-bold text-[var(--color-text-main)] mb-2">
                {i + 1}. {step.title}
              </h4>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{step.desc}</p>
            </FadeIn>
          ))}
        </div>

        {/* Why it matters for institutions */}
        <FadeIn className="mb-6">
          <h3 className="text-xl font-bold text-[var(--color-text-main)]">{enc.institutionsTitle}</h3>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {enc.institutions.map((it, i: number) => (
            <FadeIn
              key={it.title}
              delay={i * 0.08}
              className="bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-2xl p-6"
            >
              <div className="flex items-center gap-3 mb-3">
                <Landmark className="size-5 shrink-0 text-[var(--color-primary)]" />
                <h4 className="text-base font-bold text-[var(--color-text-main)]">{it.title}</h4>
              </div>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{it.desc}</p>
            </FadeIn>
          ))}
        </div>

        {/* Advantages over current methods (cards, no table) */}
        <FadeIn className="mb-6">
          <h3 className="text-xl font-bold text-[var(--color-text-main)]">{enc.comparisonTitle}</h3>
        </FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {enc.comparison.map((c, i: number) => (
            <FadeIn
              key={c.title}
              delay={i * 0.08}
              className="bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-2xl p-6"
            >
              <div className="flex items-center gap-3 mb-3">
                {COMPARE_ICONS[i]}
                <h4 className="text-base font-bold text-[var(--color-text-main)]">{c.title}</h4>
              </div>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{c.desc}</p>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
