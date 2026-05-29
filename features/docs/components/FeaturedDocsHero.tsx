'use client';

import { Layers, Zap, Shield, Code } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useLayout } from '@/context/LayoutContext';
import { SidebarPageHero } from '@/components/layout/SidebarPageHero';
import type { FeaturedDocsHeroProps } from '../types/components.types';
import type { Dictionary } from '@/i18n';
import type { DocsDictionary } from '../types/i18n.types';
import type { FeaturedCardProps } from '@/components/ui/FeaturedCard';

/* ─── Static card config (data only — no JSX) ───────────────────────────── */

const CARDS_CONFIG = [
  {
    id: 'ledger-architecture',
    titleKey: 'ledger_architecture',
    topicKey: 'whitepapers',
    cardKey: 'architecture' as const,
    Icon: Layers,
    gradient: 'from-blue-500 to-cyan-400',
    accentRgb: '59,130,246',
  },
  {
    id: 'scrypto-basics',
    titleKey: 'scrypto_basics',
    topicKey: 'developers',
    cardKey: 'scrypto' as const,
    Icon: Code,
    gradient: 'from-fuchsia-500 to-pink-500',
    accentRgb: '217,70,239',
  },
  {
    id: 'babylon-guide',
    titleKey: 'babylon_guide',
    topicKey: 'guides',
    cardKey: 'staking' as const,
    Icon: Zap,
    gradient: 'from-amber-400 to-orange-500',
    accentRgb: '251,191,36',
  },
  {
    id: 'atomic-composability',
    titleKey: 'atomic_composability',
    topicKey: 'whitepapers',
    cardKey: 'security' as const,
    Icon: Shield,
    gradient: 'from-emerald-400 to-teal-500',
    accentRgb: '52,211,153',
  },
] as const;

/* ─── Props ─────────────────────────────────────────────────────────────── */

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function FeaturedDocsHero({
  onSelectDoc,
  collapsed = false,
  dictionary,
}: FeaturedDocsHeroProps & { dictionary?: Partial<Dictionary> }) {
  const { t: dict } = useLanguage();
  const { setShowUnderConstruction } = useLayout();
  const docsT = (dictionary?.docs || dict?.docs || {}) as DocsDictionary;
  const docsLabels = docsT.documents || {};
  const topics = docsT.topics ?? {};
  const cards = docsT.featured_cards ?? {};

  const resolvedCards: FeaturedCardProps[] = CARDS_CONFIG.map(cfg => {
    const cardData = cards[cfg.cardKey] ?? { title: '', desc: '' };
    return {
      onClick: () => onSelectDoc(cfg.id),
      gradient: cfg.gradient,
      accentRgb: cfg.accentRgb,
      iconVariant: 'gradient-text',
      icon: <cfg.Icon className="size-6" />,
      badgeLabel: topics[cfg.topicKey] ?? cfg.topicKey,
      title: docsLabels?.[cfg.titleKey] ?? cardData.title ?? '',
      description: cardData.desc ?? '',
      ctaLabel: docsT.readArticle || 'Read article',
    };
  });

  return (
    <SidebarPageHero
      title={docsT.heroTitle ?? 'Documentos'}
      heroDescription={docsT.heroDescription ?? ''}
      featuredLabel={docsT.featured ?? 'Destacado'}
      cards={resolvedCards}
      collapsed={collapsed}
      cta_connect_wallet={docsT.cta_connect_wallet ?? 'Conectar Wallet'}
      onConnectWallet={() => setShowUnderConstruction(true)}
      cta_buy_badge={docsT.cta_buy_badge}
      onBuyBadge={() => setShowUnderConstruction(true)}
    />
  );
}
