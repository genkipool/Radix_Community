'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useLayout } from '@/context/LayoutContext';
import { getCookie, setCookie } from '@/utils/cookies';
import '../styles/radix-invaders.css';
import { type GameMode, type GameState } from '../types/radix-invaders.types';
import { CANVAS_W, MAX_LEVEL } from '../constants/radix-invaders.constants';
import { consumeContinue, initGameState } from '../services/engine';
import { dispatchSfx, setMuted } from '../utils/sound';
import { loadHiScore, useGameLoop } from '../hooks/useGameLoop';
import { useResponsiveCanvas } from '../hooks/useResponsiveCanvas';
import FunLevelSelectScreen, { snapToBossLevel } from './FunLevelSelectScreen';
import { AlienIntroScreen, BadgeScreen, IntroScreen } from './GameIntroScreens';
import { GamePlayfield } from './GamePlayfield';
import VictoryEndingScreen from './VictoryEndingScreen';

const COOKIE_MUTED = 'si_sound_muted';

type AppScreen =
  | 'INTRO'
  | 'FUN_LEVEL_SELECT'
  | 'ALIEN_INTRO'
  | 'BADGE_ACQUIRING'
  | 'BADGE_SUCCESS'
  | 'GAME'
  | 'VICTORY_ENDING';

export default function RadixInvadersGame() {
  const { t: dict, language } = useLanguage();
  const t = (dict.games.space_invaders ?? {}) as unknown as Record<string, string>;
  const tRef = useRef(t);
  useLayoutEffect(() => {
    tRef.current = t;
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playfieldWrapRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const mouseXRef = useRef<number>(CANVAS_W / 2);
  const isMouseRef = useRef<boolean>(false);
  const isMouseDownRef = useRef<boolean>(false);
  const isTouchingRef = useRef<boolean>(false);
  const clickRef = useRef<boolean>(false);
  const hiRef = useRef<number>(0);
  const modeRef = useRef<GameMode>('FUN');
  const pendingModeRef = useRef<GameMode>('FUN');
  const startLevelRef = useRef<number>(1);
  const bossRushRef = useRef<boolean>(false);
  const pausedAtRef = useRef<number>(0);
  const badgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [appScreen, setAppScreen] = useState<AppScreen>('INTRO');
  const [selectedFunLevel, setSelectedFunLevel] = useState(1);
  const [bossRush, setBossRush] = useState(false);
  const [victoryScore, setVictoryScore] = useState(0);
  const [badgeStep, setBadgeStep] = useState<'acquiring' | 'success'>('acquiring');
  const [soundMuted, setSoundMuted] = useState(() => {
    if (typeof document === 'undefined') return false;
    return getCookie(COOKIE_MUTED) === 'true';
  });

  const { theaterMode, setTheaterMode } = useLayout();
  const { isMobileRef, isMobilePortrait, renderHRef, getCanvasRect } = useResponsiveCanvas({
    active: appScreen === 'GAME',
    containerRef,
    canvasRef,
    playfieldWrapRef,
  });

  useEffect(() => {
    if (soundMuted) setMuted(true);
  }, [soundMuted]);

  useEffect(() => {
    return () => {
      if (badgeTimeoutRef.current) clearTimeout(badgeTimeoutRef.current);
    };
  }, []);

  const activateTheaterIfMobile = () => {
    if (isMobileRef.current) setTheaterMode(true);
  };

  const handleSoundToggle = () => {
    setSoundMuted((prev) => {
      const next = !prev;
      setMuted(next);
      setCookie(COOKIE_MUTED, String(next));
      return next;
    });
  };

  const togglePause = () => {
    const s = stateRef.current;
    if (!s) return;
    if (s.screen === 'PLAYING') {
      s.screen = 'PAUSED';
      pausedAtRef.current = performance.now();
      isMouseDownRef.current = false;
      isTouchingRef.current = false;
      clickRef.current = false;
    } else if (s.screen === 'PAUSED') {
      s.screen = 'PLAYING';
    }
  };

  const restartCurrentRun = () => {
    const fresh = initGameState(modeRef.current === 'FUN' ? startLevelRef.current : 1, hiRef.current);
    fresh.mode = modeRef.current;
    isMouseRef.current = false;
    mouseXRef.current = CANVAS_W / 2;
    stateRef.current = fresh;
  };

  const handleOverlayAction = (s: GameState | null): boolean => {
    if (!s) return true;
    if (s.screen === 'CONTINUE') {
      if (consumeContinue(s) && s.sfx.length > 0) dispatchSfx(s.sfx);
      return true;
    }
    if (s.screen === 'GAME_OVER' || s.screen === 'VICTORY') {
      restartCurrentRun();
      return true;
    }
    if (s.screen === 'PAUSED') {
      if (performance.now() - pausedAtRef.current > 280) s.screen = 'PLAYING';
      return true;
    }
    return false;
  };

  const startGame = (mode: GameMode, level = 1) => {
    hiRef.current = loadHiScore();
    modeRef.current = mode;
    pendingModeRef.current = mode;
    const effectiveLevel = mode === 'FUN' ? Math.max(1, Math.min(MAX_LEVEL, level)) : 1;
    startLevelRef.current = effectiveLevel;
    isMouseRef.current = false;
    isMouseDownRef.current = false;
    isTouchingRef.current = false;
    clickRef.current = false;
    keysRef.current.clear();
    mouseXRef.current = CANVAS_W / 2;
    const gs = initGameState(effectiveLevel, hiRef.current);
    gs.mode = mode;
    stateRef.current = gs;
    setAppScreen('GAME');
  };

  const handleAlienIntroReady = () => {
    startGame(pendingModeRef.current, pendingModeRef.current === 'FUN' ? startLevelRef.current : 1);
  };

  const handleTournament = () => {
    activateTheaterIfMobile();
    startLevelRef.current = 1;
    bossRushRef.current = false;
    setAppScreen('BADGE_ACQUIRING');
    setBadgeStep('acquiring');
    if (badgeTimeoutRef.current) clearTimeout(badgeTimeoutRef.current);
    badgeTimeoutRef.current = setTimeout(() => setBadgeStep('success'), 2200);
  };

  const handleBadgePlay = () => {
    activateTheaterIfMobile();
    pendingModeRef.current = 'TOURNAMENT';
    startLevelRef.current = 1;
    bossRushRef.current = false;
    setAppScreen('ALIEN_INTRO');
  };

  const handleFun = () => {
    setAppScreen('FUN_LEVEL_SELECT');
  };

  const handleSetBossRush = (enabled: boolean) => {
    setBossRush(enabled);
    if (enabled) setSelectedFunLevel((lvl) => snapToBossLevel(lvl));
  };

  const handleFunStartLevel = () => {
    activateTheaterIfMobile();
    pendingModeRef.current = 'FUN';
    bossRushRef.current = bossRush;
    startLevelRef.current = bossRush ? snapToBossLevel(selectedFunLevel) : selectedFunLevel;
    setAppScreen('ALIEN_INTRO');
  };

  const handleVictory = (score: number) => {
    setVictoryScore(score);
    setAppScreen('VICTORY_ENDING');
  };

  useGameLoop({
    active: appScreen === 'GAME',
    rebindKey: isMobilePortrait,
    canvasRef,
    stateRef,
    keysRef,
    isMouseRef,
    mouseXRef,
    isMouseDownRef,
    isTouchingRef,
    clickRef,
    hiRef,
    modeRef,
    bossRushRef,
    renderHRef,
    tRef,
    onClearClick: () => { clickRef.current = false; },
    onUpdateState: (next) => { stateRef.current = next; },
    onUpdateHi: (hi) => { hiRef.current = hi; },
    onVictory: handleVictory,
  });

  // ── Keyboard ────────────────────────────────────────────────────
  useEffect(() => {
    if (appScreen !== 'GAME') return;
    const onDown = (e: KeyboardEvent) => {
      const isPauseKey = e.code === 'KeyP' || e.key === 'p' || e.key === 'P' || e.code === 'Escape';
      if (isPauseKey) {
        e.preventDefault();
        if (!e.repeat) togglePause();
        return;
      }

      keysRef.current.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'ArrowDown'].includes(e.code)) {
        if (e.code.startsWith('Arrow')) isMouseRef.current = false;
        e.preventDefault();
      }
      const s = stateRef.current;
      if (!s) return;
      if (e.code === 'Space' && s.screen === 'CONTINUE') {
        if (consumeContinue(s) && s.sfx.length > 0) dispatchSfx(s.sfx);
        return;
      }
      if (e.code === 'Space' && (s.screen === 'GAME_OVER' || s.screen === 'VICTORY')) {
        restartCurrentRun();
      }
    };
    const onUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [appScreen]);

  // ── Canvas pointer/touch handlers ───────────────────────────────
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = getCanvasRect();
    if (!rect) return;
    mouseXRef.current = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    isMouseRef.current = true;
  };

  const handleTouch = (e: React.TouchEvent<HTMLElement>) => {
    const rect = getCanvasRect();
    if (!rect || e.touches.length === 0) return;
    const touch = e.touches[0];
    mouseXRef.current = Math.max(0, Math.min(CANVAS_W, (touch.clientX - rect.left) * (CANVAS_W / rect.width)));
    isMouseRef.current = true;
    isTouchingRef.current = true;
    handleOverlayAction(stateRef.current);
  };

  const handleTouchEnd = () => { isTouchingRef.current = false; };
  const handleMouseLeave = () => { isMouseRef.current = false; isMouseDownRef.current = false; };
  const handleMouseDown = () => { isMouseDownRef.current = true; };
  const handleMouseUp = () => { isMouseDownRef.current = false; };

  const handleCanvasClick = () => {
    if (!handleOverlayAction(stateRef.current)) {
      clickRef.current = true;
    }
  };

  return (
    <div ref={containerRef} className="flex-1 w-full h-full min-h-0 flex flex-col">
      {appScreen === 'INTRO' ? (
        <IntroScreen
          t={t}
          lang={language}
          onTournament={handleTournament}
          onFun={handleFun}
        />
      ) : appScreen === 'VICTORY_ENDING' ? (
        <VictoryEndingScreen
          t={t}
          score={victoryScore}
          onPlayAgain={() => startGame(modeRef.current, modeRef.current === 'FUN' ? startLevelRef.current : 1)}
          onBackToMenu={() => setAppScreen('INTRO')}
        />
      ) : appScreen === 'FUN_LEVEL_SELECT' ? (
        <FunLevelSelectScreen
          t={t}
          level={selectedFunLevel}
          bossRush={bossRush}
          onChangeLevel={setSelectedFunLevel}
          onSetBossRush={handleSetBossRush}
          onStart={handleFunStartLevel}
          onBack={() => setAppScreen('INTRO')}
        />
      ) : appScreen === 'ALIEN_INTRO' ? (
        <AlienIntroScreen t={t} onReady={handleAlienIntroReady} />
      ) : appScreen === 'BADGE_ACQUIRING' || appScreen === 'BADGE_SUCCESS' ? (
        <BadgeScreen t={t} step={badgeStep} onPlay={handleBadgePlay} />
      ) : (
        <GamePlayfield
          isMobilePortrait={isMobilePortrait}
          theaterMode={theaterMode}
          soundMuted={soundMuted}
          t={t}
          canvasRef={canvasRef}
          playfieldWrapRef={playfieldWrapRef}
          onTouchStart={handleTouch}
          onTouchMove={handleTouch}
          onTouchEnd={handleTouchEnd}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onCanvasClick={handleCanvasClick}
          onToggleSound={handleSoundToggle}
          onTogglePause={togglePause}
          onExitTheater={() => setTheaterMode(false)}
        />
      )}
    </div>
  );
}
