/**
 * Retro arcade sound engine using Web Audio API synthesis.
 * All sounds are procedurally generated — no audio files required.
 */
import type { SfxEvent } from '../types/radix-invaders.types';

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
      const AudioCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!;
      ctx = new AudioCtor();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 4200;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.ratio.value = 6;
      filter.connect(comp);
      comp.connect(ctx.destination);
      masterBus = filter;
    } catch {
      return null;
    }
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

interface ToneSweepOptions {
  type: OscillatorType;
  startFreq: number;
  endFreq?: number;
  volume: number;
  freqDur?: number;
  gainDur: number;
  stopDur?: number;
  delay?: number;
}

function playToneSweep(ac: AudioContext, opts: ToneSweepOptions) {
  const t = ac.currentTime + (opts.delay ?? 0);
  const g = ac.createGain();
  g.gain.setValueAtTime(opts.volume, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + opts.gainDur);
  g.connect(getBus(ac));

  const o = osc(ac, opts.type, opts.startFreq, g);
  o.frequency.setValueAtTime(opts.startFreq, t);
  if (opts.endFreq !== undefined) {
    o.frequency.exponentialRampToValueAtTime(opts.endFreq, t + (opts.freqDur ?? opts.gainDur));
  }
  o.start(t);
  o.stop(t + (opts.stopDur ?? opts.gainDur));
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
  for (let i = 0; i < notes.length; i++) {
    playToneSweep(ac, {
      type,
      startFreq: notes[i],
      volume,
      gainDur: decaySec,
      stopDur: decaySec + 0.015,
      delay: i * stepSec,
    });
  }
}

// ── Sound primitives ─────────────────────────────────────────────

export function playShoot(kind: 'normal' | 'spread' | 'laser' | 'rapid' = 'normal') {
  if (muted || !shouldPlay('shoot', 35)) return;
  const ac = getCtx();
  if (!ac) return;

  if (kind === 'laser') {
    playToneSweep(ac, { type: 'sawtooth', startFreq: 1480, endFreq: 240, volume: 0.18, freqDur: 0.11, gainDur: 0.13 });
    playToneSweep(ac, { type: 'square', startFreq: 2200, endFreq: 520, volume: 0.08, freqDur: 0.075, gainDur: 0.08, stopDur: 0.085 });
    return;
  }

  if (kind === 'spread') {
    playToneSweep(ac, { type: 'sawtooth', startFreq: 840, endFreq: 200, volume: 0.16, freqDur: 0.08, gainDur: 0.095 });
    playToneSweep(ac, { type: 'sawtooth', startFreq: 940, endFreq: 240, volume: 0.12, freqDur: 0.08, gainDur: 0.095 });
    return;
  }

  const isRapid = kind === 'rapid';
  const dur = isRapid ? 0.068 : 0.088;
  const startF = isRapid ? 1060 : 920;
  const endF = isRapid ? 270 : 210;

  playToneSweep(ac, { type: 'sawtooth', startFreq: startF, endFreq: endF, volume: isRapid ? 0.14 : 0.17, freqDur: dur, gainDur: dur + 0.015 });
  playToneSweep(ac, { type: 'sine', startFreq: startF * 1.45, endFreq: endF * 1.35, volume: isRapid ? 0.07 : 0.09, freqDur: dur * 0.65, gainDur: dur * 0.7, stopDur: dur * 0.72 });
}

export function playAlienDie(type: 0 | 1 | 2 | 3) {
  if (muted || !shouldPlay('alien_die', 30)) return;
  const ac = getCtx();
  if (!ac) return;
  const base = ([120, 160, 200, 90])[type] ?? 140;
  playToneSweep(ac, { type: 'square', startFreq: base * 4, endFreq: base, volume: 0.22, freqDur: 0.14, gainDur: 0.16 });
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
  playToneSweep(ac, { type: 'triangle', startFreq: 920, endFreq: 320, volume: 0.22, freqDur: 0.18, gainDur: 0.2 });
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
  playToneSweep(ac, { type: 'sine', startFreq: 440, endFreq: 880, volume: 0.18, freqDur: 0.15, gainDur: 0.2 });
}

export function playExtraLife() {
  playArpeggio([523, 659, 784, 1047, 1319], 'sine', 0.2, 0.065, 0.12);
}

export function playBossWarning() {
  const ac = getCtx();
  if (!ac || muted) return;
  for (let i = 0; i < 2; i++) {
    playToneSweep(ac, {
      type: 'sawtooth',
      startFreq: 140,
      endFreq: 420,
      volume: 0.22,
      freqDur: 0.22,
      gainDur: 0.25,
      stopDur: 0.26,
      delay: i * 0.28,
    });
  }
}

export function playBossHit() {
  if (muted || !shouldPlay('boss_hit', 50)) return;
  const ac = getCtx();
  if (!ac) return;
  playToneSweep(ac, { type: 'square', startFreq: 220, endFreq: 95, volume: 0.15, freqDur: 0.06, gainDur: 0.07 });
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
  const f = ([100, 80, 90, 70])[tick % 4];
  playToneSweep(ac, { type: 'square', startFreq: f, volume: 0.1, gainDur: 0.055, stopDur: 0.06 });
}

/** Dispatches a batch of simulation SFX events to the Web Audio synthesizer. */
export function dispatchSfx(events: SfxEvent[]) {
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    switch (e.type) {
      case 'shoot': playShoot(e.kind); break;
      case 'alien_die': playAlienDie(e.alienType); break;
      case 'ufo_appear': playUFOAppear(); break;
      case 'ufo_die': playUFODie(); break;
      case 'player_die': playPlayerDie(); break;
      case 'shield_hit': playShieldHit(); break;
      case 'stage_clear': playStageClear(); break;
      case 'game_over': playGameOver(); break;
      case 'victory': playVictory(); break;
      case 'time_bonus': playTimeBonus(); break;
      case 'power_up': playPowerUp(); break;
      case 'extra_life': playExtraLife(); break;
      case 'boss_warning': playBossWarning(); break;
      case 'boss_hit': playBossHit(); break;
      case 'boss_die': playBossDie(); break;
      case 'alien_step': playAlienStep(e.tick); break;
    }
  }
}

// ── Mute control ─────────────────────────────────────────────────

export function setMuted(v: boolean) { muted = v; }
export function isMuted(): boolean { return muted; }
