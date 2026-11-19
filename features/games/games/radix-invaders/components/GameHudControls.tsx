'use client';

import { useState, type ReactNode } from 'react';

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

function HudIconButton({
  title,
  dimmed = false,
  onClick,
  children,
}: {
  title: string;
  dimmed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={title}
      aria-label={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 22, borderRadius: 5, padding: 0,
        background: hovered ? 'rgba(0,229,255,0.2)' : 'rgba(4,14,34,0.85)',
        border: `1px solid ${hovered ? 'rgba(0,229,255,0.55)' : 'rgba(255,255,255,0.18)'}`,
        color: dimmed ? 'rgba(255,255,255,0.3)' : 'rgba(0,229,255,0.9)',
        cursor: 'pointer',
        transition: 'background 0.15s ease, border-color 0.15s ease',
      }}
    >
      {children}
    </button>
  );
}

export function GameHudControls({
  muted,
  pauseTitle,
  onToggleSound,
  onTogglePause,
}: {
  muted: boolean;
  pauseTitle: string;
  onToggleSound: () => void;
  onTogglePause: () => void;
}) {
  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      right: '14%',
      height: '3.7%',
      zIndex: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}>
      <HudIconButton
        title={muted ? 'Enable sound' : 'Mute sound'}
        dimmed={muted}
        onClick={onToggleSound}
      >
        {muted ? <SpeakerOffIcon /> : <SpeakerOnIcon />}
      </HudIconButton>
      <HudIconButton title={pauseTitle} onClick={onTogglePause}>
        <PauseIcon />
      </HudIconButton>
    </div>
  );
}
