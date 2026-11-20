/**
 * High-performance continuous-dt in-place simulation engine for Radix Invaders.
 *
 * - Continuous normalized `dt` (`1.0 === 1/60 s`) ensures butter-smooth native
 *   frame pacing at 60 Hz, 120 Hz, 144 Hz, and 240 Hz with zero accumulator judder.
 * - VFX/math helpers live in `./engineVfx`, entity updates in `./engineEntities`,
 *   collision/pickup resolution in `./engineCollisions`, and boss AI in `./bossAi`.
 */
import type { GameState, Star } from '../types/radix-invaders.types';
import {
  BULLET_SPEED_P,
  CANVAS_H,
  CANVAS_W,
  COLORS,
  INITIAL_LIVES,
  MAX_CONTINUES,
  MAX_LEVEL,
  MAX_LIVES,
  PLAYER_SPEED,
  PLAYER_W,
  PLAYER_Y,
  SHIELD_COUNT,
  UFO_W,
} from '../constants/radix-invaders.constants';
import { updateBoss } from './bossAi';
import {
  checkInvasionAndEndConditions,
  resolveEnemyAndPickupCollisions,
  resolvePlayerBulletCollisions,
} from './engineCollisions';
import {
  scanAliens,
  updateAliensAndDiveBombers,
  updateEnemyShootingAndBullets,
  updatePlayerBullets,
  updatePowerUpItemsAndDrops,
  updateUfo,
} from './engineEntities';
import {
  crossedInterval,
  makeShield,
  makeStars,
  pushBullet,
  rand,
  randInt,
  spawnExplosion,
  spawnText,
  updateBackgroundInPlace,
} from './engineVfx';
import {
  clampLevel,
  createBossForLevel,
  createWaveAliens,
  getWaveDifficulty,
  isBossLevel,
} from './waves';

const TIME_BONUS_TARGET_TICKS = 1800; // 30s at 60fps
const TIME_BONUS_MAX = 2000;

export function initGameState(
  level: number,
  prevHi: number,
  prevScore = 0,
  prevLives = INITIAL_LIVES,
  prevStars?: Star[],
  prevShield = false,
  prevContinues = 0,
): GameState {
  const clamped = clampLevel(level);
  const shieldY = CANVAS_H - 178;
  const sp = CANVAS_W / (SHIELD_COUNT + 1);
  const shields = Array.from({ length: SHIELD_COUNT }, (_, i) => makeShield(sp * (i + 1), shieldY));
  const boss = createBossForLevel(clamped);
  const aliens = createWaveAliens(clamped);
  const diff = getWaveDifficulty(clamped);
  const isBoss = isBossLevel(clamped);

  return {
    screen: 'PLAYING',
    mode: 'FUN',
    score: prevScore,
    hiScore: prevHi,
    lives: Math.min(MAX_LIVES, prevLives),
    continues: Math.min(MAX_CONTINUES, prevContinues),
    continueTimer: 0,
    level: clamped,
    player: {
      x: CANVAS_W / 2,
      vx: 0,
      tilt: 0,
      shootCooldown: 0,
      invincible: 0,
      hasShield: prevShield,
    },
    powerUp: 'NONE',
    powerUpTimer: 0,
    combo: 0,
    comboTimer: 0,
    aliens,
    initialAlienCount: aliens.length,
    alienDir: 1,
    alienDropQueued: false,
    alienSpeed: diff.baseSpeed,
    alienFrameTimer: 0,
    alienFrame: 0,
    boss,
    bossWarningTimer: isBoss ? 110 : 0,
    preBossLifeDropped: false,
    bossContinueDropped: false,
    bulletsP: [],
    bulletsE: [],
    shields,
    ufo: { active: false, x: -UFO_W, y: 52, dir: 1, score: 0, hitFlash: 0 },
    powerUpItems: [],
    particles: [],
    shockwaves: [],
    floatingTexts: [],
    stars: prevStars ?? makeStars(),
    shakeTimer: isBoss ? 18 : 0,
    shakeIntensity: isBoss ? 4 : 0,
    tick: 0,
    stageTimer: 0,
    newRecord: false,
    nextPowerUpId: 1,
    stageStartTick: 0,
    timeBonus: 0,
    timeBonusTimer: 0,
    sfx: isBoss ? [{ type: 'boss_warning' }] : [],
  };
}

function firePlayerWeapon(s: GameState, px: number, py: number): number {
  const pu = s.powerUp;
  if (pu === 'SPREAD') {
    pushBullet(s.bulletsP, px, py, -3.2, -BULLET_SPEED_P + 1.5, 'spread', 1);
    pushBullet(s.bulletsP, px, py, 0, -BULLET_SPEED_P, 'spread', 1);
    pushBullet(s.bulletsP, px, py, 3.2, -BULLET_SPEED_P + 1.5, 'spread', 1);
    s.sfx.push({ type: 'shoot', kind: 'spread' });
    return 17;
  }
  if (pu === 'RAPID') {
    const offset = Math.floor(s.tick) % 2 === 0 ? -7 : 7;
    pushBullet(s.bulletsP, px + offset, py, 0, -BULLET_SPEED_P - 3.5, 'rapid', 1);
    s.sfx.push({ type: 'shoot', kind: 'rapid' });
    return 7;
  }
  if (pu === 'LASER') {
    pushBullet(s.bulletsP, px, py - 4, 0, -BULLET_SPEED_P * 1.45, 'laser', 2);
    s.sfx.push({ type: 'shoot', kind: 'laser' });
    return 19;
  }
  pushBullet(s.bulletsP, px, py, 0, -BULLET_SPEED_P, 'normal', 1);
  s.sfx.push({ type: 'shoot', kind: 'normal' });
  return 15;
}

/** Consumes 1 Continue token to revive the player right where they fell. */
export function consumeContinue(state: GameState): boolean {
  if (state.screen !== 'CONTINUE' || state.continues <= 0) return false;
  state.continues -= 1;
  state.lives = INITIAL_LIVES;
  state.continueTimer = 0;
  state.player.x = CANVAS_W / 2;
  state.player.vx = 0;
  state.player.tilt = 0;
  state.player.invincible = 150;
  state.bulletsE.length = 0;
  state.screen = 'PLAYING';
  spawnExplosion(state, state.player.x, PLAYER_Y, COLORS.continueItem, 28, 6.5, true);
  spawnText(state, state.player.x, PLAYER_Y - 24, 'CONTINUE!', COLORS.continueItem, 18, 70);
  state.sfx.push({ type: 'extra_life' });
  return true;
}

function finishStage(s: GameState) {
  const prevHi = s.hiScore;
  const elapsed = s.tick - s.stageStartTick;
  const bonus = Math.max(
    0,
    Math.floor((1 - Math.min(1, elapsed / TIME_BONUS_TARGET_TICKS)) * TIME_BONUS_MAX * Math.min(10, 1 + s.level * 0.1)),
  );
  s.score += bonus;
  s.hiScore = Math.max(s.score, s.hiScore);
  s.timeBonus = bonus;
  s.timeBonusTimer = bonus > 0 ? 110 : 0;
  s.bulletsE.length = 0;

  if (s.level >= MAX_LEVEL) {
    s.screen = 'VICTORY';
    s.newRecord = s.score > prevHi && prevHi > 0;
    s.sfx.push({ type: 'victory' });
    return;
  }

  s.screen = 'STAGE_CLEAR';
  s.stageTimer = 135;
  s.sfx.push({ type: 'stage_clear' });
  if (bonus > 0) s.sfx.push({ type: 'time_bonus' });
}

function updateNonPlayingScreen(state: GameState, prevTick: number, dt: number): GameState {
  const warp = state.screen === 'STAGE_CLEAR' ? 3.5 : 1;
  updateBackgroundInPlace(state, dt, warp);
  state.tick += dt;
  if (state.screen === 'STAGE_CLEAR') {
    state.stageTimer -= dt;
    if (state.timeBonusTimer > 0) state.timeBonusTimer = Math.max(0, state.timeBonusTimer - dt);
  }
  if (state.screen === 'CONTINUE') {
    state.continueTimer -= dt;
    if (state.continueTimer <= 0) {
      state.continueTimer = 0;
      state.screen = 'GAME_OVER';
      state.sfx.push({ type: 'game_over' });
    }
  }
  if (state.screen === 'VICTORY' && crossedInterval(prevTick, state.tick, 25)) {
    const fx = rand(120, CANVAS_W - 120);
    const fy = rand(100, CANVAS_H * 0.55);
    const palette = [COLORS.primary, COLORS.secondary, COLORS.gold, COLORS.accent];
    spawnExplosion(state, fx, fy, palette[randInt(0, palette.length - 1)], 20, 6, true);
  }
  return state;
}

function updatePlayerAndShooting(
  state: GameState,
  keys: Set<string>,
  isMouseActive: boolean,
  mouseX: number,
  mouseClick: boolean,
  clearMouseClick: () => void,
  dt: number,
) {
  let targetVx = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) targetVx -= PLAYER_SPEED;
  if (keys.has('ArrowRight') || keys.has('KeyD')) targetVx += PLAYER_SPEED;
  if (isMouseActive && targetVx === 0) {
    const dx = mouseX - state.player.x;
    if (Math.abs(dx) > 2) {
      targetVx = Math.sign(dx) * Math.min(PLAYER_SPEED * 1.25, Math.abs(dx) * 0.28);
    }
  }
  const vxBlend = 1 - Math.pow(1 - 0.52, dt);
  state.player.vx += (targetVx - state.player.vx) * vxBlend;
  if (Math.abs(state.player.vx) < 0.04) state.player.vx = 0;
  state.player.x = Math.max(PLAYER_W / 2, Math.min(CANVAS_W - PLAYER_W / 2, state.player.x + state.player.vx * dt));
  const tiltBlend = 1 - Math.pow(1 - 0.28, dt);
  state.player.tilt += (Math.max(-1, Math.min(1, state.player.vx / PLAYER_SPEED)) - state.player.tilt) * tiltBlend;

  if (state.player.shootCooldown > 0) state.player.shootCooldown = Math.max(0, state.player.shootCooldown - dt);
  if (state.player.invincible > 0) state.player.invincible = Math.max(0, state.player.invincible - dt);
  if (state.powerUpTimer > 0) {
    state.powerUpTimer = Math.max(0, state.powerUpTimer - dt);
    if (state.powerUpTimer === 0) state.powerUp = 'NONE';
  }

  const wantShoot = keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW') || mouseClick;
  if (mouseClick) clearMouseClick();

  if (wantShoot && state.player.shootCooldown <= 0) {
    state.player.shootCooldown = firePlayerWeapon(state, state.player.x, PLAYER_Y - 16);
  }
}

export function updateGame(
  state: GameState,
  keys: Set<string>,
  isMouseActive: boolean,
  mouseX: number,
  mouseClick: boolean,
  clearMouseClick: () => void,
  dt = 1,
): GameState {
  state.sfx.length = 0;
  const prevTick = state.tick;

  if (state.screen !== 'PLAYING') {
    return updateNonPlayingScreen(state, prevTick, dt);
  }

  state.tick += dt;
  updateBackgroundInPlace(state, dt, 1);

  if (state.timeBonusTimer > 0) state.timeBonusTimer = Math.max(0, state.timeBonusTimer - dt);
  if (state.bossWarningTimer > 0) state.bossWarningTimer = Math.max(0, state.bossWarningTimer - dt);
  if (state.shakeTimer > 0) {
    state.shakeTimer = Math.max(0, state.shakeTimer - dt);
    if (state.shakeTimer === 0) state.shakeIntensity = 0;
  }
  if (state.comboTimer > 0) {
    state.comboTimer = Math.max(0, state.comboTimer - dt);
    if (state.comboTimer === 0) state.combo = 0;
  }

  const diff = getWaveDifficulty(state.level);
  updatePlayerAndShooting(state, keys, isMouseActive, mouseX, mouseClick, clearMouseClick, dt);
  updatePlayerBullets(state, dt);

  if (state.boss && state.boss.active) {
    updateBoss(state, state.boss, dt);
  }

  const scan = scanAliens(state);
  const bossAlive = !!(state.boss && state.boss.active);
  if (!bossAlive && !scan.anyAlive) {
    finishStage(state);
    return state;
  }

  updateAliensAndDiveBombers(state, scan, diff, prevTick, dt);
  updateEnemyShootingAndBullets(state, scan.staticCount, diff, prevTick, dt);
  updateUfo(state, bossAlive, scan.staticCount, prevTick, dt);
  updatePowerUpItemsAndDrops(state, bossAlive, prevTick, dt);

  resolvePlayerBulletCollisions(state);
  resolveEnemyAndPickupCollisions(state);
  checkInvasionAndEndConditions(state);

  return state;
}
