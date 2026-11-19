/**
 * 3-phase strictly tier-escalating Boss AI for Radix Invaders (levels 10..100).
 * Each of the 10 bosses has its own combat archetype & attack rotation.
 */
import type { Alien, Boss, Bullet, GameState } from '../types/radix-invaders.types';
import { ALIEN_W, CANVAS_W, PLAYER_Y } from '../constants/radix-invaders.constants';
import { getBossProfile, type BossProfile } from './waves';

export interface BossAiHooks {
  pushBullet: (
    list: Bullet[],
    x: number,
    y: number,
    vx: number,
    vy: number,
    kind: Bullet['kind'],
    damage?: number,
    phase?: number,
  ) => void;
  spawnExplosion: (
    s: GameState,
    x: number,
    y: number,
    color: string,
    count?: number,
    spread?: number,
    withRing?: boolean,
  ) => void;
  addShake: (s: GameState, duration: number, intensity: number) => void;
  randInt: (a: number, b: number) => number;
}

function spawnBossEscorts(s: GameState, boss: Boss, profile: BossProfile, critical: boolean, bonusCount = 0) {
  // Compact dead escorts in place so s.aliens never grows unboundedly during long boss fights
  let aw = 0;
  for (let i = 0; i < s.aliens.length; i++) {
    if (s.aliens[i].alive) s.aliens[aw++] = s.aliens[i];
  }
  s.aliens.length = aw;
  const activeEscorts = aw;
  const maxEscorts = Math.min(4, profile.maxEscorts + bonusCount + (critical ? 1 : 0));
  if (activeEscorts >= maxEscorts) return;
  const toSpawn = Math.min(maxEscorts - activeEscorts, critical ? 2 : 1 + (bonusCount > 0 ? 1 : 0));
  for (let i = 0; i < toSpawn; i++) {
    const sx = i % 2 === 0 ? boss.x + 10 : boss.x + boss.w - ALIEN_W - 10;
    const escort: Alien = {
      row: 0,
      col: i,
      x: sx,
      y: boss.y + boss.h,
      alive: true,
      hp: profile.escortHp,
      maxHp: profile.escortHp,
      frame: 0,
      hitFlash: 0,
      type: 3,
      diving: true,
      diveTargetX: s.player.x,
      diveAngle: Math.PI * 0.5,
      divePhase: 'DIVE',
      diveFlipTimer: 0,
      diveOriginX: sx,
      diveOriginY: boss.y + boss.h,
    };
    s.aliens.push(escort);
  }
}

function fireAimedFan(
  s: GameState,
  boss: Boss,
  profile: BossProfile,
  speed: number,
  hooks: BossAiHooks,
  leadFactor = 0,
) {
  const cx = boss.x + boss.w / 2;
  const cy = boss.y + boss.h - 4;
  const targetX = Math.max(40, Math.min(CANVAS_W - 40, s.player.x + s.player.vx * leadFactor));
  const baseAngle = Math.atan2(PLAYER_Y - cy, targetX - cx);
  const count = profile.fanCount + (boss.enraged ? 1 : 0);
  const spread = 0.22;
  const half = (count - 1) / 2;
  for (let i = 0; i < count; i++) {
    const a = baseAngle + (i - half) * spread;
    hooks.pushBullet(s.bulletsE, cx, cy, Math.cos(a) * speed, Math.sin(a) * speed, 'boss_orb');
  }
  if (boss.tier >= 7 || leadFactor > 0) {
    hooks.pushBullet(s.bulletsE, cx, cy, Math.cos(baseAngle) * speed * 1.24, Math.sin(baseAngle) * speed * 1.24, 'boss_heavy');
  }
}

function fireTwinTurrets(s: GameState, boss: Boss, speed: number, hooks: BossAiHooks) {
  const cx = boss.x + boss.w / 2;
  const cy = boss.y + boss.h - 4;
  const lx = boss.x + 22;
  const rx = boss.x + boss.w - 22;
  const ty = boss.y + boss.h * 0.76;
  const aimL = Math.atan2(PLAYER_Y - ty, s.player.x - lx);
  const aimR = Math.atan2(PLAYER_Y - ty, s.player.x - rx);
  hooks.pushBullet(s.bulletsE, lx, ty, 0, speed * 1.22, 'boss_heavy');
  hooks.pushBullet(s.bulletsE, rx, ty, 0, speed * 1.22, 'boss_heavy');
  hooks.pushBullet(s.bulletsE, lx, ty, Math.cos(aimL) * speed * 1.05, Math.sin(aimL) * speed * 1.05, 'boss_orb');
  hooks.pushBullet(s.bulletsE, rx, ty, Math.cos(aimR) * speed * 1.05, Math.sin(aimR) * speed * 1.05, 'boss_orb');

  const extraPairs = Math.min(2, Math.floor(boss.tier / 3));
  for (let p = 1; p <= extraPairs; p++) {
    const delta = 0.2 * p;
    hooks.pushBullet(s.bulletsE, lx, ty, Math.cos(aimL - delta) * speed * 0.96, Math.sin(aimL - delta) * speed * 0.96, 'boss_orb');
    hooks.pushBullet(s.bulletsE, rx, ty, Math.cos(aimR + delta) * speed * 0.96, Math.sin(aimR + delta) * speed * 0.96, 'boss_orb');
  }
  if (boss.enraged && boss.tier >= 4) {
    hooks.pushBullet(s.bulletsE, cx, cy, 0, speed * 1.26, 'boss_heavy');
  }
}

function firePlasmaCurtain(
  s: GameState,
  boss: Boss,
  profile: BossProfile,
  speed: number,
  critical: boolean,
  hooks: BossAiHooks,
  extraHeavy = false,
) {
  const cx = boss.x + boss.w / 2;
  const cy = boss.y + boss.h - 4;
  const count = Math.min(12, profile.curtainCount + (boss.enraged ? 1 : 0) + (critical ? 1 : 0));
  const startA = Math.PI * 0.16;
  const endA = Math.PI * 0.84;
  const step = (endA - startA) / (count - 1);
  // Wide 2-slot safe corridor so there is always a readable lane to slip through
  const gapIdx = hooks.randInt(1, Math.max(1, count - 3));
  for (let i = 0; i < count; i++) {
    if (i === gapIdx || i === gapIdx + 1) continue;
    const a = startA + i * step;
    hooks.pushBullet(s.bulletsE, cx, cy, Math.cos(a) * (speed * 0.9), Math.sin(a) * (speed * 0.9), 'boss_orb');
  }
  if (extraHeavy || boss.tier >= 5) {
    const aim = Math.atan2(PLAYER_Y - cy, s.player.x - cx);
    hooks.pushBullet(s.bulletsE, cx, cy, Math.cos(aim) * speed * 1.18, Math.sin(aim) * speed * 1.18, 'boss_heavy');
  }
}

function fireDoubleHelixBananas(
  s: GameState,
  boss: Boss,
  profile: BossProfile,
  speed: number,
  critical: boolean,
  hooks: BossAiHooks,
) {
  const cx = boss.x + boss.w / 2;
  const cy = boss.y + boss.h - 4;
  const count = Math.min(8, profile.bananaCount + (boss.enraged ? 1 : 0) + (critical ? 1 : 0));
  for (let i = 0; i < count; i++) {
    const offsetX = ((i - (count - 1) / 2) * (boss.w + 90)) / count;
    const phase = (i % 2 === 0 ? 0 : Math.PI) + i * 0.7;
    hooks.pushBullet(s.bulletsE, cx + offsetX, cy, 0, speed * 0.82, 'banana', 1, phase);
  }
}

function fireVortexSpiral(s: GameState, boss: Boss, speed: number, critical: boolean, hooks: BossAiHooks) {
  const cx = boss.x + boss.w / 2;
  const cy = boss.y + boss.h * 0.72;
  const arms = 6 + Math.floor(boss.tier / 3) + (boss.enraged ? 1 : 0);
  const spinOffset = (boss.attackIndex * 0.48) % (Math.PI * 2);
  for (let i = 0; i < arms; i++) {
    const a = spinOffset + (i / arms) * Math.PI * 2;
    if (Math.sin(a) < 0.14) continue;
    hooks.pushBullet(s.bulletsE, cx, cy, Math.cos(a) * (speed * 0.94), Math.sin(a) * (speed * 0.94), 'boss_orb');
  }
  if (critical) {
    const aim = Math.atan2(PLAYER_Y - cy, s.player.x - cx);
    hooks.pushBullet(s.bulletsE, cx, cy, Math.cos(aim) * (speed * 1.18), Math.sin(aim) * (speed * 1.18), 'boss_heavy');
  }
}

function fireSniperLock(s: GameState, boss: Boss, speed: number, leadFactor: number, hooks: BossAiHooks) {
  const cx = boss.x + boss.w / 2;
  const cy = boss.y + boss.h - 4;
  const targetX = Math.max(36, Math.min(CANVAS_W - 36, s.player.x + s.player.vx * leadFactor));
  const aim = Math.atan2(PLAYER_Y - cy, targetX - cx);
  hooks.pushBullet(s.bulletsE, cx, cy, Math.cos(aim) * (speed * 1.36), Math.sin(aim) * (speed * 1.36), 'boss_heavy');
  if (boss.enraged) {
    hooks.pushBullet(s.bulletsE, cx, cy - 16, Math.cos(aim) * (speed * 1.2), Math.sin(aim) * (speed * 1.2), 'boss_heavy');
  }
  const wingLayers = boss.tier >= 7 ? 2 : 1;
  for (let w = 1; w <= wingLayers; w++) {
    const aOff = 0.2 * w;
    const spd = speed * (1.08 - w * 0.06);
    hooks.pushBullet(s.bulletsE, cx - 18 * w, cy, Math.cos(aim - aOff) * spd, Math.sin(aim - aOff) * spd, 'boss_orb');
    hooks.pushBullet(s.bulletsE, cx + 18 * w, cy, Math.cos(aim + aOff) * spd, Math.sin(aim + aOff) * spd, 'boss_orb');
  }
}

function fireTempestCrossRain(s: GameState, boss: Boss, speed: number, critical: boolean, hooks: BossAiHooks) {
  const lx = boss.x + 16;
  const rx = boss.x + boss.w - 16;
  const ty = boss.y + boss.h * 0.72;
  const count = Math.min(5, 3 + Math.floor(boss.tier / 4) + (critical ? 1 : 0));
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(1, count - 1);
    const aLeft = Math.PI * (0.24 + t * 0.26);
    const aRight = Math.PI * (0.76 - t * 0.26);
    const spd = speed * (0.86 + t * 0.22);
    hooks.pushBullet(s.bulletsE, lx, ty, Math.cos(aLeft) * spd, Math.sin(aLeft) * spd, i % 2 === 0 ? 'boss_orb' : 'boss_heavy');
    hooks.pushBullet(s.bulletsE, rx, ty, Math.cos(aRight) * spd, Math.sin(aRight) * spd, i % 2 === 0 ? 'boss_orb' : 'boss_heavy');
  }
}

function firePulsarNova(s: GameState, boss: Boss, speed: number, critical: boolean, hooks: BossAiHooks) {
  const cx = boss.x + boss.w / 2;
  const cy = boss.y + boss.h * 0.65;
  const ringCount = Math.min(9, 6 + Math.floor(boss.tier / 3) + (critical ? 1 : 0));
  for (let i = 0; i < ringCount; i++) {
    const a = Math.PI * 0.14 + (i / (ringCount - 1)) * Math.PI * 0.72;
    hooks.pushBullet(s.bulletsE, cx, cy, Math.cos(a) * speed, Math.sin(a) * speed, 'boss_orb');
  }
  const innerCount = Math.max(4, ringCount - 2);
  const halfStep = (Math.PI * 0.72) / (innerCount * 2);
  for (let i = 0; i < innerCount; i++) {
    const a = Math.PI * 0.14 + halfStep + (i / innerCount) * Math.PI * 0.72;
    hooks.pushBullet(s.bulletsE, cx, cy, Math.cos(a) * (speed * 0.68), Math.sin(a) * (speed * 0.68), 'boss_heavy');
  }
}

function executeBossAttack(s: GameState, boss: Boss, critical: boolean, hooks: BossAiHooks) {
  const profile = getBossProfile(boss.tier);
  const speed = profile.bulletSpeed + (boss.enraged ? 0.45 : 0) + (critical ? 0.4 : 0);
  const step = boss.attackIndex % (profile.archetype === 'OMEGA' ? 5 : 4);
  boss.attackIndex += 1;

  switch (profile.archetype) {
    case 'VANGUARD':
      if (step === 0) fireAimedFan(s, boss, profile, speed, hooks);
      else if (step === 1) fireTwinTurrets(s, boss, speed, hooks);
      else if (step === 2) firePlasmaCurtain(s, boss, profile, speed, critical, hooks);
      else { fireAimedFan(s, boss, profile, speed, hooks); spawnBossEscorts(s, boss, profile, critical); }
      break;

    case 'VIPER':
      if (step === 0 || step === 2) fireDoubleHelixBananas(s, boss, profile, speed, critical, hooks);
      else if (step === 1) fireAimedFan(s, boss, profile, speed * 1.04, hooks);
      else { fireTwinTurrets(s, boss, speed, hooks); spawnBossEscorts(s, boss, profile, critical); }
      break;

    case 'PHALANX':
      if (step === 0 || step === 2) firePlasmaCurtain(s, boss, profile, speed, critical, hooks, true);
      else if (step === 1) fireTwinTurrets(s, boss, speed * 1.04, hooks);
      else { fireAimedFan(s, boss, profile, speed, hooks); spawnBossEscorts(s, boss, profile, critical); }
      break;

    case 'VORTEX':
      if (step === 0 || step === 2) fireVortexSpiral(s, boss, speed, critical, hooks);
      else if (step === 1) fireDoubleHelixBananas(s, boss, profile, speed, critical, hooks);
      else { fireAimedFan(s, boss, profile, speed, hooks); spawnBossEscorts(s, boss, profile, critical); }
      break;

    case 'SNIPER':
      if (step === 0 || step === 2) fireSniperLock(s, boss, speed, 8, hooks);
      else if (step === 1) fireTwinTurrets(s, boss, speed * 1.05, hooks);
      else { firePlasmaCurtain(s, boss, profile, speed, critical, hooks, true); spawnBossEscorts(s, boss, profile, critical); }
      break;

    case 'CARRIER':
      if (step === 0 || step === 2) { fireTwinTurrets(s, boss, speed, hooks); spawnBossEscorts(s, boss, profile, critical, 1); }
      else if (step === 1) fireAimedFan(s, boss, profile, speed, hooks);
      else fireTempestCrossRain(s, boss, speed, critical, hooks);
      break;

    case 'TEMPEST':
      if (step === 0 || step === 2) fireTempestCrossRain(s, boss, speed, critical, hooks);
      else if (step === 1) fireDoubleHelixBananas(s, boss, profile, speed * 1.04, critical, hooks);
      else { fireVortexSpiral(s, boss, speed, critical, hooks); spawnBossEscorts(s, boss, profile, critical); }
      break;

    case 'PULSAR':
      if (step === 0 || step === 2) firePulsarNova(s, boss, speed, critical, hooks);
      else if (step === 1) fireSniperLock(s, boss, speed, 10, hooks);
      else { fireVortexSpiral(s, boss, speed, critical, hooks); spawnBossEscorts(s, boss, profile, critical); }
      break;

    case 'NEMESIS':
      if (step === 0) fireSniperLock(s, boss, speed * 1.04, 14, hooks);
      else if (step === 1) fireAimedFan(s, boss, profile, speed * 1.04, hooks, 10);
      else if (step === 2) fireTempestCrossRain(s, boss, speed, critical, hooks);
      else { firePulsarNova(s, boss, speed, critical, hooks); spawnBossEscorts(s, boss, profile, critical); }
      break;

    case 'OMEGA':
      if (step === 0) firePulsarNova(s, boss, speed, critical, hooks);
      else if (step === 1) fireSniperLock(s, boss, speed * 1.04, 13, hooks);
      else if (step === 2) fireVortexSpiral(s, boss, speed, critical, hooks);
      else if (step === 3) fireTempestCrossRain(s, boss, speed, critical, hooks);
      else { firePlasmaCurtain(s, boss, profile, speed, critical, hooks, true); spawnBossEscorts(s, boss, profile, critical, 1); }
      break;
  }
}

export function updateBoss(s: GameState, boss: Boss, dt: number, hooks: BossAiHooks) {
  if (boss.hitFlash > 0) boss.hitFlash = Math.max(0, boss.hitFlash - dt);

  if (boss.entering) {
    boss.y += 2.6 * dt;
    if (boss.y >= boss.targetY) {
      boss.y = boss.targetY;
      boss.entering = false;
    }
    return;
  }

  const profile = getBossProfile(boss.tier);
  const hpRatio = boss.hp / boss.maxHp;
  const critical = hpRatio <= profile.criticalThreshold;

  if (!boss.enraged && hpRatio <= profile.enragedThreshold) {
    boss.enraged = true;
    boss.vx = Math.sign(boss.vx || 1) * (profile.strafeSpeed * 1.38);
    hooks.spawnExplosion(s, boss.x + boss.w / 2, boss.y + boss.h / 2, boss.accentColor, 28, 7.5, true);
    hooks.addShake(s, 16, 6);
    s.sfx.push({ type: 'boss_warning' });
  }

  const speedMult = critical ? 1.28 : 1;
  boss.x += boss.vx * speedMult * dt;
  if (boss.x <= 24) {
    boss.x = 24;
    boss.vx = Math.abs(boss.vx);
  } else if (boss.x + boss.w >= CANVAS_W - 24) {
    boss.x = CANVAS_W - 24 - boss.w;
    boss.vx = -Math.abs(boss.vx);
  }
  const baseTargetY = critical ? boss.targetY + 26 : boss.enraged ? boss.targetY + 12 : boss.targetY;
  const weaveFreq = (critical ? 0.08 : boss.enraged ? 0.055 : 0.038) + (boss.tier - 1) * 0.003;
  const weaveAmp = profile.weaveAmplitude * (critical ? 1.3 : 1);
  boss.y = baseTargetY + Math.sin(s.tick * weaveFreq) * weaveAmp;

  if (boss.chargeTimer > 0) {
    boss.chargeTimer -= dt;
    if (boss.chargeTimer <= 0) {
      boss.chargeTimer = 0;
      executeBossAttack(s, boss, critical, hooks);
    }
    return;
  }

  boss.attackTimer -= dt;
  if (boss.attackTimer <= 0) {
    const phaseMult = critical ? 0.74 : boss.enraged ? 0.85 : 1;
    boss.chargeTimer = profile.chargeTicks * phaseMult;
    boss.attackTimer = profile.attackCooldown * phaseMult;
  }
}
