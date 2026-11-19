/**
 * Canvas 2D cinematic ending renderer for Radix Invaders:
 * deep-space nebulae, ringed planet, parallax stars, shooting comets,
 * the luminous cratered Radix Moon with its glowing Radical Mark, and
 * our twin-thruster starfighter flying across the cosmos into warp.
 */
import { CANVAS_H, CANVAS_W, COLORS } from '../constants/radix-invaders.constants';

interface StarParticle {
  x: number;
  y: number;
  z: number;
  r: number;
  phase: number;
  tint: string;
}

interface TrailSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  r: number;
  color: string;
}

interface Comet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  alpha: number;
}

const DURATION_MS = 11_500;
const STAR_TINTS = ['#ffffff', '#cceeff', '#ffd8f5', '#c8ffe8'] as const;

function buildRadixMoonSprite(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const size = 340;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) return null;

  const cx = size / 2;
  const cy = size / 2;
  const R = 112;

  const corona = g.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.48);
  corona.addColorStop(0, 'rgba(0, 229, 255, 0.38)');
  corona.addColorStop(0.45, 'rgba(99, 102, 241, 0.16)');
  corona.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = corona;
  g.fillRect(0, 0, size, size);

  g.save();
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.clip();

  const sphere = g.createRadialGradient(cx - R * 0.32, cy - R * 0.32, R * 0.1, cx, cy, R * 1.15);
  sphere.addColorStop(0, '#eefaff');
  sphere.addColorStop(0.32, '#b9dce8');
  sphere.addColorStop(0.68, '#537394');
  sphere.addColorStop(1, '#101c33');
  g.fillStyle = sphere;
  g.fillRect(cx - R, cy - R, R * 2, R * 2);

  const craters: Array<[number, number, number, number]> = [
    [-46, -34, 24, 0.14],
    [48, -42, 18, 0.16],
    [-58, 28, 28, 0.18],
    [52, 34, 22, 0.2],
    [12, 62, 16, 0.18],
    [-16, -68, 14, 0.12],
    [68, -4, 15, 0.16],
    [-22, 46, 12, 0.14],
  ];
  for (const [ox, oy, cr, alpha] of craters) {
    g.fillStyle = `rgba(10, 22, 48, ${alpha})`;
    g.beginPath();
    g.arc(cx + ox, cy + oy, cr, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(220, 248, 255, 0.14)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(cx + ox - 1.5, cy + oy - 1.5, cr, Math.PI * 0.9, Math.PI * 1.75);
    g.stroke();
  }

  // Authentic Radix Radical Mark: M0,91.1 L38.35,91.1 L85.85,158.1 L155.45,11 L223.9,11
  g.save();
  const markScale = 0.56;
  const markW = 223.9 * markScale;
  const markH = 169.1 * markScale;
  g.translate(cx - markW / 2, cy - markH / 2 - 4);
  g.scale(markScale, markScale);
  g.lineCap = 'round';
  g.lineJoin = 'round';

  const drawMarkPath = () => {
    g.beginPath();
    g.moveTo(0, 91.1);
    g.lineTo(38.35, 91.1);
    g.lineTo(85.85, 158.1);
    g.lineTo(155.45, 11);
    g.lineTo(223.9, 11);
  };

  g.strokeStyle = 'rgba(0, 229, 255, 0.24)';
  g.lineWidth = 56;
  drawMarkPath();
  g.stroke();

  g.strokeStyle = 'rgba(0, 255, 180, 0.48)';
  g.lineWidth = 36;
  drawMarkPath();
  g.stroke();

  g.strokeStyle = '#00e5ff';
  g.lineWidth = 24;
  drawMarkPath();
  g.stroke();

  g.strokeStyle = '#ffffff';
  g.lineWidth = 11;
  drawMarkPath();
  g.stroke();
  g.restore();

  const rim = g.createRadialGradient(cx, cy, R * 0.88, cx, cy, R);
  rim.addColorStop(0, 'rgba(0,0,0,0)');
  rim.addColorStop(1, 'rgba(0, 229, 255, 0.35)');
  g.fillStyle = rim;
  g.fillRect(cx - R, cy - R, R * 2, R * 2);

  g.restore();
  return c;
}

function buildCosmosBackdrop(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = CANVAS_W;
  c.height = CANVAS_H;
  const g = c.getContext('2d');
  if (!g) return null;

  const sky = g.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
  sky.addColorStop(0, '#020617');
  sky.addColorStop(0.35, '#071436');
  sky.addColorStop(0.7, '#120a33');
  sky.addColorStop(1, '#020614');
  g.fillStyle = sky;
  g.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const band = g.createLinearGradient(0, CANVAS_H * 0.85, CANVAS_W, CANVAS_H * 0.1);
  band.addColorStop(0, 'rgba(0, 229, 255, 0.13)');
  band.addColorStop(0.35, 'rgba(99, 102, 241, 0.16)');
  band.addColorStop(0.68, 'rgba(236, 72, 153, 0.14)');
  band.addColorStop(1, 'rgba(16, 185, 129, 0.11)');
  g.fillStyle = band;
  g.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const clouds: Array<[number, number, number, string]> = [
    [CANVAS_W * 0.2, CANVAS_H * 0.32, 340, 'rgba(0, 229, 255, 0.18)'],
    [CANVAS_W * 0.78, CANVAS_H * 0.26, 360, 'rgba(168, 85, 247, 0.2)'],
    [CANVAS_W * 0.56, CANVAS_H * 0.74, 340, 'rgba(255, 0, 140, 0.14)'],
    [CANVAS_W * 0.3, CANVAS_H * 0.78, 280, 'rgba(0, 255, 170, 0.11)'],
  ];
  for (const [x, y, r, color] of clouds) {
    const ng = g.createRadialGradient(x, y, 8, x, y, r);
    ng.addColorStop(0, color);
    ng.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = ng;
    g.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  // Distant ringed sapphire planet on lower-left horizon
  const px = 145;
  const py = CANVAS_H - 92;
  const pr = 64;
  const pGrad = g.createRadialGradient(px - 22, py - 24, 6, px, py, pr);
  pGrad.addColorStop(0, '#38bdf8');
  pGrad.addColorStop(0.55, '#1d4ed8');
  pGrad.addColorStop(1, '#091026');
  g.fillStyle = pGrad;
  g.beginPath();
  g.arc(px, py, pr, 0, Math.PI * 2);
  g.fill();

  g.save();
  g.translate(px, py);
  g.rotate(-0.28);
  g.strokeStyle = 'rgba(125, 211, 252, 0.42)';
  g.lineWidth = 6;
  g.beginPath();
  g.ellipse(0, 0, pr * 1.85, pr * 0.34, 0, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = 'rgba(255, 215, 0, 0.22)';
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(0, 0, pr * 1.55, pr * 0.27, 0, 0, Math.PI * 2);
  g.stroke();
  g.restore();

  return c;
}

function drawHeroShip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  scale: number,
  tick: number,
  warp: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  const flameLen = 18 + 9 * Math.sin(tick * 0.45) + warp * 40;
  const engines = [-11, 11] as const;
  for (let i = 0; i < engines.length; i++) {
    const ex = engines[i];
    ctx.globalAlpha = 0.24 + warp * 0.22;
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(ex, 16, 13 + warp * 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#ff9900';
    ctx.beginPath();
    ctx.moveTo(ex - 5.5, 11);
    ctx.lineTo(ex + 5.5, 11);
    ctx.lineTo(ex, 14 + flameLen);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#e0fbff';
    ctx.beginPath();
    ctx.moveTo(ex - 2.8, 11);
    ctx.lineTo(ex + 2.8, 11);
    ctx.lineTo(ex, 13 + flameLen * 0.65);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(0, 229, 255, 0.22)';
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.lineTo(32, 18);
  ctx.lineTo(0, 10);
  ctx.lineTo(-32, 18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = COLORS.playerShip;
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(28, 16);
  ctx.lineTo(14, 8);
  ctx.lineTo(-14, 8);
  ctx.lineTo(-28, 16);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#032946';
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(12, 8);
  ctx.lineTo(-12, 8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = COLORS.gold;
  ctx.fillRect(-23, 2, 4, 11);
  ctx.fillRect(19, 2, 4, 11);

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, -3, 5, 8.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function sampleShipPosition(p: number): [number, number] {
  const warp = p > 0.78 ? Math.min(1, (p - 0.78) / 0.22) : 0;
  const x = p < 0.78
    ? -60 + (p / 0.78) * (CANVAS_W * 0.72)
    : -60 + CANVAS_W * 0.72 + Math.pow(warp, 1.8) * (CANVAS_W * 0.55);
  const y = CANVAS_H * 0.62 - Math.sin(p * Math.PI * 1.15) * 145 + Math.cos(p * Math.PI * 3) * 18;
  return [x, y];
}

/**
 * Starts the Victory Ending Canvas2D animation loop and returns a cleanup function.
 */
export function startVictoryCinematic(
  canvas: HTMLCanvasElement,
  labels: Record<string, string>,
  score: number,
  onComplete: () => void,
): () => void {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    onComplete();
    return () => {};
  }

  const cosmosBg = buildCosmosBackdrop();
  const moonSprite = buildRadixMoonSprite();

  const stars: StarParticle[] = Array.from({ length: 160 }, (_, i) => ({
    x: Math.random() * CANVAS_W,
    y: Math.random() * CANVAS_H,
    z: i < 95 ? 0.35 + Math.random() * 0.45 : i < 140 ? 0.8 + Math.random() * 0.5 : 1.3 + Math.random() * 0.6,
    r: i < 95 ? 0.9 : i < 140 ? 1.5 : 2.3,
    phase: Math.random() * Math.PI * 2,
    tint: STAR_TINTS[i % STAR_TINTS.length],
  }));

  const sparks: TrailSpark[] = [];
  const comets: Comet[] = [];
  let rafId = 0;
  const startTime = performance.now();
  let lastTime = startTime;
  let tick = 0;
  let nextCometTick = 45;

  const loop = (now: number) => {
    const progress = Math.min(1, (now - startTime) / DURATION_MS);
    const deltaMs = Math.min(33.33, Math.max(0.5, now - lastTime));
    lastTime = now;
    const dt = deltaMs / (1000 / 60);
    tick += dt;

    const warp = progress > 0.78 ? Math.min(1, (progress - 0.78) / 0.22) : 0;

    if (cosmosBg) {
      ctx.drawImage(cosmosBg, 0, 0);
    } else {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    for (let i = 0; i < stars.length; i++) {
      const st = stars[i];
      st.x += -(1.4 + warp * 14) * st.z * dt;
      st.y += (0.35 + warp * 2.2) * st.z * dt;
      if (st.x < -20) { st.x = CANVAS_W + 10; st.y = Math.random() * CANVAS_H; }
      if (st.y > CANVAS_H + 20) { st.y = -10; st.x = Math.random() * CANVAS_W; }
      st.phase += 0.05 * dt;
      ctx.globalAlpha = 0.4 + 0.6 * ((Math.sin(st.phase) + 1) * 0.5);
      ctx.fillStyle = st.tint;
      if (warp > 0.08) {
        ctx.fillRect(st.x, st.y, (6 + warp * 36) * st.z, st.r);
      } else {
        ctx.fillRect(st.x, st.y, st.r * 1.4, st.r * 1.4);
      }
    }
    ctx.globalAlpha = 1;

    if (tick >= nextCometTick && warp < 0.4) {
      nextCometTick = tick + 85 + Math.random() * 70;
      comets.push({
        x: CANVAS_W + 40,
        y: 40 + Math.random() * (CANVAS_H * 0.55),
        vx: -(10 + Math.random() * 5),
        vy: 2.5 + Math.random() * 2,
        len: 55 + Math.random() * 45,
        alpha: 0.9,
      });
    }
    let cw = 0;
    for (let i = 0; i < comets.length; i++) {
      const cm = comets[i];
      cm.x += cm.vx * dt;
      cm.y += cm.vy * dt;
      cm.alpha -= 0.006 * dt;
      if (cm.x > -120 && cm.alpha > 0.02) {
        comets[cw++] = cm;
        ctx.strokeStyle = `rgba(186, 245, 255, ${cm.alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cm.x, cm.y);
        ctx.lineTo(cm.x - cm.vx * (cm.len / 12), cm.y - cm.vy * (cm.len / 12));
        ctx.stroke();
      }
    }
    comets.length = cw;

    const moonX = CANVAS_W + 170 - progress * (CANVAS_W + 340);
    const moonY = CANVAS_H * 0.34 - Math.sin(progress * Math.PI) * 36;
    if (moonSprite) {
      ctx.drawImage(moonSprite, (moonX - moonSprite.width / 2) | 0, (moonY - moonSprite.height / 2) | 0);
    }

    const [shipX, shipY] = sampleShipPosition(progress);
    const [prevX, prevY] = sampleShipPosition(Math.max(0, progress - 0.01));
    const flightAngle = Math.atan2(shipY - prevY, shipX - prevX);
    const heading = flightAngle + Math.PI / 2;
    const shipScale = 1.25 + Math.sin(progress * Math.PI) * 0.25;

    const cosH = Math.cos(heading);
    const sinH = Math.sin(heading);
    const backVx = -Math.cos(flightAngle);
    const backVy = -Math.sin(flightAngle);
    const nozzles = [-11, 11] as const;
    const perNozzle = warp > 0 ? 2 : 1;
    for (let n = 0; n < nozzles.length; n++) {
      const lx = nozzles[n] * shipScale;
      const ly = 15 * shipScale;
      const nx = shipX + lx * cosH - ly * sinH;
      const ny = shipY + lx * sinH + ly * cosH;
      for (let k = 0; k < perNozzle; k++) {
        if (sparks.length < 180) {
          const spd = 2.6 + Math.random() * 2.2 + warp * 5.5;
          sparks.push({
            x: nx + (Math.random() - 0.5) * 3,
            y: ny + (Math.random() - 0.5) * 3,
            vx: backVx * spd + (Math.random() - 0.5) * 0.7,
            vy: backVy * spd + (Math.random() - 0.5) * 0.7,
            life: 1,
            maxLife: 1,
            r: 1.6 + Math.random() * 2.0,
            color: (n + k) % 2 === 0 ? '#00e5ff' : '#ffd700',
          });
        }
      }
    }

    let sw = 0;
    for (let i = 0; i < sparks.length; i++) {
      const sp = sparks[i];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.life -= 0.036 * dt;
      if (sp.life > 0) {
        sparks[sw++] = sp;
        ctx.globalAlpha = sp.life * 0.85;
        ctx.fillStyle = sp.color;
        ctx.fillRect(sp.x - sp.r, sp.y - sp.r, sp.r * 2, sp.r * 2);
      }
    }
    sparks.length = sw;
    ctx.globalAlpha = 1;

    drawHeroShip(ctx, shipX, shipY, heading, shipScale, tick, warp);

    const titleAlpha = progress < 0.12
      ? progress / 0.12
      : progress > 0.88
        ? (1 - progress) / 0.12
        : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, titleAlpha));
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 46px "Courier New", monospace';
    ctx.fillText(labels.victory_title ?? '', CANVAS_W / 2, 84);

    ctx.fillStyle = '#cceeff';
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillText(labels.victory_subtitle ?? '', CANVAS_W / 2, 114);

    if (score > 0) {
      ctx.fillStyle = COLORS.primary;
      ctx.font = 'bold 15px "Courier New", monospace';
      ctx.fillText(`${labels.final_score ?? ''}: ${score.toLocaleString()}`, CANVAS_W / 2, CANVAS_H - 36);
    }
    ctx.restore();

    if (progress > 0.9) {
      const flash = (progress - 0.9) / 0.1;
      ctx.fillStyle = `rgba(2, 12, 32, ${Math.min(1, flash)})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }

    if (progress >= 1) {
      onComplete();
      return;
    }

    rafId = requestAnimationFrame(loop);
  };

  rafId = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(rafId);
}
