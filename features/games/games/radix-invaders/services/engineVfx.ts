/**
 * Low-level math, VFX, starfield, shield, bullet, and pickup helpers
 * shared across the Radix Invaders simulation modules.
 */
import type {
  Bullet,
  GameState,
  PowerUpItemType,
  Shield,
  Star,
} from '../types/radix-invaders.types';
import {
  CANVAS_H,
  CANVAS_W,
  COLORS,
  MAX_PARTICLES,
} from '../constants/radix-invaders.constants';

const STAR_TINTS = ['#ffffff', '#cceeff', '#ffe8cc', '#d4ccff'] as const;

export function rand(a: number, b: number): number {
  return Math.random() * (b - a) + a;
}

export function randInt(a: number, b: number): number {
  return Math.floor(rand(a, b + 1));
}

export function crossedInterval(prevTick: number, nextTick: number, interval: number, offset = 0): boolean {
  return Math.floor((prevTick - offset) / interval) !== Math.floor((nextTick - offset) / interval);
}

export function aabb(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function alienGlow(type: number): string {
  return ([COLORS.glow0, COLORS.glow1, COLORS.glow2, COLORS.glow3])[type] ?? COLORS.glow1;
}

export function pushBullet(
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

export function addShake(s: GameState, duration: number, intensity: number) {
  if (intensity >= s.shakeIntensity || s.shakeTimer <= 0) {
    s.shakeTimer = Math.max(s.shakeTimer, duration);
    s.shakeIntensity = Math.max(s.shakeIntensity, intensity);
  }
}

export function spawnShockwave(s: GameState, x: number, y: number, color: string, maxR = 36) {
  if (s.shockwaves.length >= 24) return;
  s.shockwaves.push({ x, y, r: 4, maxR, life: 1, color });
}

export function spawnText(s: GameState, x: number, y: number, text: string, color: string, size = 14, maxLife = 52) {
  if (s.floatingTexts.length >= 20) s.floatingTexts.shift();
  s.floatingTexts.push({ x, y, text, color, life: maxLife, maxLife, size });
}

export function spawnExplosion(s: GameState, x: number, y: number, color: string, count = 16, spread = 5, withRing = true) {
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

export function spawnPickupItem(
  s: GameState,
  type: PowerUpItemType,
  x: number,
  y: number,
  vy = 1.25,
) {
  const clampedX = Math.max(64, Math.min(CANVAS_W - 64, x));
  s.powerUpItems.push({
    id: s.nextPowerUpId++,
    x: clampedX,
    y,
    vy,
    type,
    active: true,
    rotation: 0,
    pulse: 0,
  });
}

export function makeStars(): Star[] {
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

export function makeShield(cx: number, y: number): Shield {
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

export function updateBackgroundInPlace(s: GameState, dt: number, warpMultiplier = 1) {
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
