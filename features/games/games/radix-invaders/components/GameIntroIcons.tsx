'use client';

import type { ReactNode } from 'react';

export function ShipSVG() {
  return (
    <svg width="64" height="52" viewBox="0 0 64 52" fill="none">
      <polygon points="32,2 62,50 32,38 2,50" fill="rgba(0,229,255,0.15)" stroke="#00e5ff" strokeWidth="1.5" />
      <ellipse cx="32" cy="24" rx="7" ry="9" fill="rgba(255,255,255,0.7)" />
      <polygon points="26,50 38,50 32,62" fill="rgba(255,140,0,0.7)" />
      <ellipse cx="32" cy="52" rx="5" ry="3" fill="rgba(0,229,255,0.4)" />
    </svg>
  );
}

export function UsersIconSVG() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 16c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="14" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M17 14c0-2.5-1.5-4-3.5-4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function CoinIconSVG() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6v8M7.5 8a2.5 2.5 0 015 0 2.5 2.5 0 01-5 0zM7.5 12a2.5 2.5 0 005 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function ChartIconSVG() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="12" width="4" height="6" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="8" y="7" width="4" height="11" rx="1" fill="currentColor" opacity="0.85" />
      <rect x="14" y="3" width="4" height="15" rx="1" fill="currentColor" />
    </svg>
  );
}

export function SwordIconSVG() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M10 1l3 3-7 7-3 1 1-3 7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8 3l3 3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2 10l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function PlayIconSVG() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <polygon points="2,1 13,7 2,13" fill="currentColor" />
    </svg>
  );
}

export function MoveIconSVG() {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
      <path d="M1 5h12M1 5L4 2M1 5L4 8M13 5L10 2M13 5L10 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function ShootIconSVG() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
      <path d="M6 13V2M6 2L2 6M6 2L10 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function MouseIconSVG() {
  return (
    <svg width="12" height="16" viewBox="0 0 12 16" fill="none">
      <rect x="1" y="1" width="10" height="14" rx="5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 1v6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function SpinnerSVG() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ animation: 'si-spin 0.8s linear infinite' }}>
      <circle cx="24" cy="24" r="20" stroke="rgba(0,229,255,0.2)" strokeWidth="3" />
      <path d="M24 4a20 20 0 0120 20" stroke="#00e5ff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function BadgeSVG() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
      <circle cx="36" cy="36" r="32" fill="rgba(255,215,0,0.15)" stroke="#ffd700" strokeWidth="2" />
      <polygon points="36,16 41,30 56,30 44,39 49,54 36,45 23,54 28,39 16,30 31,30" fill="#ffd700" stroke="#ffaa00" strokeWidth="1" />
      <circle cx="36" cy="36" r="10" fill="#ffaa00" opacity="0.5" />
    </svg>
  );
}

export function drawAlienSvg(type: 0 | 1 | 2, size = 40): ReactNode {
  const colors = ['var(--ri-alien0)', 'var(--ri-alien1)', 'var(--ri-alien2)'];
  const color = colors[type];
  if (type === 0) {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <ellipse cx="20" cy="22" rx="14" ry="12" fill={color} opacity="0.2" />
        <ellipse cx="20" cy="22" rx="14" ry="12" stroke={color} strokeWidth="1.5" />
        <circle cx="13" cy="20" r="3" fill={color} />
        <circle cx="27" cy="20" r="3" fill={color} />
        <path d="M14 26 Q20 30 26 26" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10 14 L6 8M30 14 L34 8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M8 24 L4 28M32 24 L36 28" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 1) {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <rect x="8" y="14" width="24" height="16" rx="3" fill={color} opacity="0.2" />
        <rect x="8" y="14" width="24" height="16" rx="3" stroke={color} strokeWidth="1.5" />
        <rect x="12" y="18" width="5" height="5" rx="1" fill={color} />
        <rect x="23" y="18" width="5" height="5" rx="1" fill={color} />
        <path d="M14 27 Q20 31 26 27" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M8 14 L5 9M32 14 L35 9" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 30 L9 35M28 30 L31 35" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path d="M20 10 L32 18 L32 30 L20 36 L8 30 L8 18 Z" fill={color} opacity="0.2" />
      <path d="M20 10 L32 18 L32 30 L20 36 L8 30 L8 18 Z" stroke={color} strokeWidth="1.5" />
      <circle cx="15" cy="22" r="3" fill={color} />
      <circle cx="25" cy="22" r="3" fill={color} />
      <path d="M15 28 Q20 32 25 28" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 14 L11 8M26 14 L29 8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function UFOSvg({ size = 50 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.5} viewBox="0 0 60 30" fill="none">
      <ellipse cx="30" cy="20" rx="28" ry="10" fill="var(--ri-ufo)" opacity="0.2" />
      <ellipse cx="30" cy="20" rx="28" ry="10" stroke="var(--ri-ufo)" strokeWidth="1.5" />
      <ellipse cx="30" cy="14" rx="14" ry="12" fill="rgba(255,0,170,0.15)" stroke="var(--ri-ufo)" strokeWidth="1" />
      <circle cx="18" cy="22" r="2.5" fill="white" opacity="0.8" />
      <circle cx="26" cy="24" r="2.5" fill="white" opacity="0.8" />
      <circle cx="34" cy="24" r="2.5" fill="white" opacity="0.8" />
      <circle cx="42" cy="22" r="2.5" fill="white" opacity="0.8" />
    </svg>
  );
}
