/**
 * Privacy — RSC
 *
 * "Your document never leaves your browser" banner: the four privacy
 * guarantees (local hashing, direct P2P transfer, identity under the user's
 * control, no accounts), closing with a CTA into the signing tool.
 */
import Link from 'next/link';
import { EyeOff, FileDigit, KeyRound, Radio, UserRoundCog } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FadeIn } from '@/components/ui/FadeIn';
import { FeatureCard } from '../../components/FeatureCard';
import { SEAL_LINKS } from '../../data/links';
import type { SealLocaleSectionProps } from '../../types';

const CARD_ICONS = [
  <FileDigit key="hash" className="size-10 text-[var(--color-primary)]" />,
  <Radio key="p2p" className="size-10 text-[var(--color-secondary)]" />,
  <UserRoundCog key="identity" className="size-10 text-[var(--color-primary)]" />,
  <KeyRound key="accounts" className="size-10 text-[var(--color-secondary)]" />,
];

export default function Privacy({ t, locale }: SealLocaleSectionProps) {
  const privacy = t.seal.privacy;

  return (
    <section id="privacy" className="py-24 bg-[var(--color-surface)]/50 relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<EyeOff className="size-3.5 text-[var(--color-primary)]" />}
          badge={privacy.label}
          title={privacy.h2a}
          titleAccent={privacy.h2b}
          subtitle={privacy.sub}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {privacy.cards.map((card: { title: string; desc: string }, i: number) => (
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
            href={`/${locale}${SEAL_LINKS.sign}`}
            className="inline-flex justify-center items-center px-8 py-4 rounded-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-secondary)] text-[var(--color-bg)] font-bold hover:opacity-90 transition-opacity"
          >
            {privacy.cta}
          </Link>
        </FadeIn>
      </div>
    </section>
  );
}
