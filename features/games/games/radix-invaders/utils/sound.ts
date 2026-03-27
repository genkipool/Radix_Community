/**
 * Retro arcade sound engine using Web Audio API synthesis.
 * All sounds are procedurally generated — no audio files required.
 */

let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)();
    } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function gain(ac: AudioContext, value: number): GainNode {
  const g = ac.createGain();
  g.gain.value = value;
  g.connect(ac.destination);
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

export function playShoot() {
  const ac = getCtx();
  if (!ac || muted) return;
  const g = gain(ac, 0.18);
  const o = osc(ac, 'sawtooth', 880, g);
  const now = ac.currentTime;
  o.frequency.setValueAtTime(880, now);
  o.frequency.exponentialRampToValueAtTime(220, now + 0.08);
  g.gain.setValueAtTime(0.18, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  o.start(now);
  o.stop(now + 0.1);
}

export function playAlienDie(type: 0 | 1 | 2 | 3) {
  const ac = getCtx();
  if (!ac || muted) return;
  const baseFreqs = [120, 160, 200, 90];
  const base = baseFreqs[type] ?? 140;
  const g = gain(ac, 0.28);
  const o = osc(ac, 'square', base * 4, g);
  const now = ac.currentTime;
  o.frequency.setValueAtTime(base * 4, now);
  o.frequency.exponentialRampToValueAtTime(base, now + 0.15);
  g.gain.setValueAtTime(0.28, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  o.start(now);
  o.stop(now + 0.18);
}

export function playUFOAppear() {
  const ac = getCtx();
  if (!ac || muted) return;
  const g = gain(ac, 0.15);
  const o = osc(ac, 'sine', 100, g);
  const now = ac.currentTime;
  const dur = 0.8;
  // Warbling effect
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
  const g = gain(ac, 0.35);
  const now = ac.currentTime;
  // Explosion: noise-like with quick decay
  for (let i = 0; i < 4; i++) {
    const o = osc(ac, 'sawtooth', 300 - i * 60, g);
    o.frequency.exponentialRampToValueAtTime(30 + i * 10, now + 0.3);
    o.start(now + i * 0.02);
    o.stop(now + 0.32);
  }
  g.gain.setValueAtTime(0.35, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
}

export function playPlayerDie() {
  const ac = getCtx();
  if (!ac || muted) return;
  const g = gain(ac, 0.3);
  const now = ac.currentTime;
  [440, 330, 220, 110].forEach((f, i) => {
    const o = osc(ac, 'sawtooth', f, g);
    o.start(now + i * 0.07);
    o.stop(now + i * 0.07 + 0.1);
  });
  g.gain.setValueAtTime(0.3, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
}

export function playStageClear() {
  const ac = getCtx();
  if (!ac || muted) return;
  const now = ac.currentTime;
  const melody = [523, 659, 784, 1047];
  melody.forEach((f, i) => {
    const g = gain(ac, 0.2);
    const o = osc(ac, 'square', f, g);
    const t = now + i * 0.1;
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.start(t);
    o.stop(t + 0.13);
  });
}

export function playGameOver() {
  const ac = getCtx();
  if (!ac || muted) return;
  const now = ac.currentTime;
  const g = gain(ac, 0.25);
  const notes = [330, 277, 247, 196, 185, 165];
  notes.forEach((f, i) => {
    const o = osc(ac, 'square', f, g);
    const t = now + i * 0.14;
    o.start(t);
    o.stop(t + 0.15);
  });
  g.gain.setValueAtTime(0.25, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + notes.length * 0.14 + 0.2);
}

export function playTimeBonus() {
  const ac = getCtx();
  if (!ac || muted) return;
  const now = ac.currentTime;
  const g = gain(ac, 0.18);
  [784, 880, 1047, 1175].forEach((f, i) => {
    const o = osc(ac, 'triangle', f, g);
    const t = now + i * 0.07;
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.start(t);
    o.stop(t + 0.1);
  });
}

export function playPowerUp() {
  const ac = getCtx();
  if (!ac || muted) return;
  const now = ac.currentTime;
  const g = gain(ac, 0.2);
  const o = osc(ac, 'sine', 440, g);
  o.frequency.exponentialRampToValueAtTime(880, now + 0.15);
  g.gain.setValueAtTime(0.2, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  o.start(now);
  o.stop(now + 0.2);
}

export function playAlienStep(tick: number) {
  const ac = getCtx();
  if (!ac || muted) return;
  const freqs = [100, 80, 90, 70];
  const f = freqs[tick % 4];
  const g = gain(ac, 0.12);
  const o = osc(ac, 'square', f, g);
  const now = ac.currentTime;
  g.gain.setValueAtTime(0.12, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  o.start(now);
  o.stop(now + 0.06);
}

// ── Mute control ─────────────────────────────────────────────────

export function setMuted(v: boolean) { muted = v; }
export function isMuted(): boolean { return muted; }
