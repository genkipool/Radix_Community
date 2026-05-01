'use client';

import { Zap, Layers, Brain, Trophy, Car, Map, Sword, Puzzle } from 'lucide-react';
import { ReactNode } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import type { Dictionary } from '@/i18n';
import { GAME_CATEGORIES, GAMES } from '../data/gamesData';
import { type GameCategory, type GamesSidebarProps } from '../types';
import SidebarLayout from '@/components/layout/SidebarLayout';
import { SidebarGraphic } from '@/components/ui/SidebarGraphic';
import { SearchBar } from '@/components/ui/SearchBar';
import { SidebarControls } from '@/components/ui/SidebarControls';
import { SidebarCard, type SidebarCardItem } from '@/components/ui/SidebarCard';

const ICON_MAP: Record<string, ReactNode> = {
    Zap: <Zap className="w-5 h-5" />,
    Layers: <Layers className="w-5 h-5" />,
    Brain: <Brain className="w-5 h-5" />,
    Trophy: <Trophy className="w-5 h-5" />,
    Car: <Car className="w-5 h-5" />,
    Map: <Map className="w-5 h-5" />,
    Sword: <Sword className="w-5 h-5" />,
    Puzzle: <Puzzle className="w-5 h-5" />,
};


export default function GamesSidebar({
    selectedGameId, onSelectGame,
    expandedCategories, onCategoryToggle, onExpandAll, onCollapseAll,
    autoCollapse, onAutoCollapseChange,
    searchQuery, onSearchQueryChange,
    gridView, onGridViewToggle,
    theaterMode, onTheaterModeToggle,
    dictionary,
}: GamesSidebarProps & { dictionary?: Partial<Dictionary> }) {
    const { t: dict } = useLanguage();
    const t = dictionary?.games || dict?.games || {};
    const categoriesT = (t.categories ?? {}) as Record<string, string>;
    const titles = (t.titles ?? {}) as Record<string, string>;
    const sidebarT = (t.sidebar ?? {}) as Record<string, string>;
    const svgText = (t.svg ?? {}) as Record<string, string>;

    const filteredCategories = (() => {
        if (!searchQuery.trim()) return GAME_CATEGORIES;
        const q = searchQuery.toLowerCase();
        return GAME_CATEGORIES.map(cat => {
            const catLabel = (categoriesT[cat.labelKey] ?? cat.labelKey).toLowerCase();
            const matchingGames = cat.games.filter(g =>
                (titles[g.titleKey] ?? g.titleKey).toLowerCase().includes(q)
            );
            if (catLabel.includes(q)) return cat;
            if (matchingGames.length > 0) return { ...cat, games: matchingGames };
            return null;
        }).filter(Boolean) as GameCategory[];
    })();

    // All games flat for grid view
    const allGames = GAMES;

    const hasAnyExpanded = expandedCategories.size > 0;

    const header = (
        <SidebarGraphic
            appName={svgText.appName ?? 'Radix · Play to Earn'}
            title={svgText.gamesTitle ?? 'Radix Games'}
            subtitle={svgText.gamesSubtitle ?? 'Juega · Compite · Gana XRD'}
            badgeLabel={svgText.games ?? 'GAMES'}
            idPrefix="games"
            variant="games"
        />
    );

    const searchBar = (
        <SearchBar variant="sidebar"
            value={searchQuery}
            onChange={onSearchQueryChange}
            placeholder={t.searchPlaceholder ?? 'Search games...'}
        />
    );

    const controls = (
        <SidebarControls
            hasAnyExpanded={hasAnyExpanded}
            autoCollapse={autoCollapse}
            onExpandAll={onExpandAll}
            onCollapseAll={onCollapseAll}
            onAutoCollapseChange={onAutoCollapseChange}
            collapseAllLabel={sidebarT.collapse_all ?? 'Collapse all'}
            expandAllLabel={sidebarT.expand_all ?? 'Expand all'}
            gridView={gridView}
            onGridViewToggle={onGridViewToggle}
            gridViewTitle={sidebarT.grid_view ?? 'Grid view'}
            theaterMode={theaterMode}
            onTheaterModeToggle={onTheaterModeToggle}
            theaterModeTitle={sidebarT.theater_mode ?? 'Theater mode'}
        />
    );

    return (
        <SidebarLayout
            header={header}
            searchBar={searchBar}
            controls={controls}
            onHeaderClick={() => onSelectGame(null)}
            headerAriaLabel={sidebarT.home_aria ?? 'Go to games home'}
            heightOffset={80}
        >
            {gridView ? (
                /* Grid view: all games as cards */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, paddingTop: 4 }}>
                    {allGames
                        .filter(g => !searchQuery.trim() || (titles[g.titleKey] ?? g.titleKey).toLowerCase().includes(searchQuery.toLowerCase()))
                        .map(game => {
                            const label = titles[game.titleKey] ?? game.titleKey;
                            const isSelected = game.id === selectedGameId;
                            return (
                                <button
                                    key={game.id}
                                    onClick={() => onSelectGame(game.id)}
                                    style={{
                                        background: isSelected ? 'var(--color-primary)' : 'var(--color-surface)',
                                        border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-card-border)'}`,
                                        borderRadius: 10,
                                        padding: '10px 8px',
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        transition: 'all 0.15s ease',
                                    }}
                                    onMouseEnter={e => { if (!isSelected) { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-primary)'; } }}
                                    onMouseLeave={e => { if (!isSelected) { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-card-border)'; } }}
                                >
                                    <div className={`w-8 h-8 mx-auto mb-1.5 rounded-lg bg-gradient-to-br ${game.thumbnailGradient} flex items-center justify-center`}>
                                        <Zap className="w-4 h-4 text-white opacity-80" />
                                    </div>
                                    <p style={{ fontSize: 11, fontWeight: 600, color: isSelected ? 'var(--color-bg)' : 'var(--color-text-main)', lineHeight: 1.2, margin: 0 }}>
                                        {label}
                                    </p>
                                    {game.featured && (
                                        <span style={{ display: 'inline-block', marginTop: 3, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', padding: '1px 5px', borderRadius: 4, background: isSelected ? 'rgba(0,0,0,0.2)' : 'var(--color-primary)', color: isSelected ? 'white' : 'white', opacity: 0.85 }}>
                                            TOP
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                </div>
            ) : (
                /* Normal category list */
                <div className="space-y-3 pt-0">
                    {filteredCategories.map(cat => {
                        const catLabel = categoriesT[cat.labelKey] ?? cat.labelKey;
                        const isExpanded = expandedCategories.has(cat.id);
                        const hasSelected = cat.games.some(g => g.id === selectedGameId);
                        const items: SidebarCardItem[] = cat.games.map(game => ({
                            id: game.id,
                            label: titles[game.titleKey] ?? game.titleKey,
                            isSelected: game.id === selectedGameId,
                            badge: game.featured ? (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: 'var(--color-primary)', color: 'white', opacity: 0.85 }}>
                                    {t.featured_badge ?? 'TOP'}
                                </span>
                            ) : undefined,
                        }));
                        const headerBadge = (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0" style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-card-border)' }}>
                                {cat.games.length}
                            </span>
                        );
                        return (
                            <SidebarCard
                                key={cat.id}
                                id={cat.id}
                                icon={ICON_MAP[cat.iconName] ?? <Zap className="w-5 h-5" />}
                                gradient={cat.gradient}
                                title={catLabel}
                                searchQuery={searchQuery}
                                isExpanded={isExpanded}
                                hasSelectedItem={hasSelected}
                                headerBadge={headerBadge}
                                onToggle={() => onCategoryToggle(cat.id)}
                                items={items}
                                onSelectItem={id => onSelectGame(id)}
                            />
                        );
                    })}
                    {filteredCategories.length === 0 && (
                        <p className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                            {t.noResults ?? 'No results for'} &ldquo;{searchQuery}&rdquo;
                        </p>
                    )}
                </div>
            )}
        </SidebarLayout>
    );
}
