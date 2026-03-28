import { type GameState } from '../types/radix-invaders.types';
import {
  CANVAS_W,CANVAS_H,PLAYER_W,PLAYER_H,ALIEN_W,ALIEN_H,UFO_W,UFO_H,
  COLORS
} from '../constants/radix-invaders.constants';

function glow(ctx:CanvasRenderingContext2D,color:string,blur:number,isMobile?:boolean){
  if(isMobile) return;
  ctx.shadowColor=color;ctx.shadowBlur=blur;
}
function noGlow(ctx:CanvasRenderingContext2D){ctx.shadowBlur=0;}

export function drawBackground(ctx:CanvasRenderingContext2D,state:GameState,isMobile?:boolean){
  const g=ctx.createLinearGradient(0,0,0,CANVAS_H);
  g.addColorStop(0,'#010614');g.addColorStop(0.5,'#020f2a');g.addColorStop(1,'#010614');
  ctx.fillStyle=g;ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  for(const st of state.stars){
    ctx.globalAlpha=st.alpha;
    if(isMobile){
      ctx.fillStyle='#ffffff';
      ctx.fillRect(st.x-st.r,st.y-st.r,st.r*2,st.r*2);
    } else {
      glow(ctx,'#ffffff',st.r*3,isMobile);
      ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(st.x,st.y,st.r,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.globalAlpha=1;noGlow(ctx);
}

export function drawScanlines(ctx:CanvasRenderingContext2D){
  ctx.save();ctx.globalAlpha=0.04;ctx.fillStyle='#000';
  for(let y=0;y<CANVAS_H;y+=3)ctx.fillRect(0,y,CANVAS_W,1.5);
  ctx.globalAlpha=1;
  const v=ctx.createRadialGradient(CANVAS_W/2,CANVAS_H/2,CANVAS_H*0.35,CANVAS_W/2,CANVAS_H/2,CANVAS_H*0.85);
  v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,0.55)');
  ctx.fillStyle=v;ctx.fillRect(0,0,CANVAS_W,CANVAS_H);ctx.restore();
}

export function drawParticles(ctx:CanvasRenderingContext2D,state:GameState,isMobile?:boolean){
  for(const p of state.particles){
    ctx.globalAlpha=p.life;
    if(isMobile){
      ctx.fillStyle=p.color;
      const r=p.r*p.life;
      ctx.fillRect(p.x-r,p.y-r,r*2,r*2);
    } else {
      glow(ctx,p.color,p.r*2,isMobile);
      ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r*p.life,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.globalAlpha=1;noGlow(ctx);
}

export function drawPlayer(ctx:CanvasRenderingContext2D,state:GameState,isMobile?:boolean){
  const{x,invincible}=state.player;
  const y=CANVAS_H-56;
  if(invincible>0&&Math.floor(invincible/5)%2===0)return;
  ctx.save();ctx.translate(x,y);
  // Engine glow
  ctx.globalAlpha=0.4+0.3*Math.sin(state.tick*0.18);
  glow(ctx,COLORS.playerShip,28,isMobile);
  const eg=ctx.createRadialGradient(0,PLAYER_H/2,0,0,PLAYER_H/2,20);
  eg.addColorStop(0,COLORS.playerShip);eg.addColorStop(1,'transparent');
  ctx.fillStyle=eg;ctx.fillRect(-12,PLAYER_H/2-4,24,16);
  ctx.globalAlpha=1;
  glow(ctx,COLORS.playerShip,18,isMobile);ctx.fillStyle=COLORS.playerShip;
  ctx.beginPath();
  ctx.moveTo(0,-PLAYER_H/2);ctx.lineTo(PLAYER_W/2-4,PLAYER_H/2);
  ctx.lineTo(PLAYER_W/2-14,PLAYER_H/4);ctx.lineTo(-PLAYER_W/2+14,PLAYER_H/4);
  ctx.lineTo(-PLAYER_W/2+4,PLAYER_H/2);ctx.closePath();ctx.fill();
  glow(ctx,'#ffffff',10,isMobile);ctx.fillStyle='rgba(255,255,255,0.7)';
  ctx.beginPath();ctx.ellipse(0,-2,7,9,0,0,Math.PI*2);ctx.fill();
  // Flame
  const fh=8+6*Math.sin(state.tick*0.25);
  const fg=ctx.createLinearGradient(0,PLAYER_H/2,0,PLAYER_H/2+fh);
  fg.addColorStop(0,'rgba(0,229,255,0.9)');fg.addColorStop(0.5,'rgba(255,165,0,0.7)');fg.addColorStop(1,'transparent');
  ctx.fillStyle=fg;glow(ctx,'#ff8800',16,isMobile);
  ctx.beginPath();ctx.moveTo(-8,PLAYER_H/2);ctx.lineTo(8,PLAYER_H/2);ctx.lineTo(0,PLAYER_H/2+fh);ctx.closePath();ctx.fill();
  // Power-up indicator ring
  if(state.powerUp!=='NONE'){
    const puColor=state.powerUp==='SPREAD'?COLORS.bulletSpread:state.powerUp==='LASER'?COLORS.bulletLaser:COLORS.bulletRapid;
    const alpha=0.5+0.4*Math.sin(state.tick*0.15);
    ctx.globalAlpha=alpha;glow(ctx,puColor,14,isMobile);ctx.strokeStyle=puColor;ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(0,0,28,0,Math.PI*2);ctx.stroke();
  }
  ctx.restore();noGlow(ctx);
}

function drawAlienType0(ctx:CanvasRenderingContext2D,w:number,h:number,f:number){
  ctx.beginPath();
  if(f===0){
    ctx.moveTo(w/2,0);ctx.lineTo(w-4,h/2);ctx.lineTo(w*0.7,h);ctx.lineTo(w*0.3,h);ctx.lineTo(4,h/2);ctx.closePath();
    ctx.moveTo(w*0.25,h);ctx.lineTo(w*0.15,h+7);
    ctx.moveTo(w*0.5,h);ctx.lineTo(w*0.5,h+9);
    ctx.moveTo(w*0.75,h);ctx.lineTo(w*0.85,h+7);
  }else{
    ctx.moveTo(w/2,0);ctx.lineTo(w-2,h/2-2);ctx.lineTo(w*0.65,h);ctx.lineTo(w*0.35,h);ctx.lineTo(2,h/2-2);ctx.closePath();
    ctx.moveTo(w*0.2,h);ctx.lineTo(w*0.05,h+6);
    ctx.moveTo(w*0.5,h);ctx.lineTo(w*0.5,h+10);
    ctx.moveTo(w*0.8,h);ctx.lineTo(w*0.95,h+6);
  }
  ctx.fill();ctx.stroke();
  ctx.fillStyle=COLORS.bg;ctx.beginPath();ctx.arc(w*0.35,h*0.45,3,0,Math.PI*2);ctx.arc(w*0.65,h*0.45,3,0,Math.PI*2);ctx.fill();
}

function drawAlienType1(ctx:CanvasRenderingContext2D,w:number,h:number,f:number){
  ctx.beginPath();ctx.roundRect(6,4,w-12,h-8,6);ctx.fill();ctx.stroke();
  ctx.beginPath();
  if(f===0){ctx.moveTo(2,4);ctx.lineTo(0,0);ctx.lineTo(6,6);ctx.moveTo(w-2,4);ctx.lineTo(w,0);ctx.lineTo(w-6,6);}
  else{ctx.moveTo(4,6);ctx.lineTo(0,4);ctx.lineTo(6,8);ctx.moveTo(w-4,6);ctx.lineTo(w,4);ctx.lineTo(w-6,8);}
  ctx.stroke();
  for(let i=0;i<3;i++){
    const lx=10+i*((w-20)/2);
    ctx.beginPath();ctx.moveTo(lx,h-4);ctx.lineTo(lx+(f===0?-4:4),h+5);ctx.stroke();
    ctx.beginPath();ctx.moveTo(w-10-i*((w-20)/2),h-4);ctx.lineTo(w-10-i*((w-20)/2)+(f===0?4:-4),h+5);ctx.stroke();
  }
  ctx.fillStyle=COLORS.bg;ctx.beginPath();ctx.arc(w*0.33,h*0.42,3.5,0,Math.PI*2);ctx.arc(w*0.67,h*0.42,3.5,0,Math.PI*2);ctx.fill();
}

function drawAlienType2(ctx:CanvasRenderingContext2D,w:number,h:number,f:number){
  ctx.beginPath();ctx.ellipse(w/2,h*0.4,w/2-4,h*0.44,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  for(let i=0;i<5;i++){
    const tx=5+i*((w-10)/4);
    const wave=f===0?(i%2===0?5:-5):(i%2===0?-5:5);
    ctx.beginPath();ctx.moveTo(tx,h*0.7);ctx.quadraticCurveTo(tx+wave,h*0.85,tx,h+2);ctx.stroke();
  }
  ctx.fillStyle=COLORS.bg;ctx.beginPath();ctx.arc(w*0.37,h*0.35,4,0,Math.PI*2);ctx.arc(w*0.63,h*0.35,4,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(w/2,h*0.52,6,0.2,Math.PI-0.2);ctx.stroke();
}

function drawAlienType3(ctx:CanvasRenderingContext2D,w:number,h:number,f:number){
  // Elite / dive-bomber: angular aggressive shape with wings
  ctx.beginPath();
  ctx.moveTo(w/2,0);ctx.lineTo(w,h/3);ctx.lineTo(w*0.75,h);ctx.lineTo(w*0.25,h);ctx.lineTo(0,h/3);ctx.closePath();
  ctx.fill();ctx.stroke();
  // Wings
  ctx.beginPath();
  if(f===0){ctx.moveTo(0,h/3);ctx.lineTo(-10,h*0.6);ctx.lineTo(0,h*0.7);}
  else{ctx.moveTo(0,h/3);ctx.lineTo(-8,h*0.55);ctx.lineTo(0,h*0.65);}
  ctx.fill();ctx.stroke();
  ctx.beginPath();
  if(f===0){ctx.moveTo(w,h/3);ctx.lineTo(w+10,h*0.6);ctx.lineTo(w,h*0.7);}
  else{ctx.moveTo(w,h/3);ctx.lineTo(w+8,h*0.55);ctx.lineTo(w,h*0.65);}
  ctx.fill();ctx.stroke();
  // Eyes
  ctx.fillStyle=COLORS.bg;ctx.beginPath();ctx.arc(w*0.38,h*0.5,4,0,Math.PI*2);ctx.arc(w*0.62,h*0.5,4,0,Math.PI*2);ctx.fill();
}

export function drawAliens(ctx:CanvasRenderingContext2D,state:GameState,isMobile?:boolean){
  for(const a of state.aliens){
    if(!a.alive)continue;
    const color=[COLORS.alien0,COLORS.alien1,COLORS.alien2,COLORS.alien3][a.type];
    const glowColor=[COLORS.glow0,COLORS.glow1,COLORS.glow2,COLORS.glow3][a.type];
    ctx.save();
    if(a.diving){
      ctx.translate(a.x+ALIEN_W/2,a.y+ALIEN_H/2);
      const angle=a.divePhase==='DIVE'?a.diveAngle:-Math.PI/2;
      ctx.rotate(angle+Math.PI/2);
      ctx.translate(-ALIEN_W/2,-ALIEN_H/2);
    }else{
      ctx.translate(a.x,a.y);
    }
    if(a.hitFlash>0){ctx.fillStyle='#ffffff';ctx.strokeStyle='#ffffff';glow(ctx,'#ffffff',20,isMobile);}
    else{ctx.fillStyle=color??COLORS.alien1;ctx.strokeStyle=color??COLORS.alien1;glow(ctx,glowColor??COLORS.glow1,14,isMobile);}
    ctx.lineWidth=1.5;
    if(a.type===0)drawAlienType0(ctx,ALIEN_W,ALIEN_H,state.alienFrame);
    else if(a.type===1)drawAlienType1(ctx,ALIEN_W,ALIEN_H,state.alienFrame);
    else if(a.type===3)drawAlienType3(ctx,ALIEN_W,ALIEN_H,state.alienFrame);
    else drawAlienType2(ctx,ALIEN_W,ALIEN_H,state.alienFrame);
    ctx.restore();
  }
  noGlow(ctx);
}

export function drawUFO(ctx:CanvasRenderingContext2D,state:GameState,isMobile?:boolean){
  const{ufo}=state;if(!ufo.active)return;
  ctx.save();ctx.translate(ufo.x,ufo.y);
  const pulse=0.7+0.3*Math.sin(state.tick*0.15);
  glow(ctx,COLORS.ufo,20*pulse,isMobile);ctx.fillStyle=COLORS.ufo;
  ctx.beginPath();ctx.ellipse(UFO_W/2,UFO_H*0.65,UFO_W/2,UFO_H*0.35,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='rgba(255,0,170,0.6)';ctx.beginPath();ctx.ellipse(UFO_W/2,UFO_H*0.45,UFO_W*0.32,UFO_H*0.5,0,Math.PI,0);ctx.fill();
  for(let i=0;i<5;i++){
    const lx=10+i*((UFO_W-20)/4);
    const on=(state.tick+i*8)%20<10;
    ctx.fillStyle=on?'#ffffff':COLORS.ufo;glow(ctx,on?'#ffffff':COLORS.ufo,on?8:3,isMobile);
    ctx.beginPath();ctx.arc(lx,UFO_H*0.68,3,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();noGlow(ctx);
}

export function drawShields(ctx:CanvasRenderingContext2D,state:GameState,isMobile?:boolean){
  for(const sh of state.shields){
    const{blocks,x,y,blockW,blockH}=sh;
    glow(ctx,COLORS.shield,6,isMobile);ctx.fillStyle=COLORS.shield;
    for(let r=0;r<blocks.length;r++)for(let c=0;c<blocks[r].length;c++){
      if(!blocks[r][c])continue;
      ctx.globalAlpha=0.85;ctx.fillRect(x+c*blockW+1,y+r*blockH+1,blockW-2,blockH-2);
    }
  }
  ctx.globalAlpha=1;noGlow(ctx);
}

export function drawBullets(ctx:CanvasRenderingContext2D,state:GameState,isMobile?:boolean){
  // Player bullets
  for(const b of state.bulletsP){
    const color=b.kind==='spread'?COLORS.bulletSpread:b.kind==='laser'?COLORS.bulletLaser:b.kind==='rapid'?COLORS.bulletRapid:COLORS.bulletP;
    for(let i=0;i<b.trail.length;i++){
      const t=b.trail[i];ctx.globalAlpha=(1-i/b.trail.length)*0.35;
      ctx.fillStyle=color;ctx.fillRect(t.x-1.5,t.y-3,3,6);
    }
    ctx.globalAlpha=1;glow(ctx,color,12,isMobile);ctx.fillStyle=color;
    if(b.kind==='laser'){
      ctx.fillRect(b.x-3,b.y-16,6,32);
    }else{
      ctx.fillRect(b.x-2,b.y-8,4,16);
    }
  }
  // Enemy bullets
  for(const b of state.bulletsE){
    for(let i=0;i<b.trail.length;i++){
      const t=b.trail[i];ctx.globalAlpha=(1-i/b.trail.length)*0.3;
      ctx.fillStyle=b.kind==='banana'?COLORS.bulletBanana:COLORS.bulletE;ctx.fillRect(t.x-1.5,t.y-3,3,6);
    }
    ctx.globalAlpha=1;
    if(b.kind==='banana'){
      // Draw banana shape: curved yellow projectile
      glow(ctx,COLORS.bulletBanana,14,isMobile);
      ctx.save();ctx.translate(b.x,b.y);
      ctx.strokeStyle=COLORS.bulletBanana;ctx.lineWidth=4;ctx.lineCap='round';
      ctx.beginPath();ctx.arc(0,0,8,0.3,Math.PI-0.3);ctx.stroke();
      ctx.beginPath();ctx.arc(0,-3,5,Math.PI+0.5,Math.PI*2-0.5);ctx.stroke();
      ctx.restore();
    }else{
      glow(ctx,COLORS.bulletE,10,isMobile);ctx.strokeStyle=COLORS.bulletE;ctx.lineWidth=2.5;
      ctx.beginPath();ctx.moveTo(b.x-2,b.y-6);ctx.lineTo(b.x+2,b.y-2);ctx.lineTo(b.x-2,b.y+2);ctx.lineTo(b.x+2,b.y+6);ctx.stroke();
    }
  }
  ctx.globalAlpha=1;noGlow(ctx);
}

export function drawPowerUpItems(ctx:CanvasRenderingContext2D,state:GameState,isMobile?:boolean){
  for(const item of state.powerUpItems){
    ctx.save();ctx.translate(item.x,item.y);ctx.rotate(item.rotation);
    const color=item.type==='SPREAD'?COLORS.bulletSpread:item.type==='LASER'?COLORS.bulletLaser:COLORS.bulletRapid;
    glow(ctx,color,16,isMobile);
    // Hexagon
    ctx.strokeStyle=color;ctx.lineWidth=2;ctx.fillStyle=`${color}22`;
    ctx.beginPath();
    for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2-Math.PI/6;ctx.lineTo(Math.cos(a)*12,Math.sin(a)*12);}
    ctx.closePath();ctx.fill();ctx.stroke();
    // Icon inside
    ctx.fillStyle=color;ctx.font='bold 11px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
    const icon=item.type==='SPREAD'?'S':item.type==='LASER'?'L':'R';
    ctx.fillText(icon,0,0);
    ctx.restore();
  }
  noGlow(ctx);
}

export function drawHUD(ctx:CanvasRenderingContext2D,state:GameState,labels:Record<string,string>,mode:'TOURNAMENT'|'FUN',isMobile?:boolean){
  const y=28;
  glow(ctx,COLORS.primary,12,isMobile);ctx.fillStyle=COLORS.primary;ctx.font='bold 13px "Courier New",monospace';
  ctx.textAlign='left';ctx.fillText(labels.hud_score??'SCORE',20,y-10);
  ctx.font='bold 22px "Courier New",monospace';ctx.fillText(String(state.score).padStart(6,'0'),20,y+12);
  ctx.textAlign='center';ctx.fillStyle=COLORS.gold;glow(ctx,COLORS.gold,10,isMobile);
  ctx.font='bold 13px "Courier New",monospace';ctx.fillText(labels.hud_hi??'HI-SCORE',CANVAS_W/2,y-10);
  ctx.font='bold 22px "Courier New",monospace';ctx.fillText(String(state.hiScore).padStart(6,'0'),CANVAS_W/2,y+12);
  ctx.textAlign='right';ctx.fillStyle=COLORS.primary;glow(ctx,COLORS.primary,12,isMobile);
  ctx.font='bold 13px "Courier New",monospace';ctx.fillText(labels.hud_lives??'LIVES',CANVAS_W-20,y-10);
  for(let i=0;i<state.lives;i++){const lx=CANVAS_W-28-i*28;drawMiniShip(ctx,lx,y+4,COLORS.primary);}
  ctx.textAlign='left';ctx.fillStyle=COLORS.secondary;glow(ctx,COLORS.secondary,10,isMobile);
  ctx.font='bold 13px "Courier New",monospace';ctx.fillText(`${labels.hud_level??'LVL'} ${state.level}`,20,CANVAS_H-14);
  // Power-up timer bar
  if(state.powerUp!=='NONE'){
    const puColor=state.powerUp==='SPREAD'?COLORS.bulletSpread:state.powerUp==='LASER'?COLORS.bulletLaser:COLORS.bulletRapid;
    const pct=state.powerUpTimer/600;
    glow(ctx,puColor,8,isMobile);ctx.fillStyle=`${puColor}44`;ctx.fillRect(CANVAS_W/2-60,CANVAS_H-26,120,8);
    ctx.fillStyle=puColor;ctx.fillRect(CANVAS_W/2-60,CANVAS_H-26,120*pct,8);
    ctx.fillStyle=puColor;ctx.textAlign='center';ctx.font='bold 10px "Courier New",monospace';
    ctx.fillText(state.powerUp,CANVAS_W/2,CANVAS_H-12);
  }
  ctx.textAlign='right';ctx.fillStyle=mode==='TOURNAMENT'?COLORS.gold:COLORS.dimWhite;
  glow(ctx,mode==='TOURNAMENT'?COLORS.gold:'transparent',8,isMobile);ctx.font='bold 11px "Courier New",monospace';
  ctx.fillText(mode==='TOURNAMENT'?(labels.tournament_mode??'TOURNAMENT'):(labels.fun_mode??'EXHIBITION'),CANVAS_W-20,CANVAS_H-14);
  noGlow(ctx);
}

function drawMiniShip(ctx:CanvasRenderingContext2D,x:number,y:number,color:string){
  ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x,y-10);ctx.lineTo(x+10,y+6);ctx.lineTo(x-10,y+6);ctx.closePath();ctx.fill();
}

export function drawGameOver(ctx:CanvasRenderingContext2D,state:GameState,labels:Record<string,string>,isMobile?:boolean){
  ctx.save();ctx.fillStyle='rgba(0,0,0,0.72)';ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  const cx=CANVAS_W/2,cy=CANVAS_H/2;
  if(state.newRecord){glow(ctx,COLORS.gold,30,isMobile);ctx.fillStyle=COLORS.gold;ctx.font='bold 22px "Courier New",monospace';ctx.textAlign='center';ctx.fillText(labels.new_record??'NEW RECORD',cx,cy-90);}
  glow(ctx,COLORS.secondary,30,isMobile);ctx.fillStyle=COLORS.secondary;ctx.font='bold 64px "Courier New",monospace';ctx.textAlign='center';ctx.fillText(labels.game_over??'GAME OVER',cx,cy-20);
  ctx.fillStyle=COLORS.white;glow(ctx,COLORS.white,10,isMobile);ctx.font='18px "Courier New",monospace';ctx.fillText(`${labels.final_score??'SCORE'}: ${state.score}`,cx,cy+36);
  glow(ctx,COLORS.primary,16,isMobile);ctx.fillStyle=COLORS.primary;ctx.font='bold 16px "Courier New",monospace';ctx.fillText(labels.play_again??'PRESS SPACE TO PLAY AGAIN',cx,cy+80);
  ctx.restore();noGlow(ctx);
}

export function drawStageClear(ctx:CanvasRenderingContext2D,state:GameState,labels:Record<string,string>,isMobile?:boolean){
  ctx.save();ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  const pulse=0.8+0.2*Math.sin(state.tick*0.1);
  glow(ctx,COLORS.accent,30*pulse,isMobile);ctx.fillStyle=COLORS.accent;ctx.font='bold 52px "Courier New",monospace';ctx.textAlign='center';
  ctx.fillText(labels.stage_clear??'STAGE CLEAR!',CANVAS_W/2,CANVAS_H/2-20);
  // Time bonus
  if(state.timeBonus>0&&state.timeBonusTimer>0){
    const alpha=Math.min(1,state.timeBonusTimer/30);
    ctx.globalAlpha=alpha;
    glow(ctx,COLORS.gold,20,isMobile);ctx.fillStyle=COLORS.gold;
    ctx.font='bold 24px "Courier New",monospace';
    ctx.fillText(`${labels.time_bonus??'TIME BONUS'} +${state.timeBonus}`,CANVAS_W/2,CANVAS_H/2+40);
    ctx.globalAlpha=1;
  }
  ctx.restore();noGlow(ctx);
}

export function drawPaused(ctx:CanvasRenderingContext2D,labels:Record<string,string>,isMobile?:boolean){
  ctx.save();ctx.fillStyle='rgba(0,0,0,0.65)';ctx.fillRect(0,0,CANVAS_W,CANVAS_H);
  glow(ctx,COLORS.gold,20,isMobile);ctx.fillStyle=COLORS.gold;ctx.font='bold 52px "Courier New",monospace';ctx.textAlign='center';ctx.fillText(labels.paused??'PAUSED',CANVAS_W/2,CANVAS_H/2-10);
  ctx.fillStyle=COLORS.dimWhite;ctx.font='16px "Courier New",monospace';ctx.fillText(labels.resume??'P / ESC TO RESUME',CANVAS_W/2,CANVAS_H/2+36);
  ctx.restore();noGlow(ctx);
}

export function drawGroundLine(ctx:CanvasRenderingContext2D,isMobile?:boolean){
  glow(ctx,COLORS.primary,6,isMobile);ctx.strokeStyle=COLORS.primary;ctx.lineWidth=1.5;ctx.globalAlpha=0.5;
  ctx.beginPath();ctx.moveTo(0,CANVAS_H-26);ctx.lineTo(CANVAS_W,CANVAS_H-26);ctx.stroke();
  ctx.globalAlpha=1;noGlow(ctx);
}

export function drawFlashMessage(ctx:CanvasRenderingContext2D,state:GameState,isMobile?:boolean){
  if(!state.flashMessage||state.flashTimer<=0)return;
  ctx.globalAlpha=Math.min(1,state.flashTimer/30);
  glow(ctx,COLORS.gold,16,isMobile);ctx.fillStyle=COLORS.gold;ctx.font='bold 20px "Courier New",monospace';ctx.textAlign='center';
  ctx.fillText(state.flashMessage,CANVAS_W/2,90);ctx.globalAlpha=1;noGlow(ctx);
}

export function drawUFOScorePopup(ctx:CanvasRenderingContext2D,state:GameState,isMobile?:boolean){
  const p=state.ufoScorePopup;
  if(!p||p.timer<=0)return;
  const alpha=Math.min(1,p.timer/20);
  const rise=(90-p.timer)*0.6;
  ctx.globalAlpha=alpha;
  glow(ctx,COLORS.ufo,14,isMobile);
  ctx.fillStyle=COLORS.ufo;
  ctx.font='bold 22px "Courier New",monospace';
  ctx.textAlign='center';
  ctx.fillText(`+${p.score}`,p.x,p.y-rise);
  ctx.globalAlpha=1;noGlow(ctx);
}
