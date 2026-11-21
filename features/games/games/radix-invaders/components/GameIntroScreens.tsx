'use client';

import { useEffect, useReducer, type CSSProperties, type ReactNode } from 'react';
import {
  TOURNAMENT_PARTICIPANTS,
  TOURNAMENT_PRIZE_POOL_XRD,
} from '../constants/radix-invaders.constants';
import { useXrdPrice } from '../../../hooks/useXrdPrice';
import {
  BadgeSVG,
  ChartIconSVG,
  CoinIconSVG,
  drawAlienSvg,
  MouseIconSVG,
  MoveIconSVG,
  PlayIconSVG,
  ShipSVG,
  ShootIconSVG,
  SpinnerSVG,
  SwordIconSVG,
  UFOSvg,
  UsersIconSVG,
} from './GameIntroIcons';

// ── Tournament dates ───────────────────────────────────────────────
function getTournamentDates() {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + diffToMon);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 0);
  return { start, end };
}

function fmtDate(d: Date, lang: string) {
  return d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ── Static starfield for intro screens ─────────────────────────────
const STATIC_STARS = Array.from({ length: 80 }, (_, i) => ({
  left: `${(i * 13.7 + 7) % 100}%`,
  top: `${(i * 19.3 + 11) % 100}%`,
  size: `${((i * 7 + 3) % 20) / 10 + 0.5}px`,
  opacity: ((i * 11 + 5) % 70) / 100 + 0.2,
  animationName: 'si-twinkle',
  animationDuration: `${((i * 3 + 1) % 30) / 10 + 1}s`,
  animationTimingFunction: 'ease-in-out',
  animationIterationCount: 'infinite' as const,
  animationDirection: 'alternate' as const,
  animationDelay: `${((i * 7) % 30) / 10}s`,
}));

function DateChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-white/40 tracking-[0.05em] mb-0.5">{label.toUpperCase()}</div>
      <div className="text-sm font-bold text-white">{value}</div>
    </div>
  );
}

function StatBox({ icon, label, value, sub, color, note }: {
  icon: ReactNode; label: string; value: string;
  sub?: string; color: string; note?: string;
}) {
  const rgbVar = color.includes('primary') ? '--ri-primary-rgb' : color.includes('gold') ? '--ri-gold-rgb' : '--ri-accent-rgb';
  return (
    <div className="rounded-xl p-3 text-center" style={{
      background: `rgba(var(${rgbVar}),0.06)`, border: `1px solid rgba(var(${rgbVar}),0.2)`,
    }}>
      <div className="mb-1 flex justify-center" style={{ color }}>{icon}</div>
      <div className="text-[10px] text-white/45 tracking-[0.05em] mb-1">{label.toUpperCase()}</div>
      <div className="text-base font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] text-white/50 mt-0.5">{sub}</div>}
      {note && <div className="text-[10px] text-[#ff8800] mt-0.5">{note}</div>}
    </div>
  );
}

function GameButton({ label, icon, color, onClick }: {
  label: string; icon: ReactNode; color: string; onClick: () => void;
}) {
  const rgbVar = color.includes('gold') ? 'var(--ri-gold-rgb)' : 'var(--ri-primary-rgb)';
  const style = {
    '--ri-btn-color': color,
    '--ri-btn-rgb': rgbVar,
  } as CSSProperties;
  return (
    <button type="button" onClick={onClick} className="ri-game-btn" style={style}>
      {icon}
      <span className="ri-centered-label">{label}</span>
    </button>
  );
}

export function AlienIntroScreen({ t, onReady }: { t: Record<string, string>; onReady: () => void }) {
  const [state, dispatch] = useReducer(
    (s: { phase: number; visible: boolean }, a: { type: 'SHOW' } | { type: 'FADE' }) => {
      switch (a.type) {
        case 'SHOW': return { ...s, visible: true };
        case 'FADE': return { ...s, phase: 1 };
        default: return s;
      }
    },
    { phase: 0, visible: false },
  );

  useEffect(() => {
    const t1 = setTimeout(() => dispatch({ type: 'SHOW' }), 100);
    let t3: ReturnType<typeof setTimeout>;
    const t2 = setTimeout(() => {
      dispatch({ type: 'FADE' });
      t3 = setTimeout(onReady, 400);
    }, 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onReady]);

  const aliens: Array<{ type: 0 | 1 | 2; pts: number; label: string }> = [
    { type: 0, pts: 30, label: t.alien_type_top ?? '' },
    { type: 1, pts: 20, label: t.alien_type_mid ?? '' },
    { type: 2, pts: 10, label: t.alien_type_bot ?? '' },
  ];

  return (
    <button
      type="button"
      onClick={onReady}
      style={{
        width: '100%', height: '100%',
        background: 'linear-gradient(180deg, #010614 0%, #02122a 50%, #010614 100%)',
        fontFamily: '"Courier New", Courier, monospace',
        color: '#fff',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 0, padding: '20px 16px',
        cursor: 'pointer',
        opacity: state.phase === 1 ? 0 : state.visible ? 1 : 0,
        transition: 'opacity 0.4s ease',
        position: 'relative', overflow: 'hidden',
        border: 'none', textAlign: 'center',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {STATIC_STARS.slice(0, 40).map((st, i) => (
          <div key={i} style={{
            position: 'absolute', left: st.left, top: st.top,
            width: st.size, height: st.size, borderRadius: '50%',
            background: '#fff', opacity: st.opacity,
            animationName: st.animationName, animationDuration: st.animationDuration,
            animationTimingFunction: st.animationTimingFunction,
            animationIterationCount: st.animationIterationCount,
            animationDirection: st.animationDirection, animationDelay: st.animationDelay,
          }} />
        ))}
      </div>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <h2 style={{ fontSize: 'clamp(18px,4vw,30px)', fontWeight: 900, letterSpacing: '0.05em', color: '#00e5ff', margin: 0, animation: 'si-glow 0.8s ease-in-out infinite', textAlign: 'center' }}>
          {t.alien_intro_title ?? ''}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
          {aliens.map(({ type, pts, label }, i) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 20, justifyContent: 'center', animation: `si-alien-in 0.4s ease ${i * 0.15}s both` }}>
              <div style={{ animation: 'si-float 0.8s ease-in-out infinite', animationDelay: `${i * 0.3}s` }}>
                {drawAlienSvg(type, 44)}
              </div>
              <div style={{ minWidth: 80, textAlign: 'left' }}>
                <div style={{ fontSize: 'clamp(18px,3vw,26px)', fontWeight: 900, color: ['var(--ri-alien0)', 'var(--ri-alien1)', 'var(--ri-alien2)'][type], fontFamily: '"Courier New",monospace' }}>
                  {pts} {t.alien_pts ?? ''}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}>
                  {label}
                </div>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, justifyContent: 'center', animation: `si-alien-in 0.4s ease ${aliens.length * 0.15}s both` }}>
            <div style={{ animation: 'si-float 0.8s ease-in-out infinite', animationDelay: '0.9s' }}>
              <UFOSvg size={56} />
            </div>
            <div style={{ minWidth: 80, textAlign: 'left' }}>
              <div style={{ fontSize: 'clamp(18px,3vw,26px)', fontWeight: 900, color: 'var(--ri-ufo)', fontFamily: '"Courier New",monospace' }}>
                {t.alien_ufo_pts ?? ''}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}>
                {t.alien_ufo_label ?? ''}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em', animation: 'si-glow 0.8s ease-in-out infinite' }}>
          {t.alien_intro_click ?? ''}
        </div>
      </div>
    </button>
  );
}

export function IntroScreen({ t, lang, onTournament, onFun }: {
  t: Record<string, string>; lang: string;
  onTournament: () => void; onFun: () => void;
}) {
  const { price, error: priceErr } = useXrdPrice();
  const { start, end } = getTournamentDates();
  const PARTICIPANTS = TOURNAMENT_PARTICIPANTS;
  const prizeXRD = TOURNAMENT_PRIZE_POOL_XRD;

  const prizeUSD = price ? `$${(prizeXRD * price.usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '…';
  const prizeEUR = price ? `€${(prizeXRD * price.eur).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '…';
  const xrdUSD = price ? `$${price.usd.toFixed(4)}` : '…';
  const xrdEUR = price ? `€${price.eur.toFixed(4)}` : '…';

  return (
    <div style={{
      width: '100%', height: '100%', minHeight: '100%',
      background: 'linear-gradient(180deg, #010614 0%, #02122a 50%, #010614 100%)',
      fontFamily: '"Courier New", Courier, monospace',
      color: '#fff', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '20px 16px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {STATIC_STARS.map((st, i) => (
          <div key={i} style={{
            position: 'absolute', left: st.left, top: st.top,
            width: st.size, height: st.size, borderRadius: '50%',
            background: '#fff', opacity: st.opacity,
            animationName: st.animationName, animationDuration: st.animationDuration,
            animationTimingFunction: st.animationTimingFunction,
            animationIterationCount: st.animationIterationCount,
            animationDirection: st.animationDirection, animationDelay: st.animationDelay,
          }} />
        ))}
      </div>

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.04) 2px,rgba(0,0,0,0.04) 4px)' }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 660, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        <div style={{ animation: 'si-float 0.8s ease-in-out infinite', marginBottom: 6 }}>
          <ShipSVG />
        </div>

        <div style={{ width: '100%', border: '1px solid rgba(0,229,255,0.35)', borderRadius: 16, background: 'rgba(0,229,255,0.04)', backdropFilter: 'blur(8px)', padding: '18px 22px', marginBottom: 16, animation: 'si-slidein 0.5s ease both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, justifyContent: 'center' }}>
            <span className="ri-tournament-badge">
              <span className="ri-centered-label">{t.tournament_label ?? ''}</span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
            <DateChip label={t.tournament_starts ?? ''} value={fmtDate(start, lang)} />
            <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 18 }}>&#8594;</div>
            <DateChip label={t.tournament_ends ?? ''} value={fmtDate(end, lang)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
            <StatBox icon={<UsersIconSVG />} label={t.participants ?? ''} value={PARTICIPANTS.toLocaleString()} color="var(--ri-primary)" />
            <StatBox icon={<CoinIconSVG />} label={t.prize_pool ?? ''} value={`${prizeXRD.toLocaleString()} XRD`} sub={price ? `${prizeUSD} · ${prizeEUR}` : (t.loading_price ?? '')} color="var(--ri-gold)" />
            <StatBox icon={<ChartIconSVG />} label={t.xrd_price_label ?? ''} value={price ? xrdUSD : '…'} sub={price ? xrdEUR : undefined} note={priceErr ? '—' : undefined} color="var(--ri-accent)" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, width: '100%', flexWrap: 'wrap', animation: 'si-slidein 0.7s ease both' }}>
          <GameButton label={t.btn_tournament ?? ''} icon={<SwordIconSVG />} color="var(--ri-gold)" onClick={onTournament} />
          <GameButton label={t.btn_fun ?? ''} icon={<PlayIconSVG />} color="var(--ri-primary)" onClick={onFun} />
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', opacity: 0.45 }}>
          {[
            { icon: <MoveIconSVG />, text: t.controls_move ?? '' },
            { icon: <ShootIconSVG />, text: t.controls_shoot ?? '' },
            { icon: <MouseIconSVG />, text: t.controls_mouse ?? '' },
          ].map((c) => (
            <div key={c.text} className="flex items-center gap-[5px] text-[11px] text-[#aaa]">
              {c.icon} {c.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BadgeScreen({ t, step, onPlay }: {
  t: Record<string, string>; step: 'acquiring' | 'success'; onPlay: () => void;
}) {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg,#010614 0%,#02122a 100%)', fontFamily: '"Courier New",monospace', color: '#fff', gap: 22, padding: 32 }}>
      {step === 'acquiring' ? (
        <>
          <SpinnerSVG />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#00e5ff', margin: 0 }}>{t.badge_acquiring ?? ''}</p>
            <p style={{ fontSize: 14, color: '#ffd700', margin: '8px 0 0', opacity: 0.8 }}>{t.badge_cost ?? ''}</p>
          </div>
        </>
      ) : (
        <>
          <div style={{ animation: 'si-badge 0.5s ease both' }}><BadgeSVG /></div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#ffd700', margin: 0 }}>{t.badge_success_title ?? ''}</p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', margin: '12px 0 22px', maxWidth: 400, lineHeight: 1.6 }}>{t.badge_success_body ?? ''}</p>
            <button type="button" onClick={onPlay} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: '14px 40px', fontFamily: '"Courier New",monospace', fontWeight: 700, fontSize: 16, color: '#010614', background: '#ffd700', border: 'none', borderRadius: 12, cursor: 'pointer', boxShadow: '0 0 20px #ffd700,0 0 40px #ffd700aa', letterSpacing: '0.05em' }}>
              <span className="ri-centered-label">{t.badge_btn_play ?? ''}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
