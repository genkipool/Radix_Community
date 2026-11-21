/**
 * Per-frame entity movement & spawning routines (bullets, alien waves,
 * dive-bombers, UFO, and power-up drops) for Radix Invaders.
 */
import type {
  Alien,
  GameState,
  PowerUpItemType,
} from '../types/radix-invaders.types';
import {
  ALIEN_COLS,
  ALIEN_H,
  ALIEN_W,
  CANVAS_H,
  CANVAS_W,
  PLAYER_Y,
  UFO_SPEED,
  UFO_W,
} from '../constants/radix-invaders.constants';
import {
  crossedInterval,
  pushBullet,
  rand,
  randInt,
  spawnPickupItem,
} from './engineVfx';
import { isPreBossLevel, type WaveDifficulty } from './waves';

export function updatePlayerBullets(state: GameState, dt: number) {
  let bpw = 0;
  for (let i = 0; i < state.bulletsP.length; i++) {
    const b = state.bulletsP[i];
    if (!b.active) continue;
    b.prevX = b.x;
    b.prevY = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y > -28 && b.x > -20 && b.x < CANVAS_W + 20) {
      state.bulletsP[bpw++] = b;
    }
  }
  state.bulletsP.length = bpw;
}

export interface AlienWaveScan {
  staticCount: number;
  anyAlive: boolean;
  leftmost: number;
  rightmost: number;
}

export function scanAliens(state: GameState): AlienWaveScan {
  let staticCount = 0;
  let anyAlive = false;
  let leftmost = Infinity;
  let rightmost = -Infinity;

  for (let i = 0; i < state.aliens.length; i++) {
    const a = state.aliens[i];
    if (!a.alive) continue;
    anyAlive = true;
    if (!a.diving) {
      staticCount += 1;
      if (a.x < leftmost) leftmost = a.x;
      if (a.x + ALIEN_W > rightmost) rightmost = a.x + ALIEN_W;
    }
  }

  // Guaranteed extra-life item on pre-boss levels (9, 19, 29, …, 99)
  if (isPreBossLevel(state.level) && !state.preBossLifeDropped) {
    const killedRatio = state.initialAlienCount > 0 ? 1 - staticCount / state.initialAlienCount : 0;
    if (killedRatio >= 0.25 || state.tick >= 240) {
      spawnPickupItem(state, 'LIFE', CANVAS_W * 0.5 + rand(-180, 180), 42, 1.25);
      state.preBossLifeDropped = true;
    }
  }

  return { staticCount, anyAlive, leftmost, rightmost };
}

export function updateAliensAndDiveBombers(
  state: GameState,
  scan: AlienWaveScan,
  diff: WaveDifficulty,
  prevTick: number,
  dt: number,
) {
  if (scan.staticCount > 0) {
    if (scan.rightmost >= CANVAS_W - 10) {
      state.alienDir = -1;
      state.alienDropQueued = true;
    } else if (scan.leftmost <= 10) {
      state.alienDir = 1;
      state.alienDropQueued = true;
    }

    const ratio = state.initialAlienCount > 0 ? scan.staticCount / state.initialAlienCount : 1;
    const speedNow = state.alienSpeed * (1 + (1 - ratio) * 1.65);
    const dropY = state.alienDropQueued ? 16 : 0;
    state.alienDropQueued = false;

    const prevFrame = state.alienFrame;
    state.alienFrameTimer += dt;
    if (state.alienFrameTimer >= Math.max(6, Math.round(22 - ratio * 8))) {
      state.alienFrame = (state.alienFrame + 1) % 2;
      state.alienFrameTimer = 0;
    }
    if (state.alienFrame !== prevFrame) {
      state.sfx.push({ type: 'alien_step', tick: Math.floor(state.tick) });
    }

    const dxMove = state.alienDir * speedNow * dt;
    for (let i = 0; i < state.aliens.length; i++) {
      const a = state.aliens[i];
      if (!a.alive) continue;
      if (a.hitFlash > 0) a.hitFlash = Math.max(0, a.hitFlash - dt);
      if (!a.diving) {
        a.x += dxMove;
        a.y += dropY;
      }
    }

    // Trigger dive-bomber
    if (diff.diveChance > 0 && crossedInterval(prevTick, state.tick, diff.diveInterval) && Math.random() < diff.diveChance) {
      const candidates: Alien[] = [];
      let activeDivers = 0;
      for (let i = 0; i < state.aliens.length; i++) {
        const a = state.aliens[i];
        if (!a.alive) continue;
        if (a.diving) activeDivers += 1;
        else candidates.push(a);
      }
      if (candidates.length > 0) {
        const launchCount = state.level >= 90 && candidates.length >= 2 && Math.random() < 0.45 ? 2 : 1;
        for (let k = 0; k < launchCount; k++) {
          const pickIdx = randInt(0, candidates.length - 1);
          const diver = candidates[pickIdx];
          candidates[pickIdx] = candidates[candidates.length - 1];
          candidates.pop();
          diver.diving = true;
          diver.divePhase = 'RISE';
          diver.diveFlipTimer = 0;
          diver.diveAngle = -Math.PI / 2;
          diver.type = 3;
          if (diver.hp > 2) diver.hp = 2;
          if (diver.maxHp > 2) diver.maxHp = 2;
        }
        if (state.powerUp === 'NONE' && activeDivers + launchCount >= 2) {
          const maxShielded = state.level >= 90 ? 1 : 0;
          let shieldedCount = 0;
          for (let i = 0; i < state.aliens.length; i++) {
            const a = state.aliens[i];
            if (a.alive && a.diving && a.hp > 1) {
              if (shieldedCount < maxShielded) {
                shieldedCount += 1;
              } else {
                a.hp = 1;
                a.maxHp = 1;
              }
            }
          }
        }
      }
    }
  }

  // Update diving aliens (including boss escorts) — crisp & dodgeable swoop
  const diveSpeed = 4.9 + Math.min(2.9, Math.pow(state.level, 0.65) * 0.22);
  for (let i = 0; i < state.aliens.length; i++) {
    const a = state.aliens[i];
    if (!a.alive || !a.diving) continue;
    if (a.hitFlash > 0) a.hitFlash = Math.max(0, a.hitFlash - dt);
    if (a.divePhase === 'RISE') {
      a.y -= 3.0 * dt;
      a.diveFlipTimer += dt;
      if (a.diveFlipTimer > 25) {
        a.divePhase = 'DIVE';
        a.diveAngle = Math.PI * 0.5;
        a.diveFlipTimer = 0;
      }
    } else {
      const targetAngle = Math.atan2(PLAYER_Y - a.y, state.player.x - a.x);
      const angDiff = ((targetAngle - a.diveAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      a.diveAngle += Math.sign(angDiff) * Math.min(0.056 * dt, Math.abs(angDiff));
      a.x += Math.cos(a.diveAngle) * diveSpeed * dt;
      a.y += Math.sin(a.diveAngle) * diveSpeed * dt;
      if (a.y > CANVAS_H + 60 || a.x < -80 || a.x > CANVAS_W + 80) {
        a.alive = false;
      }
    }
  }
}

export function updateEnemyShootingAndBullets(
  state: GameState,
  staticCount: number,
  diff: WaveDifficulty,
  prevTick: number,
  dt: number,
) {
  if (staticCount > 0 && crossedInterval(prevTick, state.tick, diff.shootInterval)) {
    const col = randInt(0, ALIEN_COLS - 1);
    let shooter: Alien | null = null;
    for (let i = 0; i < state.aliens.length; i++) {
      const a = state.aliens[i];
      if (a.alive && !a.diving && a.col === col && (!shooter || a.y > shooter.y)) {
        shooter = a;
      }
    }
    if (shooter) {
      const useBanana = diff.bananaChance > 0 && Math.random() < diff.bananaChance;
      pushBullet(
        state.bulletsE,
        shooter.x + ALIEN_W / 2,
        shooter.y + ALIEN_H,
        0,
        useBanana ? diff.bulletSpeed * 0.78 : diff.bulletSpeed,
        useBanana ? 'banana' : 'enemy',
        1,
        useBanana ? rand(0, Math.PI * 2) : undefined,
      );
    }
  }

  let bew = 0;
  for (let i = 0; i < state.bulletsE.length; i++) {
    const b = state.bulletsE[i];
    if (!b.active) continue;
    b.prevX = b.x;
    b.prevY = b.y;
    if (b.kind === 'banana') {
      b.x += Math.sin(state.tick * 0.13 + (b.phase ?? 0)) * 2.4 * dt;
      b.y += b.vy * dt;
    } else {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    if (b.y < CANVAS_H + 24 && b.y > -30 && b.x > -30 && b.x < CANVAS_W + 30) {
      state.bulletsE[bew++] = b;
    }
  }
  state.bulletsE.length = bew;
}

export function updateUfo(
  state: GameState,
  bossAlive: boolean,
  staticCount: number,
  prevTick: number,
  dt: number,
) {
  if (!bossAlive && !state.ufo.active && crossedInterval(prevTick, state.tick, 440, 210) && staticCount > 4) {
    const dir = (Math.floor(state.tick) % 880 < 440 ? 1 : -1) as 1 | -1;
    state.ufo.active = true;
    state.ufo.dir = dir;
    state.ufo.x = dir === 1 ? -UFO_W : CANVAS_W + UFO_W;
    state.ufo.y = 52;
    state.ufo.score = [100, 150, 250, 500][randInt(0, 3)];
    state.ufo.hitFlash = 0;
    state.sfx.push({ type: 'ufo_appear' });
  }
  if (state.ufo.active) {
    state.ufo.x += state.ufo.dir * UFO_SPEED * dt;
    if (state.ufo.hitFlash > 0) state.ufo.hitFlash = Math.max(0, state.ufo.hitFlash - dt);
    if (state.ufo.x < -UFO_W * 2 || state.ufo.x > CANVAS_W + UFO_W * 2) {
      state.ufo.active = false;
    }
  }
}

export function updatePowerUpItemsAndDrops(
  state: GameState,
  bossAlive: boolean,
  prevTick: number,
  dt: number,
) {
  let puw = 0;
  for (let i = 0; i < state.powerUpItems.length; i++) {
    const item = state.powerUpItems[i];
    if (!item.active) continue;
    item.y += item.vy * dt;
    item.rotation += 0.04 * dt;
    item.pulse += 0.1 * dt;
    if (item.y < CANVAS_H + 40) state.powerUpItems[puw++] = item;
  }
  state.powerUpItems.length = puw;

  // Guaranteed CONTINUE token drop on every Boss screen
  if (
    bossAlive
    && !state.bossContinueDropped
    && state.boss
    && !state.boss.entering
    && (state.boss.hp <= state.boss.maxHp * 0.65 || state.tick >= 220)
  ) {
    spawnPickupItem(state, 'CONTINUE', rand(80, CANVAS_W - 80), Math.max(80, state.boss.y + state.boss.h), 1.25);
    state.bossContinueDropped = true;
  }

  if (crossedInterval(prevTick, state.tick, 340, 170) && Math.random() < (bossAlive ? 0.72 : 0.62)) {
    const pool: PowerUpItemType[] = state.level >= 80
      ? ['SPREAD', 'LASER', 'RAPID', 'SHIELD', 'SHIELD']
      : ['SPREAD', 'LASER', 'RAPID', 'SHIELD'];
    spawnPickupItem(state, pool[randInt(0, pool.length - 1)], rand(64, CANVAS_W - 64), -22, 1.5);
  }
}
