'use client';

import { Gamepad2, Trophy, Info, ArrowUpRight, Code2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useLayout } from '@/context/LayoutContext';
import { SidebarPageHero } from '@/components/layout/SidebarPageHero';
import { GAME_CATEGORIES, FEATURED_GAME_IDS, getAllGames } from '../data/gamesData';
import TournamentModal from './TournamentModal';
import DevPublishModal from './DevPublishModal';
import type { FeaturedCardProps } from '@/components/ui/FeaturedCard';
import { useState } from 'react';

/* ─── Props ─────────────────────────────────────────────────────────────── */

import type { Dictionary } from '@/i18n';
import { GamesHeroProps } from '../types/components.types';

/* ─── Component ─────────────────────────────────────────────────────────── */

export default function GamesHero({ onSelectGame, collapsed = false, dictionary }: GamesHeroProps & { dictionary?: Partial<Dictionary> }) {
  const { t: dict } = useLanguage();
  const { setShowUnderConstruction } = useLayout();
  const t = dictionary?.games || dict?.games || {};
  const [isTournamentOpen, setIsTournamentOpen] = useState(false);
  const [isDevOpen, setIsDevOpen] = useState(false);

  const titles = (t.titles ?? {}) as Record<string, string>;
  const categories = (t.categories ?? {}) as Record<string, string>;
  const featuredGames = getAllGames().filter(g => FEATURED_GAME_IDS.includes(g.id));

  const resolvedCards: FeaturedCardProps[] = featuredGames.map(game => {
    const cat = GAME_CATEGORIES.find(c => c.id === game.categoryId);
    const catLabel = cat ? (categories[cat.labelKey] ?? cat.labelKey) : game.categoryId;
    return {
      onClick: () => onSelectGame(game.id),
      gradient: game.thumbnailGradient,
      accentRgb: game.accentRgb,
      iconVariant: 'icon-box',
      icon: <Gamepad2 className="size-6 text-white" />,
      badgeLabel: catLabel,
      title: titles[game.titleKey] ?? game.titleKey,
      description:
        ((t.game_descs ?? {}) as Record<string, string>)[game.id] ??
        t.default_desc ??
        'Play now and compete for XRD prizes in weekly tournaments.',
      ctaLabel: t.play_now ?? 'Play now',
      topBadge: (
        <span
          className="absolute top-4 right-4 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
          style={{ background: 'var(--color-primary)', color: 'white', opacity: 0.9 }}
        >
          <Trophy className="size-3" />
          {t.tournament_badge ?? 'Tournament'}
        </span>
      ),
    };
  });

  const actions = (
    <div className="flex flex-wrap justify-center items-center gap-4">
      <button
        type="button"
        onClick={() => setIsTournamentOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-70"
        style={{ color: 'var(--color-primary)' }}
      >
        <Info className="size-4" />
        {t.moreInfo ?? 'More information about tournaments'}
        <ArrowUpRight className="size-4" />
      </button>
      <span style={{ color: 'var(--color-card-border)' }}>|</span>
      <button
        type="button"
        onClick={() => setIsDevOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-70"
        style={{ color: 'var(--color-primary)' }}
      >
        <Code2 className="size-4" />
        {t.moreInfoDev ?? 'More info on publishing games'}
        <ArrowUpRight className="size-4" />
      </button>
    </div>
  );

  const modals = (
    <>
      <TournamentModal isOpen={isTournamentOpen} onClose={() => setIsTournamentOpen(false)} />
      <DevPublishModal isOpen={isDevOpen} onClose={() => setIsDevOpen(false)} />
    </>
  );

  return (
    <SidebarPageHero
      title={t.heroTitle ?? 'Games'}
      gradient="from-[var(--color-primary)] to-[var(--color-accent)]"
      heroDescription={t.heroDescription}
      featuredLabel={t.featured ?? 'Featured Games'}
      cards={resolvedCards}
      actions={actions}
      modals={modals}
      collapsed={collapsed}
      cta_connect_wallet={t.cta_connect_wallet as string}
      onConnectWallet={() => setShowUnderConstruction(true)}
    />
  );
}
