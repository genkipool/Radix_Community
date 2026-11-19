/**
 * Offscreen Canvas 2D sprite & backdrop caches for Radix Invaders.
 * Pre-renders static sector backdrops (with baked scanlines/vignette),
 * glowing boss plasma orbs, and all 4 alien types (2 frames x 3 variants)
 * once per session for ultra-fast single-drawImage blitting.
 */
import {
  ALIEN_H,
  ALIEN_W,
  CANVAS_H,
  CANVAS_W,
  COLORS,
  SECTOR_PALETTES,
} from '../constants/radix-invaders.constants';

export const ALIEN_PALETTE = [COLORS.alien0, COLORS.alien1, COLORS.alien2, COLORS.alien3] as const;
export const ALIEN_SPRITE_PAD_X = 12;
export const ALIEN_SPRITE_PAD_Y = 4;
const ALIEN_SPRITE_W = ALIEN_W + ALIEN_SPRITE_PAD_X * 2;
const ALIEN_SPRITE_H = ALIEN_H + 16;

const backdropCache = new Map<number, HTMLCanvasElement>();
const alienSpriteCache = new Map<string, HTMLCanvasElement>();
let bossOrbSpriteCache: HTMLCanvasElement | null = null;

function makeOffscreen(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function getSectorBackdrop(sector: number): HTMLCanvasElement | null {
  const cached = backdropCache.get(sector);
  if (cached) return cached;
  const c = makeOffscreen(CANVAS_W, CANVAS_H);
  if (!c) return null;
  const g = c.getContext('2d');
  if (!g) return null;

  const pal = SECTOR_PALETTES[sector] ?? SECTOR_PALETTES[0];

  const bg = g.createLinearGradient(0, 0, 0, CANVAS_H);
  bg.addColorStop(0, pal.bgTop);
  bg.addColorStop(0.55, pal.bgMid);
  bg.addColorStop(1, pal.bgTop);
  g.fillStyle = bg;
  g.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const neb1 = g.createRadialGradient(CANVAS_W * 0.22, CANVAS_H * 0.28, 10, CANVAS_W * 0.22, CANVAS_H * 0.28, 320);
  neb1.addColorStop(0, pal.nebulaA);
  neb1.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = neb1;
  g.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const neb2 = g.createRadialGradient(CANVAS_W * 0.78, CANVAS_H * 0.62, 10, CANVAS_W * 0.78, CANVAS_H * 0.62, 300);
  neb2.addColorStop(0, pal.nebulaB);
  neb2.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = neb2;
  g.fillRect(0, 0, CANVAS_W, CANVAS_H);

  g.strokeStyle = 'rgba(0,229,255,0.045)';
  g.lineWidth = 1;
  for (let x = 0; x <= CANVAS_W; x += 60) {
    g.beginPath();
    g.moveTo(x, CANVAS_H - 130);
    g.lineTo(x, CANVAS_H - 26);
    g.stroke();
  }
  for (let y = CANVAS_H - 130; y <= CANVAS_H - 26; y += 26) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(CANVAS_W, y);
    g.stroke();
  }

  g.strokeStyle = 'rgba(0,229,255,0.45)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, CANVAS_H - 26);
  g.lineTo(CANVAS_W, CANVAS_H - 26);
  g.stroke();

  // Subtle scanlines + vignette baked directly into static backdrop
  g.fillStyle = 'rgba(0,0,0,0.05)';
  for (let y = 0; y < CANVAS_H; y += 3) {
    g.fillRect(0, y, CANVAS_W, 1);
  }
  const vig = g.createRadialGradient(
    CANVAS_W / 2, CANVAS_H / 2, CANVAS_H * 0.36,
    CANVAS_W / 2, CANVAS_H / 2, CANVAS_H * 0.86,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.48)');
  g.fillStyle = vig;
  g.fillRect(0, 0, CANVAS_W, CANVAS_H);

  backdropCache.set(sector, c);
  return c;
}

export function getBossOrbSprite(): HTMLCanvasElement | null {
  if (bossOrbSpriteCache) return bossOrbSpriteCache;
  const c = makeOffscreen(22, 22);
  if (!c) return null;
  const g = c.getContext('2d');
  if (!g) return null;

  g.globalAlpha = 0.3;
  g.fillStyle = COLORS.bulletBoss;
  g.beginPath();
  g.arc(11, 11, 9, 0, Math.PI * 2);
  g.fill();

  g.globalAlpha = 1;
  g.fillStyle = COLORS.bulletBoss;
  g.beginPath();
  g.arc(11, 11, 5, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(11, 11, 2.2, 0, Math.PI * 2);
  g.fill();

  bossOrbSpriteCache = c;
  return c;
}

export function drawAlienShape(ctx: CanvasRenderingContext2D, type: 0 | 1 | 2 | 3, w: number, h: number, f: number) {
  if (type === 0) {
    ctx.beginPath();
    if (f === 0) {
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w - 3, h / 2);
      ctx.lineTo(w * 0.72, h);
      ctx.lineTo(w * 0.28, h);
      ctx.lineTo(3, h / 2);
      ctx.closePath();
      ctx.moveTo(w * 0.25, h); ctx.lineTo(w * 0.14, h + 6);
      ctx.moveTo(w * 0.5, h); ctx.lineTo(w * 0.5, h + 8);
      ctx.moveTo(w * 0.75, h); ctx.lineTo(w * 0.86, h + 6);
    } else {
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w - 1, h / 2 - 2);
      ctx.lineTo(w * 0.66, h);
      ctx.lineTo(w * 0.34, h);
      ctx.lineTo(1, h / 2 - 2);
      ctx.closePath();
      ctx.moveTo(w * 0.2, h); ctx.lineTo(w * 0.06, h + 5);
      ctx.moveTo(w * 0.5, h); ctx.lineTo(w * 0.5, h + 9);
      ctx.moveTo(w * 0.8, h); ctx.lineTo(w * 0.94, h + 5);
    }
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(w * 0.31, h * 0.4, 5, 5);
    ctx.fillRect(w * 0.69 - 5, h * 0.4, 5, 5);
    return;
  }

  if (type === 1) {
    ctx.beginPath();
    ctx.roundRect(6, 4, w - 12, h - 8, 5);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    if (f === 0) {
      ctx.moveTo(2, 4); ctx.lineTo(0, 0); ctx.lineTo(6, 6);
      ctx.moveTo(w - 2, 4); ctx.lineTo(w, 0); ctx.lineTo(w - 6, 6);
      ctx.moveTo(10, h - 4); ctx.lineTo(6, h + 4);
      ctx.moveTo(w - 10, h - 4); ctx.lineTo(w - 6, h + 4);
    } else {
      ctx.moveTo(4, 6); ctx.lineTo(0, 4); ctx.lineTo(6, 8);
      ctx.moveTo(w - 4, 6); ctx.lineTo(w, 4); ctx.lineTo(w - 6, 8);
      ctx.moveTo(10, h - 4); ctx.lineTo(14, h + 4);
      ctx.moveTo(w - 10, h - 4); ctx.lineTo(w - 14, h + 4);
    }
    ctx.stroke();
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(w * 0.3, h * 0.36, 5, 5);
    ctx.fillRect(w * 0.7 - 5, h * 0.36, 5, 5);
    return;
  }

  if (type === 3) {
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w, h * 0.35);
    ctx.lineTo(w * 0.74, h);
    ctx.lineTo(w * 0.26, h);
    ctx.lineTo(0, h * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const wingOut = f === 0 ? 9 : 6;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.34); ctx.lineTo(-wingOut, h * 0.62); ctx.lineTo(0, h * 0.72);
    ctx.moveTo(w, h * 0.34); ctx.lineTo(w + wingOut, h * 0.62); ctx.lineTo(w, h * 0.72);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(w * 0.34, h * 0.42, 5, 5);
    ctx.fillRect(w * 0.66 - 5, h * 0.42, 5, 5);
    return;
  }

  // Type 2
  ctx.beginPath();
  ctx.ellipse(w / 2, h * 0.42, w / 2 - 4, h * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const tx = 8 + i * ((w - 16) / 3);
    const wave = f === 0 ? (i % 2 === 0 ? 4 : -4) : (i % 2 === 0 ? -4 : 4);
    ctx.moveTo(tx, h * 0.75);
    ctx.lineTo(tx + wave, h + 3);
  }
  ctx.stroke();
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(w * 0.34, h * 0.3, 5, 5);
  ctx.fillRect(w * 0.66 - 5, h * 0.3, 5, 5);
}

export function getAlienSprite(type: 0 | 1 | 2 | 3, frame: number, variant: 0 | 1 | 2): HTMLCanvasElement | null {
  const key = `${type}_${frame}_${variant}`;
  const cached = alienSpriteCache.get(key);
  if (cached) return cached;

  const c = makeOffscreen(ALIEN_SPRITE_W, ALIEN_SPRITE_H);
  if (!c) return null;
  const g = c.getContext('2d');
  if (!g) return null;

  const color = ALIEN_PALETTE[type] ?? COLORS.alien1;
  g.translate(ALIEN_SPRITE_PAD_X, ALIEN_SPRITE_PAD_Y);
  g.lineWidth = 1.6;
  g.fillStyle = variant === 2 ? '#ffffff' : color;
  g.strokeStyle = variant >= 1 ? '#ffffff' : color;

  drawAlienShape(g, type, ALIEN_W, ALIEN_H, frame);
  alienSpriteCache.set(key, c);
  return c;
}
