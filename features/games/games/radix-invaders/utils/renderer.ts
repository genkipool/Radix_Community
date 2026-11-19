/**
 * High-performance Canvas 2D entity & frame renderer for Radix Invaders.
 * Offscreen sprite/backdrop caches live in `./spriteCache`, Boss silhouettes
 * in `./bossRenderer`, and HUD/screen overlays in `./hudRenderer`.
 */
import type { GameState } from '../types/radix-invaders.types';
import {
  ALIEN_H,
  ALIEN_W,
  CANVAS_H,
  CANVAS_W,
  COLORS,
  PLAYER_H,
  PLAYER_W,
  PLAYER_Y,
  UFO_H,
  UFO_W,
} from '../constants/radix-invaders.constants';
import { getSectorIndex } from '../services/waves';
import { drawBoss } from './bossRenderer';
import {
  drawBossWarning,
  drawContinueScreen,
  drawFlashMessage,
  drawGameOver,
  drawHUD,
  drawPaused,
  drawStageClear,
  drawVictory,
} from './hudRenderer';
import {
  ALIEN_PALETTE,
  ALIEN_SPRITE_PAD_X,
  ALIEN_SPRITE_PAD_Y,
  drawAlienShape,
  getAlienSprite,
  getBossOrbSprite,
  getSectorBackdrop,
} from './spriteCache';

export {
  drawBoss,
  drawBossWarning,
  drawContinueScreen,
  drawFlashMessage,
  drawGameOver,
  drawHUD,
  drawPaused,
  drawStageClear,
  drawVictory,
};

// ── Background & Stars ─────────────────────────────────────────────
export function drawBackground(ctx: CanvasRenderingContext2D, state: GameState) {
  const sector = getSectorIndex(state.level);
  const bg = getSectorBackdrop(sector);
  if (bg) {
    ctx.drawImage(bg, 0, 0);
  } else {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  const warp = state.screen === 'STAGE_CLEAR';
  let lastTint = '';
  for (let i = 0; i < state.stars.length; i++) {
    const st = state.stars[i];
    if (st.tint !== lastTint) {
      ctx.fillStyle = st.tint;
      lastTint = st.tint;
    }
    ctx.globalAlpha = st.alpha;
    if (warp && st.layer >= 1) {
      ctx.fillRect(st.x, st.y - st.speed * 7, st.r * 1.1, st.speed * 9 + st.r * 2);
    } else if (st.layer === 2) {
      ctx.fillRect(st.x - st.r, st.y - st.r, st.r * 2, st.r * 2);
      ctx.globalAlpha = st.alpha * 0.28;
      ctx.fillRect(st.x - st.r * 2, st.y - 0.6, st.r * 4, 1.2);
      ctx.fillRect(st.x - 0.6, st.y - st.r * 2, 1.2, st.r * 4);
    } else {
      ctx.fillRect(st.x, st.y, st.r * 1.6, st.r * 1.6);
    }
  }
  ctx.globalAlpha = 1;
}

// ── Particles & Shockwaves ─────────────────────────────────────────
export function drawParticles(ctx: CanvasRenderingContext2D, state: GameState) {
  for (let i = 0; i < state.shockwaves.length; i++) {
    const sw = state.shockwaves[i];
    ctx.globalAlpha = Math.max(0, sw.life * 0.65);
    ctx.strokeStyle = sw.color;
    ctx.lineWidth = 2 * sw.life + 0.5;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];
    const alpha = Math.max(0, p.life / p.maxLife);
    const sz = p.r * (0.4 + 0.6 * alpha);
    ctx.fillStyle = p.color;
    if (p.glow) {
      ctx.globalAlpha = alpha * 0.25;
      ctx.fillRect(p.x - sz * 2, p.y - sz * 2, sz * 4, sz * 4);
    }
    ctx.globalAlpha = alpha;
    ctx.fillRect(p.x - sz, p.y - sz, sz * 2, sz * 2);
  }
  ctx.globalAlpha = 1;
}

// ── Player Starfighter ─────────────────────────────────────────────
export function drawPlayer(ctx: CanvasRenderingContext2D, state: GameState) {
  const { x, tilt, invincible, hasShield } = state.player;
  if (invincible > 0 && Math.floor(invincible / 5) % 2 === 0) return;

  const puColor =
    state.powerUp === 'SPREAD'
      ? COLORS.bulletSpread
      : state.powerUp === 'LASER'
        ? COLORS.bulletLaser
        : state.powerUp === 'RAPID'
          ? COLORS.bulletRapid
          : COLORS.playerShip;

  ctx.save();
  ctx.translate(x, PLAYER_Y);
  ctx.rotate(tilt * 0.13);

  const fh = 11 + 6 * Math.sin(state.tick * 0.35);
  ctx.fillStyle = 'rgba(0,229,255,0.22)';
  ctx.beginPath();
  ctx.arc(0, PLAYER_H / 2 + 2, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ff8800';
  ctx.beginPath();
  ctx.moveTo(-7, PLAYER_H / 2 - 2);
  ctx.lineTo(7, PLAYER_H / 2 - 2);
  ctx.lineTo(0, PLAYER_H / 2 + fh);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ccf7ff';
  ctx.beginPath();
  ctx.moveTo(-3.5, PLAYER_H / 2 - 2);
  ctx.lineTo(3.5, PLAYER_H / 2 - 2);
  ctx.lineTo(0, PLAYER_H / 2 + fh * 0.6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(0,229,255,0.16)';
  ctx.beginPath();
  ctx.moveTo(0, -PLAYER_H / 2 - 4);
  ctx.lineTo(PLAYER_W / 2 + 2, PLAYER_H / 2 + 2);
  ctx.lineTo(0, PLAYER_H / 4 + 4);
  ctx.lineTo(-PLAYER_W / 2 - 2, PLAYER_H / 2 + 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = COLORS.playerShip;
  ctx.beginPath();
  ctx.moveTo(0, -PLAYER_H / 2);
  ctx.lineTo(PLAYER_W / 2 - 2, PLAYER_H / 2);
  ctx.lineTo(PLAYER_W / 2 - 14, PLAYER_H / 4);
  ctx.lineTo(-PLAYER_W / 2 + 14, PLAYER_H / 4);
  ctx.lineTo(-PLAYER_W / 2 + 2, PLAYER_H / 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#032946';
  ctx.beginPath();
  ctx.moveTo(0, -PLAYER_H / 2 + 6);
  ctx.lineTo(11, PLAYER_H / 4);
  ctx.lineTo(-11, PLAYER_H / 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = puColor;
  ctx.fillRect(-PLAYER_W / 2 + 5, 1, 4, 11);
  ctx.fillRect(PLAYER_W / 2 - 9, 1, 4, 11);

  ctx.fillStyle = '#e0fbff';
  ctx.beginPath();
  ctx.ellipse(0, -2, 4.5, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (state.powerUp !== 'NONE') {
    ctx.globalAlpha = 0.45 + 0.35 * Math.sin(state.tick * 0.16);
    ctx.strokeStyle = puColor;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, 29, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (hasShield) {
    const pulse = 0.72 + 0.28 * Math.sin(state.tick * 0.12);
    ctx.globalAlpha = 0.14 * pulse;
    ctx.fillStyle = COLORS.shieldItem;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.75 * pulse;
    ctx.strokeStyle = COLORS.shieldItem;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

// ── Aliens (cached offscreen sprite blits) ─────────────────────────
export function drawAliens(ctx: CanvasRenderingContext2D, state: GameState) {
  const frame = state.alienFrame;
  for (let i = 0; i < state.aliens.length; i++) {
    const a = state.aliens[i];
    if (!a.alive) continue;

    const variant: 0 | 1 | 2 = a.hitFlash > 0 ? 2 : a.hp > 1 ? 1 : 0;
    const sprite = getAlienSprite(a.type, frame, variant);

    if (sprite) {
      if (a.diving) {
        ctx.save();
        ctx.translate(a.x + ALIEN_W / 2, a.y + ALIEN_H / 2);
        const angle = a.divePhase === 'DIVE' ? a.diveAngle : -Math.PI / 2;
        ctx.rotate(angle + Math.PI / 2);
        ctx.drawImage(sprite, -ALIEN_W / 2 - ALIEN_SPRITE_PAD_X, -ALIEN_H / 2 - ALIEN_SPRITE_PAD_Y);
        ctx.restore();
      } else {
        ctx.drawImage(sprite, (a.x - ALIEN_SPRITE_PAD_X) | 0, (a.y - ALIEN_SPRITE_PAD_Y) | 0);
      }
    } else {
      const color = ALIEN_PALETTE[a.type] ?? COLORS.alien1;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.lineWidth = 1.6;
      ctx.fillStyle = variant === 2 ? '#ffffff' : color;
      ctx.strokeStyle = variant >= 1 ? '#ffffff' : color;
      drawAlienShape(ctx, a.type, ALIEN_W, ALIEN_H, frame);
      ctx.restore();
    }

    if (a.maxHp > 1 && !a.diving) {
      const pipW = 8;
      const gap = 3;
      const totalW = a.maxHp * pipW + (a.maxHp - 1) * gap;
      const sx = a.x + (ALIEN_W - totalW) / 2;
      const sy = a.y - 7;
      for (let p = 0; p < a.maxHp; p++) {
        ctx.fillStyle = p < a.hp ? COLORS.gold : 'rgba(255,255,255,0.2)';
        ctx.fillRect(sx + p * (pipW + gap), sy, pipW, 3);
      }
    }
  }
}

// ── UFO ────────────────────────────────────────────────────────────
export function drawUFO(ctx: CanvasRenderingContext2D, state: GameState) {
  const { ufo } = state;
  if (!ufo.active) return;

  ctx.save();
  ctx.translate(ufo.x, ufo.y);

  ctx.globalAlpha = 0.2;
  ctx.fillStyle = COLORS.ufo;
  ctx.beginPath();
  ctx.ellipse(UFO_W / 2, UFO_H * 0.65, UFO_W * 0.6, UFO_H * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = COLORS.ufo;
  ctx.beginPath();
  ctx.ellipse(UFO_W / 2, UFO_H * 0.65, UFO_W / 2, UFO_H * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,180,235,0.75)';
  ctx.beginPath();
  ctx.ellipse(UFO_W / 2, UFO_H * 0.45, UFO_W * 0.3, UFO_H * 0.45, 0, Math.PI, 0);
  ctx.fill();

  for (let i = 0; i < 5; i++) {
    const lx = 10 + i * ((UFO_W - 20) / 4);
    const on = (state.tick + i * 6) % 18 < 9;
    ctx.fillStyle = on ? '#ffffff' : '#660044';
    ctx.beginPath();
    ctx.arc(lx, UFO_H * 0.68, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── Shields ────────────────────────────────────────────────────────
export function drawShields(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.fillStyle = COLORS.shield;
  for (let si = 0; si < state.shields.length; si++) {
    const { blocks, x, y, blockW, blockH } = state.shields[si];
    for (let r = 0; r < blocks.length; r++) {
      const row = blocks[r];
      ctx.globalAlpha = 0.9 - r * 0.06;
      for (let c = 0; c < row.length; c++) {
        if (!row[c]) continue;
        ctx.fillRect(x + c * blockW + 1, y + r * blockH + 1, blockW - 2, blockH - 2);
      }
    }
  }
  ctx.globalAlpha = 1;
}

// ── Bullets ────────────────────────────────────────────────────────
export function drawBullets(ctx: CanvasRenderingContext2D, state: GameState) {
  for (let i = 0; i < state.bulletsP.length; i++) {
    const b = state.bulletsP[i];
    const color =
      b.kind === 'spread'
        ? COLORS.bulletSpread
        : b.kind === 'laser'
          ? COLORS.bulletLaser
          : b.kind === 'rapid'
            ? COLORS.bulletRapid
            : COLORS.bulletP;

    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = b.kind === 'laser' ? 7 : 4;
    ctx.beginPath();
    ctx.moveTo(b.prevX, b.prevY + 12);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    if (b.kind === 'laser') {
      ctx.fillRect(b.x - 3, b.y - 18, 6, 36);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - 1, b.y - 16, 2, 32);
    } else {
      ctx.fillRect(b.x - 2, b.y - 8, 4, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - 1, b.y - 6, 2, 10);
    }
  }

  const orbSprite = getBossOrbSprite();
  for (let i = 0; i < state.bulletsE.length; i++) {
    const b = state.bulletsE[i];
    if (b.kind === 'banana') {
      ctx.strokeStyle = COLORS.bulletBanana;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 7, 0.3, Math.PI - 0.3);
      ctx.stroke();
    } else if (b.kind === 'boss_orb') {
      if (orbSprite) {
        ctx.drawImage(orbSprite, (b.x - 11) | 0, (b.y - 11) | 0);
      } else {
        ctx.fillStyle = COLORS.bulletBoss;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (b.kind === 'boss_heavy') {
      ctx.fillStyle = 'rgba(255,68,68,0.35)';
      ctx.fillRect(b.x - 6, b.y - 11, 12, 22);
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(b.x - 3, b.y - 9, 6, 18);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - 1, b.y - 7, 2, 14);
    } else {
      ctx.strokeStyle = COLORS.bulletE;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(b.x - 2, b.y - 6);
      ctx.lineTo(b.x + 2, b.y - 2);
      ctx.lineTo(b.x - 2, b.y + 2);
      ctx.lineTo(b.x + 2, b.y + 6);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

// ── Power-Up, Extra Life & Continue Items ──────────────────────────
function drawHeart(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  ctx.moveTo(0, r * 0.75);
  ctx.bezierCurveTo(-r * 1.15, r * 0.1, -r * 1.1, -r * 0.85, 0, -r * 0.25);
  ctx.bezierCurveTo(r * 1.1, -r * 0.85, r * 1.15, r * 0.1, 0, r * 0.75);
  ctx.closePath();
  ctx.fill();
}

export function drawPowerUpItems(ctx: CanvasRenderingContext2D, state: GameState) {
  for (let i = 0; i < state.powerUpItems.length; i++) {
    const item = state.powerUpItems[i];
    ctx.save();
    ctx.translate(item.x, item.y);

    if (item.type === 'CONTINUE') {
      const s = 1 + 0.12 * Math.sin(item.pulse * 1.7);
      ctx.scale(s, s);
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = COLORS.continueItem;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = 'rgba(42,30,4,0.94)';
      ctx.strokeStyle = COLORS.continueItem;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255,235,130,0.65)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 10.5, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = COLORS.continueItem;
      ctx.font = 'bold 13px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('C', 0, 1);
      ctx.restore();
      continue;
    }

    if (item.type === 'LIFE') {
      const s = 1 + 0.12 * Math.sin(item.pulse * 1.6);
      ctx.scale(s, s);
      ctx.globalAlpha = 0.26;
      ctx.fillStyle = COLORS.lifeItem;
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = 'rgba(10,36,24,0.92)';
      ctx.strokeStyle = COLORS.lifeItem;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.lineTo(15, 0);
      ctx.lineTo(0, 15);
      ctx.lineTo(-15, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ff3b7f';
      drawHeart(ctx, 7.5);
      ctx.restore();
      continue;
    }

    const color =
      item.type === 'SPREAD'
        ? COLORS.bulletSpread
        : item.type === 'LASER'
          ? COLORS.bulletLaser
          : item.type === 'SHIELD'
            ? COLORS.shieldItem
            : COLORS.bulletRapid;

    ctx.rotate(item.rotation);
    ctx.fillStyle = `${color}28`;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 - Math.PI / 6;
      if (k === 0) ctx.moveTo(Math.cos(a) * 13, Math.sin(a) * 13);
      else ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 13);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.rotate(-item.rotation);
    ctx.fillStyle = color;
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icon = item.type === 'SPREAD' ? 'S' : item.type === 'LASER' ? 'L' : item.type === 'SHIELD' ? 'E' : 'R';
    ctx.fillText(icon, 0, 1);
    ctx.restore();
  }
}

// ── Floating Score & Pickup Popups ─────────────────────────────────
export function drawFloatingTexts(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < state.floatingTexts.length; i++) {
    const ft = state.floatingTexts[i];
    ctx.globalAlpha = Math.min(1, ft.life / 18);
    ctx.fillStyle = ft.color;
    ctx.font = `bold ${ft.size}px "Courier New", monospace`;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;
}

/** Master frame renderer with screen-shake isolation (world shakes, HUD stays rock-steady). */
export function renderGameFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  labels: Record<string, string>,
  mode: 'TOURNAMENT' | 'FUN',
) {
  drawBackground(ctx, state);

  ctx.save();
  if (state.shakeTimer > 0 && state.shakeIntensity > 0) {
    const mag = state.shakeIntensity * (state.shakeTimer / 18);
    ctx.translate((Math.random() - 0.5) * mag * 2, (Math.random() - 0.5) * mag * 2);
  }
  drawShields(ctx, state);
  drawAliens(ctx, state);
  drawBoss(ctx, state, labels);
  drawUFO(ctx, state);
  drawBullets(ctx, state);
  drawPowerUpItems(ctx, state);
  drawPlayer(ctx, state);
  drawParticles(ctx, state);
  drawFloatingTexts(ctx, state);
  ctx.restore();

  drawHUD(ctx, state, labels, mode);
  drawBossWarning(ctx, state, labels);
  drawFlashMessage(ctx, state);

  if (state.screen === 'GAME_OVER') drawGameOver(ctx, state, labels);
  else if (state.screen === 'CONTINUE') drawContinueScreen(ctx, state, labels);
  else if (state.screen === 'VICTORY') drawVictory(ctx, state, labels);
  else if (state.screen === 'STAGE_CLEAR') drawStageClear(ctx, state, labels);
  else if (state.screen === 'PAUSED') drawPaused(ctx, labels);
}
