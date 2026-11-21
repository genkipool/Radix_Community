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
  MOBILE_RENDER_SCALE,
  PLAYER_H,
  PLAYER_W,
  PLAYER_Y,
  POWERUP_COLORS,
  UFO_H,
  UFO_W,
} from '../constants/radix-invaders.constants';
import { getSectorIndex } from '../services/waves';
import { drawBoss } from './bossRenderer';
import {
  drawBossWarning,
  drawContinueScreen,
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
  drawGameOver,
  drawHUD,
  drawPaused,
  drawStageClear,
  drawVictory,
};

// ── Background & Stars ─────────────────────────────────────────────
export function drawBackground(ctx: CanvasRenderingContext2D, state: GameState, renderH = CANVAS_H) {
  const scaleY = renderH / CANVAS_H;
  const sector = getSectorIndex(state.level);
  const bg = getSectorBackdrop(sector);
  if (bg) {
    if (renderH === CANVAS_H) {
      ctx.drawImage(bg, 0, 0);
    } else {
      ctx.drawImage(bg, 0, 0, CANVAS_W, renderH);
    }
  } else {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, CANVAS_W, renderH);
  }

  const warp = state.screen === 'STAGE_CLEAR';
  let lastTint = '';
  for (let i = 0; i < state.stars.length; i++) {
    const st = state.stars[i];
    const sy = st.y * scaleY;
    if (st.tint !== lastTint) {
      ctx.fillStyle = st.tint;
      lastTint = st.tint;
    }
    ctx.globalAlpha = st.alpha;
    if (warp && st.layer >= 1) {
      ctx.fillRect(st.x, sy - st.speed * 7, st.r * 1.1, st.speed * 9 + st.r * 2);
    } else if (st.layer === 2) {
      ctx.fillRect(st.x - st.r, sy - st.r, st.r * 2, st.r * 2);
      ctx.globalAlpha = st.alpha * 0.28;
      ctx.fillRect(st.x - st.r * 2, sy - 0.6, st.r * 4, 1.2);
      ctx.fillRect(st.x - 0.6, sy - st.r * 2, 1.2, st.r * 4);
    } else {
      ctx.fillRect(st.x, sy, st.r * 1.6, st.r * 1.6);
    }
  }
  ctx.globalAlpha = 1;
}

// ── Particles & Shockwaves ─────────────────────────────────────────
export function drawParticles(ctx: CanvasRenderingContext2D, state: GameState, scaleY = 1) {
  const s = scaleY > 1 ? MOBILE_RENDER_SCALE.particle : 1;
  for (let i = 0; i < state.shockwaves.length; i++) {
    const sw = state.shockwaves[i];
    const sy = sw.y * scaleY;
    ctx.globalAlpha = Math.max(0, sw.life * 0.65);
    ctx.strokeStyle = sw.color;
    ctx.lineWidth = (2 * sw.life + 0.5) * s;
    ctx.beginPath();
    ctx.arc(sw.x, sy, sw.r * s, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];
    const py = p.y * scaleY;
    const alpha = Math.max(0, p.life / p.maxLife);
    const sz = p.r * (0.4 + 0.6 * alpha) * s;
    ctx.fillStyle = p.color;
    if (p.glow) {
      ctx.globalAlpha = alpha * 0.25;
      ctx.fillRect(p.x - sz * 2, py - sz * 2, sz * 4, sz * 4);
    }
    ctx.globalAlpha = alpha;
    ctx.fillRect(p.x - sz, py - sz, sz * 2, sz * 2);
  }
  ctx.globalAlpha = 1;
}

// ── Player Starfighter ─────────────────────────────────────────────
export function drawPlayer(ctx: CanvasRenderingContext2D, state: GameState, scaleY = 1) {
  const { x, tilt, invincible, hasShield } = state.player;
  if (invincible > 0 && Math.floor(invincible / 5) % 2 === 0) return;

  const puColor = POWERUP_COLORS[state.powerUp];

  ctx.save();
  ctx.translate(x, PLAYER_Y * scaleY);
  if (scaleY > 1) ctx.scale(MOBILE_RENDER_SCALE.player, MOBILE_RENDER_SCALE.player);
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
export function drawAliens(ctx: CanvasRenderingContext2D, state: GameState, scaleY = 1) {
  const frame = state.alienFrame;
  const isTall = scaleY > 1;
  const alienScale = isTall ? MOBILE_RENDER_SCALE.alien : 1;
  for (let i = 0; i < state.aliens.length; i++) {
    const a = state.aliens[i];
    if (!a.alive) continue;

    const ay = a.y * scaleY;
    const variant: 0 | 1 | 2 = a.hitFlash > 0 ? 2 : a.hp > 1 ? 1 : 0;
    const sprite = getAlienSprite(a.type, frame, variant);

    if (sprite) {
      if (a.diving || isTall) {
        ctx.save();
        ctx.translate(a.x + ALIEN_W / 2, ay + ALIEN_H / 2);
        if (isTall) ctx.scale(alienScale, alienScale);
        if (a.diving) {
          const angle = a.divePhase === 'DIVE' ? a.diveAngle : -Math.PI / 2;
          ctx.rotate(angle + Math.PI / 2);
        }
        ctx.drawImage(sprite, -ALIEN_W / 2 - ALIEN_SPRITE_PAD_X, -ALIEN_H / 2 - ALIEN_SPRITE_PAD_Y);
        ctx.restore();
      } else {
        ctx.drawImage(sprite, (a.x - ALIEN_SPRITE_PAD_X) | 0, (ay - ALIEN_SPRITE_PAD_Y) | 0);
      }
    } else {
      const color = ALIEN_PALETTE[a.type] ?? COLORS.alien1;
      ctx.save();
      ctx.translate(a.x + ALIEN_W / 2, ay + ALIEN_H / 2);
      if (isTall) ctx.scale(alienScale, alienScale);
      ctx.translate(-ALIEN_W / 2, -ALIEN_H / 2);
      ctx.lineWidth = 1.6;
      ctx.fillStyle = variant === 2 ? '#ffffff' : color;
      ctx.strokeStyle = variant >= 1 ? '#ffffff' : color;
      drawAlienShape(ctx, a.type, ALIEN_W, ALIEN_H, frame);
      ctx.restore();
    }

    if (a.maxHp > 1 && !a.diving) {
      const pipW = isTall ? 10 : 8;
      const gap = 3;
      const totalW = a.maxHp * pipW + (a.maxHp - 1) * gap;
      const sx = a.x + (ALIEN_W - totalW) / 2;
      const sy = ay - (isTall ? 12 : 7);
      for (let p = 0; p < a.maxHp; p++) {
        ctx.fillStyle = p < a.hp ? COLORS.gold : 'rgba(255,255,255,0.2)';
        ctx.fillRect(sx + p * (pipW + gap), sy, pipW, isTall ? 4 : 3);
      }
    }
  }
}

// ── UFO ────────────────────────────────────────────────────────────
export function drawUFO(ctx: CanvasRenderingContext2D, state: GameState, scaleY = 1) {
  const { ufo } = state;
  if (!ufo.active) return;

  ctx.save();
  ctx.translate(ufo.x + UFO_W / 2, ufo.y * scaleY + UFO_H / 2);
  if (scaleY > 1) ctx.scale(MOBILE_RENDER_SCALE.ufo, MOBILE_RENDER_SCALE.ufo);
  ctx.translate(-UFO_W / 2, -UFO_H / 2);

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
export function drawShields(ctx: CanvasRenderingContext2D, state: GameState, scaleY = 1) {
  ctx.fillStyle = COLORS.shield;
  const isTall = scaleY > 1;
  const bwScale = isTall ? MOBILE_RENDER_SCALE.shieldX : 1;
  const bhScale = isTall ? MOBILE_RENDER_SCALE.shieldY : 1;
  for (let si = 0; si < state.shields.length; si++) {
    const { blocks, x, y, blockW, blockH } = state.shields[si];
    const cols = blocks[0]?.length ?? 9;
    const origW = cols * blockW;
    const bw = blockW * bwScale;
    const bh = blockH * bhScale;
    const baseX = x - (cols * bw - origW) / 2;
    const baseY = y * scaleY;
    for (let r = 0; r < blocks.length; r++) {
      const row = blocks[r];
      ctx.globalAlpha = 0.9 - r * 0.06;
      for (let c = 0; c < row.length; c++) {
        if (!row[c]) continue;
        ctx.fillRect(baseX + c * bw + 1, baseY + r * bh + 1, bw - 2, bh - 2);
      }
    }
  }
  ctx.globalAlpha = 1;
}

// ── Bullets ────────────────────────────────────────────────────────
export function drawBullets(ctx: CanvasRenderingContext2D, state: GameState, scaleY = 1) {
  const bs = scaleY > 1 ? MOBILE_RENDER_SCALE.bullet : 1;
  for (let i = 0; i < state.bulletsP.length; i++) {
    const b = state.bulletsP[i];
    const by = b.y * scaleY;
    const prevY = b.prevY * scaleY;
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
    ctx.lineWidth = (b.kind === 'laser' ? 7 : 4) * bs;
    ctx.beginPath();
    ctx.moveTo(b.prevX, prevY + 12 * bs);
    ctx.lineTo(b.x, by);
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    if (b.kind === 'laser') {
      ctx.fillRect(b.x - 3 * bs, by - 18 * bs, 6 * bs, 36 * bs);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - 1 * bs, by - 16 * bs, 2 * bs, 32 * bs);
    } else {
      ctx.fillRect(b.x - 2 * bs, by - 8 * bs, 4 * bs, 16 * bs);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - 1 * bs, by - 6 * bs, 2 * bs, 10 * bs);
    }
  }

  const orbSprite = getBossOrbSprite();
  for (let i = 0; i < state.bulletsE.length; i++) {
    const b = state.bulletsE[i];
    const by = b.y * scaleY;
    if (b.kind === 'banana') {
      ctx.strokeStyle = COLORS.bulletBanana;
      ctx.lineWidth = 3.5 * bs;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(b.x, by, 7 * bs, 0.3, Math.PI - 0.3);
      ctx.stroke();
    } else if (b.kind === 'boss_orb') {
      if (orbSprite) {
        const half = 11 * bs;
        ctx.drawImage(orbSprite, (b.x - half) | 0, (by - half) | 0, half * 2, half * 2);
      } else {
        ctx.fillStyle = COLORS.bulletBoss;
        ctx.beginPath();
        ctx.arc(b.x, by, 5 * bs, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (b.kind === 'boss_heavy') {
      ctx.fillStyle = 'rgba(255,68,68,0.35)';
      ctx.fillRect(b.x - 6 * bs, by - 11 * bs, 12 * bs, 22 * bs);
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(b.x - 3 * bs, by - 9 * bs, 6 * bs, 18 * bs);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - 1 * bs, by - 7 * bs, 2 * bs, 14 * bs);
    } else {
      ctx.strokeStyle = COLORS.bulletE;
      ctx.lineWidth = 2.5 * bs;
      ctx.beginPath();
      ctx.moveTo(b.x - 2 * bs, by - 6 * bs);
      ctx.lineTo(b.x + 2 * bs, by - 2 * bs);
      ctx.lineTo(b.x - 2 * bs, by + 2 * bs);
      ctx.lineTo(b.x + 2 * bs, by + 6 * bs);
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

export function drawPowerUpItems(ctx: CanvasRenderingContext2D, state: GameState, scaleY = 1) {
  for (let i = 0; i < state.powerUpItems.length; i++) {
    const item = state.powerUpItems[i];
    ctx.save();
    ctx.translate(item.x, item.y * scaleY);
    if (scaleY > 1) ctx.scale(MOBILE_RENDER_SCALE.pickup, MOBILE_RENDER_SCALE.pickup);

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

    const color = POWERUP_COLORS[item.type];

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
export function drawFloatingTexts(ctx: CanvasRenderingContext2D, state: GameState, scaleY = 1) {
  const fontScale = scaleY > 1 ? MOBILE_RENDER_SCALE.floatingText : 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < state.floatingTexts.length; i++) {
    const ft = state.floatingTexts[i];
    ctx.globalAlpha = Math.min(1, ft.life / 18);
    ctx.fillStyle = ft.color;
    ctx.font = `bold ${Math.round(ft.size * fontScale)}px "Courier New", monospace`;
    ctx.fillText(ft.text, ft.x, ft.y * scaleY);
  }
  ctx.globalAlpha = 1;
}

/** Master frame renderer with screen-shake isolation (world shakes, HUD stays rock-steady). */
export function renderGameFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  labels: Record<string, string>,
  mode: 'TOURNAMENT' | 'FUN',
  renderH = CANVAS_H,
) {
  const scaleY = renderH / CANVAS_H;
  drawBackground(ctx, state, renderH);

  ctx.save();
  if (state.screen === 'PLAYING' && state.shakeTimer > 0 && state.shakeIntensity > 0) {
    const mag = state.shakeIntensity * (state.shakeTimer / 18);
    ctx.translate((Math.random() - 0.5) * mag * 2, (Math.random() - 0.5) * mag * 2);
  }
  drawShields(ctx, state, scaleY);
  drawAliens(ctx, state, scaleY);
  drawBoss(ctx, state, labels, scaleY);
  drawUFO(ctx, state, scaleY);
  drawBullets(ctx, state, scaleY);
  drawPowerUpItems(ctx, state, scaleY);
  drawPlayer(ctx, state, scaleY);
  drawParticles(ctx, state, scaleY);
  drawFloatingTexts(ctx, state, scaleY);
  ctx.restore();

  drawHUD(ctx, state, labels, mode, renderH);
  drawBossWarning(ctx, state, labels, renderH);

  if (state.screen === 'GAME_OVER') drawGameOver(ctx, state, labels, renderH);
  else if (state.screen === 'CONTINUE') drawContinueScreen(ctx, state, labels, renderH);
  else if (state.screen === 'VICTORY') drawVictory(ctx, state, labels, renderH);
  else if (state.screen === 'STAGE_CLEAR') drawStageClear(ctx, state, labels, renderH);
  else if (state.screen === 'PAUSED') drawPaused(ctx, labels, renderH);
}
