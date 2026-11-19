'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useLayout } from '@/context/LayoutContext';
import { getCookie, setCookie } from '@/utils/cookies';
import '../styles/radix-invaders.css';
import { type GameMode, type GameState, type SfxEvent } from '../types/radix-invaders.types';
import {
  BOSS_INTERVAL,
  CANVAS_H,
  CANVAS_W,
  HI_SCORE_KEY,
  MAX_LEVEL,
  MAX_LIVES,
} from '../constants/radix-invaders.constants';
import { consumeContinue, initGameState, updateGame } from '../services/engine';
import { renderGameFrame } from '../utils/renderer';
import {
  playShoot, playAlienDie, playUFOAppear, playUFODie,
  playPlayerDie, playShieldHit, playStageClear, playGameOver, playVictory,
  playTimeBonus, playPowerUp, playExtraLife, playBossWarning, playBossHit,
  playBossDie, playAlienStep, setMuted,
} from '../utils/sound';
import FunLevelSelectScreen, { snapToBossLevel } from './FunLevelSelectScreen';
import { GameHudControls } from './GameHudControls';
import { AlienIntroScreen, BadgeScreen, IntroScreen } from './GameIntroScreens';
import VictoryEndingScreen from './VictoryEndingScreen';

const COOKIE_MUTED = 'si_sound_muted';

function loadHi(): number {
  try { return parseInt(localStorage.getItem(HI_SCORE_KEY) ?? '0', 10) || 0; } catch { return 0; }
}
function saveHi(v: number) {
  try { localStorage.setItem(HI_SCORE_KEY, String(v)); } catch { }
}

function dispatchSfx(events: SfxEvent[]) {
  for (const e of events) {
    switch (e.type) {
      case 'shoot': playShoot(e.kind); break;
      case 'alien_die': playAlienDie(e.alienType); break;
      case 'ufo_appear': playUFOAppear(); break;
      case 'ufo_die': playUFODie(); break;
      case 'player_die': playPlayerDie(); break;
      case 'shield_hit': playShieldHit(); break;
      case 'stage_clear': playStageClear(); break;
      case 'game_over': playGameOver(); break;
      case 'victory': playVictory(); break;
      case 'time_bonus': playTimeBonus(); break;
      case 'power_up': playPowerUp(); break;
      case 'extra_life': playExtraLife(); break;
      case 'boss_warning': playBossWarning(); break;
      case 'boss_hit': playBossHit(); break;
      case 'boss_die': playBossDie(); break;
      case 'alien_step': playAlienStep(e.tick); break;
    }
  }
}

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
  const stateRef = useRef<GameState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const mouseXRef = useRef<number>(CANVAS_W / 2);
  const isMouseRef = useRef<boolean>(false);
  const isMouseDownRef = useRef<boolean>(false);
  const isTouchingRef = useRef<boolean>(false);
  const clickRef = useRef<boolean>(false);
  const rafRef = useRef<number>(0);
  const hiRef = useRef<number>(0);
  const modeRef = useRef<GameMode>('FUN');
  const pendingModeRef = useRef<GameMode>('FUN');
  const startLevelRef = useRef<number>(1);
  const bossRushRef = useRef<boolean>(false);
  const pausedAtRef = useRef<number>(0);
  const canvasRectRef = useRef<DOMRect | null>(null);
  const isMobileRef = useRef(false);

  const [appScreen, setAppScreen] = useState<AppScreen>('INTRO');
  const [selectedFunLevel, setSelectedFunLevel] = useState(1);
  const [bossRush, setBossRush] = useState(false);
  const [victoryScore, setVictoryScore] = useState(0);
  const [badgeStep, setBadgeStep] = useState<'acquiring' | 'success'>('acquiring');
  const [soundMuted, setSoundMuted] = useState(() => {
    if (typeof document === 'undefined') return false;
    return getCookie(COOKIE_MUTED) === 'true';
  });

  const { setTheaterMode } = useLayout();

  useEffect(() => {
    isMobileRef.current = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }, []);

  useEffect(() => {
    if (soundMuted) setMuted(true);
  }, [soundMuted]);

  // Cache canvas bounding rect on resize/scroll so pointer/touch handlers never trigger layout reflow
  useEffect(() => {
    if (appScreen !== 'GAME') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateRect = () => {
      canvasRectRef.current = canvas.getBoundingClientRect();
    };
    updateRect();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateRect) : null;
    ro?.observe(canvas);
    window.addEventListener('resize', updateRect, { passive: true });
    window.addEventListener('scroll', updateRect, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect);
      canvasRectRef.current = null;
    };
  }, [appScreen]);

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

  const startGame = (mode: GameMode, level = 1) => {
    hiRef.current = loadHi();
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
    setTimeout(() => setBadgeStep('success'), 2200);
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

  // ── Keyboard ────────────────────────────────────────────────────
  useEffect(() => {
    if (appScreen !== 'GAME') return;
    const onDown = (e: KeyboardEvent) => {
      const isPauseKey = e.code === 'KeyP' || e.key === 'p' || e.key === 'P' || e.code === 'Escape';
      if (isPauseKey) {
        e.preventDefault();
        if (e.repeat) return;
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
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, [appScreen]);

  // ── Canvas pointer/touch handlers ───────────────────────────────
  const getCanvasRect = (): DOMRect | null => {
    if (canvasRectRef.current && canvasRectRef.current.width > 0) return canvasRectRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    canvasRectRef.current = rect;
    return rect;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = getCanvasRect();
    if (!rect) return;
    mouseXRef.current = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    isMouseRef.current = true;
  };

  const handleTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const rect = getCanvasRect();
    if (!rect || e.touches.length === 0) return;
    const touch = e.touches[0];
    mouseXRef.current = (touch.clientX - rect.left) * (CANVAS_W / rect.width);
    isMouseRef.current = true;
    isTouchingRef.current = true;
    const s = stateRef.current;
    if (s?.screen === 'CONTINUE') {
      if (consumeContinue(s) && s.sfx.length > 0) dispatchSfx(s.sfx);
    } else if (s?.screen === 'GAME_OVER' || s?.screen === 'VICTORY') {
      restartCurrentRun();
    } else if (s?.screen === 'PAUSED' && performance.now() - pausedAtRef.current > 280) {
      s.screen = 'PLAYING';
    }
  };

  const handleTouchEnd = () => { isTouchingRef.current = false; };
  const handleMouseLeave = () => { isMouseRef.current = false; isMouseDownRef.current = false; };
  const handleMouseDown = () => { isMouseDownRef.current = true; };
  const handleMouseUp = () => { isMouseDownRef.current = false; };

  const handleCanvasClick = () => {
    const s = stateRef.current;
    if (!s) return;
    if (s.screen === 'CONTINUE') {
      if (consumeContinue(s) && s.sfx.length > 0) dispatchSfx(s.sfx);
      return;
    }
    if (s.screen === 'GAME_OVER' || s.screen === 'VICTORY') {
      restartCurrentRun();
      return;
    }
    if (s.screen === 'PAUSED') {
      if (performance.now() - pausedAtRef.current > 280) s.screen = 'PLAYING';
      return;
    }
    clickRef.current = true;
  };

  // ── Smooth native-refresh-rate game loop (60 / 120 / 144 / 240 Hz) ──
  useEffect(() => {
    if (appScreen !== 'GAME') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const BASE_FRAME_MS = 1000 / 60;
    let lastTime = performance.now();
    let lastStageLevel = 0;
    let hiDirty = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const flushHi = () => {
      if (hiDirty) {
        hiDirty = false;
        saveHi(hiRef.current);
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) flushHi();
      else lastTime = performance.now();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const loop = (now: number) => {
      const s = stateRef.current;
      if (!s) {
        lastTime = now;
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const deltaMs = Math.min(33.33, Math.max(0.5, now - lastTime));
      lastTime = now;
      const dt = deltaMs / BASE_FRAME_MS;

      if (isTouchingRef.current || isMouseDownRef.current) clickRef.current = true;

      const current = updateGame(
        s,
        keysRef.current,
        isMouseRef.current,
        mouseXRef.current,
        clickRef.current,
        () => { clickRef.current = false; },
        dt,
      );
      if (current.sfx.length > 0) dispatchSfx(current.sfx);

      if (current.screen !== 'STAGE_CLEAR') lastStageLevel = 0;

      if (current.screen === 'STAGE_CLEAR' && current.stageTimer <= 0 && lastStageLevel !== current.level) {
        lastStageLevel = current.level;
        const isRush = modeRef.current === 'FUN' && bossRushRef.current;
        const nextLevel = isRush ? Math.min(MAX_LEVEL, current.level + BOSS_INTERVAL) : current.level + 1;
        const carryHi = current.hiScore;
        const carryScore = current.score;
        const carryLives = isRush ? Math.min(MAX_LIVES, current.lives + 1) : current.lives;
        const carryStars = current.stars;
        const carryShield = current.player.hasShield;
        const carryContinues = current.continues;
        timeoutId = setTimeout(() => {
          const next = initGameState(nextLevel, carryHi, carryScore, carryLives, carryStars, carryShield, carryContinues);
          next.mode = modeRef.current;
          if (next.sfx.length > 0) dispatchSfx(next.sfx);
          stateRef.current = next;
        }, 80);
      }

      if (current.hiScore > hiRef.current) {
        hiRef.current = current.hiScore;
        hiDirty = true;
      }
      if (hiDirty && current.screen !== 'PLAYING') flushHi();
      stateRef.current = current;

      if (current.screen === 'VICTORY') {
        flushHi();
        setVictoryScore(current.score);
        setAppScreen('VICTORY_ENDING');
        return;
      }

      renderGameFrame(ctx, current, tRef.current, modeRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      flushHi();
    };
  }, [appScreen]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
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
        <div style={{ width: '100%', height: '100%', containerType: 'size', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#010614' }}>
          <div style={{
            position: 'relative',
            width: `min(100cqw, calc(100cqh * ${CANVAS_W} / ${CANVAS_H}))`,
            aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
          }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onClick={handleCanvasClick}
              onTouchStart={handleTouch}
              onTouchMove={handleTouch}
              onTouchEnd={handleTouchEnd}
              style={{ touchAction: 'none' }}
              className="w-full h-full block cursor-crosshair image-rendering-pixelated touch-none"
              tabIndex={0}
            />
            <GameHudControls
              muted={soundMuted}
              pauseTitle={t.pause_btn ?? ''}
              onToggleSound={handleSoundToggle}
              onTogglePause={togglePause}
            />
          </div>
        </div>
      )}
    </div>
  );
}
