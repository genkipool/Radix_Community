/**
 * High-performance continuous-dt in-place simulation engine for Radix Invaders.
 *
 * - Continuous normalized `dt` (`1.0 === 1/60 s`) ensures butter-smooth native
 *   frame pacing at 60 Hz, 120 Hz, 144 Hz, and 240 Hz with zero accumulator judder.
 * - All per-frame collections are updated and compacted in place for near-zero GC.
 */
import type {
  Alien,
  Bullet,
  GameState,
  PowerUpItemType,
  Shield,
  Star,
} from '../types/radix-invaders.types';
import {
  ALIEN_COLS,
  ALIEN_H,
  ALIEN_W,
  BULLET_SPEED_P,
  CANVAS_H,
  CANVAS_W,
  COLORS,
  COMBO_WINDOW,
  CONTINUE_COUNTDOWN,
  INITIAL_LIVES,
  MAX_CONTINUES,
  MAX_LEVEL,
  MAX_LIVES,
  MAX_PARTICLES,
  PLAYER_SPEED,
  PLAYER_W,
  PLAYER_Y,
  POWERUP_DURATION,
  SHIELD_COUNT,
  UFO_SPEED,
  UFO_W,
} from '../constants/radix-invaders.constants';
import { updateBoss, type BossAiHooks } from './bossAi';
import {
  clampLevel,
  createBossForLevel,
  createWaveAliens,
  getWaveDifficulty,
  isBossLevel,
  isPreBossLevel,
} from './waves';

function rand(a: number, b: number): number {
  return Math.random() * (b - a) + a;
}

function randInt(a: number, b: number): number {
  return Math.floor(rand(a, b + 1));
}

function crossedInterval(prevTick: number, nextTick: number, interval: number, offset = 0): boolean {
  return Math.floor((prevTick - offset) / interval) !== Math.floor((nextTick - offset) / interval);
}

const TIME_BONUS_TARGET_TICKS = 1800; // 30s at 60fps
const TIME_BONUS_MAX = 2000;
const STAR_TINTS = ['#ffffff', '#cceeff', '#ffe8cc', '#d4ccff'] as const;

function makeStars(): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < 96; i++) {
    const layer = (i < 54 ? 0 : i < 82 ? 1 : 2) as 0 | 1 | 2;
    const speed = layer === 0 ? rand(0.08, 0.22) : layer === 1 ? rand(0.32, 0.65) : rand(0.9, 1.55);
    const r = layer === 0 ? rand(0.5, 1.1) : layer === 1 ? rand(1.1, 1.8) : rand(1.8, 2.6);
    stars.push({
      x: rand(0, CANVAS_W),
      y: rand(0, CANVAS_H),
      r,
      speed,
      layer,
      alpha: rand(0.35, 1),
      twinkleSpeed: rand(0.015, 0.05),
      twinklePhase: rand(0, Math.PI * 2),
      tint: STAR_TINTS[i % STAR_TINTS.length],
    });
  }
  // Group by tint once so renderer changes ctx.fillStyle only 4 times per frame
  stars.sort((a, b) => (a.tint < b.tint ? -1 : a.tint > b.tint ? 1 : 0));
  return stars;
}

function makeShield(cx: number, y: number): Shield {
  const W = 9;
  const H = 6;
  const blockW = 8;
  const blockH = 7;
  const x = cx - (W * blockW) / 2;
  const blocks: boolean[][] = Array.from({ length: H }, (_, r) =>
    Array.from({ length: W }, (_, c) => {
      if (r === 0 && (c === 0 || c === W - 1)) return false;
      if (r >= 4 && (c < 2 || c >= W - 2)) return false;
      return true;
    }),
  );
  return { blocks, x, y, blockW, blockH };
}

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
    flashMessage: '',
    flashTimer: 0,
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

function addShake(s: GameState, duration: number, intensity: number) {
  if (intensity >= s.shakeIntensity || s.shakeTimer <= 0) {
    s.shakeTimer = Math.max(s.shakeTimer, duration);
    s.shakeIntensity = Math.max(s.shakeIntensity, intensity);
  }
}

function spawnShockwave(s: GameState, x: number, y: number, color: string, maxR = 36) {
  if (s.shockwaves.length >= 24) return;
  s.shockwaves.push({ x, y, r: 4, maxR, life: 1, color });
}

function spawnText(s: GameState, x: number, y: number, text: string, color: string, size = 14, maxLife = 52) {
  if (s.floatingTexts.length >= 20) s.floatingTexts.shift();
  s.floatingTexts.push({ x, y, text, color, life: maxLife, maxLife, size });
}

function spawnExplosion(s: GameState, x: number, y: number, color: string, count = 16, spread = 5, withRing = true) {
  const room = MAX_PARTICLES - s.particles.length;
  const n = Math.min(count, Math.max(0, room));
  for (let i = 0; i < n; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(0.7, spread);
    const life = rand(0.65, 1);
    s.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      r: rand(1.6, 4.4),
      color: i % 5 === 0 ? '#ffffff' : color,
      glow: i % 2 === 0,
    });
  }
  if (withRing) spawnShockwave(s, x, y, color, spread * 6.5);
}

function aabb(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function alienGlow(type: number): string {
  return ([COLORS.glow0, COLORS.glow1, COLORS.glow2, COLORS.glow3])[type] ?? COLORS.glow1;
}

function pushBullet(
  list: Bullet[],
  x: number,
  y: number,
  vx: number,
  vy: number,
  kind: Bullet['kind'],
  damage = 1,
  phase?: number,
) {
  list.push({ x, y, vx, vy, active: true, prevX: x, prevY: y, kind, damage, phase });
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

function updateBackgroundInPlace(s: GameState, dt: number, warpMultiplier = 1) {
  const drag = Math.pow(0.985, dt);
  const rDecay = Math.pow(0.975, dt);

  for (let i = 0; i < s.stars.length; i++) {
    const st = s.stars[i];
    st.y += st.speed * warpMultiplier * dt;
    if (st.y > CANVAS_H) {
      st.y = -2;
      st.x = rand(0, CANVAS_W);
    }
    st.twinklePhase += st.twinkleSpeed * dt;
    st.alpha = 0.32 + 0.68 * ((Math.sin(st.twinklePhase) + 1) * 0.5);
  }

  let pw = 0;
  for (let i = 0; i < s.particles.length; i++) {
    const p = s.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= drag;
    p.vy = p.vy * drag + 0.055 * dt;
    p.life -= 0.025 * dt;
    p.r *= rDecay;
    if (p.life > 0 && p.r > 0.25) {
      s.particles[pw++] = p;
    }
  }
  s.particles.length = pw;

  let sw = 0;
  for (let i = 0; i < s.shockwaves.length; i++) {
    const r = s.shockwaves[i];
    r.r += ((r.maxR - r.r) * 0.22 + 1.2) * dt;
    r.life -= 0.055 * dt;
    if (r.life > 0) s.shockwaves[sw++] = r;
  }
  s.shockwaves.length = sw;

  let tw = 0;
  for (let i = 0; i < s.floatingTexts.length; i++) {
    const ft = s.floatingTexts[i];
    ft.y -= 0.85 * dt;
    ft.life -= dt;
    if (ft.life > 0) s.floatingTexts[tw++] = ft;
  }
  s.floatingTexts.length = tw;
}

function spawnContinueItem(s: GameState, x: number, y: number) {
  const clampedX = Math.max(64, Math.min(CANVAS_W - 64, x));
  s.powerUpItems.push({
    id: s.nextPowerUpId++,
    x: clampedX,
    y: Math.max(36, y),
    vy: 1.25,
    type: 'CONTINUE',
    active: true,
    rotation: 0,
    pulse: 0,
  });
  s.bossContinueDropped = true;
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

function spawnExtraLifeItem(s: GameState, x: number, y: number) {
  const clampedX = Math.max(64, Math.min(CANVAS_W - 64, x));
  s.powerUpItems.push({
    id: s.nextPowerUpId++,
    x: clampedX,
    y: Math.max(36, y),
    vy: 1.25,
    type: 'LIFE',
    active: true,
    rotation: 0,
    pulse: 0,
  });
  s.preBossLifeDropped = true;
}

function damageShieldAt(s: GameState, bx: number, by: number): boolean {
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

function hitPlayer(s: GameState) {
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

const BOSS_AI_HOOKS: BossAiHooks = {
  pushBullet,
  spawnExplosion,
  addShake,
  randInt,
};

function registerKill(s: GameState, basePoints: number, x: number, y: number, color: string) {
  s.combo = Math.min(5, s.combo + 1);
  s.comboTimer = COMBO_WINDOW;
  const mult = s.combo >= 5 ? 3 : s.combo >= 3 ? 2 : 1;
  const pts = basePoints * mult;
  s.score += pts;
  const label = mult > 1 ? `+${pts} x${mult}` : `+${pts}`;
  spawnText(s, x, y - 8, label, mult > 1 ? COLORS.gold : color, mult > 1 ? 15 : 13, 46);
}

function finishStage(s: GameState) {
  const elapsed = s.tick - s.stageStartTick;
  const bonus = Math.max(0, Math.floor((1 - Math.min(1, elapsed / TIME_BONUS_TARGET_TICKS)) * TIME_BONUS_MAX * Math.min(10, 1 + s.level * 0.1)));
  s.score += bonus;
  s.hiScore = Math.max(s.score, s.hiScore);
  s.timeBonus = bonus;
  s.timeBonusTimer = bonus > 0 ? 110 : 0;
  s.bulletsE.length = 0;

  if (s.level >= MAX_LEVEL) {
    s.screen = 'VICTORY';
    s.newRecord = s.score > s.hiScore && s.hiScore > 0;
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

function resolvePlayerBulletCollisions(state: GameState) {
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

function resolveEnemyAndPickupCollisions(state: GameState) {
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
        const puColor = item.type === 'SPREAD' ? COLORS.bulletSpread : item.type === 'LASER' ? COLORS.bulletLaser : COLORS.bulletRapid;
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

function checkInvasionAndEndConditions(state: GameState) {
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

  if (
    state.screen === 'PAUSED'
    || state.screen === 'CONTINUE'
    || state.screen === 'GAME_OVER'
    || state.screen === 'VICTORY'
    || state.screen === 'STAGE_CLEAR'
  ) {
    return updateNonPlayingScreen(state, prevTick, dt);
  }

  if (state.screen !== 'PLAYING') return state;

  state.tick += dt;
  updateBackgroundInPlace(state, dt, 1);

  if (state.flashTimer > 0) state.flashTimer = Math.max(0, state.flashTimer - dt);
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

  // ── Update player bullets in place ───────────────────────────────
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

  // ── Boss update (on levels 10, 20, …, 100) ───────────────────────
  if (state.boss && state.boss.active) {
    updateBoss(state, state.boss, dt, BOSS_AI_HOOKS);
  }

  // ── Aliens update ────────────────────────────────────────────────
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
      spawnExtraLifeItem(state, CANVAS_W * 0.5 + rand(-180, 180), 42);
    }
  }

  // Check stage clear
  const bossAlive = !!(state.boss && state.boss.active);
  if (!bossAlive && !anyAlive) {
    finishStage(state);
    return state;
  }

  if (staticCount > 0) {
    if (rightmost >= CANVAS_W - 10) {
      state.alienDir = -1;
      state.alienDropQueued = true;
    } else if (leftmost <= 10) {
      state.alienDir = 1;
      state.alienDropQueued = true;
    }

    const ratio = state.initialAlienCount > 0 ? staticCount / state.initialAlienCount : 1;
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
      for (let i = 0; i < state.aliens.length; i++) {
        const a = state.aliens[i];
        if (a.alive && !a.diving) candidates.push(a);
      }
      if (candidates.length > 0) {
        const diver = candidates[randInt(0, candidates.length - 1)];
        diver.diving = true;
        diver.divePhase = 'RISE';
        diver.diveFlipTimer = 0;
        diver.diveOriginX = diver.x;
        diver.diveOriginY = diver.y;
        diver.diveAngle = -Math.PI / 2;
        diver.type = 3;
        if (diver.hp > 2) diver.hp = 2;
        if (diver.maxHp > 2) diver.maxHp = 2;
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

  // ── Enemy shooting (regular waves) ───────────────────────────────
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

  // ── Update enemy bullets in place ────────────────────────────────
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

  // ── UFO (non-boss levels) ────────────────────────────────────────
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

  // ── Power-up items update & random drops ─────────────────────────
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

  // Guaranteed CONTINUE token drop on every Boss screen (random X across the arena)
  if (
    bossAlive
    && !state.bossContinueDropped
    && state.boss
    && !state.boss.entering
    && (state.boss.hp <= state.boss.maxHp * 0.65 || state.tick >= 220)
  ) {
    spawnContinueItem(state, rand(80, CANVAS_W - 80), Math.max(80, state.boss.y + state.boss.h));
  }

  if (crossedInterval(prevTick, state.tick, 340, 170) && Math.random() < (bossAlive ? 0.72 : 0.62)) {
    const pool: PowerUpItemType[] = ['SPREAD', 'LASER', 'RAPID', 'SHIELD'];
    state.powerUpItems.push({
      id: state.nextPowerUpId++,
      x: rand(64, CANVAS_W - 64),
      y: -22,
      vy: 1.5,
      type: pool[randInt(0, pool.length - 1)],
      active: true,
      rotation: 0,
      pulse: 0,
    });
  }

  resolvePlayerBulletCollisions(state);
  resolveEnemyAndPickupCollisions(state);
  checkInvasionAndEndConditions(state);

  return state;
}
