/**
 * Game constants for Radix Invaders.
 * Includes dimensions, speeds, and mirrored color values for Canvas rendering.
 */

export const CANVAS_W = 900;
export const CANVAS_H = 700;

export const PLAYER_W = 52;
export const PLAYER_H = 28;
export const PLAYER_SPEED = 5;

export const BULLET_SPEED_P = 14;
export const BULLET_SPEED_E = 4.5;

export const ALIEN_ROWS = 5;
export const ALIEN_COLS = 11;
export const ALIEN_W = 40;
export const ALIEN_H = 30;
export const ALIEN_GAP_X = 16;
export const ALIEN_GAP_Y = 14;

export const SHIELD_COUNT = 4;
export const UFO_W = 60;
export const UFO_H = 22;
export const UFO_SPEED = 2.5;

/**
 * Color constants mirroring radix-invaders.css variables.
 */
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
  shield: '#00bfff',
  ufo: '#ff00aa',
  alien0: '#ff4dff',
  alien1: '#00e5ff',
  alien2: '#39ff14',
  alien3: '#ff8800',
  glow0: 'rgba(255,77,255,0.6)',
  glow1: 'rgba(0,229,255,0.6)',
  glow2: 'rgba(57,255,20,0.6)',
  glow3: 'rgba(255,136,0,0.7)',
  glowP: 'rgba(0,229,255,0.8)',
} as const;
