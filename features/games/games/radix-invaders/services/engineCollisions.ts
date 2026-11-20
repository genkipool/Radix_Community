/**
 * Collision resolution, damage handling, pickup collection, and end-condition
 * checks for the Radix Invaders simulation engine.
 */
import type { GameState } from '../types/radix-invaders.types';
import {
  ALIEN_H,
  ALIEN_W,
  COLORS,
  COMBO_WINDOW,
  CONTINUE_COUNTDOWN,
  MAX_CONTINUES,
  MAX_LIVES,
  PLAYER_Y,
  POWERUP_COLORS,
  POWERUP_DURATION,
  UFO_W,
} from '../constants/radix-invaders.constants';
import {
  aabb,
  addShake,
  alienGlow,
  spawnExplosion,
  spawnText,
} from './engineVfx';

export function damageShieldAt(s: GameState, bx: number, by: number): boolean {
  for (let si = 0; si < s.shields.length; si++) {
    const sh = s.shields[si];
    const cols = sh.blocks[0].length;
    const rows = sh.blocks.length;
    const sw = cols * sh.blockW;
    const shH = rows * sh.blockH;
    if (!aabb(bx - 3, by - 4, 6, 8, sh.x, sh.y, sw, shH)) continue;

    const col = Math.floor((bx - sh.x) / sh.blockW);
    const row = Math.floor((by - sh.y) / sh.blockH);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = row + dr;
        const cc = col + dc;
        if (rr >= 0 && rr < rows && cc >= 0 && cc < cols && sh.blocks[rr][cc]) {
          sh.blocks[rr][cc] = false;
          spawnExplosion(s, bx, by, COLORS.shield, 4, 2.2, false);
          return true;
        }
      }
    }
  }
  return false;
}

export function hitPlayer(s: GameState) {
  if (s.player.invincible > 0) return;

  if (s.player.hasShield) {
    s.player.hasShield = false;
    s.player.invincible = 70;
    s.combo = 0;
    s.comboTimer = 0;
    spawnExplosion(s, s.player.x, PLAYER_Y, COLORS.shieldItem, 22, 6, true);
    addShake(s, 10, 4);
    s.sfx.push({ type: 'shield_hit' });
    return;
  }

  s.lives -= 1;
  s.player.invincible = 125;
  s.combo = 0;
  s.comboTimer = 0;
  spawnExplosion(s, s.player.x, PLAYER_Y, COLORS.playerShip, 28, 6.5, true);
  addShake(s, 16, 7);
  s.sfx.push({ type: 'player_die' });
}

export function registerKill(s: GameState, basePoints: number, x: number, y: number, color: string) {
  s.combo = Math.min(5, s.combo + 1);
  s.comboTimer = COMBO_WINDOW;
  const mult = s.combo >= 5 ? 3 : s.combo >= 3 ? 2 : 1;
  const pts = basePoints * mult;
  s.score += pts;
  const label = mult > 1 ? `+${pts} x${mult}` : `+${pts}`;
  spawnText(s, x, y - 8, label, mult > 1 ? COLORS.gold : color, mult > 1 ? 15 : 13, 46);
}

export function resolvePlayerBulletCollisions(state: GameState) {
  let bpw = 0;
  for (let bi = 0; bi < state.bulletsP.length; bi++) {
    const b = state.bulletsP[bi];
    let consumed = false;

    // 1. Boss hit
    if (state.boss && state.boss.active && !state.boss.entering) {
      const boss = state.boss;
      if (aabb(b.x - 5, b.y - 10, 10, 20, boss.x + 8, boss.y + 6, boss.w - 16, boss.h - 10)) {
        boss.hp -= b.damage;
        boss.hitFlash = 5;
        spawnExplosion(state, b.x, b.y, boss.accentColor, 7, 3.5, false);
        consumed = true;

        if (boss.hp <= 0) {
          boss.active = false;
          const bossPts = 1000 * boss.tier;
          state.score += bossPts;
          const cx = boss.x + boss.w / 2;
          const cy = boss.y + boss.h / 2;
          spawnExplosion(state, cx, cy, boss.accentColor, 48, 9, true);
          spawnExplosion(state, cx - 44, cy, COLORS.gold, 24, 7, true);
          spawnExplosion(state, cx + 44, cy, COLORS.primary, 24, 7, true);
          spawnText(state, cx, cy, `+${bossPts}`, COLORS.gold, 24, 85);
          addShake(state, 28, 10);
          state.sfx.push({ type: 'boss_die' });
          for (let ai = 0; ai < state.aliens.length; ai++) state.aliens[ai].alive = false;
        } else {
          state.sfx.push({ type: 'boss_hit' });
        }
      }
    }

    // 2. Aliens hit
    if (!consumed) {
      for (let ai = 0; ai < state.aliens.length; ai++) {
        const a = state.aliens[ai];
        if (!a.alive) continue;
        if (!aabb(b.x - 5, b.y - 10, 10, 20, a.x, a.y, ALIEN_W, ALIEN_H)) continue;

        a.hp -= b.damage;
        a.hitFlash = 6;
        if (a.hp <= 0) {
          a.alive = false;
          const basePts = a.type === 3 ? 60 : ([30, 20, 10][a.type as 0 | 1 | 2] ?? 10);
          registerKill(state, basePts, a.x + ALIEN_W / 2, a.y + ALIEN_H / 2, alienGlow(a.type));
          spawnExplosion(state, a.x + ALIEN_W / 2, a.y + ALIEN_H / 2, alienGlow(a.type), 16, 5.2, true);
          state.sfx.push({ type: 'alien_die', alienType: a.type });
        } else {
          spawnExplosion(state, b.x, b.y, '#ffffff', 5, 2.5, false);
          state.sfx.push({ type: 'boss_hit' });
        }

        if (b.kind !== 'laser') {
          consumed = true;
          break;
        }
      }
    }

    // 3. UFO hit
    if (!consumed && state.ufo.active && aabb(b.x - 4, b.y - 8, 8, 16, state.ufo.x, state.ufo.y, UFO_W, 22)) {
      const cx = state.ufo.x + UFO_W / 2;
      const cy = state.ufo.y + 11;
      registerKill(state, state.ufo.score, cx, cy, COLORS.ufo);
      spawnExplosion(state, cx, cy, COLORS.ufo, 26, 6.5, true);
      addShake(state, 8, 3);
      state.sfx.push({ type: 'ufo_die' });
      state.ufo.active = false;
      if (b.kind !== 'laser') consumed = true;
    }

    // 4. Shields hit
    if (!consumed && damageShieldAt(state, b.x, b.y)) {
      if (b.kind !== 'laser') consumed = true;
    }

    if (!consumed) state.bulletsP[bpw++] = b;
  }
  state.bulletsP.length = bpw;
}

export function resolveEnemyAndPickupCollisions(state: GameState) {
  // Aliens crushing shields
  for (let ai = 0; ai < state.aliens.length; ai++) {
    const a = state.aliens[ai];
    if (!a.alive) continue;
    for (let si = 0; si < state.shields.length; si++) {
      const sh = state.shields[si];
      const sw = sh.blocks[0].length * sh.blockW;
      const shH = sh.blocks.length * sh.blockH;
      if (!aabb(a.x, a.y, ALIEN_W, ALIEN_H, sh.x, sh.y, sw, shH)) continue;
      let hadBlock = false;
      for (let r = 0; r < sh.blocks.length; r++) {
        for (let c = 0; c < sh.blocks[r].length; c++) {
          if (sh.blocks[r][c]) {
            sh.blocks[r][c] = false;
            hadBlock = true;
          }
        }
      }
      if (hadBlock) spawnExplosion(state, sh.x + sw / 2, sh.y + shH / 2, COLORS.shield, 22, 5, true);
    }
  }

  // Enemy bullets vs Shields & Player
  let bew = 0;
  for (let i = 0; i < state.bulletsE.length; i++) {
    const b = state.bulletsE[i];
    if (damageShieldAt(state, b.x, b.y)) {
      if (b.kind === 'boss_heavy') damageShieldAt(state, b.x, b.y + 8);
      continue;
    }

    const bW = b.kind === 'banana' ? 14 : b.kind === 'boss_heavy' ? 10 : 8;
    const bH = b.kind === 'boss_heavy' ? 16 : 12;
    if (state.player.invincible <= 0 && aabb(b.x - bW / 2, b.y - bH / 2, bW, bH, state.player.x - 20, PLAYER_Y - 12, 40, 24)) {
      hitPlayer(state);
      continue;
    }
    state.bulletsE[bew++] = b;
  }
  state.bulletsE.length = bew;

  // Diving aliens vs Player
  if (state.player.invincible <= 0) {
    for (let i = 0; i < state.aliens.length; i++) {
      const a = state.aliens[i];
      if (!a.alive || !a.diving) continue;
      if (aabb(a.x + 4, a.y + 4, ALIEN_W - 8, ALIEN_H - 8, state.player.x - 20, PLAYER_Y - 12, 40, 24)) {
        a.alive = false;
        spawnExplosion(state, a.x + ALIEN_W / 2, a.y + ALIEN_H / 2, COLORS.glow3, 16, 5, true);
        hitPlayer(state);
        break;
      }
    }
  }

  // Power-up, Extra Life & Continue pickups
  let puw = 0;
  for (let i = 0; i < state.powerUpItems.length; i++) {
    const item = state.powerUpItems[i];
    if (aabb(item.x - 14, item.y - 14, 28, 28, state.player.x - 27, PLAYER_Y - 15, 54, 30)) {
      if (item.type === 'CONTINUE') {
        if (state.continues < MAX_CONTINUES) {
          state.continues += 1;
          spawnText(state, item.x, item.y - 10, '+1 CONTINUE', COLORS.continueItem, 18, 75);
        } else {
          state.score += 1000;
          spawnText(state, item.x, item.y - 10, '+1000', COLORS.gold, 18, 75);
        }
        spawnExplosion(state, item.x, item.y, COLORS.continueItem, 26, 6.5, true);
        state.sfx.push({ type: 'extra_life' });
      } else if (item.type === 'LIFE') {
        if (state.lives < MAX_LIVES) {
          state.lives += 1;
          spawnText(state, item.x, item.y - 10, '+1 UP', COLORS.lifeItem, 18, 70);
        } else {
          state.score += 500;
          spawnText(state, item.x, item.y - 10, '+500', COLORS.gold, 18, 70);
        }
        spawnExplosion(state, item.x, item.y, COLORS.lifeItem, 24, 6, true);
        state.sfx.push({ type: 'extra_life' });
      } else if (item.type === 'SHIELD') {
        state.player.hasShield = true;
        spawnText(state, item.x, item.y - 10, 'SHIELD', COLORS.shieldItem, 16, 60);
        spawnExplosion(state, item.x, item.y, COLORS.shieldItem, 18, 5, true);
        state.sfx.push({ type: 'power_up' });
      } else {
        state.powerUp = item.type;
        state.powerUpTimer = POWERUP_DURATION;
        const puColor = POWERUP_COLORS[item.type];
        spawnText(state, item.x, item.y - 10, item.type, puColor, 16, 60);
        spawnExplosion(state, item.x, item.y, puColor, 18, 5, true);
        state.sfx.push({ type: 'power_up' });
      }
    } else {
      state.powerUpItems[puw++] = item;
    }
  }
  state.powerUpItems.length = puw;
}

export function checkInvasionAndEndConditions(state: GameState) {
  for (let i = 0; i < state.aliens.length; i++) {
    const a = state.aliens[i];
    if (a.alive && !a.diving && a.y + ALIEN_H >= PLAYER_Y - 12) {
      state.lives = 0;
      break;
    }
  }

  const prevHi = state.hiScore;
  if (state.score > state.hiScore) state.hiScore = state.score;

  if (state.lives <= 0) {
    spawnExplosion(state, state.player.x, PLAYER_Y, COLORS.playerShip, 38, 8, true);
    state.newRecord = state.score > prevHi && prevHi > 0;
    state.lives = 0;
    if (state.continues > 0) {
      state.screen = 'CONTINUE';
      state.continueTimer = CONTINUE_COUNTDOWN;
      state.bulletsE.length = 0;
    } else {
      state.screen = 'GAME_OVER';
      state.sfx.push({ type: 'game_over' });
    }
  }
}
