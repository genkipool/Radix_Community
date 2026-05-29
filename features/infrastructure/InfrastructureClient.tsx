'use client';
import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Database, Network, Code2, TrendingUp, ArrowLeftRight,
  Monitor, Shield, Wrench, Globe2, Layers, GitBranch,
  Cpu, Zap, Server, Cog, Terminal, Box, Gem,
  Blocks, Link2, Globe, KeyRound, Package, FileText,
  Wallet, Smartphone, Wifi, LayoutDashboard, FlaskConical,
  Cable, Router, BarChart2, ChevronDown,
  FoldVertical, UnfoldVertical,
} from 'lucide-react';

import { ContentHero } from '@/components/layout/ContentHero';
import { SearchBar } from '@/components/ui/SearchBar';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { HighlightText } from '@/components/ui/HighlightText';
import { usePersistentExpandSet } from '@/hooks/usePersistentExpandSet';
import { INFRA_LAYERS } from './data/infrastructureData';
import { AutoCollapseToggle } from '@/components/ui/AutoCollapseToggle';
import type { InfraPageType } from './types/i18n.types';
import type {
  InfrastructureClientProps,
  ItemCardProps,
  LayerCardProps
} from './types/components.types';

/* ─── Icon map ───────────────────────────────────────────────────────────── */

const ICON_MAP: Record<string, React.ElementType> = {
  Database, Network, Code2, TrendingUp, ArrowLeftRight,
  Monitor, Shield, Wrench, Globe2, Layers, GitBranch,
  Cpu, Zap, Server, Cog, Terminal, Box, Gem,
  Blocks, Link2, Globe, KeyRound, Package, FileText,
  Wallet, Smartphone, Wifi, LayoutDashboard, FlaskConical,
  Cable, Router, BarChart2,
  // Aliases / non-standard names used in data
  Bridge: ArrowLeftRight,
};

function Icon({ name, className = '' }: { name: string; className?: string }) {
  const Comp = ICON_MAP[name] ?? Box;
  return <Comp className={className} aria-hidden="true" />;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

/* ─── Sub-item card ──────────────────────────────────────────────────────── */

function ItemCard({ item, layerGradient, title, description, searchQuery, index: _index }: ItemCardProps) {
  return (
    <div className="group h-full rounded-2xl bg-[var(--color-bg)] border border-[var(--color-card-border)] p-5 hover:border-[var(--color-primary)]/30 hover:shadow-md transition-all duration-300">
      <div className="flex items-start gap-4">
        <div
          className={`shrink-0 size-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${layerGradient} shadow-sm`}
        >
          <Icon name={item.icon} className="size-5 text-white" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-[var(--color-text-main)] mb-1 group-hover:text-[var(--color-primary)] transition-colors">
            <HighlightText text={title} query={searchQuery} />
          </h4>
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
            <HighlightText text={description} query={searchQuery} />
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Layer accordion card ───────────────────────────────────────────────── */

function LayerCard({ layer, isExpanded, onToggle, layerT, searchQuery, index }: LayerCardProps) {
  return (
    <ScrollReveal delay={index * 0.05}>
      <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-card-border)] overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">

        {/* ── Header ── */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          className="w-full flex items-center gap-4 p-5 sm:p-6 text-left transition-colors hover:bg-[var(--color-bg)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]/50"
        >
          {/* Layer number */}
          <div
            className={`shrink-0 size-12 rounded-2xl flex items-center justify-center bg-gradient-to-br ${layer.gradient} shadow-md`}
          >
            <Icon name={layer.icon} className="size-6 text-white" />
          </div>

          {/* Titles */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className={`text-xs font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r ${layer.gradient}`}
              >
                {layerT.number}
              </span>
              <h3 className="text-base sm:text-lg font-bold text-[var(--color-text-main)] truncate">
                <HighlightText text={layerT.title} query={searchQuery} />
              </h3>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 font-medium">
              <HighlightText text={layerT.subtitle} query={searchQuery} />
            </p>
          </div>

          {/* Item count badge */}
          <span className="hidden sm:flex shrink-0 items-center justify-center size-7 rounded-full bg-[var(--color-bg)] border border-[var(--color-card-border)] text-[10px] font-black text-[var(--color-text-muted)]">
            {layer.items.length}
          </span>

          {/* Chevron */}
          <ChevronDown
            className={`shrink-0 size-5 text-[var(--color-text-muted)] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>

        {/* ── Expanded body ── */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              key="body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="px-5 sm:px-6 pb-6 space-y-4">
                {/* Layer description */}
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed pt-1 border-t border-[var(--color-card-border)]">
                  <HighlightText text={layerT.description} query={searchQuery} />
                </p>

                {/* Sub-items — CSS grid: equal-height cards per row, no gaps */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
                  {layer.items.map((item, i) => {
                    const itemT = layerT.items?.[item.key];
                    if (!itemT) return null;
                    return (
                      <ItemCard
                        key={item.key}
                        item={item}
                        layerGradient={layer.gradient}
                        title={itemT.title}
                        description={itemT.description}
                        searchQuery={searchQuery}
                        index={i}
                      />
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ScrollReveal>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */

export default function InfrastructureClient({
  t,
  initialAutoCollapse = false,
  initialExpandedTopics = '',
}: InfrastructureClientProps) {
  const pt = (t as unknown as { infrastructure_page: InfraPageType }).infrastructure_page;

  const allLayerIds = INFRA_LAYERS.map(l => l.id);

  const {
    expandedIds,
    autoCollapse,
    handleToggle,
    handleExpandAll,
    handleCollapseAll,
    handleAutoCollapseChange,
    expandAllOnSearch,
  } = usePersistentExpandSet({
    initialAutoCollapse,
    initialExpandedTopics,
    cookieKeyItems: 'infra_expanded',
    cookieKeyAutoCollapse: 'infra_autocollapse',
    allIds: allLayerIds,
    defaultExpandAll: false,
  });

  const [searchQuery, setSearchQuery] = useState('');

  /* Expand all layers when the user types a query */
  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (q.trim()) expandAllOnSearch();
  };

  /* Filter layers: keep a layer if its title, subtitle, description,
     or any of its items' title/description matches the query */
  const filteredLayers = (() => {
    if (!searchQuery.trim()) return INFRA_LAYERS;
    const q = searchQuery.toLowerCase();
    return INFRA_LAYERS.filter(layer => {
      const lt = pt.layers?.[layer.id];
      if (!lt) return false;
      if (
        lt.title.toLowerCase().includes(q) ||
        lt.subtitle.toLowerCase().includes(q) ||
        lt.description.toLowerCase().includes(q)
      ) return true;
      return layer.items.some((item: { key: string; icon: string }) => {
        const it = lt.items?.[item.key];
        return (
          it?.title.toLowerCase().includes(q) ||
          it?.description.toLowerCase().includes(q)
        );
      });
    });
  })();

  const allExpanded = expandedIds.size >= filteredLayers.length && filteredLayers.length > 0;

  const onToggleAll = () => {
    if (allExpanded) handleCollapseAll();
    else handleExpandAll();
  };

  /* Toolbar button styles */
  const btnBase = 'p-2 rounded-xl border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/50';
  const btnActive = 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm';
  const btnInactive = 'border-[var(--color-card-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-text-main)]';

  return (
    <ContentHero
      brandName={pt.hero.brand}
      title={pt.hero.title}
      gradient="from-[var(--color-primary)] to-[var(--color-accent)]"
      heroPadding="pt-32 pb-4"
      subtitle={
        <p className="text-[var(--color-text-muted)] max-w-3xl mx-auto leading-relaxed text-center mb-8">
          {pt.hero.description}
        </p>
      }
    >
      {/* ── Controls ── */}
      <section className="pb-0">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12 mt-[-8px] space-y-4">

          {/* Search + toolbar row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1">
              <SearchBar
                value={searchQuery}
                onChange={handleSearch}
                placeholder={pt.controls.search_placeholder}
              />
            </div>

            {/* Expand / Collapse / Auto-collapse buttons */}
            <div className="flex items-center gap-1.5 shrink-0 justify-end">
              <button
                type="button"
                onClick={onToggleAll}
                title={allExpanded ? pt.controls.collapse_all : pt.controls.expand_all}
                className={`${btnBase} ${allExpanded ? btnActive : btnInactive}`}
              >
                {allExpanded
                  ? <FoldVertical className="size-4" />
                  : <UnfoldVertical className="size-4" />
                }
              </button>

              <AutoCollapseToggle
                autoCollapse={autoCollapse}
                onToggle={handleAutoCollapseChange}
                activeTitle={pt.controls.auto_collapse}
                inactiveTitle={pt.controls.auto_collapse}
                className="!rounded-xl"
              />

              {/* Results counter */}
              {searchQuery.trim() && (
                <span className="px-3 py-2 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)] text-xs font-bold text-[var(--color-text-muted)] whitespace-nowrap">
                  {filteredLayers.length === 1
                    ? pt.controls.results_one
                    : pt.controls.results_many.replace('{n}', String(filteredLayers.length))}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Layer list ── */}
      <section className="pt-6 pb-24">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12 space-y-4">

          {filteredLayers.map((layer, i) => {
            const layerT = pt.layers?.[layer.id];
            if (!layerT) return null;
            return (
              <LayerCard
                key={layer.id}
                layer={layer}
                isExpanded={expandedIds.has(layer.id)}
                onToggle={() => handleToggle(layer.id)}
                layerT={layerT}
                searchQuery={searchQuery}
                index={i}
              />
            );
          })}

          {filteredLayers.length === 0 && (
            <div className="text-center text-[var(--color-text-muted)] py-24 text-lg">
              {pt.controls.no_results}
            </div>
          )}
        </div>
      </section>
    </ContentHero>
  );
}
