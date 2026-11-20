import { describe, expect, it } from 'vitest';
import {
  MAX_LEVEL,
  MAX_LIVES,
  PLAYER_Y,
} from '@/features/games/games/radix-invaders/constants/radix-invaders.constants';
import { consumeContinue, initGameState, updateGame } from '@/features/games/games/radix-invaders/services/engine';
import {
  createBossForLevel,
  createWaveAliens,
  getBossProfile,
  isBossLevel,
  isPreBossLevel,
} from '@/features/games/games/radix-invaders/services/waves';

const NO_KEYS = new Set<string>();
const noop = () => {};

describe('Radix Invaders — 100 levels, bosses & pre-boss extra life', () => {
  it('places a boss on every 10th level from 10 to 100 and waves on all other levels', () => {
    const bossLevels: number[] = [];
    for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
      if (isBossLevel(lvl)) {
        bossLevels.push(lvl);
        const boss = createBossForLevel(lvl);
        expect(boss).not.toBeNull();
        expect(boss!.tier).toBe(lvl / 10);
        expect(createWaveAliens(lvl)).toHaveLength(0);
      } else {
        expect(createBossForLevel(lvl)).toBeNull();
        expect(createWaveAliens(lvl).length).toBeGreaterThan(0);
      }
    }
    expect(bossLevels).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });

  it('strictly escalates boss difficulty from level 10 -> 20 -> 30 -> … -> 100', () => {
    let prev = getBossProfile(1);
    const archetypes = new Set<string>([prev.archetype]);
    for (let tier = 2; tier <= 10; tier++) {
      const curr = getBossProfile(tier);
      archetypes.add(curr.archetype);
      const boss = createBossForLevel(tier * 10)!;
      expect(boss.maxHp).toBe(curr.maxHp);
      expect(curr.maxHp).toBeGreaterThan(prev.maxHp);
      expect(curr.strafeSpeed).toBeGreaterThan(prev.strafeSpeed);
      expect(curr.bulletSpeed).toBeGreaterThan(prev.bulletSpeed);
      expect(curr.attackCooldown).toBeLessThan(prev.attackCooldown);
      expect(curr.chargeTicks).toBeLessThan(prev.chargeTicks);
      expect(curr.fanCount).toBeGreaterThanOrEqual(prev.fanCount);
      expect(curr.curtainCount).toBeGreaterThanOrEqual(prev.curtainCount);
      expect(curr.bananaCount).toBeGreaterThanOrEqual(prev.bananaCount);
      expect(curr.maxEscorts).toBeGreaterThanOrEqual(prev.maxEscorts);
      expect(curr.escortHp).toBeGreaterThanOrEqual(prev.escortHp);
      expect(curr.escortHp).toBeLessThanOrEqual(2);
      prev = curr;
    }
    expect(archetypes.size).toBe(10);
  });

  it('drops a guaranteed LIFE item on every pre-boss level (9, 19, …, 99)', () => {
    const preBossLevels = [9, 19, 29, 39, 49, 59, 69, 79, 89, 99];
    for (const lvl of preBossLevels) {
      expect(isPreBossLevel(lvl)).toBe(true);
      const state = initGameState(lvl, 0, 0, 3);
      // Simulate until the guaranteed pre-boss life item drops
      let foundLife = false;
      for (let t = 0; t < 260; t++) {
        updateGame(state, NO_KEYS, false, 0, false, noop);
        if (state.powerUpItems.some((p) => p.type === 'LIFE')) {
          foundLife = true;
          break;
        }
      }
      expect(foundLife).toBe(true);
    }
  });

  it('grants +1 life (up to MAX_LIVES) when catching the LIFE pickup', () => {
    const state = initGameState(9, 0, 0, 3);
    state.powerUpItems.push({
      id: 99,
      x: state.player.x,
      y: PLAYER_Y,
      vy: 0,
      type: 'LIFE',
      active: true,
      rotation: 0,
      pulse: 0,
    });
    updateGame(state, NO_KEYS, false, 0, false, noop);
    expect(state.lives).toBe(4);
    expect(state.sfx.some((e) => e.type === 'extra_life')).toBe(true);

    // At MAX_LIVES, catching LIFE grants +500 bonus points instead of exceeding MAX_LIVES
    state.lives = MAX_LIVES;
    const beforeScore = state.score;
    state.powerUpItems.push({
      id: 100,
      x: state.player.x,
      y: PLAYER_Y,
      vy: 0,
      type: 'LIFE',
      active: true,
      rotation: 0,
      pulse: 0,
    });
    updateGame(state, NO_KEYS, false, 0, false, noop);
    expect(state.lives).toBe(MAX_LIVES);
    expect(state.score).toBe(beforeScore + 500);
  });

  it('transitions to VICTORY after defeating the level 100 final boss', () => {
    const state = initGameState(100, 0, 5000, 3);
    expect(state.boss).not.toBeNull();
    state.boss!.entering = false;
    state.boss!.y = state.boss!.targetY;
    state.boss!.hp = 1;
    // Place a player bullet directly on the boss
    state.bulletsP.push({
      x: state.boss!.x + state.boss!.w / 2,
      y: state.boss!.y + state.boss!.h / 2,
      vx: 0,
      vy: -1,
      prevX: state.boss!.x + state.boss!.w / 2,
      prevY: state.boss!.y + state.boss!.h / 2 + 1,
      active: true,
      kind: 'normal',
      damage: 1,
    });

    // Tick 1 destroys boss; tick 2 sees no boss and no aliens -> VICTORY
    updateGame(state, NO_KEYS, false, 0, false, noop);
    expect(state.boss!.active).toBe(false);
    updateGame(state, NO_KEYS, false, 0, false, noop);
    expect(state.screen).toBe('VICTORY');
    expect(state.sfx.some((e) => e.type === 'victory')).toBe(true);
  });

  it('absorbs a hit with active SHIELD without losing a life', () => {
    const state = initGameState(1, 0, 0, 3, undefined, true);
    state.bulletsE.push({
      x: state.player.x,
      y: PLAYER_Y,
      vx: 0,
      vy: 0,
      prevX: state.player.x,
      prevY: PLAYER_Y,
      active: true,
      kind: 'enemy',
      damage: 1,
    });
    updateGame(state, NO_KEYS, false, 0, false, noop);
    expect(state.lives).toBe(3);
    expect(state.player.hasShield).toBe(false);
    expect(state.sfx.some((e) => e.type === 'shield_hit')).toBe(true);
  });

  it('drops a guaranteed CONTINUE item on boss levels and lets the player revive', () => {
    const state = initGameState(10, 0, 0, 1);
    expect(state.boss).not.toBeNull();
    state.boss!.entering = false;
    state.boss!.y = state.boss!.targetY;
    state.boss!.hp = Math.floor(state.boss!.maxHp * 0.5);

    updateGame(state, NO_KEYS, false, 0, false, noop);
    const contItem = state.powerUpItems.find((p) => p.type === 'CONTINUE');
    expect(contItem).toBeDefined();
    expect(state.bossContinueDropped).toBe(true);

    // Catch the CONTINUE item
    contItem!.x = state.player.x;
    contItem!.y = PLAYER_Y;
    updateGame(state, NO_KEYS, false, 0, false, noop);
    expect(state.continues).toBe(1);

    // Lose last life -> enters CONTINUE screen instead of GAME_OVER
    state.bulletsE.push({
      x: state.player.x,
      y: PLAYER_Y,
      vx: 0,
      vy: 0,
      prevX: state.player.x,
      prevY: PLAYER_Y,
      active: true,
      kind: 'boss_orb',
      damage: 1,
    });
    updateGame(state, NO_KEYS, false, 0, false, noop);
    expect(state.screen).toBe('CONTINUE');

    // Use Continue -> revives in place with 3 lives and 0 continues left
    expect(consumeContinue(state)).toBe(true);
    expect(state.screen).toBe('PLAYING');
    expect(state.lives).toBe(3);
    expect(state.continues).toBe(0);
  });

  it('marks newRecord=true when clearing level 100 with a score above previous hi-score', () => {
    const state = initGameState(MAX_LEVEL, 10_000, 12_000, 3);
    if (state.boss) state.boss.active = false;
    state.aliens = [];

    const next = updateGame(state, NO_KEYS, false, 450, false, noop, 1);
    expect(next.screen).toBe('VICTORY');
    expect(next.newRecord).toBe(true);
    expect(next.hiScore).toBeGreaterThanOrEqual(12_000);
  });

  it('destroys colliding aliens with player bullets and increments score & combo', () => {
    const state = initGameState(1, 0);
    const target = state.aliens[0];
    target.hp = 1;
    state.bulletsP.push({
      x: target.x + 10,
      y: target.y + 10,
      vx: 0,
      vy: -1,
      active: true,
      prevX: target.x + 10,
      prevY: target.y + 11,
      kind: 'normal',
      damage: 1,
    });

    const next = updateGame(state, NO_KEYS, false, 450, false, noop, 1);
    expect(target.alive).toBe(false);
    expect(next.score).toBeGreaterThan(0);
    expect(next.combo).toBe(1);
    expect(next.sfx.some((e) => e.type === 'alien_die')).toBe(true);
  });
});
