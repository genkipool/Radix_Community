/**
 * Retro arcade sound engine using Web Audio API synthesis.
 * All sounds are procedurally generated — no audio files required.
 */

let ctx: AudioContext | null = null;
let masterBus: AudioNode | null = null;
let resuming = false;
let muted = false;
const lastPlayed = new Map<string, number>();

function shouldPlay(key: string, minGapMs: number): boolean {
  const now = performance.now();
  const prev = lastPlayed.get(key) ?? 0;
  if (now - prev < minGapMs) return false;
  lastPlayed.set(key, now);
  return true;
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 4200;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.ratio.value = 6;
      filter.connect(comp);
      comp.connect(ctx.destination);
      masterBus = filter;
    } catch { return null; }
  }
  if (ctx.state === 'suspended' && !resuming) {
    resuming = true;
    void ctx.resume().finally(() => { resuming = false; });
  }
  return ctx;
}

function getBus(ac: AudioContext): AudioNode {
  return masterBus ?? ac.destination;
}

function gain(ac: AudioContext, value: number): GainNode {
  const g = ac.createGain();
  g.gain.value = value;
  g.connect(getBus(ac));
  return g;
}

function osc(ac: AudioContext, type: OscillatorType, freq: number, dest: AudioNode): OscillatorNode {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.connect(dest);
  return o;
}

// ── Sound primitives ─────────────────────────────────────────────

export function playShoot(kind: 'normal' | 'spread' | 'laser' | 'rapid' = 'normal') {
  if (muted || !shouldPlay('shoot', 35)) return;
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const bus = getBus(ac);

  if (kind === 'laser') {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    g.connect(bus);

    const o1 = osc(ac, 'sawtooth', 1480, g);
    o1.frequency.setValueAtTime(1480, now);
    o1.frequency.exponentialRampToValueAtTime(240, now + 0.11);
    o1.start(now);
    o1.stop(now + 0.13);

    const g2 = ac.createGain();
    g2.gain.setValueAtTime(0.08, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    g2.connect(bus);

    const o2 = osc(ac, 'square', 2200, g2);
    o2.frequency.setValueAtTime(2200, now);
    o2.frequency.exponentialRampToValueAtTime(520, now + 0.075);
    o2.start(now);
    o2.stop(now + 0.085);
    return;
  }

  if (kind === 'spread') {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    g.connect(bus);

    const o1 = osc(ac, 'sawtooth', 840, g);
    o1.frequency.setValueAtTime(840, now);
    o1.frequency.exponentialRampToValueAtTime(200, now + 0.08);
    o1.start(now);
    o1.stop(now + 0.095);

    const o2 = osc(ac, 'sawtooth', 940, g);
    o2.frequency.setValueAtTime(940, now);
    o2.frequency.exponentialRampToValueAtTime(240, now + 0.08);
    o2.start(now);
    o2.stop(now + 0.095);
    return;
  }

  // Classic crisp arcade pew (normal & rapid)
  const isRapid = kind === 'rapid';
  const dur = isRapid ? 0.068 : 0.088;
  const startF = isRapid ? 1060 : 920;
  const endF = isRapid ? 270 : 210;

  const g = ac.createGain();
  g.gain.setValueAtTime(isRapid ? 0.14 : 0.17, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur + 0.015);
  g.connect(bus);

  const o = osc(ac, 'sawtooth', startF, g);
  o.frequency.setValueAtTime(startF, now);
  o.frequency.exponentialRampToValueAtTime(endF, now + dur);
  o.start(now);
  o.stop(now + dur + 0.015);

  const gSub = ac.createGain();
  gSub.gain.setValueAtTime(isRapid ? 0.07 : 0.09, now);
  gSub.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.7);
  gSub.connect(bus);

  const oSub = osc(ac, 'sine', startF * 1.45, gSub);
  oSub.frequency.setValueAtTime(startF * 1.45, now);
  oSub.frequency.exponentialRampToValueAtTime(endF * 1.35, now + dur * 0.65);
  oSub.start(now);
  oSub.stop(now + dur * 0.72);
}

export function playAlienDie(type: 0 | 1 | 2 | 3) {
  if (muted || !shouldPlay('alien_die', 30)) return;
  const ac = getCtx();
  if (!ac) return;
  const baseFreqs = [120, 160, 200, 90];
  const base = baseFreqs[type] ?? 140;
  const g = gain(ac, 0.22);
  const o = osc(ac, 'square', base * 4, g);
  const now = ac.currentTime;
  o.frequency.setValueAtTime(base * 4, now);
  o.frequency.exponentialRampToValueAtTime(base, now + 0.14);
  g.gain.setValueAtTime(0.22, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  o.start(now);
  o.stop(now + 0.16);
}

export function playUFOAppear() {
  const ac = getCtx();
  if (!ac || muted) return;
  const g = gain(ac, 0.14);
  const o = osc(ac, 'sine', 200, g);
  const now = ac.currentTime;
  const dur = 0.75;
  const lfo = ac.createOscillator();
  lfo.frequency.value = 5;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 60;
  lfo.connect(lfoGain);
  lfoGain.connect(o.frequency);
  o.frequency.setValueAtTime(200, now);
  g.gain.setValueAtTime(0.12, now);
  g.gain.setValueAtTime(0.12, now + dur - 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  o.start(now); lfo.start(now);
  o.stop(now + dur); lfo.stop(now + dur);
}

export function playUFODie() {
  const ac = getCtx();
  if (!ac || muted) return;
  const g = gain(ac, 0.3);
  const now = ac.currentTime;
  for (let i = 0; i < 4; i++) {
    const o = osc(ac, 'sawtooth', 300 - i * 60, g);
    o.frequency.exponentialRampToValueAtTime(30 + i * 10, now + 0.28);
    o.start(now + i * 0.02);
    o.stop(now + 0.3);
  }
  g.gain.setValueAtTime(0.3, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
}

export function playPlayerDie() {
  const ac = getCtx();
  if (!ac || muted) return;
  const g = gain(ac, 0.28);
  const now = ac.currentTime;
  [440, 330, 220, 110].forEach((f, i) => {
    const o = osc(ac, 'sawtooth', f, g);
    o.start(now + i * 0.07);
    o.stop(now + i * 0.07 + 0.1);
  });
  g.gain.setValueAtTime(0.28, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
}

export function playShieldHit() {
  const ac = getCtx();
  if (!ac || muted) return;
  const now = ac.currentTime;
  const g = gain(ac, 0.22);
  const o = osc(ac, 'triangle', 920, g);
  o.frequency.exponentialRampToValueAtTime(320, now + 0.18);
  g.gain.setValueAtTime(0.22, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  o.start(now);
  o.stop(now + 0.2);
}

function playArpeggio(
  notes: readonly number[],
  type: OscillatorType,
  volume: number,
  stepSec: number,
  decaySec: number,
) {
  const ac = getCtx();
  if (!ac || muted) return;
  const now = ac.currentTime;
  for (let i = 0; i < notes.length; i++) {
    const t = now + i * stepSec;
    const g = gain(ac, volume);
    const o = osc(ac, type, notes[i], g);
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decaySec);
    o.start(t);
    o.stop(t + decaySec + 0.015);
  }
}

export function playStageClear() {
  playArpeggio([523, 659, 784, 1047], 'square', 0.18, 0.09, 0.12);
}

export function playGameOver() {
  playArpeggio([330, 277, 247, 196, 185, 165], 'square', 0.24, 0.14, 0.16);
}

export function playVictory() {
  playArpeggio([523, 659, 784, 1047, 784, 1047, 1319], 'triangle', 0.2, 0.11, 0.2);
}

export function playTimeBonus() {
  playArpeggio([784, 880, 1047, 1175], 'triangle', 0.16, 0.07, 0.1);
}

export function playPowerUp() {
  const ac = getCtx();
  if (!ac || muted) return;
  const now = ac.currentTime;
  const g = gain(ac, 0.18);
  const o = osc(ac, 'sine', 440, g);
  o.frequency.exponentialRampToValueAtTime(880, now + 0.15);
  g.gain.setValueAtTime(0.18, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  o.start(now);
  o.stop(now + 0.2);
}

export function playExtraLife() {
  playArpeggio([523, 659, 784, 1047, 1319], 'sine', 0.2, 0.065, 0.12);
}

export function playBossWarning() {
  const ac = getCtx();
  if (!ac || muted) return;
  const now = ac.currentTime;
  for (let i = 0; i < 2; i++) {
    const g = gain(ac, 0.22);
    const o = osc(ac, 'sawtooth', 140, g);
    const t = now + i * 0.28;
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.22);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.start(t);
    o.stop(t + 0.26);
  }
}

export function playBossHit() {
  if (muted || !shouldPlay('boss_hit', 50)) return;
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const g = gain(ac, 0.15);
  const o = osc(ac, 'square', 220, g);
  o.frequency.exponentialRampToValueAtTime(95, now + 0.06);
  g.gain.setValueAtTime(0.15, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
  o.start(now);
  o.stop(now + 0.07);
}

export function playBossDie() {
  const ac = getCtx();
  if (!ac || muted) return;
  const now = ac.currentTime;
  const g = gain(ac, 0.34);
  for (let i = 0; i < 6; i++) {
    const o = osc(ac, 'sawtooth', 260 - i * 32, g);
    const t = now + i * 0.06;
    o.frequency.exponentialRampToValueAtTime(28, t + 0.42);
    o.start(t);
    o.stop(t + 0.45);
  }
  g.gain.setValueAtTime(0.34, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
}

export function playAlienStep(tick: number) {
  if (muted || !shouldPlay('alien_step', 55)) return;
  const ac = getCtx();
  if (!ac) return;
  const freqs = [100, 80, 90, 70];
  const f = freqs[tick % 4];
  const g = gain(ac, 0.1);
  const o = osc(ac, 'square', f, g);
  const now = ac.currentTime;
  g.gain.setValueAtTime(0.1, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
  o.start(now);
  o.stop(now + 0.06);
}

// ── Mute control ─────────────────────────────────────────────────

export function setMuted(v: boolean) { muted = v; }
export function isMuted(): boolean { return muted; }
