'use client';

import { useRouter } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { SidebarPageHero } from '@/components/layout/SidebarPageHero';
import type { FeaturedCardProps } from '@/components/ui/FeaturedCard';
import type { Dictionary } from '@/i18n';
import { CONSOLE_GROUPS, CONSOLE_TOOLS, FEATURED_TOOL_SLUGS } from '../data/consoleTools';
import { useConsoleDictionary } from '../hooks/useConsoleDictionary';
import type { ConsoleToolSlug } from '../types/console.types';

interface ConsoleHomeProps {
  dictionary?: Partial<Dictionary>;
}

/** Console landing page — hero plus featured tool cards (docs-style). */
export default function ConsoleHome({ dictionary }: ConsoleHomeProps) {
  const t = useConsoleDictionary(dictionary);
  const { language } = useLanguage();
  const router = useRouter();
  const { isConnected, connect } = useRadixWallet();

  const toolLabels = (t.tools ?? {}) as Record<string, { title?: string; description?: string }>;
  const groupLabels = (t.groups ?? {}) as Record<string, string>;

  const openTool = (slug: ConsoleToolSlug) => router.push(`/${language}/console/${slug}`);

  const cards: FeaturedCardProps[] = FEATURED_TOOL_SLUGS.map((slug) => {
    const meta = CONSOLE_TOOLS[slug];
    const group = CONSOLE_GROUPS.find((g) => g.tools.includes(slug));
    return {
      onClick: () => openTool(slug),
      gradient: meta.gradient,
      accentRgb: meta.accentRgb,
      iconVariant: 'gradient-text',
      icon: <span className="[&>svg]:size-6">{meta.icon}</span>,
      badgeLabel: group ? groupLabels[group.id] ?? group.id : '',
      title: toolLabels[slug]?.title ?? slug,
      description: toolLabels[slug]?.description ?? '',
      ctaLabel: t.openTool ?? 'Open tool',
    };
  });

  const remainingSlugs = CONSOLE_GROUPS.flatMap((group) =>
    group.tools.filter((slug) => !FEATURED_TOOL_SLUGS.includes(slug)),
  );

  return (
    <>
      <SidebarPageHero
        title={t.heroTitle ?? 'Console'}
        heroDescription={t.heroDescription ?? ''}
        featuredLabel={t.featured ?? ''}
        cards={cards}
        collapsed={false}
        cta_connect_wallet={t.cta_connect_wallet}
        onConnectWallet={() => {
          if (!isConnected) connect(RadixNetworkId.Mainnet);
        }}
      />

      {/* Remaining tools as compact rows below the featured grid */}
      {remainingSlugs.length > 0 && (
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-12 pb-20 -mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {remainingSlugs.map((slug) => {
              const meta = CONSOLE_TOOLS[slug];
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => openTool(slug)}
                  className="group flex items-start gap-3.5 p-5 rounded-2xl border text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
                  style={{
                    borderColor: 'var(--color-card-border)',
                    background: `linear-gradient(135deg, rgba(${meta.accentRgb},0.06) 0%, transparent 55%)`,
                  }}
                >
                  <div
                    className={`size-10 shrink-0 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center text-white shadow group-hover:scale-110 transition-transform duration-300`}
                  >
                    {meta.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold flex items-center gap-1" style={{ color: 'var(--color-text-main)' }}>
                      {toolLabels[slug]?.title ?? slug}
                      <ArrowUpRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-primary)' }} />
                    </p>
                    <p className="text-xs mt-1 leading-relaxed line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
                      {toolLabels[slug]?.description ?? ''}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
