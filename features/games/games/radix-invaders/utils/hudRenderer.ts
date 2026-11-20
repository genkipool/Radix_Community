/**
 * HUD & screen overlay renderers (score, lives, continues, power-up bar,
 * boss warning, stage clear, continue countdown, victory, game over, paused).
 */
import type { GameState } from '../types/radix-invaders.types';
import {
  CANVAS_H,
  CANVAS_W,
  COLORS,
  MAX_LEVEL,
  MOBILE_RENDER_SCALE,
  POWERUP_COLORS,
  POWERUP_DURATION,
} from '../constants/radix-invaders.constants';
import { getBossProfile } from '../services/waves';

function drawMiniShip(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, scale = 1) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 9 * scale);
  ctx.lineTo(x + 9 * scale, y + 6 * scale);
  ctx.lineTo(x, y + 2 * scale);
  ctx.lineTo(x - 9 * scale, y + 6 * scale);
  ctx.closePath();
  ctx.fill();
}

export function drawHUD(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  labels: Record<string, string>,
  mode: 'TOURNAMENT' | 'FUN',
  renderH = CANVAS_H,
) {
  const isTall = renderH > CANVAS_H;
  const y = isTall ? 42 : 26;
  const labelFont = isTall ? 'bold 18px "Courier New", monospace' : 'bold 12px "Courier New", monospace';
  const valueFont = isTall ? 'bold 34px "Courier New", monospace' : 'bold 22px "Courier New", monospace';
  const bottomY = isTall ? renderH - 18 : renderH - 9;
  ctx.textBaseline = 'alphabetic';

  // Score + Combo
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.primary;
  ctx.font = labelFont;
  ctx.fillText(labels.hud_score ?? 'SCORE', 20, y - (isTall ? 14 : 9));
  ctx.font = valueFont;
  ctx.fillText(String(state.score).padStart(6, '0'), 20, y + (isTall ? 22 : 12));

  if (state.combo >= 3) {
    const mult = state.combo >= 5 ? 3 : 2;
    ctx.fillStyle = COLORS.gold;
    ctx.font = labelFont;
    ctx.fillText(`x${mult} ${labels.combo_label ?? 'COMBO'}`, isTall ? 172 : 122, y + (isTall ? 18 : 10));
  }

  // Hi-score
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.font = labelFont;
  ctx.fillText(labels.hud_hi ?? 'HI-SCORE', CANVAS_W / 2, y - (isTall ? 14 : 9));
  ctx.font = valueFont;
  ctx.fillText(String(state.hiScore).padStart(6, '0'), CANVAS_W / 2, y + (isTall ? 22 : 12));

  // Lives
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.primary;
  ctx.font = labelFont;
  ctx.fillText(labels.hud_lives ?? 'LIVES', CANVAS_W - 20, y - (isTall ? 14 : 9));
  const shipScale = isTall ? MOBILE_RENDER_SCALE.miniShip : 1;
  for (let i = 0; i < state.lives; i++) {
    drawMiniShip(ctx, CANVAS_W - 32 - i * (isTall ? 32 : 24), y + (isTall ? 12 : 4), COLORS.primary, shipScale);
  }

  // Bottom bar: Level X/100 + Continues badge
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.secondary;
  ctx.font = isTall ? 'bold 21px "Courier New", monospace' : 'bold 13px "Courier New", monospace';
  ctx.fillText(`${labels.hud_level ?? 'LVL'} ${state.level}/${MAX_LEVEL}`, 20, bottomY);

  if (state.continues > 0) {
    ctx.fillStyle = COLORS.continueItem;
    ctx.font = isTall ? 'bold 20px "Courier New", monospace' : 'bold 12px "Courier New", monospace';
    ctx.fillText(`${labels.continue_hud ?? 'CONT'}: ${state.continues}`, isTall ? 204 : 138, bottomY);
  }

  // Active power-up timer bar
  if (state.powerUp !== 'NONE') {
    const puColor = POWERUP_COLORS[state.powerUp];
    const pct = Math.max(0, state.powerUpTimer / POWERUP_DURATION);
    const barW = isTall ? 200 : 128;
    const barH = isTall ? 14 : 8;
    const barY = isTall ? renderH - 38 : renderH - 20;
    ctx.fillStyle = `${puColor}38`;
    ctx.fillRect(CANVAS_W / 2 - barW / 2, barY, barW, barH);
    ctx.fillStyle = puColor;
    ctx.fillRect(CANVAS_W / 2 - barW / 2, barY, barW * pct, barH);
    ctx.textAlign = 'center';
    ctx.font = isTall ? 'bold 16px "Courier New", monospace' : 'bold 10px "Courier New", monospace';
    ctx.fillText(state.powerUp, CANVAS_W / 2, isTall ? renderH - 16 : renderH - 6);
  }

  // Mode label
  ctx.textAlign = 'right';
  ctx.fillStyle = mode === 'TOURNAMENT' ? COLORS.gold : COLORS.dimWhite;
  ctx.font = isTall ? 'bold 19px "Courier New", monospace' : 'bold 11px "Courier New", monospace';
  ctx.fillText(
    mode === 'TOURNAMENT' ? (labels.tournament_mode ?? 'TOURNAMENT') : (labels.fun_mode ?? 'EXHIBITION'),
    CANVAS_W - 20,
    bottomY,
  );
}

export function drawBossWarning(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  labels: Record<string, string>,
  renderH = CANVAS_H,
) {
  if (state.bossWarningTimer <= 0 || !state.boss) return;
  const flash = Math.sin(state.tick * 0.35) > -0.2;
  const alpha = Math.min(1, state.bossWarningTimer / 25);
  const cy = renderH / 2;
  ctx.save();
  ctx.globalAlpha = alpha * 0.85;
  ctx.fillStyle = 'rgba(30, 0, 18, 0.78)';
  ctx.fillRect(0, cy - 42, CANVAS_W, 84);
  ctx.strokeStyle = state.boss.accentColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, cy - 42); ctx.lineTo(CANVAS_W, cy - 42);
  ctx.moveTo(0, cy + 42); ctx.lineTo(CANVAS_W, cy + 42);
  ctx.stroke();

  if (flash) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff3b5c';
    ctx.font = 'bold 30px "Courier New", monospace';
    ctx.fillText(labels.boss_warning ?? '', CANVAS_W / 2, cy - 2);
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 14px "Courier New", monospace';
    const archetype = getBossProfile(state.boss.tier).archetype;
    ctx.fillText(`${labels.hud_level ?? ''} ${state.level} · ${labels.boss_label ?? ''} ${state.boss.tier}/10 · ${archetype}`, CANVAS_W / 2, cy + 24);
  }
  ctx.restore();
}

export function drawStageClear(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  labels: Record<string, string>,
  renderH = CANVAS_H,
) {
  const cy = renderH / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.48)';
  ctx.fillRect(0, 0, CANVAS_W, renderH);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 50px "Courier New", monospace';
  ctx.fillText(labels.stage_clear ?? '', CANVAS_W / 2, cy - 22);

  ctx.fillStyle = COLORS.primary;
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.fillText(`${labels.hud_level ?? ''} ${state.level}/${MAX_LEVEL}`, CANVAS_W / 2, cy + 12);

  if (state.timeBonus > 0 && state.timeBonusTimer > 0) {
    ctx.globalAlpha = Math.min(1, state.timeBonusTimer / 25);
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillText(`${labels.time_bonus ?? ''} +${state.timeBonus}`, CANVAS_W / 2, cy + 48);
  }
  ctx.restore();
}

export function drawVictory(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  labels: Record<string, string>,
  renderH = CANVAS_H,
) {
  ctx.save();
  ctx.fillStyle = 'rgba(1,6,20,0.72)';
  ctx.fillRect(0, 0, CANVAS_W, renderH);
  const cx = CANVAS_W / 2;
  const cy = renderH / 2;
  ctx.textAlign = 'center';

  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 56px "Courier New", monospace';
  ctx.fillText(labels.victory_title ?? '', cx, cy - 36);

  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 18px "Courier New", monospace';
  ctx.fillText(labels.victory_subtitle ?? '', cx, cy + 4);

  ctx.fillStyle = COLORS.white;
  ctx.font = 'bold 20px "Courier New", monospace';
  ctx.fillText(`${labels.final_score ?? ''}: ${state.score}`, cx, cy + 44);

  ctx.fillStyle = COLORS.primary;
  ctx.font = 'bold 15px "Courier New", monospace';
  ctx.fillText(labels.play_again ?? '', cx, cy + 88);
  ctx.restore();
}

export function drawGameOver(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  labels: Record<string, string>,
  renderH = CANVAS_H,
) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, CANVAS_W, renderH);
  const cx = CANVAS_W / 2;
  const cy = renderH / 2;
  ctx.textAlign = 'center';

  if (state.newRecord) {
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillText(labels.new_record ?? '', cx, cy - 88);
  }
  ctx.fillStyle = COLORS.secondary;
  ctx.font = 'bold 60px "Courier New", monospace';
  ctx.fillText(labels.game_over ?? '', cx, cy - 18);

  ctx.fillStyle = COLORS.white;
  ctx.font = '18px "Courier New", monospace';
  ctx.fillText(`${labels.final_score ?? ''}: ${state.score}  ·  ${labels.hud_level ?? ''} ${state.level}/${MAX_LEVEL}`, cx, cy + 34);

  ctx.fillStyle = COLORS.primary;
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.fillText(labels.play_again ?? '', cx, cy + 80);
  ctx.restore();
}

export function drawContinueScreen(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  labels: Record<string, string>,
  renderH = CANVAS_H,
) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.74)';
  ctx.fillRect(0, 0, CANVAS_W, renderH);
  const cx = CANVAS_W / 2;
  const cy = renderH / 2;
  const secs = Math.max(0, Math.ceil(state.continueTimer / 60));

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.continueItem;
  ctx.font = 'bold 48px "Courier New", monospace';
  ctx.fillText(labels.continue_title ?? '', cx, cy - 58);

  ctx.fillStyle = secs <= 3 ? '#ff4444' : COLORS.white;
  ctx.font = 'bold 64px "Courier New", monospace';
  ctx.fillText(String(secs), cx, cy + 16);

  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 15px "Courier New", monospace';
  ctx.fillText(`${labels.continue_hud ?? ''}: ${state.continues}`, cx, cy + 52);

  ctx.fillStyle = COLORS.primary;
  ctx.font = 'bold 15px "Courier New", monospace';
  ctx.fillText(labels.continue_prompt ?? '', cx, cy + 88);
  ctx.restore();
}

export function drawPaused(
  ctx: CanvasRenderingContext2D,
  labels: Record<string, string>,
  renderH = CANVAS_H,
) {
  const cy = renderH / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, CANVAS_W, renderH);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 52px "Courier New", monospace';
  ctx.fillText(labels.paused ?? '', CANVAS_W / 2, cy - 10);
  ctx.fillStyle = COLORS.dimWhite;
  ctx.font = '16px "Courier New", monospace';
  ctx.fillText(labels.resume ?? '', CANVAS_W / 2, cy + 36);
  ctx.restore();
}
