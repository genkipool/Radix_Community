/**
 * Implementation — RSC
 *
 * The concrete engineering surface: existing Google pass infrastructure,
 * ROLA libraries, Gateway API, Scrypto, native SDKs and fee delegation.
 */
import { Nfc, Fingerprint, Globe, Code2, Package, HandCoins } from 'lucide-react';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { FeatureCard } from '../../components/FeatureCard';
import { GOOGLE_WALLET_LINKS } from '../../data/links';
import type { GoogleWalletSectionProps } from '../../types';

const CARD_ICONS = [
  <Nfc key="vas" className="size-10 text-[var(--color-primary)]" />,
  <Fingerprint key="rola" className="size-10 text-[var(--color-secondary)]" />,
  <Globe key="gateway" className="size-10 text-[var(--color-primary)]" />,
  <Code2 key="scrypto" className="size-10 text-[var(--color-secondary)]" />,
  <Package key="sdk" className="size-10 text-[var(--color-primary)]" />,
  <HandCoins key="fees" className="size-10 text-[var(--color-secondary)]" />,
];

const CARD_LINKS: { href: string; secondHref?: string }[] = [
  { href: GOOGLE_WALLET_LINKS.googleWalletApi },
  { href: GOOGLE_WALLET_LINKS.rolaTs },
  { href: GOOGLE_WALLET_LINKS.radixDocs, secondHref: GOOGLE_WALLET_LINKS.babylonGateway },
  { href: GOOGLE_WALLET_LINKS.scryptoExamples },
  { href: GOOGLE_WALLET_LINKS.rustSdk },
  { href: GOOGLE_WALLET_LINKS.manifestDocs },
];

export default function Implementation({ t }: GoogleWalletSectionProps) {
  const implementation = t.googleWallet.implementation;

  return (
    <section id="implementation" className="py-24 bg-[var(--color-bg)] relative overflow-hidden">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 relative z-10">
        <SectionHeader
          icon={<Code2 className="size-3.5 text-[var(--color-primary)]" />}
          badge={implementation.label}
          title={implementation.h2a}
          titleAccent={implementation.h2b}
          subtitle={implementation.sub}
        />

        {/* Building blocks */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {implementation.cards.map((card, i) => (
            <FeatureCard
              key={card.title}
              icon={CARD_ICONS[i]}
              title={card.title}
              desc={card.desc}
              link={{ href: CARD_LINKS[i].href, label: card.linkLabel }}
              secondLink={
                'secondLinkLabel' in card && CARD_LINKS[i].secondHref
                  ? { href: CARD_LINKS[i].secondHref as string, label: card.secondLinkLabel as string }
                  : undefined
              }
              delay={i * 0.08}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
