'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { BOSS_INTERVAL, MAX_LEVEL } from '../constants/radix-invaders.constants';
import { getBossProfile, isBossLevel, isPreBossLevel } from '../services/waves';

export function snapToBossLevel(level: number): number {
  return Math.min(MAX_LEVEL, Math.max(BOSS_INTERVAL, Math.ceil(level / BOSS_INTERVAL) * BOSS_INTERVAL));
}

function StepperButton({
  symbol,
  ariaLabel,
  disabled,
  onStartHold,
  onStopHold,
  onStep,
}: {
  symbol: string;
  ariaLabel: string;
  disabled: boolean;
  onStartHold: () => void;
  onStopHold: () => void;
  onStep: () => void;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => { e.preventDefault(); onStartHold(); }}
      onPointerUp={onStopHold}
      onPointerLeave={onStopHold}
      onPointerCancel={onStopHold}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStep(); } }}
      disabled={disabled}
      aria-label={ariaLabel}
      className={[
        'w-11 h-11 rounded-full border border-white/15 bg-white/5 text-[22px] font-bold',
        'flex items-center justify-center select-none touch-none',
        disabled ? 'text-white/20 cursor-default' : 'text-white cursor-pointer hover:bg-white/10',
      ].join(' ')}
    >
      {symbol}
    </button>
  );
}

interface FunLevelSelectScreenProps {
  t: Record<string, string>;
  level: number;
  bossRush: boolean;
  onChangeLevel: (lvl: number) => void;
  onSetBossRush: (enabled: boolean) => void;
  onStart: () => void;
  onBack: () => void;
}

export default function FunLevelSelectScreen({
  t,
  level,
  bossRush,
  onChangeLevel,
  onSetBossRush,
  onStart,
  onBack,
}: FunLevelSelectScreenProps) {
  const step = bossRush ? BOSS_INTERVAL : 1;
  const minLvl = bossRush ? BOSS_INTERVAL : 1;
  const effectiveLevel = bossRush ? snapToBossLevel(level) : Math.max(1, Math.min(MAX_LEVEL, level));
  const boss = isBossLevel(effectiveLevel);
  const preBoss = !bossRush && isPreBossLevel(effectiveLevel);
  const activeProfile = boss ? getBossProfile(effectiveLevel / BOSS_INTERVAL) : null;
  const accent = bossRush || boss ? '#ffd700' : '#00e5ff';

  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelRef = useRef(effectiveLevel);
  useLayoutEffect(() => {
    levelRef.current = effectiveLevel;
  });

  const stopHold = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  };

  useEffect(() => stopHold, []);

  const adjust = (delta: number) => {
    const next = Math.max(minLvl, Math.min(MAX_LEVEL, effectiveLevel + delta));
    onChangeLevel(next);
  };

  const startHold = (delta: number) => {
    stopHold();
    const stepOnce = () => {
      const next = Math.max(minLvl, Math.min(MAX_LEVEL, levelRef.current + delta));
      levelRef.current = next;
      onChangeLevel(next);
      if (next <= minLvl || next >= MAX_LEVEL) stopHold();
    };
    stepOnce();
    holdTimeoutRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(stepOnce, 75);
    }, 320);
  };

  return (
    <div style={{
      width: '100%', height: '100%', minHeight: '100%',
      background: 'radial-gradient(circle at 50% 35%, #061b3a 0%, #010614 75%)',
      fontFamily: '"Courier New", Courier, monospace',
      color: '#fff', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        borderRadius: 20,
        background: 'rgba(6, 16, 36, 0.92)',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '24px 22px 20px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22,
      }}>
        {/* Minimal segmented switch */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
          width: '100%', padding: 4, borderRadius: 12,
          background: 'rgba(255,255,255,0.05)',
        }}>
          <button
            type="button"
            onClick={() => onSetBossRush(false)}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              padding: '9px 8px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontFamily: '"Courier New", monospace', fontWeight: 700, fontSize: 12,
              color: !bossRush ? '#010614' : 'rgba(255,255,255,0.6)',
              background: !bossRush ? '#00e5ff' : 'transparent',
            }}
          >
            <span className="ri-centered-label">{t.mode_campaign ?? ''}</span>
          </button>
          <button
            type="button"
            onClick={() => onSetBossRush(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              padding: '9px 8px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontFamily: '"Courier New", monospace', fontWeight: 700, fontSize: 12,
              color: bossRush ? '#010614' : 'rgba(255,215,0,0.75)',
              background: bossRush ? '#ffd700' : 'transparent',
            }}
          >
            <span className="ri-centered-label">{t.mode_boss_rush ?? ''}</span>
          </button>
        </div>

        {/* Clean Level Stepper (supports press-and-hold auto-repeat) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 8px' }}>
            <StepperButton
              symbol="−"
              ariaLabel="-"
              disabled={effectiveLevel <= minLvl}
              onStartHold={() => startHold(-step)}
              onStopHold={stopHold}
              onStep={() => adjust(-step)}
            />

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 54, fontWeight: 900, lineHeight: 1, color: accent }}>
                {effectiveLevel}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                {`${t.hud_level ?? ''} ${effectiveLevel} / ${MAX_LEVEL}`}
              </div>
            </div>

            <StepperButton
              symbol="+"
              ariaLabel="+"
              disabled={effectiveLevel >= MAX_LEVEL}
              onStartHold={() => startHold(step)}
              onStopHold={stopHold}
              onStep={() => adjust(step)}
            />
          </div>

          <div style={{ minHeight: 18, fontSize: 12, fontWeight: 700, textAlign: 'center', color: boss ? '#ffd700' : preBoss ? '#00ff9d' : 'rgba(255,255,255,0.45)' }}>
            {boss
              ? `${t.boss_label ?? ''} ${effectiveLevel / BOSS_INTERVAL}/10 · ${activeProfile?.archetype ?? ''}`
              : preBoss
                ? (t.pre_boss_tag ?? '')
                : ''}
          </div>

          <input
            type="range"
            min={minLvl}
            max={MAX_LEVEL}
            step={step}
            value={effectiveLevel}
            onChange={(e) => onChangeLevel(Number(e.target.value))}
            aria-label={t.select_level_title ?? ''}
            style={{ width: '100%', accentColor: accent, cursor: 'pointer', marginTop: 4 }}
          />

          {/* Fixed-height helper slot so card height never shifts between modes */}
          <div style={{
            minHeight: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: 'rgba(255,255,255,0.45)',
            textAlign: 'center',
            marginTop: 2,
          }}>
            {bossRush ? (t.boss_rush_desc ?? '') : '\u00A0'}
          </div>
        </div>

        {/* Primary Play CTA + quiet Back link */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={onStart}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              width: '100%', padding: '13px 18px', borderRadius: 12, border: 'none',
              fontFamily: '"Courier New", monospace', fontWeight: 900, fontSize: 14,
              letterSpacing: '0.06em', cursor: 'pointer',
              color: '#010614', background: accent,
            }}
          >
            <span className="ri-centered-label">
              {bossRush ? `${t.start_boss_rush ?? ''} ${effectiveLevel}` : `${t.start_level ?? ''} ${effectiveLevel}`}
            </span>
          </button>
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: '"Courier New", monospace', fontSize: 12,
              color: 'rgba(255,255,255,0.5)', padding: '6px 10px',
            }}
          >
            <span className="ri-centered-label">{`← ${t.back ?? ''}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
