import { Zap } from 'lucide-react';
import { ReactNode } from 'react';
import { ContentHero } from '@/components/layout/ContentHero';
import { CollapsibleHeroSection } from '@/components/layout/CollapsibleHeroSection';
import { FeaturedCard, type FeaturedCardProps } from '@/components/ui/FeaturedCard';

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface SidebarPageHeroProps {
  /** Plain portion of the h1 (default: 'Radix') */
  brandName?: string;
  /** Gradient-coloured portion of the h1 */
  title: string;
  /** Tailwind gradient classes for the title (inherits ContentHero default if omitted) */
  gradient?: string;
  /** Descriptive paragraph rendered below the h1 */
  heroDescription: string;
  /** Label for the featured-cards grid section */
  featuredLabel: string;
  /** Pre-resolved card props — caller handles all i18n lookups */
  cards: FeaturedCardProps[];
  /**
   * Optional row of action links/buttons rendered below the description.
   * Used by Games (Tournament info + Publish info links).
   */
  actions?: ReactNode;
  /**
   * Optional siblings rendered outside CollapsibleHeroSection (modals, overlays).
   * Used by Games (TournamentModal + DevPublishModal).
   */
  modals?: ReactNode;
  /** When true both hero and grid animate out (item selected) */
  collapsed?: boolean;
  /** Optional phrase to replace with a clickable button inside heroDescription */
  cta_connect_wallet?: string;
  /** Callback triggered when the clickable CTA is clicked */
  onConnectWallet?: () => void;
}

/* ─── Component ─────────────────────────────────────────────────────────── */

/**
 * Shared hero + featured-cards layout used by the Docs and Games pages.
 * Replaces the formerly duplicated FeaturedDocsHero and GamesHero components.
 *
 * Callers pass pre-resolved FeaturedCardProps[] so this component stays
 * purely presentational — zero i18n lookups, zero domain logic.
 */
export function SidebarPageHero({
  brandName = 'Radix',
  title,
  gradient,
  heroDescription,
  featuredLabel,
  cards,
  actions,
  modals,
  collapsed = false,
  cta_connect_wallet,
  onConnectWallet,
}: SidebarPageHeroProps) {
  const hero = (
    <ContentHero
      brandName={brandName}
      title={title}
      gradient={gradient}
      heroPadding="pt-12 pb-16"
      subtitle={
        <div className="space-y-4">
          <p
            className="leading-relaxed"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {cta_connect_wallet && onConnectWallet && heroDescription.includes(cta_connect_wallet) ? (
              <>
                {heroDescription.split(cta_connect_wallet)[0]}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onConnectWallet();
                  }}
                  className="text-[var(--color-primary)] font-bold hover:text-[var(--color-accent)] transition-all mx-1"
                >
                  {cta_connect_wallet}
                </button>
                {heroDescription.split(cta_connect_wallet)[1]}
              </>
            ) : heroDescription}
          </p>
          {actions}
        </div>
      }
    />
  );

  const grid = (
    <>
      <h2
        className="text-xl font-bold mb-6 flex items-center gap-2"
        style={{ color: 'var(--color-text-main)' }}
      >
        <Zap className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
        {featuredLabel}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cards.map((card, i) => (
          <FeaturedCard key={i} {...card} />
        ))}
      </div>
    </>
  );

  return (
    <>
      {modals}
      <CollapsibleHeroSection collapsed={collapsed} hero={hero} grid={grid} />
    </>
  );
}
