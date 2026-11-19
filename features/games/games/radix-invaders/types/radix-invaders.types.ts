export type GameScreen =
  | 'INTRO'
  | 'BADGE_ACQUIRING'
  | 'BADGE_SUCCESS'
  | 'PLAYING'
  | 'PAUSED'
  | 'CONTINUE'
  | 'STAGE_CLEAR'
  | 'VICTORY'
  | 'GAME_OVER';

export type GameMode = 'TOURNAMENT' | 'FUN';
export type PowerUpType = 'NONE' | 'SPREAD' | 'LASER' | 'RAPID';
export type PowerUpItemType = 'SPREAD' | 'LASER' | 'RAPID' | 'SHIELD' | 'LIFE' | 'CONTINUE';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Star {
  x: number;
  y: number;
  r: number;
  speed: number;
  layer: 0 | 1 | 2;
  alpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  tint: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  r: number;
  color: string;
  glow: boolean;
}

export interface Shockwave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  life: number;
  color: string;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  active: boolean;
  prevX: number;
  prevY: number;
  kind: 'normal' | 'spread' | 'laser' | 'rapid' | 'enemy' | 'banana' | 'boss_orb' | 'boss_heavy';
  damage: number;
  phase?: number;
}

export interface Alien {
  row: number;
  col: number;
  x: number;
  y: number;
  alive: boolean;
  hp: number;
  maxHp: number;
  frame: number;
  hitFlash: number;
  type: 0 | 1 | 2 | 3;
  diving: boolean;
  diveTargetX: number;
  diveAngle: number;
  divePhase: 'RISE' | 'FLIP' | 'DIVE';
  diveFlipTimer: number;
  diveOriginX: number;
  diveOriginY: number;
}

export interface Boss {
  active: boolean;
  tier: number; // 1..10 (level / 10)
  x: number;
  y: number;
  targetY: number;
  vx: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  hitFlash: number;
  enraged: boolean;
  attackTimer: number;
  attackIndex: number;
  chargeTimer: number;
  entering: boolean;
  accentColor: string;
}

export interface Shield {
  blocks: boolean[][];
  x: number;
  y: number;
  blockW: number;
  blockH: number;
}

export interface UFO {
  active: boolean;
  x: number;
  y: number;
  dir: 1 | -1;
  score: number;
  hitFlash: number;
}

export interface PowerUpItem {
  id: number;
  x: number;
  y: number;
  vy: number;
  type: PowerUpItemType;
  active: boolean;
  rotation: number;
  pulse: number;
}

export interface GameState {
  screen: GameScreen;
  mode: GameMode;
  score: number;
  hiScore: number;
  lives: number;
  continues: number;
  continueTimer: number;
  level: number;
  player: {
    x: number;
    vx: number;
    tilt: number;
    shootCooldown: number;
    invincible: number;
    hasShield: boolean;
  };
  powerUp: PowerUpType;
  powerUpTimer: number;
  combo: number;
  comboTimer: number;
  aliens: Alien[];
  initialAlienCount: number;
  alienDir: number;
  alienDropQueued: boolean;
  alienSpeed: number;
  alienFrameTimer: number;
  alienFrame: number;
  boss: Boss | null;
  bossWarningTimer: number;
  preBossLifeDropped: boolean;
  bossContinueDropped: boolean;
  bulletsP: Bullet[];
  bulletsE: Bullet[];
  shields: Shield[];
  ufo: UFO;
  powerUpItems: PowerUpItem[];
  particles: Particle[];
  shockwaves: Shockwave[];
  floatingTexts: FloatingText[];
  stars: Star[];
  shakeTimer: number;
  shakeIntensity: number;
  flashMessage: string;
  flashTimer: number;
  tick: number;
  stageTimer: number;
  newRecord: boolean;
  nextPowerUpId: number;
  stageStartTick: number;
  timeBonus: number;
  timeBonusTimer: number;
  sfx: SfxEvent[];
}

export type SfxEvent =
  | { type: 'shoot'; kind: 'normal' | 'spread' | 'laser' | 'rapid' }
  | { type: 'alien_die'; alienType: 0 | 1 | 2 | 3 }
  | { type: 'ufo_appear' }
  | { type: 'ufo_die' }
  | { type: 'player_die' }
  | { type: 'shield_hit' }
  | { type: 'stage_clear' }
  | { type: 'game_over' }
  | { type: 'victory' }
  | { type: 'time_bonus' }
  | { type: 'power_up' }
  | { type: 'extra_life' }
  | { type: 'boss_warning' }
  | { type: 'boss_hit' }
  | { type: 'boss_die' }
  | { type: 'alien_step'; tick: number };
