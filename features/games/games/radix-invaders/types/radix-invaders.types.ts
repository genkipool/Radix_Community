export type GameScreen = 'INTRO'|'BADGE_ACQUIRING'|'BADGE_SUCCESS'|'PLAYING'|'PAUSED'|'STAGE_CLEAR'|'GAME_OVER';
export type GameMode = 'TOURNAMENT' | 'FUN';
export type PowerUpType = 'NONE' | 'SPREAD' | 'LASER' | 'RAPID';
export type PowerUpItemType = 'SPREAD' | 'LASER' | 'RAPID';



export interface Vec2 { x:number; y:number; }
export interface Star { x:number; y:number; r:number; speed:number; alpha:number; twinkleSpeed:number; twinklePhase:number; }
export interface Particle { x:number; y:number; vx:number; vy:number; life:number; maxLife:number; r:number; color:string; }
export interface Bullet { x:number; y:number; vx:number; vy:number; active:boolean; trail:Vec2[]; kind:string; }
export interface Alien {
  row:number; col:number; x:number; y:number;
  alive:boolean; frame:number; hitFlash:number;
  type: 0|1|2|3;
  diving:boolean; diveTargetX:number; diveAngle:number;
  divePhase:'RISE'|'FLIP'|'DIVE'; diveFlipTimer:number;
  diveOriginX:number; diveOriginY:number;
}
export interface Shield { blocks:boolean[][]; x:number; y:number; blockW:number; blockH:number; }
export interface UFO { active:boolean; x:number; y:number; dir:1|-1; score:number; hitFlash:number; }
export interface UfoScorePopup { x:number; y:number; score:number; timer:number; }
export interface PowerUpItem { id:number; x:number; y:number; vy:number; type:PowerUpItemType; active:boolean; rotation:number; }
export interface GameState {
  screen:GameScreen; mode:GameMode;
  score:number; hiScore:number; lives:number; level:number;
  player:{ x:number; vx:number; shootCooldown:number; invincible:number; };
  powerUp:PowerUpType; powerUpTimer:number;
  aliens:Alien[]; alienDir:number; alienDropQueued:boolean;
  alienSpeed:number; alienFrameTimer:number; alienFrame:number;
  bulletsP:Bullet[]; bulletsE:Bullet[];
  shields:Shield[]; ufo:UFO;
  ufoScorePopup:UfoScorePopup | null;
  powerUpItems:PowerUpItem[]; particles:Particle[]; stars:Star[];
  flashMessage:string; flashTimer:number;
  tick:number; stageTimer:number; newRecord:boolean; nextPowerUpId:number;
  // Time-bonus tracking
  stageStartTick:number;
  timeBonus:number;
  timeBonusTimer:number;
  // Sound event flags (consumed each frame by the game component)
  sfx: SfxEvent[];
}

export type SfxEvent =
  | { type: 'shoot' }
  | { type: 'alien_die'; alienType: 0|1|2|3 }
  | { type: 'ufo_appear' }
  | { type: 'ufo_die' }
  | { type: 'player_die' }
  | { type: 'stage_clear' }
  | { type: 'game_over' }
  | { type: 'time_bonus' }
  | { type: 'power_up' }
  | { type: 'alien_step'; tick: number };
