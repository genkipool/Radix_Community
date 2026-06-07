'use client';

import dynamic from 'next/dynamic';
import { Gamepad2, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';


const RadixInvadersGame = dynamic(
  () => import('../games/radix-invaders'),
  {
    ssr: false,
    loading: () => (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#010614', minHeight: 400 }}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <circle cx="20" cy="20" r="16" stroke="rgba(0,229,255,0.2)" strokeWidth="3" />
          <path d="M20 4a16 16 0 0116 16" stroke="#00e5ff" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    ),
  }
);

const CUSTOM_GAMES: Record<string, React.ComponentType> = {
  'radix-invaders': RadixInvadersGame,
};

import { GamePlayerProps } from '../types/components.types';

export default function GamePlayer({ game }: GamePlayerProps) {
  const { t: dict } = useLanguage();
  const t = dict.games?.player ?? {};
  const gamesT = dict.games ?? {};
  const gameTitles = (gamesT.titles ?? {}) as Record<string, string>;
  const gameTitle = gameTitles[game.titleKey] ?? game.titleKey;

  const CustomGame = CUSTOM_GAMES[game.id];

  return (
    // Absolute fill — no top bar, game occupies all space
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {CustomGame ? (
          <CustomGame />
        ) : game.embedUrl ? (
          <iframe
            src={game.embedUrl}
            style={{ flex: 1, width: '100%', border: 0 }}
            title={gameTitle}
            allow="accelerometer; autoplay; fullscreen"
            sandbox="allow-scripts allow-forms allow-popups"
            loading="lazy"
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, background: 'var(--color-bg)' }}>
            <div className={`w-32 h-32 rounded-3xl bg-gradient-to-br ${game.thumbnailGradient} flex items-center justify-center shadow-2xl`}>
              <Gamepad2 className="size-16 text-white opacity-80" />
            </div>
            <div className="text-center max-w-md px-6">
              <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text-main)' }}>{gameTitle}</h2>
              <div className="flex items-start gap-2 p-4 rounded-2xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-card-border)' }}>
                <AlertCircle className="size-5 mt-0.5 shrink-0" style={{ color: 'var(--color-primary)' }} />
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t.coming_soon ?? 'This game is coming soon!'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
