'use client';

import { useEffect, useRef, useState } from 'react';
import { MOCK_LEADERBOARD } from '../../../data/gamesData';
import { CANVAS_H, CANVAS_W, TOURNAMENT_PRIZE_POOL_XRD } from '../constants/radix-invaders.constants';
import { startVictoryCinematic } from '../utils/endingRenderer';
import { playVictory } from '../utils/sound';

interface VictoryEndingScreenProps {
  t: Record<string, string>;
  score: number;
  onPlayAgain: () => void;
  onBackToMenu: () => void;
}

function getXrdPrizeForRank(rank: number): number {
  if (rank === 1) return Math.round(TOURNAMENT_PRIZE_POOL_XRD * 0.325);
  if (rank === 2) return Math.round(TOURNAMENT_PRIZE_POOL_XRD * 0.17);
  if (rank === 3) return Math.round(TOURNAMENT_PRIZE_POOL_XRD * 0.075);
  if (rank >= 4 && rank <= 10) return Math.round(TOURNAMENT_PRIZE_POOL_XRD * 0.005);
  return 0;
}

export default function VictoryEndingScreen({
  t,
  score,
  onPlayAgain,
  onBackToMenu,
}: VictoryEndingScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'CINEMATIC' | 'LEADERBOARD'>('CINEMATIC');

  useEffect(() => {
    playVictory();
  }, []);

  useEffect(() => {
    if (phase !== 'CINEMATIC' || !canvasRef.current) return;
    return startVictoryCinematic(canvasRef.current, t, score, () => setPhase('LEADERBOARD'));
  }, [phase, score, t]);

  const baseTop = MOCK_LEADERBOARD.slice(0, 10).map((u) => ({
    id: `${u.rank}-${u.username}`,
    username: u.username,
    score: u.score,
    isPlayer: false,
  }));
  const combined = score > 0
    ? [...baseTop, { id: 'current-player', username: t.top10_you ?? '', score, isPlayer: true }]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
    : baseTop;

  if (phase === 'CINEMATIC') {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#010614', position: 'relative',
      }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="max-w-full max-h-full w-full h-full block object-contain"
        />
        <button
          type="button"
          onClick={() => setPhase('LEADERBOARD')}
          style={{
            position: 'absolute', bottom: 18, right: 18, zIndex: 10,
            padding: '7px 14px', borderRadius: 8,
            fontFamily: '"Courier New", monospace', fontWeight: 700, fontSize: 12,
            color: 'rgba(255,255,255,0.75)', background: 'rgba(4,14,34,0.8)',
            border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer',
          }}
        >
          {`${t.ending_skip ?? ''} →`}
        </button>
      </div>
    );
  }

  const medalColor = (idx: number) =>
    idx === 0 ? '#ffd700' : idx === 1 ? '#d1d5db' : idx === 2 ? '#cd7f32' : 'rgba(255,255,255,0.45)';

  return (
    <div style={{
      width: '100%', height: '100%', minHeight: '100%',
      background: 'radial-gradient(circle at 50% 20%, #071d42 0%, #010614 75%)',
      fontFamily: '"Courier New", Courier, monospace',
      color: '#fff', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '16px 14px', overflowY: 'auto',
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        borderRadius: 18,
        background: 'rgba(6, 16, 36, 0.94)',
        border: '1px solid rgba(255, 215, 0, 0.3)',
        padding: '18px 18px 16px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '0.08em', color: '#ffd700' }}>
            {t.top10_title ?? ''}
          </div>
          {score > 0 && (
            <div style={{ fontSize: 12, color: '#00e5ff', marginTop: 3 }}>
              {`${t.final_score ?? ''}: ${score.toLocaleString()}`}
            </div>
          )}
        </div>

        {/* Top 10 table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '34px 1fr auto auto', gap: 10, alignItems: 'center',
            padding: '4px 10px', fontSize: 10, fontWeight: 700, lineHeight: 1,
            color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em',
          }}>
            <span>#</span>
            <span>{t.top10_player ?? ''}</span>
            <span style={{ textAlign: 'right' }}>{t.top10_score ?? ''}</span>
            <span style={{ textAlign: 'right', minWidth: 82 }}>{t.top10_prize ?? ''}</span>
          </div>

          {combined.map((entry, idx) => {
            const xrdPrize = getXrdPrizeForRank(idx + 1);
            return (
              <div
                key={`${entry.id}-${idx}`}
                style={{
                  display: 'grid', gridTemplateColumns: '34px 1fr auto auto', gap: 10, alignItems: 'center',
                  minHeight: 30,
                  padding: '6px 10px', borderRadius: 8,
                  lineHeight: 1,
                  background: entry.isPlayer
                    ? 'rgba(0, 229, 255, 0.14)'
                    : idx < 3
                      ? 'rgba(255, 215, 0, 0.06)'
                      : 'rgba(255, 255, 255, 0.03)',
                  border: entry.isPlayer
                    ? '1px solid rgba(0, 229, 255, 0.5)'
                    : '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 900, lineHeight: 1, paddingTop: 1, color: medalColor(idx) }}>
                  {`#${idx + 1}`}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: entry.isPlayer || idx < 3 ? 800 : 600,
                  lineHeight: 1, paddingTop: 1,
                  color: entry.isPlayer ? '#00e5ff' : '#fff',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {entry.username}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 800, lineHeight: 1, paddingTop: 1, textAlign: 'right',
                  color: entry.isPlayer ? '#00e5ff' : 'rgba(255,255,255,0.85)',
                }}>
                  {entry.score.toLocaleString()}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 800, lineHeight: 1, paddingTop: 1, textAlign: 'right', minWidth: 82,
                  color: idx < 3 ? '#ffd700' : '#00ff9d',
                }}>
                  {`${xrdPrize.toLocaleString()} XRD`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button
            type="button"
            onClick={onBackToMenu}
            style={{
              flex: 1, height: 38, padding: '1px 12px 0', borderRadius: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              fontFamily: '"Courier New", monospace', fontWeight: 700, fontSize: 12,
              color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.18)',
            }}
          >
            {t.back_to_menu ?? ''}
          </button>
          <button
            type="button"
            onClick={onPlayAgain}
            style={{
              flex: 1, height: 38, padding: '1px 12px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              fontFamily: '"Courier New", monospace', fontWeight: 900, fontSize: 12,
              color: '#010614', background: '#00e5ff',
            }}
          >
            {t.play_again ?? ''}
          </button>
        </div>
      </div>
    </div>
  );
}
