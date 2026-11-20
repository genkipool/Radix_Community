'use client';

import type { ReactNode } from 'react';

function SpeakerOnIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M2 5.5h2L8 2v12L4 10.5H2z" fill="currentColor" opacity="0.9" />
      <path d="M10 4.5c1.5 1 2.5 2.5 2.5 3.5S11.5 10.5 10 11.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M12 2.5c2.5 1.5 3.5 3.5 3.5 5.5S14.5 12 12 13.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function SpeakerOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M2 5.5h2L8 2v12L4 10.5H2z" fill="currentColor" opacity="0.5" />
      <path d="M11 6l3 4M14 6l-3 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <rect x="2.5" y="2" width="3.2" height="10" rx="1" fill="currentColor" />
      <rect x="8.3" y="2" width="3.2" height="10" rx="1" fill="currentColor" />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function HudIconButton({
  title,
  dimmed = false,
  large = false,
  onClick,
  children,
}: {
  title: string;
  dimmed?: boolean;
  large?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onTouchStart={(e) => e.stopPropagation()}
      title={title}
      aria-label={title}
      className={[
        'flex items-center justify-center cursor-pointer transition-colors duration-150',
        'bg-[rgba(4,14,34,0.85)] hover:bg-[rgba(0,229,255,0.2)]',
        'border border-white/20 hover:border-[rgba(0,229,255,0.55)]',
        dimmed ? 'text-white/30' : 'text-[rgba(0,229,255,0.9)]',
        large ? 'min-w-[36px] min-h-[32px] rounded-lg px-2 py-1' : 'min-w-[28px] min-h-[26px] rounded-md px-1 py-0.5',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function GameHudControls({
  muted,
  soundOnTitle,
  soundOffTitle,
  pauseTitle,
  exitTitle,
  variant = 'overlay',
  onToggleSound,
  onTogglePause,
  onExitTheater,
}: {
  muted: boolean;
  soundOnTitle: string;
  soundOffTitle: string;
  pauseTitle: string;
  exitTitle?: string;
  variant?: 'overlay' | 'bar';
  onToggleSound: () => void;
  onTogglePause: () => void;
  onExitTheater?: () => void;
}) {
  const isBar = variant === 'bar';
  return (
    <div
      className={isBar
        ? 'flex items-center gap-2'
        : 'absolute bottom-0 right-[14%] h-[3.7%] z-10 flex items-center gap-1.5'}
    >
      <HudIconButton
        title={muted ? soundOnTitle : soundOffTitle}
        dimmed={muted}
        large={isBar}
        onClick={onToggleSound}
      >
        {muted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
      </HudIconButton>
      <HudIconButton title={pauseTitle} large={isBar} onClick={onTogglePause}>
        <PauseIcon />
      </HudIconButton>
      {isBar && onExitTheater && exitTitle && (
        <HudIconButton title={exitTitle} large onClick={onExitTheater}>
          <ExitIcon />
        </HudIconButton>
      )}
    </div>
  );
}
