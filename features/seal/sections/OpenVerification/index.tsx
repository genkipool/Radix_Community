/**
 * OpenVerification — RSC
 *
 * "Verifiable by anyone, forever" banner: the three artifacts that make a
 * Radix Seal signature independently checkable (self-contained PDF, public
 * request key, on-ledger chain of custody), with a CTA into the verify flow.
 */
import Link from 'next/link';
import { FileCheck2, KeySquare, Link2, ShieldCheck } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import { FeatureCard } from '../../components/FeatureCard';
import { SealResourceAddresses } from '../../components/SealResourceAddresses';
import { SEAL_LINKS } from '../../data/links';
import type { SealLocaleSectionProps } from '../../types';

const CARD_ICONS = [
  <FileCheck2 key="pdf" className="size-10 text-[var(--color-primary)]" />,
  <KeySquare key="key" className="size-10 text-[var(--color-secondary)]" />,
  <Link2 key="custody" className="size-10 text-[var(--color-primary)]" />,
];

export default function OpenVerification({ t, locale }: SealLocaleSectionProps) {
  const verify = t.seal.verifyOpen;

  return (
    <section id="open-verification" className="py-24 bg-[var(--color-surface)]/50 relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<ShieldCheck className="size-3.5 text-[var(--color-primary)]" />}
          badge={verify.label}
          title={verify.h2a}
          titleAccent={verify.h2b}
          subtitle={verify.sub}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {verify.cards.map((card: { title: string; desc: string }, i: number) => (
            <FeatureCard
              key={card.title}
              icon={CARD_ICONS[i]}
              title={card.title}
              desc={card.desc}
              delay={i * 0.1}
            />
          ))}
        </div>

        <FadeIn delay={0.2} className="flex justify-center">
          <Link
            href={`/${locale}${SEAL_LINKS.sign}?tab=verify`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex justify-center items-center px-8 py-4 rounded-full bg-[var(--color-card-border)] text-[var(--color-text-main)] font-bold hover:bg-[var(--color-surface)] transition-colors border border-[var(--color-card-border)]"
          >
            {verify.cta}
          </Link>
        </FadeIn>

        <SealResourceAddresses title={verify.officialTitle} hint={verify.officialHint} />
      </div>
    </section>
  );
}
