import { describe, expect, it, vi } from 'vitest';
import {
  MAX_LEVEL,
  MAX_LIVES,
  PLAYER_Y,
} from '@/features/games/games/radix-invaders/constants/radix-invaders.constants';
import { consumeContinue, initGameState, updateGame } from '@/features/games/games/radix-invaders/services/engine';
import { updatePowerUpItemsAndDrops } from '@/features/games/games/radix-invaders/services/engineEntities';
import {
  createBossForLevel,
  createWaveAliens,
  getBossProfile,
  getWaveDifficulty,
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

  describe('kamikaze shield protection rules', () => {
    it('strips shield protection when 2 boss kamikazes spawn at once with the default weapon', () => {
      // Level 60 is CARRIER (tier 6, escortHp === 2, step 0 spawns 2 escorts via bonusCount = 1)
      const state = initGameState(60, 0, 0, 3);
      state.powerUp = 'NONE';
      state.boss!.entering = false;
      state.boss!.y = state.boss!.targetY;
      state.boss!.attackIndex = 0;
      state.boss!.chargeTimer = 1;

      updateGame(state, NO_KEYS, false, 450, false, noop, 1);

      const divers = state.aliens.filter((a) => a.alive && a.diving);
      expect(divers).toHaveLength(2);
      for (const d of divers) {
        expect(d.hp).toBe(1);
        expect(d.maxHp).toBe(1);
      }
    });

    it('allows shield protection when 2 boss kamikazes spawn at once with any non-default weapon', () => {
      for (const powerUp of ['SPREAD', 'LASER', 'RAPID'] as const) {
        const state = initGameState(60, 0, 0, 3);
        state.powerUp = powerUp;
        state.powerUpTimer = 300;
        state.boss!.entering = false;
        state.boss!.y = state.boss!.targetY;
        state.boss!.attackIndex = 0;
        state.boss!.chargeTimer = 1;

        updateGame(state, NO_KEYS, false, 450, false, noop, 1);

        const divers = state.aliens.filter((a) => a.alive && a.diving);
        expect(divers).toHaveLength(2);
        for (const d of divers) {
          expect(d.hp).toBe(2);
          expect(d.maxHp).toBe(2);
        }
      }
    });

    it('allows shield protection when only 1 boss kamikaze spawns with the default weapon', () => {
      // Level 50 is SNIPER (tier 5, escortHp === 2, non-critical step 3 spawns 1 escort)
      const state = initGameState(50, 0, 0, 3);
      state.powerUp = 'NONE';
      state.boss!.entering = false;
      state.boss!.y = state.boss!.targetY;
      state.boss!.attackIndex = 3;
      state.boss!.chargeTimer = 1;

      updateGame(state, NO_KEYS, false, 450, false, noop, 1);

      const divers = state.aliens.filter((a) => a.alive && a.diving);
      expect(divers).toHaveLength(1);
      expect(divers[0].hp).toBe(2);
      expect(divers[0].maxHp).toBe(2);
    });

    it('strips shield protection on simultaneous wave kamikazes with default weapon, but allows 1 or powered-up', () => {
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
      try {
        const level = 45;
        const diff = getWaveDifficulty(level);

        // 1) Single wave kamikaze with default weapon can keep shield (hp === 2)
        const singleState = initGameState(level, 0, 0, 3);
        singleState.powerUp = 'NONE';
        for (const a of singleState.aliens) {
          a.hp = 2;
          a.maxHp = 2;
        }
        singleState.tick = diff.diveInterval - 1;
        updateGame(singleState, NO_KEYS, false, 450, false, noop, 1);
        const singleDivers = singleState.aliens.filter((a) => a.alive && a.diving);
        expect(singleDivers).toHaveLength(1);
        expect(singleDivers[0].hp).toBe(2);
        expect(singleDivers[0].maxHp).toBe(2);

        // 2) Second wave kamikaze while first is still diving with default weapon -> both lose shield
        singleState.tick = diff.diveInterval * 2 - 1;
        updateGame(singleState, NO_KEYS, false, 450, false, noop, 1);
        const pairDivers = singleState.aliens.filter((a) => a.alive && a.diving);
        expect(pairDivers).toHaveLength(2);
        for (const d of pairDivers) {
          expect(d.hp).toBe(1);
          expect(d.maxHp).toBe(1);
        }

        // 3) Two wave kamikazes with a non-default weapon both keep shield (hp === 2)
        const poweredState = initGameState(level, 0, 0, 3);
        poweredState.powerUp = 'SPREAD';
        poweredState.powerUpTimer = 500;
        for (const a of poweredState.aliens) {
          a.hp = 2;
          a.maxHp = 2;
        }
        poweredState.tick = diff.diveInterval - 1;
        updateGame(poweredState, NO_KEYS, false, 450, false, noop, 1);
        poweredState.tick = diff.diveInterval * 2 - 1;
        updateGame(poweredState, NO_KEYS, false, 450, false, noop, 1);
        const poweredDivers = poweredState.aliens.filter((a) => a.alive && a.diving);
        expect(poweredDivers).toHaveLength(2);
        for (const d of poweredDivers) {
          expect(d.hp).toBe(2);
          expect(d.maxHp).toBe(2);
        }
      } finally {
        randomSpy.mockRestore();
      }
    });

    it('launches sometimes 2 and sometimes 1 kamikaze from level 90 onwards, with 1 shielded on default shot and 2 shielded on power-up', () => {
      const randomSpy = vi.spyOn(Math, 'random');
      try {
        // Boss level 90 (non-critical): random < 0.5 spawns 2 at once -> 1 shielded + 1 unshielded on default shot
        randomSpy.mockReturnValue(0);
        const boss90Pair = initGameState(90, 0, 0, 3);
        boss90Pair.powerUp = 'NONE';
        boss90Pair.boss!.entering = false;
        boss90Pair.boss!.y = boss90Pair.boss!.targetY;
        boss90Pair.boss!.attackIndex = 3;
        boss90Pair.boss!.chargeTimer = 1;
        updateGame(boss90Pair, NO_KEYS, false, 450, false, noop, 1);

        const bossDiversPair = boss90Pair.aliens.filter((a) => a.alive && a.diving);
        expect(bossDiversPair).toHaveLength(2);
        expect(bossDiversPair.filter((d) => d.hp === 2 && d.maxHp === 2)).toHaveLength(1);
        expect(bossDiversPair.filter((d) => d.hp === 1 && d.maxHp === 1)).toHaveLength(1);

        // Boss level 90 (non-critical) with non-default shot: both can carry shield
        const boss90Powered = initGameState(90, 0, 0, 3);
        boss90Powered.powerUp = 'LASER';
        boss90Powered.powerUpTimer = 300;
        boss90Powered.boss!.entering = false;
        boss90Powered.boss!.y = boss90Powered.boss!.targetY;
        boss90Powered.boss!.attackIndex = 3;
        boss90Powered.boss!.chargeTimer = 1;
        updateGame(boss90Powered, NO_KEYS, false, 450, false, noop, 1);

        const bossDiversPowered = boss90Powered.aliens.filter((a) => a.alive && a.diving);
        expect(bossDiversPowered).toHaveLength(2);
        expect(bossDiversPowered.filter((d) => d.hp === 2 && d.maxHp === 2)).toHaveLength(2);

        // Boss level 90 (non-critical): random >= 0.5 spawns 1 -> keeps shield on default shot
        randomSpy.mockReturnValue(0.8);
        const boss90Single = initGameState(90, 0, 0, 3);
        boss90Single.powerUp = 'NONE';
        boss90Single.boss!.entering = false;
        boss90Single.boss!.y = boss90Single.boss!.targetY;
        boss90Single.boss!.attackIndex = 3;
        boss90Single.boss!.chargeTimer = 1;
        updateGame(boss90Single, NO_KEYS, false, 450, false, noop, 1);

        const bossDiversSingle = boss90Single.aliens.filter((a) => a.alive && a.diving);
        expect(bossDiversSingle).toHaveLength(1);
        expect(bossDiversSingle[0].hp).toBe(2);

        // Wave level 95: single trigger can launch 2 simultaneous divers -> 1 shielded + 1 unshielded on default shot
        randomSpy.mockReturnValue(0);
        const wave95 = initGameState(95, 0, 0, 3);
        const diff95 = getWaveDifficulty(95);
        wave95.powerUp = 'NONE';
        for (const a of wave95.aliens) {
          a.hp = 2;
          a.maxHp = 2;
        }
        wave95.tick = diff95.diveInterval - 1;
        updateGame(wave95, NO_KEYS, false, 450, false, noop, 1);

        const waveDivers = wave95.aliens.filter((a) => a.alive && a.diving);
        expect(waveDivers).toHaveLength(2);
        expect(waveDivers.filter((d) => d.hp === 2 && d.maxHp === 2)).toHaveLength(1);
        expect(waveDivers.filter((d) => d.hp === 1 && d.maxHp === 1)).toHaveLength(1);

        // Wave level 95 with non-default shot: both simultaneous divers keep shield
        const wave95Powered = initGameState(95, 0, 0, 3);
        wave95Powered.powerUp = 'RAPID';
        wave95Powered.powerUpTimer = 300;
        for (const a of wave95Powered.aliens) {
          a.hp = 2;
          a.maxHp = 2;
        }
        wave95Powered.tick = diff95.diveInterval - 1;
        updateGame(wave95Powered, NO_KEYS, false, 450, false, noop, 1);

        const waveDiversPowered = wave95Powered.aliens.filter((a) => a.alive && a.diving);
        expect(waveDiversPowered).toHaveLength(2);
        expect(waveDiversPowered.filter((d) => d.hp === 2 && d.maxHp === 2)).toHaveLength(2);

        // Wave level 95: when roll >= 0.45 (< diveChance), launches only 1 diver with shield
        randomSpy.mockReturnValue(0.6);
        const wave95Single = initGameState(95, 0, 0, 3);
        wave95Single.powerUp = 'NONE';
        for (const a of wave95Single.aliens) {
          a.hp = 2;
          a.maxHp = 2;
        }
        wave95Single.tick = diff95.diveInterval - 1;
        updateGame(wave95Single, NO_KEYS, false, 450, false, noop, 1);

        const waveDiversSingle = wave95Single.aliens.filter((a) => a.alive && a.diving);
        expect(waveDiversSingle).toHaveLength(1);
        expect(waveDiversSingle[0].hp).toBe(2);

        // Level 89 (below 90) with default weapon: 2 simultaneous divers -> 0 shielded
        randomSpy.mockReturnValue(0);
        const wave89 = initGameState(89, 0, 0, 3);
        const diff89 = getWaveDifficulty(89);
        wave89.powerUp = 'NONE';
        for (const a of wave89.aliens) {
          a.hp = 2;
          a.maxHp = 2;
        }
        wave89.tick = diff89.diveInterval - 1;
        updateGame(wave89, NO_KEYS, false, 450, false, noop, 1);
        wave89.tick = diff89.diveInterval * 2 - 1;
        updateGame(wave89, NO_KEYS, false, 450, false, noop, 1);

        const wave89Divers = wave89.aliens.filter((a) => a.alive && a.diving);
        expect(wave89Divers).toHaveLength(2);
        expect(wave89Divers.filter((d) => d.hp === 2)).toHaveLength(0);
        expect(wave89Divers.filter((d) => d.hp === 1 && d.maxHp === 1)).toHaveLength(2);
      } finally {
        randomSpy.mockRestore();
      }
    });
  });

  it('drops the player SHIELD item more frequently from level 80 onwards', () => {
    const sampleShieldRate = (level: number) => {
      let shields = 0;
      const samples = 20;
      for (let i = 0; i < samples; i++) {
        const poolRoll = i / samples; // deterministic sweep across [0, 1)
        const state = initGameState(level, 0, 0, 3);
        state.tick = 170; // crosses 340-tick interval with offset 170 from prevTick=169
        let call = 0;
        const spy = vi.spyOn(Math, 'random').mockImplementation(() => {
          call += 1;
          if (call === 1) return 0; // pass drop-chance check
          if (call === 2) return poolRoll; // select from power-up pool
          return 0.5; // x position
        });
        try {
          updatePowerUpItemsAndDrops(state, false, 169, 1);
        } finally {
          spy.mockRestore();
        }
        if (state.powerUpItems.some((p) => p.type === 'SHIELD')) shields += 1;
      }
      return shields / samples;
    };

    const rate79 = sampleShieldRate(79);
    const rate80 = sampleShieldRate(80);
    expect(rate79).toBeCloseTo(0.25, 2);
    expect(rate80).toBeCloseTo(0.4, 2);
    expect(rate80).toBeGreaterThan(rate79);
  });
});
