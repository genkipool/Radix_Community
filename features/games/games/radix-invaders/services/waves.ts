/**
 * Pure wave, formation, difficulty, and boss generators for the 100-level
 * campaign of Radix Invaders.
 */
import type { Alien, Boss } from '../types/radix-invaders.types';
import {
  ALIEN_COLS,
  ALIEN_GAP_X,
  ALIEN_GAP_Y,
  ALIEN_H,
  ALIEN_ROWS,
  ALIEN_W,
  BOSS_H,
  BOSS_INTERVAL,
  BOSS_W,
  BULLET_SPEED_E,
  CANVAS_W,
  MAX_LEVEL,
  SECTOR_PALETTES,
} from '../constants/radix-invaders.constants';

export function clampLevel(level: number): number {
  return Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
}

/** Levels 10, 20, 30, …, 100 are boss encounters. */
export function isBossLevel(level: number): boolean {
  return level >= BOSS_INTERVAL && level <= MAX_LEVEL && level % BOSS_INTERVAL === 0;
}

/** Levels 9, 19, 29, …, 99 drop a guaranteed extra-life (1-UP) pickup before the boss. */
export function isPreBossLevel(level: number): boolean {
  return level >= 1 && level < MAX_LEVEL && level % BOSS_INTERVAL === BOSS_INTERVAL - 1;
}

/** 0-based cosmic sector index (`0..9`) for palette & tier scaling. */
export function getSectorIndex(level: number): number {
  return Math.min(SECTOR_PALETTES.length - 1, Math.floor((clampLevel(level) - 1) / BOSS_INTERVAL));
}

export interface WaveDifficulty {
  baseSpeed: number;
  shootInterval: number;
  bulletSpeed: number;
  diveInterval: number;
  diveChance: number;
  bananaChance: number;
}

/**
 * Smooth, bounded difficulty curve designed across all 100 levels so early
 * stages are approachable, mid-game escalates steadily, and levels 80–100 stay
 * intense yet fair.
 */
export function getWaveDifficulty(level: number): WaveDifficulty {
  const t = (clampLevel(level) - 1) / (MAX_LEVEL - 1); // 0..1
  const curve = Math.pow(t, 0.72);
  return {
    baseSpeed: 0.52 + curve * 1.45,
    shootInterval: Math.max(16, Math.round(78 - curve * 58)),
    bulletSpeed: BULLET_SPEED_E + curve * 3.4,
    diveInterval: Math.max(70, Math.round(210 - curve * 125)),
    diveChance: level < 4 ? 0 : Math.min(0.75, 0.28 + curve * 0.45),
    bananaChance: level < 3 ? 0 : Math.min(0.42, 0.14 + curve * 0.26),
  };
}

function makeAlien(row: number, col: number, x: number, y: number, type: 0 | 1 | 2 | 3, hp: number): Alien {
  return {
    row,
    col,
    x,
    y,
    alive: true,
    hp,
    maxHp: hp,
    frame: 0,
    hitFlash: 0,
    type,
    diving: false,
    diveTargetX: 0,
    diveAngle: -Math.PI / 2,
    divePhase: 'RISE',
    diveFlipTimer: 0,
    diveOriginX: x,
    diveOriginY: y,
  };
}

/**
 * Generates the alien formation for a non-boss level (`1..99`).
 * Cycles through 6 distinct tactical formations across each 10-level sector
 * and introduces armored aliens progressively in higher sectors.
 */
export function createWaveAliens(level: number): Alien[] {
  if (isBossLevel(level)) return [];

  const sector = getSectorIndex(level); // 0..9
  const stageInSector = (clampLevel(level) - 1) % BOSS_INTERVAL; // 0..8
  const formation = (stageInSector + sector) % 6;

  const totalW = ALIEN_COLS * (ALIEN_W + ALIEN_GAP_X) - ALIEN_GAP_X;
  const startX = (CANVAS_W - totalW) / 2;
  const startY = 96;
  const aliens: Alien[] = [];

  for (let row = 0; row < ALIEN_ROWS; row++) {
    for (let col = 0; col < ALIEN_COLS; col++) {
      // Formation mask
      if (formation === 1) {
        // V-Chevron: open upper corners
        if (row === 0 && (col === 0 || col === ALIEN_COLS - 1)) continue;
        if (row === 4 && Math.abs(col - 5) > 2) continue;
      } else if (formation === 2) {
        // Twin Wings: central corridor
        if (col === 5 && row > 0 && row < 4) continue;
      } else if (formation === 3) {
        // Diamond
        const dist = Math.abs(col - 5) + Math.abs(row - 2) * 1.4;
        if (dist > 6.2) continue;
      } else if (formation === 4) {
        // Checkerboard vanguard on front rows
        if (row >= 3 && (row + col) % 2 === 1 && sector < 4) continue;
      } else if (formation === 5) {
        // Fortress: hollow flanks on middle rows, heavy center
        if ((row === 1 || row === 2) && (col === 1 || col === ALIEN_COLS - 2)) continue;
      }

      // Alien class by row (elites appear in top row from sector 2+)
      let type: 0 | 1 | 2 | 3 = row === 0 ? 0 : row <= 2 ? 1 : 2;
      if (row === 0 && sector >= 2 && (col === 0 || col === ALIEN_COLS - 1 || (sector >= 5 && col % 2 === 0))) {
        type = 3;
      }

      // Armored HP scales cleanly with sector (never tedious)
      let hp = 1;
      if (sector >= 1 && row === 0 && (col % 2 === 0 || sector >= 3)) hp = 2;
      if (sector >= 4 && row === 1 && col % 3 === 1) hp = 2;
      if (sector >= 6 && row === 0 && (col === 3 || col === 5 || col === 7)) hp = 3;
      if (sector >= 8 && row <= 1 && col % 2 === 1) hp = Math.max(hp, 2);

      // Slight chevron vertical offset on formation 1
      const yOffset = formation === 1 ? Math.abs(col - 5) * 4 : 0;
      const x = startX + col * (ALIEN_W + ALIEN_GAP_X);
      const y = startY + row * (ALIEN_H + ALIEN_GAP_Y) + yOffset;
      aliens.push(makeAlien(row, col, x, y, type, hp));
    }
  }

  return aliens;
}

export type BossArchetype =
  | 'VANGUARD'
  | 'VIPER'
  | 'PHALANX'
  | 'VORTEX'
  | 'SNIPER'
  | 'CARRIER'
  | 'TEMPEST'
  | 'PULSAR'
  | 'NEMESIS'
  | 'OMEGA';

const BOSS_ARCHETYPES: readonly BossArchetype[] = [
  'VANGUARD',
  'VIPER',
  'PHALANX',
  'VORTEX',
  'SNIPER',
  'CARRIER',
  'TEMPEST',
  'PULSAR',
  'NEMESIS',
  'OMEGA',
] as const;

export interface BossProfile {
  tier: number;
  archetype: BossArchetype;
  maxHp: number;
  strafeSpeed: number;
  bulletSpeed: number;
  attackCooldown: number;
  chargeTicks: number;
  fanCount: number;
  curtainCount: number;
  bananaCount: number;
  maxEscorts: number;
  escortHp: number;
  enragedThreshold: number;
  criticalThreshold: number;
  weaveAmplitude: number;
}

/**
 * Strictly escalating boss difficulty profile across all 10 boss tiers
 * (levels 10, 20, 30, …, 100). Every tier has its own combat archetype
 * and strictly increases HP, movement speed, projectile speed, attack
 * cadence, reaction pressure, and volley density over the previous boss.
 */
export function getBossProfile(tier: number): BossProfile {
  const clamped = Math.max(1, Math.min(Math.floor(MAX_LEVEL / BOSS_INTERVAL), Math.floor(tier)));
  const t = clamped - 1; // 0..9
  return {
    tier: clamped,
    archetype: BOSS_ARCHETYPES[t] ?? 'OMEGA',
    maxHp: 90 + t * 44 + t * t * 3,
    strafeSpeed: 1.9 + t * 0.25,
    bulletSpeed: 3.8 + t * 0.24,
    attackCooldown: 78 - t * 3.4,
    chargeTicks: 26 - t * 0.9,
    fanCount: 3 + Math.floor(t / 2),
    curtainCount: 6 + Math.floor(t * 0.65),
    bananaCount: 3 + Math.floor(t * 0.5),
    maxEscorts: 1 + Math.floor(t / 3),
    escortHp: Math.min(2, 1 + Math.floor(t / 4)),
    enragedThreshold: clamped >= 5 ? 0.65 : 0.6,
    criticalThreshold: clamped >= 7 ? 0.32 : 0.28,
    weaveAmplitude: 9 + t * 0.9,
  };
}

/** Creates the Boss dreadnought for levels 10, 20, …, 100. */
export function createBossForLevel(level: number): Boss | null {
  if (!isBossLevel(level)) return null;
  const tier = Math.floor(clampLevel(level) / BOSS_INTERVAL); // 1..10
  const profile = getBossProfile(tier);
  const palette = SECTOR_PALETTES[Math.min(SECTOR_PALETTES.length - 1, tier - 1)];

  return {
    active: true,
    tier,
    x: CANVAS_W / 2 - BOSS_W / 2,
    y: -BOSS_H - 30,
    targetY: 92,
    vx: profile.strafeSpeed,
    w: BOSS_W,
    h: BOSS_H,
    hp: profile.maxHp,
    maxHp: profile.maxHp,
    hitFlash: 0,
    enraged: false,
    attackTimer: Math.max(24, Math.round(profile.attackCooldown * 0.78)),
    attackIndex: 0,
    chargeTimer: 0,
    entering: true,
    accentColor: palette.bossAccent,
  };
}
