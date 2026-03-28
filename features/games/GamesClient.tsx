'use client';

import { useEffect, useState } from 'react';
import GamesSidebar from './components/GamesSidebar';
import GamesHero from './components/GamesHero';
import GamePlayer from './components/GamePlayer';
import LeaderboardSidebar from './components/LeaderboardSidebar';
import { getGameById, GAME_CATEGORIES } from './data/gamesData';
import { useLanguage } from '@/context/LanguageContext';
import { useLayout } from '@/context/LayoutContext';
import { setCookie } from '@/utils/cookies';
import { usePersistentExpandSet } from '@/hooks/usePersistentExpandSet';
import { useSpeedSyncURL } from '@/hooks/useSpeedSyncURL';

const COOKIE_THEATER_MODE = 'games_theater_mode';
const COOKIE_GRID_VIEW = 'games_grid_view';
import { GamesClientProps } from './types';

/* ── Exit Theater button icon ── */
function ExitTheaterButtonIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="1.5" y="4.5" width="15" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M5.5 11L9 8.5L12.5 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="9" cy="6.5" r="1.3" fill="currentColor" />
        </svg>
    );
}

function CloseIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
    );
}

export default function GamesClient({
    initialAutoCollapse = false,
    initialExpandedTopics = '',
    initialGridView = false,
    initialTheaterMode = false,
}: GamesClientProps) {
    const [selectedGameId, setGame] = useSpeedSyncURL<string>('game');
    
    const { t: dict } = useLanguage();
    const { theaterMode, setTheaterMode } = useLayout();
    const t = dict.games;

    const selectedGame = selectedGameId ? getGameById(selectedGameId) : null;
    const allCategoryIds = GAME_CATEGORIES.map(c => c.id);

    const [searchQuery, setSearchQuery] = useState('');
    const [gridView, setGridView] = useState(initialGridView);

    /* ── Shared expand/collapse + cookie persistence ── */
    const {
        expandedIds: expandedCategories,
        autoCollapse,
        handleToggle: handleCategoryToggle,
        handleExpandAll,
        handleCollapseAll,
        handleAutoCollapseChange,
        expandAllOnSearch,
    } = usePersistentExpandSet({
        cookieKeyItems: 'games_expanded_cats',
        cookieKeyAutoCollapse: 'games_auto_collapse',
        allIds: allCategoryIds,
        defaultExpandAll: true,
        initialAutoCollapse,
        initialExpandedTopics,
    });

    /* Restore theater mode from cookies (LayoutContext doesn't handle initialization) */    useEffect(() => {
        if (initialTheaterMode) setTheaterMode(true);
    }, [initialTheaterMode, setTheaterMode]);

    /* Scroll to top when a game is selected */
    useEffect(() => {
        if (selectedGameId) window.scrollTo({ top: 0, behavior: 'instant' });
    }, [selectedGameId]);

    const handleSearchQueryChange = (q: string) => {
        setSearchQuery(q);
        if (q.trim()) expandAllOnSearch();
    };

    const handleGridViewToggle = () => {
        setGridView(v => {
            const next = !v;
            setCookie(COOKIE_GRID_VIEW, String(next));
            return next;
        });
    };

    const handleTheaterToggle = () => {
        setTheaterMode((prev: boolean) => {
            const next = !prev;
            setCookie(COOKIE_THEATER_MODE, String(next));
            return next;
        });
    };

    const gameTitles = (t.titles ?? {}) as Record<string, string>;
    const gameTitle = selectedGame ? (gameTitles[selectedGame.titleKey] ?? selectedGame.titleKey) : '';

    return (
        <>
            {theaterMode && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 40, pointerEvents: 'none' }}
                    aria-hidden="true"
                />
            )}

            <div
                className="flex flex-col md:flex-row w-full"
                style={{
                    background: 'var(--color-bg)',
                    minHeight: '100vh',
                    paddingTop: theaterMode ? 0 : '80px',
                    position: 'relative',
                    zIndex: theaterMode ? 41 : undefined,
                }}
            >
                {!theaterMode && (
                    <GamesSidebar
                        selectedGameId={selectedGameId}
                        onSelectGame={setGame}
                        expandedCategories={expandedCategories}
                        onCategoryToggle={handleCategoryToggle}
                        onExpandAll={handleExpandAll}
                        onCollapseAll={handleCollapseAll}
                        autoCollapse={autoCollapse}
                        onAutoCollapseChange={handleAutoCollapseChange}
                        searchQuery={searchQuery}
                        onSearchQueryChange={handleSearchQueryChange}
                        gridView={gridView}
                        onGridViewToggle={handleGridViewToggle}
                        theaterMode={theaterMode}
                        onTheaterModeToggle={handleTheaterToggle}
                    />
                )}

                <main
                    className="flex-1 relative min-w-0 flex flex-col"
                    style={{ overflowX: 'clip', minHeight: 0 }}
                >
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        {selectedGame ? (
                            <GamePlayer game={selectedGame} />
                        ) : (
                            <GamesHero onSelectGame={setGame} collapsed={false} />
                        )}
                    </div>

                    {theaterMode && (
                        <>
                        {/* Top exit button for mobile/accessibility */}
                        <button
                            onClick={handleTheaterToggle}
                            style={{
                                position: 'absolute',
                                top: 20,
                                right: 20,
                                zIndex: 60,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 44,
                                height: 44,
                                borderRadius: '50%',
                                background: 'rgba(0,0,0,0.6)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                color: 'rgba(255,255,255,0.85)',
                                cursor: 'pointer',
                                backdropFilter: 'blur(8px)',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            }}
                            onMouseEnter={e => {
                                const b = e.currentTarget as HTMLButtonElement;
                                b.style.background = 'rgba(255,59,48,0.2)';
                                b.style.borderColor = 'rgba(255,59,48,0.5)';
                                b.style.color = '#ff3b30';
                            }}
                            onMouseLeave={e => {
                                const b = e.currentTarget as HTMLButtonElement;
                                b.style.background = 'rgba(0,0,0,0.6)';
                                b.style.borderColor = 'rgba(255,255,255,0.2)';
                                b.style.color = 'rgba(255,255,255,0.85)';
                            }}
                            title={((t.sidebar as Record<string, string>)?.exit_theater) ?? 'Exit theater'}
                        >
                            <CloseIcon />
                        </button>

                        <button
                            onClick={handleTheaterToggle}
                            style={{
                                position: 'absolute',
                                bottom: 20,
                                right: 20,
                                zIndex: 50,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '10px 16px',
                                borderRadius: 10,
                                fontSize: 13,
                                fontWeight: 600,
                                background: 'rgba(0,0,0,0.75)',
                                border: '1px solid rgba(255,255,255,0.18)',
                                color: 'rgba(255,255,255,0.8)',
                                cursor: 'pointer',
                                backdropFilter: 'blur(12px)',
                                transition: 'all 0.15s ease',
                                letterSpacing: '0.03em',
                            }}
                            onMouseEnter={e => {
                                const b = e.currentTarget as HTMLButtonElement;
                                b.style.background = 'rgba(0,229,255,0.12)';
                                b.style.borderColor = 'rgba(0,229,255,0.5)';
                                b.style.color = '#00e5ff';
                            }}
                            onMouseLeave={e => {
                                const b = e.currentTarget as HTMLButtonElement;
                                b.style.background = 'rgba(0,0,0,0.75)';
                                b.style.borderColor = 'rgba(255,255,255,0.18)';
                                b.style.color = 'rgba(255,255,255,0.8)';
                            }}
                            title={((t.sidebar as Record<string, string>)?.exit_theater) ?? 'Exit theater'}
                        >
                            <ExitTheaterButtonIcon />
                            {((t.sidebar as Record<string, string>)?.exit_theater) ?? 'Exit theater'}
                        </button>
                        </>
                    )}
                </main>

                {selectedGame && !theaterMode && (
                    <LeaderboardSidebar gameTitle={gameTitle} />
                )}
            </div>
        </>
    );
}
