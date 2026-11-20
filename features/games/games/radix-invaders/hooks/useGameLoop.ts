'use client';

import { useEffect, type RefObject } from 'react';
import {
  BOSS_INTERVAL,
  HI_SCORE_KEY,
  MAX_LEVEL,
  MAX_LIVES,
} from '../constants/radix-invaders.constants';
import { initGameState, updateGame } from '../services/engine';
import type { GameMode, GameState } from '../types/radix-invaders.types';
import { renderGameFrame } from '../utils/renderer';
import { dispatchSfx } from '../utils/sound';

export function loadHiScore(): number {
  try {
    return parseInt(localStorage.getItem(HI_SCORE_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function saveHiScore(v: number) {
  try {
    localStorage.setItem(HI_SCORE_KEY, String(v));
  } catch {
    // Storage may be unavailable in private browsing modes
  }
}

interface UseGameLoopParams {
  active: boolean;
  rebindKey: boolean;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  stateRef: RefObject<GameState | null>;
  keysRef: RefObject<Set<string>>;
  isMouseRef: RefObject<boolean>;
  mouseXRef: RefObject<number>;
  isMouseDownRef: RefObject<boolean>;
  isTouchingRef: RefObject<boolean>;
  clickRef: RefObject<boolean>;
  hiRef: RefObject<number>;
  modeRef: RefObject<GameMode>;
  bossRushRef: RefObject<boolean>;
  renderHRef: RefObject<number>;
  tRef: RefObject<Record<string, string>>;
  onClearClick: () => void;
  onUpdateState: (next: GameState) => void;
  onUpdateHi: (hi: number) => void;
  onVictory: (score: number) => void;
}

/**
 * Smooth native-refresh-rate game loop (60 / 120 / 144 / 240 Hz)
 * with stage-clear progression, visibility-aware hi-score persistence,
 * and dynamic mobile portrait height rendering.
 */
export function useGameLoop({
  active,
  rebindKey,
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
  onClearClick,
  onUpdateState,
  onUpdateHi,
  onVictory,
}: UseGameLoopParams) {
  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const BASE_FRAME_MS = 1000 / 60;
    let rafId = 0;
    let lastTime = performance.now();
    let lastStageLevel = 0;
    let hiDirty = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const flushHi = () => {
      if (hiDirty) {
        hiDirty = false;
        saveHiScore(hiRef.current);
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
        rafId = requestAnimationFrame(loop);
        return;
      }

      const deltaMs = Math.min(33.33, Math.max(0.5, now - lastTime));
      lastTime = now;
      const dt = deltaMs / BASE_FRAME_MS;

      const wantClick = clickRef.current || isTouchingRef.current || isMouseDownRef.current;

      const current = updateGame(
        s,
        keysRef.current,
        isMouseRef.current,
        mouseXRef.current,
        wantClick,
        onClearClick,
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
          onUpdateState(next);
        }, 80);
      }

      if (current.hiScore > hiRef.current) {
        onUpdateHi(current.hiScore);
        hiDirty = true;
      }
      if (hiDirty && current.screen !== 'PLAYING') flushHi();
      onUpdateState(current);

      if (current.screen === 'VICTORY') {
        flushHi();
        onVictory(current.score);
        return;
      }

      renderGameFrame(ctx, current, tRef.current, modeRef.current, renderHRef.current);
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      flushHi();
    };
  }, [
    active,
    rebindKey,
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
    onClearClick,
    onUpdateState,
    onUpdateHi,
    onVictory,
  ]);
}
