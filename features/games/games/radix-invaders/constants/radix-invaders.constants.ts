/**
 * Game constants for Radix Invaders (100-level edition).
 */

export const CANVAS_W = 900;
export const CANVAS_H = 700;

export const MAX_LEVEL = 100;
export const BOSS_INTERVAL = 10;
export const INITIAL_LIVES = 3;
export const MAX_LIVES = 7;
export const MAX_CONTINUES = 5;
export const CONTINUE_COUNTDOWN = 600; // 10s at 60fps

export const HI_SCORE_KEY = 'si_radix_hiscore_v2';
export const TOURNAMENT_PARTICIPANTS = 12_847;
export const TOURNAMENT_PRIZE_POOL_XRD = Math.round(TOURNAMENT_PARTICIPANTS * 5 * 0.8);

export const PLAYER_W = 54;
export const PLAYER_H = 30;
export const PLAYER_Y = CANVAS_H - 56;
export const PLAYER_SPEED = 6.2;

export const BULLET_SPEED_P = 15;
export const BULLET_SPEED_E = 4.2;

export const ALIEN_ROWS = 5;
export const ALIEN_COLS = 11;
export const ALIEN_W = 40;
export const ALIEN_H = 30;
export const ALIEN_GAP_X = 16;
export const ALIEN_GAP_Y = 14;

export const BOSS_W = 168;
export const BOSS_H = 74;

export const SHIELD_COUNT = 4;
export const UFO_W = 60;
export const UFO_H = 22;
export const UFO_SPEED = 2.6;

export const MAX_PARTICLES = 180;
export const POWERUP_DURATION = 660; // ~11s at 60fps
export const COMBO_WINDOW = 150;     // 2.5s at 60fps

/** 10 cosmic sector themes (one every 10 levels) for visual variety across 100 levels. */
export const SECTOR_PALETTES = [
  { bgTop: '#010614', bgMid: '#031533', nebulaA: 'rgba(0,229,255,0.09)', nebulaB: 'rgba(255,0,170,0.06)', bossAccent: '#ff00aa' },
  { bgTop: '#04051a', bgMid: '#120a38', nebulaA: 'rgba(138,43,226,0.10)', nebulaB: 'rgba(0,229,255,0.06)', bossAccent: '#a855f7' },
  { bgTop: '#020f14', bgMid: '#042730', nebulaA: 'rgba(0,255,180,0.09)', nebulaB: 'rgba(0,180,255,0.06)', bossAccent: '#00ffb4' },
  { bgTop: '#120410', bgMid: '#2a0826', nebulaA: 'rgba(255,40,140,0.10)', nebulaB: 'rgba(255,140,0,0.06)', bossAccent: '#ff288c' },
  { bgTop: '#0b0a02', bgMid: '#241c06', nebulaA: 'rgba(255,215,0,0.09)', nebulaB: 'rgba(255,100,0,0.06)', bossAccent: '#ffd700' },
  { bgTop: '#020b18', bgMid: '#072244', nebulaA: 'rgba(56,189,248,0.10)', nebulaB: 'rgba(57,255,20,0.05)', bossAccent: '#38bdf8' },
  { bgTop: '#140308', bgMid: '#300914', nebulaA: 'rgba(255,60,60,0.10)', nebulaB: 'rgba(255,170,0,0.06)', bossAccent: '#ff3c3c' },
  { bgTop: '#02120a', bgMid: '#062c1a', nebulaA: 'rgba(57,255,20,0.09)', nebulaB: 'rgba(0,229,255,0.06)', bossAccent: '#39ff14' },
  { bgTop: '#0c041c', bgMid: '#210c45', nebulaA: 'rgba(192,132,252,0.11)', nebulaB: 'rgba(255,0,170,0.07)', bossAccent: '#c084fc' },
  { bgTop: '#14020a', bgMid: '#2d0618', nebulaA: 'rgba(255,215,0,0.12)', nebulaB: 'rgba(255,0,90,0.09)', bossAccent: '#ff0055' },
] as const;

export const COLORS = {
  bg: '#010614',
  bgGrad: '#02122a',
  primary: '#00e5ff',
  secondary: '#ff00aa',
  accent: '#39ff14',
  gold: '#ffd700',
  white: '#ffffff',
  dimWhite: 'rgba(255,255,255,0.55)',
  playerShip: '#00e5ff',
  bulletP: '#39ff14',
  bulletSpread: '#ff9900',
  bulletLaser: '#ff2288',
  bulletRapid: '#aaff00',
  bulletE: '#ff4444',
  bulletBanana: '#ffdd00',
  bulletBoss: '#ff00cc',
  shield: '#00bfff',
  shieldItem: '#38bdf8',
  lifeItem: '#22ff88',
  continueItem: '#ffd700',
  ufo: '#ff00aa',
  alien0: '#ff4dff',
  alien1: '#00e5ff',
  alien2: '#39ff14',
  alien3: '#ff8800',
  glow0: '#ff4dff',
  glow1: '#00e5ff',
  glow2: '#39ff14',
  glow3: '#ff8800',
  glowP: '#00e5ff',
} as const;

export const POWERUP_COLORS = {
  SPREAD: COLORS.bulletSpread,
  LASER: COLORS.bulletLaser,
  RAPID: COLORS.bulletRapid,
  SHIELD: COLORS.shieldItem,
  LIFE: COLORS.lifeItem,
  CONTINUE: COLORS.continueItem,
  NONE: COLORS.playerShip,
} as const;

/** Unified visual scale factors applied only in mobile portrait mode (`scaleY > 1`). */
export const MOBILE_RENDER_SCALE = {
  maxPortraitH: 1600,
  player: 1.45,
  alien: 1.28,
  boss: 1.35,
  ufo: 1.4,
  shieldX: 1.18,
  shieldY: 1.48,
  bullet: 1.55,
  pickup: 1.45,
  particle: 1.35,
  floatingText: 1.4,
  miniShip: 1.38,
} as const;
