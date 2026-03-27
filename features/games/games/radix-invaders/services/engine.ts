import {
  type GameState,type Alien,type Shield,type Star,type Particle,type Bullet,type PowerUpItemType,type SfxEvent,
} from '../types/radix-invaders.types';
import {
  CANVAS_W,CANVAS_H,ALIEN_ROWS,ALIEN_COLS,ALIEN_W,ALIEN_H,ALIEN_GAP_X,ALIEN_GAP_Y,
  PLAYER_W,PLAYER_SPEED,BULLET_SPEED_P,BULLET_SPEED_E,UFO_W,UFO_SPEED,SHIELD_COUNT,
  COLORS
} from '../constants/radix-invaders.constants';

function rand(a:number,b:number){return Math.random()*(b-a)+a;}
function randInt(a:number,b:number){return Math.floor(rand(a,b+1));}

// ── Target ticks for time bonus (at 60fps, 1800 = 30s) ──────────
const TIME_BONUS_TARGET_TICKS = 1800;
const TIME_BONUS_MAX = 2000;

export function makeStars():Star[]{
  return Array.from({length:200},()=>({
    x:rand(0,CANVAS_W),y:rand(0,CANVAS_H),r:rand(0.4,2.2),speed:rand(0.04,0.2),
    alpha:rand(0.3,1),twinkleSpeed:rand(0.008,0.04),twinklePhase:rand(0,Math.PI*2),
  }));
}

function makeShield(cx:number,y:number):Shield{
  const W=9,H=6,blockW=8,blockH=7;
  const x=cx-(W*blockW)/2;
  const blocks:boolean[][]=Array.from({length:H},(_,r)=>Array.from({length:W},(_,c)=>{
    if(r>=4&&(c<2||c>=W-2))return false;
    return true;
  }));
  return{blocks,x,y,blockW,blockH};
}

function makeAliens():Alien[]{
  const aliens:Alien[]=[];
  const startX=(CANVAS_W-(ALIEN_COLS*(ALIEN_W+ALIEN_GAP_X)-ALIEN_GAP_X))/2;
  const startY=110;
  for(let row=0;row<ALIEN_ROWS;row++){
    const type=(row===0?0:row<=2?1:2) as 0|1|2|3;
    for(let col=0;col<ALIEN_COLS;col++){
      aliens.push({row,col,x:startX+col*(ALIEN_W+ALIEN_GAP_X),y:startY+row*(ALIEN_H+ALIEN_GAP_Y),
        alive:true,frame:0,hitFlash:0,type,
        diving:false,diveTargetX:0,diveAngle:-Math.PI/2,
        divePhase:'RISE',diveFlipTimer:0,diveOriginX:0,diveOriginY:0});
    }
  }
  return aliens;
}

export function initGameState(level:number,prevHi:number,prevScore=0,prevLives=3):GameState{
  const shieldY=CANVAS_H-178;
  const sp=CANVAS_W/(SHIELD_COUNT+1);
  const shields=Array.from({length:SHIELD_COUNT},(_,i)=>makeShield(sp*(i+1),shieldY));
  const speedBoost=1+(level-1)*0.18;
  return{
    screen:'PLAYING',mode:'FUN',score:prevScore,hiScore:prevHi,
    lives:prevLives,level,
    player:{x:CANVAS_W/2,vx:0,shootCooldown:0,invincible:0},
    powerUp:'NONE',powerUpTimer:0,
    aliens:makeAliens(),alienDir:1,alienDropQueued:false,
    alienSpeed:0.55*speedBoost,alienFrameTimer:0,alienFrame:0,
    bulletsP:[],bulletsE:[],shields,
    ufo:{active:false,x:-UFO_W,y:52,dir:1,score:0,hitFlash:0},
    ufoScorePopup:null,
    powerUpItems:[],particles:[],stars:makeStars(),
    flashMessage:'',flashTimer:0,tick:0,stageTimer:0,newRecord:false,nextPowerUpId:1,
    stageStartTick:0,timeBonus:0,timeBonusTimer:0,
    sfx:[],
  };
}

export function spawnExplosion(particles:Particle[],x:number,y:number,color:string,count=18,spread=5){
  for(let i=0;i<count;i++){
    const angle=rand(0,Math.PI*2),speed=rand(0.5,spread);
    particles.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,
      life:1,maxLife:1,r:rand(1.5,5),color});
  }
}

function aabb(ax:number,ay:number,aw:number,ah:number,bx:number,by:number,bw:number,bh:number){
  return ax<bx+bw&&ax+aw>bx&&ay<by+bh&&ay+ah>by;
}

function liveStatic(s:GameState):Alien[]{return s.aliens.filter(a=>a.alive&&!a.diving);}

function alienGlow(type:number):string{
  return([COLORS.glow0,COLORS.glow1,COLORS.glow2,COLORS.glow3])[type]??COLORS.glow1;
}

function makeBullet(x:number,y:number,vx:number,vy:number,kind:string):Bullet{
  return{x,y,vx,vy,active:true,trail:[],kind};
}

function playerShoot(px:number,py:number,pu:string):{bullets:Bullet[];cooldown:number}{
  if(pu==='SPREAD')return{
    bullets:[
      makeBullet(px,py,-3,-BULLET_SPEED_P+2,'spread'),
      makeBullet(px,py,0,-BULLET_SPEED_P,'spread'),
      makeBullet(px,py,3,-BULLET_SPEED_P+2,'spread'),
    ],cooldown:20};
  if(pu==='RAPID')return{bullets:[makeBullet(px,py,0,-BULLET_SPEED_P-4,'rapid')],cooldown:8};
  if(pu==='LASER')return{bullets:[makeBullet(px,py,0,-BULLET_SPEED_P*1.5,'laser')],cooldown:22};
  return{bullets:[makeBullet(px,py,0,-BULLET_SPEED_P,'normal')],cooldown:18};
}

export function updateGame(
  state:GameState,
  keys:Set<string>,
  isMouseActive:boolean,
  mouseX:number,
  mouseClick:boolean,
  clearMouseClick:()=>void,
):GameState{
  if(state.screen==='PAUSED'||state.screen==='GAME_OVER'||state.screen==='STAGE_CLEAR'){
    let s=updateBg(state);
    if(state.screen==='STAGE_CLEAR')s={...s,stageTimer:s.stageTimer-1};
    return{...s,sfx:[]};
  }
  if(state.screen!=='PLAYING')return state;

  let s={...state,tick:state.tick+1,sfx:[] as SfxEvent[]};
  s=updateBg(s);
  if(s.flashTimer>0)s={...s,flashTimer:s.flashTimer-1};
  if(s.timeBonusTimer>0)s={...s,timeBonusTimer:s.timeBonusTimer-1};

  // UFO score popup countdown
  let ufoScorePopup=s.ufoScorePopup;
  if(ufoScorePopup){
    ufoScorePopup={...ufoScorePopup,timer:ufoScorePopup.timer-1};
    if(ufoScorePopup.timer<=0)ufoScorePopup=null;
  }

  const playerY=CANVAS_H-56;

  // ── Player movement ──────────────────────────────────────────────
  let vx=0;
  if(keys.has('ArrowLeft')||keys.has('KeyA'))vx=-PLAYER_SPEED;
  if(keys.has('ArrowRight')||keys.has('KeyD'))vx=PLAYER_SPEED;
  if(isMouseActive&&vx===0){
    const diff=mouseX-s.player.x;
    if(Math.abs(diff)>4)vx=Math.sign(diff)*Math.min(PLAYER_SPEED,Math.abs(diff)*0.13);
  }
  const px=Math.max(PLAYER_W/2,Math.min(CANVAS_W-PLAYER_W/2,s.player.x+vx));
  let cooldown=Math.max(0,s.player.shootCooldown-1);
  let invincible=Math.max(0,s.player.invincible-1);
  let powerUp=s.powerUp;
  let powerUpTimer=Math.max(0,s.powerUpTimer-1);
  if(powerUpTimer===0&&powerUp!=='NONE')powerUp='NONE';

  // ── Shoot ────────────────────────────────────────────────────────
  const wantShoot=keys.has('Space')||keys.has('ArrowUp')||mouseClick;
  if(mouseClick)clearMouseClick();

  let bulletsP=s.bulletsP
    .filter(b=>b.active&&b.y>-20)
    .map(b=>{const trail=[{x:b.x,y:b.y},...b.trail.slice(0,8)];return{...b,x:b.x+b.vx,y:b.y+b.vy,trail};});

  if(wantShoot&&cooldown===0){
    const{bullets,cooldown:cd}=playerShoot(px,playerY-14,powerUp);
    bulletsP=[...bulletsP,...bullets];
    cooldown=cd;
    s.sfx.push({type:'shoot'});
  }

  // ── Alien movement ───────────────────────────────────────────────
  const alive=liveStatic(s);
  if(alive.length===0&&!s.aliens.some(a=>a.diving&&a.alive)){
    // Calculate time bonus
    const elapsed=s.tick-s.stageStartTick;
    const target=TIME_BONUS_TARGET_TICKS;
    const bonus=Math.max(0,Math.floor((1-Math.min(1,elapsed/target))*TIME_BONUS_MAX*s.level));
    const newScore=s.score+bonus;
    const sfx:SfxEvent[]=[{type:'stage_clear'}];
    if(bonus>0)sfx.push({type:'time_bonus'});
    return{
      ...s,
      screen:'STAGE_CLEAR',stageTimer:140,
      hiScore:Math.max(newScore,s.hiScore),
      score:newScore,
      timeBonus:bonus,timeBonusTimer:bonus>0?100:0,
      sfx,
    };
  }

  let{alienDir,alienDropQueued,alienFrameTimer,alienFrame}=s;
  const{alienSpeed}=s;
  const leftmost=alive.reduce((m,a)=>Math.min(m,a.x),Infinity);
  const rightmost=alive.reduce((m,a)=>Math.max(m,a.x+ALIEN_W),-Infinity);
  if(rightmost>=CANVAS_W-8){alienDir=-1;alienDropQueued=true;}
  if(leftmost<=8){alienDir=1;alienDropQueued=true;}
  const speedNow=alienSpeed*(1+(1-alive.length/(ALIEN_ROWS*ALIEN_COLS))*1.8);
  let dropY=0;
  if(alienDropQueued){dropY=18;alienDropQueued=false;}

  const prevAlienFrame=alienFrame;
  alienFrameTimer++;
  if(alienFrameTimer>=Math.max(5,22-alive.length*0.18)){
    alienFrame=(alienFrame+1)%2;
    alienFrameTimer=0;
  }
  // Alien march sound on frame change
  if(alienFrame!==prevAlienFrame){
    s.sfx.push({type:'alien_step',tick:s.tick});
  }

  const updatedAliens=s.aliens.map(a=>{
    if(!a.alive)return a;
    const hf=Math.max(0,a.hitFlash-1);
    if(a.diving){
      const DSPEED=4.5+s.level*0.3;
      let{x,y,diveAngle}=a;
      const{divePhase,diveFlipTimer}=a;
      if(divePhase==='RISE'){
        y-=3;
        const ft=diveFlipTimer+1;
        if(ft>30)return{...a,y,divePhase:'DIVE' as const,diveAngle:Math.PI*0.5,diveFlipTimer:0,hitFlash:hf};
        return{...a,y,diveFlipTimer:ft,hitFlash:hf};
      }
      if(divePhase==='DIVE'){
        const targetAngle=Math.atan2(playerY-y,px-x);
        const diff=((targetAngle-diveAngle+Math.PI*3)%(Math.PI*2))-Math.PI;
        diveAngle+=Math.sign(diff)*Math.min(0.06,Math.abs(diff));
        x+=Math.cos(diveAngle)*DSPEED;
        y+=Math.sin(diveAngle)*DSPEED;
        if(y>CANVAS_H+60||x<-80||x>CANVAS_W+80)return{...a,alive:false,hitFlash:hf};
        return{...a,x,y,diveAngle,hitFlash:hf};
      }
    }
    return{...a,x:a.x+alienDir*speedNow,y:a.y+dropY,hitFlash:hf};
  });

  if(s.level>=5&&s.tick%180===0){
    const candidates=updatedAliens.filter(a=>a.alive&&!a.diving);
    if(candidates.length>0&&Math.random()<0.4){
      const diver=candidates[Math.floor(Math.random()*candidates.length)];
      const idx=updatedAliens.indexOf(diver);
      if(idx>=0){
        updatedAliens[idx]={...diver,diving:true,divePhase:'RISE',diveFlipTimer:0,
          diveOriginX:diver.x,diveOriginY:diver.y,diveAngle:-Math.PI/2,type:3 as const};
      }
    }
  }

  // ── Enemy bullets ─────────────────────────────────────────────────
  let bulletsE=s.bulletsE
    .filter(b=>b.active&&b.y<CANVAS_H+20)
    .map(b=>{
      const trail=[{x:b.x,y:b.y},...b.trail.slice(0,6)];
      if(b.kind==='banana'){
        const newX=b.x+Math.sin(s.tick*0.12+b.vx)*2.5;
        return{...b,x:newX,y:b.y+b.vy,trail};
      }
      return{...b,x:b.x+b.vx,y:b.y+b.vy,trail};
    });

  const shootRate=Math.max(15,85-s.level*4);
  if(s.tick%shootRate===0&&alive.length>0){
    const col=randInt(0,ALIEN_COLS-1);
    const colAliens=alive.filter(a=>a.col===col);
    if(colAliens.length>0){
      const shooter=colAliens.reduce((b,a)=>a.y>b.y?a:b);
      const useBanana=s.level>=3&&Math.random()<0.25;
      bulletsE=[...bulletsE,{
        x:shooter.x+ALIEN_W/2,y:shooter.y+ALIEN_H,
        vx:useBanana?rand(0,Math.PI*2):0,
        vy:useBanana?BULLET_SPEED_E*0.75:BULLET_SPEED_E+s.level*0.3,
        active:true,trail:[],kind:useBanana?'banana':'normal',
      }];
    }
  }

  // ── UFO ───────────────────────────────────────────────────────────
  let{ufo}=s;
  const _wasUfoActive=ufo.active;
  if(!ufo.active&&s.tick%420===200&&alive.length>4){
    const dir=(s.tick%840<420?1:-1) as 1|-1;
    ufo={active:true,x:dir===1?-UFO_W:CANVAS_W+UFO_W,y:52,dir,
      score:[50,100,150,300][randInt(0,3)],hitFlash:0};
    s.sfx.push({type:'ufo_appear'});
  }
  if(ufo.active){
    ufo={...ufo,x:ufo.x+ufo.dir*UFO_SPEED,hitFlash:Math.max(0,ufo.hitFlash-1)};
    if(ufo.x<-UFO_W*2||ufo.x>CANVAS_W+UFO_W*2)ufo={...ufo,active:false};
  }

  // ── Power-up drops ────────────────────────────────────────────────
  const PUTYPES:PowerUpItemType[]=['SPREAD','LASER','RAPID'];
  let powerUpItems=s.powerUpItems
    .filter(p=>p.active&&p.y<CANVAS_H+40)
    .map(p=>({...p,y:p.y+p.vy,rotation:p.rotation+0.04}));
  let nextPowerUpId=s.nextPowerUpId;

  if(s.tick%350===170&&Math.random()<0.65){
    powerUpItems=[...powerUpItems,{
      id:nextPowerUpId++,x:rand(60,CANVAS_W-60),y:-20,vy:1.4,
      type:PUTYPES[randInt(0,2)],active:true,rotation:0,
    }];
  }

  // ── Collisions ────────────────────────────────────────────────────
  let{score,lives}=s;
  const particles=[...s.particles];
  const shields=[...s.shields];

  const keepBulletsP:Bullet[]=[];
  for(const b of bulletsP){
    let hit=false;
    for(let i=0;i<updatedAliens.length&&!hit;i++){
      const a=updatedAliens[i];
      if(!a.alive)continue;
      if(aabb(b.x-4,b.y-8,8,16,a.x,a.y,ALIEN_W,ALIEN_H)){
        const pts=a.type===3?50:[30,20,10][a.type as 0|1|2]??10;
        score+=pts;
        updatedAliens[i]={...a,alive:false};
        spawnExplosion(particles,a.x+ALIEN_W/2,a.y+ALIEN_H/2,alienGlow(a.type),22,6);
        s.sfx.push({type:'alien_die',alienType:a.type});
        if(b.kind!=='laser')hit=true;
      }
    }
    if(!hit&&ufo.active&&aabb(b.x-3,b.y-8,6,16,ufo.x,ufo.y,UFO_W,22)){
      score+=ufo.score;
      spawnExplosion(particles,ufo.x+UFO_W/2,ufo.y+11,COLORS.ufo,28,7);
      // UFO score popup
      ufoScorePopup={x:ufo.x+UFO_W/2,y:ufo.y-10,score:ufo.score,timer:90};
      s.sfx.push({type:'ufo_die'});
      ufo={...ufo,active:false};
      if(b.kind!=='laser')hit=true;
    }
    if(!hit){
      for(let si=0;si<shields.length&&!hit;si++){
        const sh=shields[si];
        const sw=sh.blocks[0].length*sh.blockW,shH=sh.blocks.length*sh.blockH;
        if(aabb(b.x-2,b.y-4,4,8,sh.x,sh.y,sw,shH)){
          const col=Math.floor((b.x-sh.x)/sh.blockW);
          const row=Math.floor((b.y-sh.y)/sh.blockH);
          const nb=sh.blocks.map(r=>[...r]);
          let shHit=false;
          for(let dr=-1;dr<=1&&!shHit;dr++)for(let dc=-1;dc<=1&&!shHit;dc++){
            const rr=row+dr,cc=col+dc;
            if(rr>=0&&rr<nb.length&&cc>=0&&cc<nb[0].length&&nb[rr][cc]){nb[rr][cc]=false;shHit=true;}
          }
          if(shHit){shields[si]={...sh,blocks:nb};spawnExplosion(particles,b.x,b.y,COLORS.shield,5,2);if(b.kind!=='laser')hit=true;}
        }
      }
    }
    if(!hit)keepBulletsP.push(b);
  }
  bulletsP=keepBulletsP;

  for(const a of updatedAliens.filter(a=>a.alive)){
    for(let si=0;si<shields.length;si++){
      const sh=shields[si];
      const sw=sh.blocks[0].length*sh.blockW,shH=sh.blocks.length*sh.blockH;
      if(aabb(a.x,a.y,ALIEN_W,ALIEN_H,sh.x,sh.y,sw,shH)){
        if(sh.blocks.some(row=>row.some(b=>b))){
          spawnExplosion(particles,sh.x+sw/2,sh.y+shH/2,COLORS.shield,35,6);
          shields[si]={...sh,blocks:sh.blocks.map(r=>r.map(()=>false))};
        }
      }
    }
  }

  const keepBulletsE:Bullet[]=[];
  for(const b of bulletsE){
    let hit=false;
    for(let si=0;si<shields.length&&!hit;si++){
      const sh=shields[si];
      const sw=sh.blocks[0].length*sh.blockW,shH=sh.blocks.length*sh.blockH;
      if(aabb(b.x-2,b.y-4,4,8,sh.x,sh.y,sw,shH)){
        const col=Math.floor((b.x-sh.x)/sh.blockW);
        const row=Math.floor((b.y-sh.y)/sh.blockH);
        const nb=sh.blocks.map(r=>[...r]);
        let shHit=false;
        for(let dr=-1;dr<=1&&!shHit;dr++)for(let dc=-1;dc<=1&&!shHit;dc++){
          const rr=row+dr,cc=col+dc;
          if(rr>=0&&rr<nb.length&&cc>=0&&cc<nb[0].length&&nb[rr][cc]){nb[rr][cc]=false;shHit=true;}
        }
        if(shHit){shields[si]={...sh,blocks:nb};spawnExplosion(particles,b.x,b.y,COLORS.shield,5,2);hit=true;}
      }
    }
    if(!hit)keepBulletsE.push(b);
  }
  bulletsE=keepBulletsE;

  if(invincible===0){
    for(const b of bulletsE){
      const bW=b.kind==='banana'?16:6;
      if(aabb(b.x-bW/2,b.y-6,bW,12,px-22,playerY-14,44,28)){
        lives--;invincible=120;
        spawnExplosion(particles,px,playerY,COLORS.playerShip,24,6);
        s.sfx.push({type:'player_die'});
        bulletsE=bulletsE.filter(eb=>eb!==b);break;
      }
    }
    for(let i=0;i<updatedAliens.length&&invincible===0;i++){
      const a=updatedAliens[i];
      if(!a.alive||!a.diving)continue;
      if(aabb(a.x,a.y,ALIEN_W,ALIEN_H,px-22,playerY-14,44,28)){
        lives--;invincible=120;
        spawnExplosion(particles,px,playerY,COLORS.playerShip,24,6);
        spawnExplosion(particles,a.x+ALIEN_W/2,a.y+ALIEN_H/2,COLORS.glow3,18,5);
        s.sfx.push({type:'player_die'});
        updatedAliens[i]={...a,alive:false};
      }
    }
  }

  const remainPU:typeof powerUpItems=[];
  for(const item of powerUpItems){
    if(aabb(item.x-12,item.y-12,24,24,px-26,playerY-14,52,28)){
      powerUp=item.type;powerUpTimer=600;
      spawnExplosion(particles,item.x,item.y,COLORS.gold,20,5);
      s.sfx.push({type:'power_up'});
    }else{remainPU.push(item);}
  }
  powerUpItems=remainPU;

  const lowestY=updatedAliens.filter(a=>a.alive&&!a.diving).reduce((m,a)=>Math.max(m,a.y+ALIEN_H),0);
  if(lowestY>=playerY-10)lives=0;

  const newHi=Math.max(score,s.hiScore);
  if(lives<=0){
    spawnExplosion(particles,px,playerY,COLORS.playerShip,40,8);
    s.sfx.push({type:'game_over'});
    return{...s,screen:'GAME_OVER',score,hiScore:newHi,newRecord:score>s.hiScore&&s.hiScore>0,lives:0,particles,aliens:updatedAliens,ufoScorePopup};
  }

  return{
    ...s,
    player:{x:px,vx,shootCooldown:cooldown,invincible},
    powerUp,powerUpTimer,
    aliens:updatedAliens,alienDir,alienDropQueued,alienSpeed,alienFrameTimer,alienFrame,
    bulletsP,bulletsE,shields,ufo,ufoScorePopup,powerUpItems,
    particles,score,hiScore:newHi,lives,nextPowerUpId,newRecord:false,
  };
}

function updateBg(s:GameState):GameState{
  const stars=s.stars.map(st=>{
    const phase=st.twinklePhase+st.twinkleSpeed;
    return{...st,y:st.y+st.speed>CANVAS_H?0:st.y+st.speed,
      alpha:0.3+0.7*((Math.sin(phase)+1)/2),twinklePhase:phase};
  });
  const particles=s.particles
    .map(p=>({...p,x:p.x+p.vx,y:p.y+p.vy,vy:p.vy+0.07,life:p.life-0.024,r:p.r*0.97}))
    .filter(p=>p.life>0);
  return{...s,stars,particles};
}
