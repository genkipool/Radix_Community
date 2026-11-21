'use client';

import type { MouseEvent, RefObject, TouchEvent } from 'react';
import { CANVAS_H, CANVAS_W } from '../constants/radix-invaders.constants';
import { GameHudControls } from './GameHudControls';

interface GamePlayfieldProps {
  isMobilePortrait: boolean;
  theaterMode: boolean;
  soundMuted: boolean;
  isPaused: boolean;
  t: Record<string, string>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  playfieldWrapRef: RefObject<HTMLDivElement | null>;
  onTouchStart: (e: TouchEvent<HTMLElement>) => void;
  onTouchMove: (e: TouchEvent<HTMLElement>) => void;
  onTouchEnd: () => void;
  onMouseMove: (e: MouseEvent<HTMLCanvasElement>) => void;
  onMouseLeave: () => void;
  onMouseDown: () => void;
  onMouseUp: () => void;
  onCanvasClick: () => void;
  onToggleSound: () => void;
  onTogglePause: () => void;
  onReturnToMenu: () => void;
  onExitTheater: () => void;
}

export function GamePlayfield({
  isMobilePortrait,
  theaterMode,
  soundMuted,
  isPaused,
  t,
  canvasRef,
  playfieldWrapRef,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onMouseMove,
  onMouseLeave,
  onMouseDown,
  onMouseUp,
  onCanvasClick,
  onToggleSound,
  onTogglePause,
  onReturnToMenu,
  onExitTheater,
}: GamePlayfieldProps) {
  const canvasElement = (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onClick={onCanvasClick}
      style={{ touchAction: 'none', outline: 'none' }}
      className={
        isMobilePortrait
          ? 'w-full h-full object-contain block image-rendering-pixelated touch-none outline-none focus:outline-none focus-visible:outline-none'
          : 'w-full h-full block cursor-crosshair image-rendering-pixelated touch-none outline-none focus:outline-none focus-visible:outline-none'
      }
      tabIndex={0}
    />
  );

  const pauseMenuOverlay = isPaused ? (
    <div
      className="pointer-events-none absolute inset-x-0 z-20 flex justify-center"
      style={{ top: 'calc(50% + 66px)' }}
    >
      <button
        type="button"
        className="ri-pause-menu-btn pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onReturnToMenu();
        }}
      >
        <span className="ri-centered-label">{t.back_to_start ?? t.back_to_menu ?? ''}</span>
      </button>
    </div>
  ) : null;

  if (isMobilePortrait) {
    return (
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        className="flex-1 w-full h-full min-h-[360px] flex flex-col bg-[#010614] touch-none select-none"
      >
        <div
          className="h-11 shrink-0 flex items-center justify-between px-3 border-b border-[rgba(0,229,255,0.22)]"
          style={{
            background: 'linear-gradient(180deg, rgba(2,14,38,0.98) 0%, rgba(1,6,20,0.95) 100%)',
          }}
        >
          <span
            className="font-mono font-extrabold text-xs tracking-[0.14em] text-[#00e5ff]"
            style={{ textShadow: '0 0 8px rgba(0,229,255,0.45)' }}
          >
            {t.title ?? ''}
          </span>
          <GameHudControls
            variant="bar"
            muted={soundMuted}
            soundOnTitle={t.sound_on ?? ''}
            soundOffTitle={t.sound_off ?? ''}
            pauseTitle={t.pause_btn ?? ''}
            exitTitle={t.mobile_exit_theater ?? ''}
            onToggleSound={onToggleSound}
            onTogglePause={onTogglePause}
            onExitTheater={theaterMode ? onExitTheater : undefined}
          />
        </div>

        <div
          ref={playfieldWrapRef}
          className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden relative"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {canvasElement}
          {pauseMenuOverlay}
        </div>
      </div>
    );
  }

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      className="flex-1 w-full h-full min-h-[320px] flex items-center justify-center bg-[#010614] touch-none select-none"
      style={{ containerType: 'size' }}
    >
      <div
        style={{
          position: 'relative',
          width: `min(100cqw, calc(100cqh * ${CANVAS_W} / ${CANVAS_H}))`,
          maxWidth: '100%',
          maxHeight: '100%',
          aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
        }}
      >
        {canvasElement}
        {pauseMenuOverlay}
        <GameHudControls
          muted={soundMuted}
          soundOnTitle={t.sound_on ?? ''}
          soundOffTitle={t.sound_off ?? ''}
          pauseTitle={t.pause_btn ?? ''}
          onToggleSound={onToggleSound}
          onTogglePause={onTogglePause}
        />
      </div>
    </div>
  );
}
