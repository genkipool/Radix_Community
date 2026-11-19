/**
 * Dedicated Canvas 2D renderer for the 10 distinct Boss Dreadnought silhouettes
 * (VANGUARD, VIPER, PHALANX, VORTEX, SNIPER, CARRIER, TEMPEST, PULSAR, NEMESIS, OMEGA).
 */
import type { Boss, GameState } from '../types/radix-invaders.types';
import { CANVAS_W, COLORS } from '../constants/radix-invaders.constants';
import { getBossProfile, type BossArchetype } from '../services/waves';

function drawBossHull(
  ctx: CanvasRenderingContext2D,
  archetype: BossArchetype,
  w: number,
  h: number,
  tick: number,
  hullFill: string,
  coreColor: string,
  turretColor: string,
  charging: boolean,
) {
  ctx.fillStyle = hullFill;
  ctx.strokeStyle = coreColor;
  ctx.lineWidth = 2.4;

  switch (archetype) {
    case 'VIPER': {
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.54);
      ctx.lineTo(w * 0.24, -h * 0.25);
      ctx.lineTo(w * 0.52, -h * 0.1);
      ctx.lineTo(w * 0.44, h * 0.56);
      ctx.lineTo(w * 0.28, h * 0.14);
      ctx.lineTo(w * 0.12, h * 0.36);
      ctx.lineTo(-w * 0.12, h * 0.36);
      ctx.lineTo(-w * 0.28, h * 0.14);
      ctx.lineTo(-w * 0.44, h * 0.56);
      ctx.lineTo(-w * 0.52, -h * 0.1);
      ctx.lineTo(-w * 0.24, -h * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = turretColor;
      ctx.beginPath();
      ctx.arc(-w * 0.43, h * 0.5, 5, 0, Math.PI * 2);
      ctx.arc(w * 0.43, h * 0.5, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'PHALANX': {
      ctx.beginPath();
      ctx.roundRect(-w * 0.52, -h * 0.4, w * 1.04, h * 0.68, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = hullFill;
      const xs = [-w * 0.44, -w * 0.2, w * 0.08, w * 0.32];
      for (let i = 0; i < xs.length; i++) {
        ctx.fillRect(xs[i], h * 0.18, w * 0.12, h * 0.3);
        ctx.strokeRect(xs[i], h * 0.18, w * 0.12, h * 0.3);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-w * 0.48, -h * 0.08);
      ctx.lineTo(w * 0.48, -h * 0.08);
      ctx.stroke();
      break;
    }

    case 'VORTEX': {
      ctx.save();
      ctx.rotate(tick * 0.035);
      ctx.fillStyle = hullFill;
      ctx.strokeStyle = coreColor;
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(10, -8);
        ctx.lineTo(w * 0.48, -16);
        ctx.lineTo(w * 0.42, 12);
        ctx.lineTo(10, 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = turretColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, h * 0.52, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }

    case 'SNIPER': {
      if (charging) {
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = '#ff3b5c';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(0, h * 0.58);
        ctx.lineTo(0, h * 4.5);
        ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.56);
      ctx.lineTo(w * 0.48, h * 0.14);
      ctx.lineTo(w * 0.22, h * 0.18);
      ctx.lineTo(w * 0.08, h * 0.62);
      ctx.lineTo(-w * 0.08, h * 0.62);
      ctx.lineTo(-w * 0.22, h * 0.18);
      ctx.lineTo(-w * 0.48, h * 0.14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = turretColor;
      ctx.fillRect(-3, h * 0.18, 6, h * 0.44);
      break;
    }

    case 'CARRIER': {
      ctx.beginPath();
      ctx.roundRect(-w * 0.52, -h * 0.42, w * 0.32, h * 0.9, 6);
      ctx.roundRect(w * 0.2, -h * 0.42, w * 0.32, h * 0.9, 6);
      ctx.roundRect(-w * 0.24, -h * 0.32, w * 0.48, h * 0.54, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = turretColor;
      ctx.fillRect(-w * 0.44, h * 0.34, w * 0.16, 7);
      ctx.fillRect(w * 0.28, h * 0.34, w * 0.16, 7);
      break;
    }

    case 'TEMPEST': {
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.52);
      ctx.lineTo(w * 0.18, -h * 0.2);
      ctx.lineTo(w * 0.54, -h * 0.36);
      ctx.lineTo(w * 0.36, h * 0.06);
      ctx.lineTo(w * 0.5, h * 0.42);
      ctx.lineTo(w * 0.16, h * 0.24);
      ctx.lineTo(0, h * 0.5);
      ctx.lineTo(-w * 0.16, h * 0.24);
      ctx.lineTo(-w * 0.5, h * 0.42);
      ctx.lineTo(-w * 0.36, h * 0.06);
      ctx.lineTo(-w * 0.54, -h * 0.36);
      ctx.lineTo(-w * 0.18, -h * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    }

    case 'PULSAR': {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const rx = Math.cos(a) * w * 0.42;
        const ry = Math.sin(a) * h * 0.52;
        if (i === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.rotate(-tick * 0.04);
      ctx.strokeStyle = turretColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.5, h * 0.26, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      break;
    }

    case 'NEMESIS': {
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.48);
      ctx.lineTo(w * 0.3, -h * 0.44);
      ctx.lineTo(w * 0.54, h * 0.12);
      ctx.lineTo(w * 0.34, h * 0.56);
      ctx.lineTo(w * 0.22, h * 0.18);
      ctx.lineTo(0, h * 0.42);
      ctx.lineTo(-w * 0.22, h * 0.18);
      ctx.lineTo(-w * 0.34, h * 0.56);
      ctx.lineTo(-w * 0.54, h * 0.12);
      ctx.lineTo(-w * 0.3, -h * 0.44);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = turretColor;
      ctx.fillRect(-w * 0.2, -h * 0.14, w * 0.4, 5);
      break;
    }

    case 'OMEGA': {
      ctx.save();
      ctx.rotate(tick * 0.025);
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.56, h * 0.58, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.moveTo(0, -h * 0.58);
      ctx.lineTo(w * 0.16, -h * 0.36);
      ctx.lineTo(w * 0.34, -h * 0.5);
      ctx.lineTo(w * 0.56, -h * 0.08);
      ctx.lineTo(w * 0.48, h * 0.44);
      ctx.lineTo(w * 0.24, h * 0.28);
      ctx.lineTo(w * 0.14, h * 0.54);
      ctx.lineTo(-w * 0.14, h * 0.54);
      ctx.lineTo(-w * 0.24, h * 0.28);
      ctx.lineTo(-w * 0.48, h * 0.44);
      ctx.lineTo(-w * 0.56, -h * 0.08);
      ctx.lineTo(-w * 0.34, -h * 0.5);
      ctx.lineTo(-w * 0.16, -h * 0.36);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath();
      ctx.arc(-w * 0.3, 4, 7, 0, Math.PI * 2);
      ctx.arc(w * 0.3, 4, 7, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'VANGUARD':
    default: {
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.5);
      ctx.lineTo(w * 0.32, -h * 0.34);
      ctx.lineTo(w * 0.5, -h * 0.05);
      ctx.lineTo(w * 0.44, h * 0.38);
      ctx.lineTo(w * 0.22, h * 0.24);
      ctx.lineTo(w * 0.14, h * 0.48);
      ctx.lineTo(-w * 0.14, h * 0.48);
      ctx.lineTo(-w * 0.22, h * 0.24);
      ctx.lineTo(-w * 0.44, h * 0.38);
      ctx.lineTo(-w * 0.5, -h * 0.05);
      ctx.lineTo(-w * 0.32, -h * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = turretColor;
      ctx.fillRect(-w * 0.39, h * 0.18, 10, 18);
      ctx.fillRect(w * 0.39 - 10, h * 0.18, 10, 18);
      break;
    }
  }
}

export function drawBoss(ctx: CanvasRenderingContext2D, state: GameState, labels: Record<string, string>) {
  const boss: Boss | null = state.boss;
  if (!boss || !boss.active) return;

  const { x, y, w, h, enraged, hitFlash, chargeTimer, accentColor } = boss;
  const archetype = getBossProfile(boss.tier).archetype;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const coreColor = hitFlash > 0 ? '#ffffff' : enraged ? '#ff2a2a' : accentColor;
  const turretColor = chargeTimer > 0 ? COLORS.gold : coreColor;
  const pulse = 0.72 + 0.28 * Math.sin(state.tick * (enraged ? 0.28 : 0.14));

  ctx.save();
  ctx.translate(cx, cy);

  // Subtle ambient halo behind boss
  ctx.globalAlpha = 0.18 * pulse;
  ctx.fillStyle = coreColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.62, h * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  drawBossHull(ctx, archetype, w, h, state.tick, hitFlash > 0 ? '#ffffff' : '#101b33', coreColor, turretColor, chargeTimer > 0);

  // Central pulsing energy core
  const coreR = 13 + (chargeTimer > 0 ? 4 * Math.sin(state.tick * 0.6) : 2 * pulse);
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = turretColor;
  ctx.beginPath();
  ctx.arc(0, 2, coreR + 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = turretColor;
  ctx.beginPath();
  ctx.arc(0, 2, coreR, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 2, coreR * 0.45, 0, Math.PI * 2);
  ctx.fill();

  // Charge telegraph ring
  if (chargeTimer > 0) {
    const pct = chargeTimer / 26;
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(0, 2, 16 + pct * 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.restore();

  // Boss HP bar at top-center
  const barW = 340;
  const barH = 12;
  const bx = (CANVAS_W - barW) / 2;
  const by = 58;
  const hpPct = Math.max(0, boss.hp / boss.maxHp);

  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);
  ctx.fillStyle = enraged ? '#ff3333' : accentColor;
  ctx.fillRect(bx, by, barW * hpPct, barH);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx - 1, by - 1, barW + 2, barH + 2);

  ctx.textAlign = 'center';
  ctx.fillStyle = enraged ? '#ff6666' : COLORS.gold;
  ctx.font = 'bold 11px "Courier New", monospace';
  const bossTitle = `${labels.boss_label ?? ''} ${boss.tier}/10 · ${archetype}${enraged ? ` · ${labels.boss_enraged ?? ''}` : ''}`;
  ctx.fillText(bossTitle, CANVAS_W / 2, by - 6);
}
