import {shiftFish} from './body-transform.js?v=1.43.0';
import {stepSoftStrand} from './soft-strand.js?v=1.43.0';
// Procedural fish drawn as literal rectangles: kinematic spines (follow-the-leader with bend limits) steered by
// explicit world rules. Every rule reads the same world the particles live in:
//  1 hunger    – seek the prey particle species (same food chain as particles)
//  2 fear      – avoid crowds of the particle species that preys on the fish's colour
//  3 affinity  – feel the particle affinity matrix row of their own species
//  4 current   – drift with the local particle flow
//  5 school    – cohesion / alignment / separation with same-species fish
//  6 food chain– fish scare fish of their prey colour (burst escape)
//  7 waves     – disturbance pulses scare fish away from the origin
//  8 wake      – bodies push particles aside; pointer attracts, Shift scares
// 10 mood       – fish and particles alternate between friends and enemies (a slow tide,
//                phase-shifted per colour): friends escort and gather, enemies hunt and flee.
//  9 life cycle – fish swallow prey particles; after digesting they excrete each one at the
//                tail as another species (60-30-10 draw). Fish age and die (or starve) and dissolve
//                into particles; clustered same-species particles condense into new fish, keeping
//                the fish count around the target. Biomass (free particles + PER_FISH per fish +
//                stomach contents) is conserved.
import {wrappedDelta,SPECIES_PATTERN} from './simulation.js?v=1.43.0';
import {SPECIES_SHARE} from './color.js?v=1.43.0';
export const PER_FISH=4,STOMACH=3,MIN_FREE=40;
export const SIZE=1.15;
const TAU=Math.PI*2,clamp=(v,a,b)=>v<a?a:v>b?b:v;
export const KIND_LABELS={rectangle:['peixe','peixes']};
// One fish design, repeated: identical shape and size; only colour (60-30-10) and swim rhythm vary.
// One abstract design, repeated: a living line. Identical length and thickness; only colour and rhythm vary.
// One geometric design, repeated: a rigged rectangle (constant width, bends with the spine). Identical size; only colour and rhythm vary.
export const STYLES={
 rect:{name:'retângulo',weight:1,school:[6,9],n:10,spacing:3.4,width:3.4,speed:2.1,amp:.16,freq:.3,bend:.3,tail:'none',fin:0,pattern:'plain',schooling:1}
};
export function seededRandom(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function angleDelta(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b));}
export function fishProfile(t){return t<.22?.5+.5*Math.sin(t/.22*Math.PI/2):1-Math.pow((t-.22)/.78,1.4)*.82;}

// Visit particles within radius of (x,y) using the grid built by the last Simulation.step.
export function forEachNear(sim,x,y,radius,visit){
 const w=sim.width,h=sim.height,r2=radius*radius,px=((x%w)+w)%w,py=((y%h)+h)%h,X=sim.x,Y=sim.y;
 const cols=sim.gridCols,rows=sim.gridRows,starts=sim.cellStarts,order=sim.particleOrder;
 if(!sim.gridReady||!cols||!starts||starts.length!==cols*rows+1){
  for(let i=0;i<sim.count;i++){const dx=wrappedDelta(X[i]-px,w),dy=wrappedDelta(Y[i]-py,h),d2=dx*dx+dy*dy;if(d2<r2)visit(i,dx,dy,d2);}return;
 }
 const cw=w/cols,ch=h/rows,cx=Math.min(cols-1,Math.floor(px/cw)),cy=Math.min(rows-1,Math.floor(py/ch));
 const rx=Math.ceil(radius/cw)+1,ry=Math.ceil(radius/ch)+1;
 const x0=2*rx+1>=cols?0:cx-rx,x1=2*rx+1>=cols?cols-1:cx+rx,y0=2*ry+1>=rows?0:cy-ry,y1=2*ry+1>=rows?rows-1:cy+ry;
 const halfW=w/2,halfH=h/2;
 for(let gy=y0;gy<=y1;gy++){const row=((gy%rows)+rows)%rows*cols;
  for(let gx=x0;gx<=x1;gx++){const c=row+((gx%cols)+cols)%cols;
   for(let k=starts[c],end=starts[c+1];k<end;k++){const i=order[k];
    let dx=X[i]-px,dy=Y[i]-py;if(dx>halfW)dx-=w;else if(dx<-halfW)dx+=w;if(dy>halfH)dy-=h;else if(dy<-halfH)dy+=h;
    const d2=dx*dx+dy*dy;if(d2<r2)visit(i,dx,dy,d2);}}}
}

export function createFish(style,rng,x,y,heading,species,id){
 const S=STYLES[style]||STYLES.rect,scale=SIZE,n=S.n;
 const c={id,kind:'rectangle',style,species,diet:(species+1)%6,fear:(species+5)%6,energy:1,heading,wander:0,phase:rng()*TAU,vx:0,vy:0,speed:0,burst:0,bites:0,hunting:false,fleeing:false,age:0,lifespan:24000+Math.floor(rng()*30000),starve:0,stomach:[],dead:false,
  baseSpeed:S.speed*Math.exp(Math.log(.45)+rng()*Math.log(2/.45)),amp:S.amp,freq:S.freq*(.9+rng()*.2),turn:.09,maxBend:S.bend||.3,sense:150+S.width*8,schooling:S.schooling,tail:S.tail,fin:S.fin,pattern:S.pattern,spacing:S.spacing*scale};
 c.x=new Float64Array(n);c.y=new Float64Array(n);c.widths=new Float32Array(n);
 const maxW=S.width*scale;c.x[0]=x;c.y[0]=y;
 for(let i=0;i<n;i++){c.widths[i]=maxW*fishProfile(i/(n-1));if(i){c.x[i]=c.x[i-1]-Math.cos(heading)*c.spacing;c.y[i]=c.y[i-1]-Math.sin(heading)*c.spacing;}}
 c.length=n*c.spacing;c.size=maxW*c.length;
 return c;
}

function shift(c,dx,dy){for(let i=0;i<c.x.length;i++){c.x[i]+=dx;c.y[i]+=dy;}}

export class Creatures {
 constructor(seed=7){this.enabled=true;this.target=30;this.wake=true;this.moodEnabled=true;this.moodPeriod=45;this.list=[];this.nextId=1;this.reseed(seed);}
 reseed(seed){this.seed=seed>>>0;this.rng=seededRandom(this.seed);this.list=[];this.started=false;this.time=Math.round(this.moodPeriod*60*.42);this.bites=0;this.escapes=0;this.births=0;this.deaths=0;this.events=[];this.excreted=0;this.tick=0;}
 configure(o){if(!o)return;if(o.enabled!==undefined)this.enabled=!!o.enabled;if(o.count!==undefined)this.target=clamp(Math.round(Number(o.count)||0),0,60);if(o.wake!==undefined)this.wake=!!o.wake;if(o.mood!==undefined)this.moodEnabled=!!o.mood;if(o.moodPeriod!==undefined)this.moodPeriod=clamp(Number(o.moodPeriod)||45,10,300);}
 // Rule 10: +1 friends, −1 enemies. A tide with plateaus (tanh), shifted 0.5 rad per colour. Off = always enemies.
 mood(species){if(!this.moodEnabled)return -1;return Math.tanh(3*Math.sin(this.time/(this.moodPeriod*60)*Math.PI*2+species*.5));}
 // Particles of one species condense into a fish: the PER_FISH nearest to a seed are removed.
 condense(sim,seed,radius){
  const species=sim.type[seed],near=[];
  forEachNear(sim,sim.x[seed],sim.y[seed],radius,(i,dx,dy,d2)=>{if(sim.type[i]===species&&!this.removed.has(i))near.push([d2,i,dx,dy]);});
  if(near.length<PER_FISH||sim.count-this.removed.size-PER_FISH<MIN_FREE)return null;
  near.sort((a,b)=>a[0]-b[0]);let cx=0,cy=0,vx=0,vy=0;
  for(const [,i,dx,dy] of near.slice(0,PER_FISH)){this.removed.add(i);cx+=dx;cy+=dy;vx+=sim.vx[i];vy+=sim.vy[i];}
  const heading=Math.hypot(vx,vy)>.01?Math.atan2(vy,vx):this.rng()*TAU;
  const f=createFish('rect',this.rng,sim.x[seed]+cx/PER_FISH,sim.y[seed]+cy/PER_FISH,heading,species,this.nextId++);
  if(f.x[0]<0)shift(f,sim.width,0);else if(f.x[0]>=sim.width)shift(f,-sim.width,0);if(f.y[0]<0)shift(f,0,sim.height);else if(f.y[0]>=sim.height)shift(f,0,-sim.height);
  this.list.push(f);return f;
 }
 randomFree(sim){for(let k=0;k<8;k++){const i=Math.floor(this.rng()*sim.count);if(!this.removed.has(i))return i;}return -1;}
 // Excrement becomes another species, drawn with the 60-30-10 shares (never the one eaten).
 excrementType(eaten){let total=0;for(let t=0;t<6;t++)if(t!==eaten)total+=SPECIES_SHARE[t];let r=this.rng()*total;for(let t=0;t<6;t++){if(t===eaten)continue;if((r-=SPECIES_SHARE[t])<=0)return t;}return (eaten+1)%6;}
 excrete(c,item){const n=c.x.length,tx=c.x[n-1]-c.x[n-2],ty=c.y[n-1]-c.y[n-2],l=Math.hypot(tx,ty)||1;this.added.push({x:c.x[n-1]+tx/l*3,y:c.y[n-1]+ty/l*3,vx:tx/l*1.3+c.vx*.3,vy:ty/l*1.3+c.vy*.3,type:this.excrementType(item.type),energy:.7,stage:0});this.excreted++;}
 dissolve(c){
  if(c.dead)(this.events||(this.events=[])).push({kind:'death',x:c.x[Math.floor(c.x.length/2)],y:c.y[Math.floor(c.y.length/2)],species:c.species});
  const n=c.x.length;for(let k=0;k<PER_FISH;k++){const i=Math.min(n-1,Math.round(k*(n-1)/(PER_FISH-1))),a=this.rng()*TAU,v=.6+this.rng()*1.2;this.added.push({x:c.x[i],y:c.y[i],vx:Math.cos(a)*v+c.vx*.4,vy:Math.sin(a)*v+c.vy*.4,type:c.species,energy:1.4,stage:.5});}
  for(const item of c.stomach)this.excrete(c,item);c.stomach=[];this.deaths++;
 }
 step(sim,pointer=null){
  this.removed=new Set();this.added=[];
  if(!this.enabled){if(this.list.length){for(const c of this.list)this.dissolve(c);this.list=[];this.started=false;}this.apply(sim);return;}
  if(!this.started){this.started=true;for(let k=0;k<this.target*8&&this.list.length<this.target;k++){const seed=this.randomFree(sim);if(seed>=0)this.condense(sim,seed,220);}}
  this.time++;
  for(const c of this.list)this.update(c,sim,pointer);
  this.lifeCycle(sim);this.apply(sim);
 }
 lifeCycle(sim){
  this.tick++;
  // More fish than the target: the oldest ones live out a short remaining time.
  if(this.list.length>this.target){const extra=this.list.length-this.target;[...this.list].sort((a,b)=>b.age-a.age).slice(0,extra).forEach(c=>{c.lifespan=Math.min(c.lifespan,c.age+180);});}
  for(const c of this.list)if(c.dead)this.dissolve(c);
  this.list=this.list.filter(c=>!c.dead);
  if(this.tick%15===0&&this.list.length<this.target){const deficit=this.target-this.list.length,chance=Math.min(1,.25+deficit/Math.max(1,this.target));
   for(let k=0;k<Math.min(3,deficit);k++){if(this.rng()>chance)continue;const seed=this.randomFree(sim);if(seed>=0&&this.condense(sim,seed,30)){this.births++;const c=this.list.at(-1);(this.events||(this.events=[])).push({kind:'birth',x:c.x[0],y:c.y[0],species:c.species});}}}
 }
 apply(sim){if(this.removed.size||this.added.length)sim.rebuild(this.removed,this.added);this.removed=new Set();this.added=[];}
 resize(oldW,oldH,w,h){for(const c of this.list){shiftFish(c,c.x[0]/oldW*w-c.x[0],c.y[0]/oldH*h-c.y[0],false);}}
 // Rule 7: a disturbance pulse scares every fish inside its radius.
 // Big bang: dashes are born in the core and thrown out with the blast (before regular swimming starts).
 blast(sim){
  if(!this.enabled)return;this.removed=new Set();this.added=[];this.started=true;const cx=sim.width/2,cy=sim.height/2,speed=Math.min(sim.width,sim.height)*.018;
  for(let k=0;k<this.target*8&&this.list.length<this.target;k++){const seed=this.randomFree(sim);if(seed>=0)this.condense(sim,seed,220);}
  for(const c of this.list){const a=this.rng()*TAU;c.heading=a;c.blastV=speed*2.1*(.2+.8*Math.pow(this.rng(),1.6));c.blastDrag=.035+this.rng()*.06;c.burst=40;
   // Lay the body out straight along the launch direction, centred on the core.
   for(let i=0;i<c.x.length;i++){c.x[i]=cx-Math.cos(a)*c.spacing*i;c.y[i]=cy-Math.sin(a)*c.spacing*i;}}
  this.apply(sim);
 }
 drift(sim,dt=1){const W=sim.width,H=sim.height;for(const c of this.list){const v=c.blastV||0;if(v<.05)continue;const dx=Math.cos(c.heading)*v*dt,dy=Math.sin(c.heading)*v*dt;
  for(let i=0;i<c.x.length;i++){c.x[i]+=dx;c.y[i]+=dy;}if(c.x[0]<0||c.x[0]>=W||c.y[0]<0||c.y[0]>=H){const sx=c.x[0]<0?W:c.x[0]>=W?-W:0,sy=c.y[0]<0?H:c.y[0]>=H?-H:0;for(let i=0;i<c.x.length;i++){c.x[i]+=sx;c.y[i]+=sy;}}
  c.blastV=v*Math.exp(-(c.blastDrag||.055)*dt);}}
 scare(x,y,radius,w,h){for(const c of this.list){const dx=wrappedDelta(c.x[0]-x,w),dy=wrappedDelta(c.y[0]-y,h),d=Math.hypot(dx,dy);if(d<radius){c.burst=Math.max(c.burst,25+35*(1-d/radius));c.heading=Math.atan2(dy,dx)+(this.rng()-.5)*.6;c.fleeing=true;this.escapes++;}}}
 update(c,sim,pointer){
  // An assembled fish keeps its identity, stomach and lifetime, but its spine is posed
  // by the organism rather than swimming or eating its own particle body.
  if(c.attachment){
   c.age++;c.energy=Math.max(.25,c.energy-.0003);c.hunting=false;c.fleeing=false;
   for(const item of c.stomach)item.timer--;
   const done=c.stomach.filter(item=>item.timer<=0);c.stomach=c.stomach.filter(item=>item.timer>0);
   if(this.added)for(const item of done)this.excrete(c,item);
   if(c.age>=c.lifespan)c.dead=true;
   return;
  }
  if(c.release){
   const r=c.release;r.age++;r.vx??=Math.cos(c.heading)*.8;r.vy??=Math.sin(c.heading)*.8;
   const ease=Math.min(1,r.age/12);
   stepSoftStrand(c,[c.x[0]+r.vx*ease,c.y[0]+r.vy*ease],[r.vx*ease,r.vy*ease],r.age,sim.width,sim.height);
   c.heading=Math.atan2(r.vy,r.vx);c.age++;c.energy=Math.max(.25,c.energy-.0003);c.hunting=false;
   // Released parts drift in place first; no school, memory or body target can pull them back.
   for(const item of c.stomach)item.timer--;
   const done=c.stomach.filter(item=>item.timer<=0);c.stomach=c.stomach.filter(item=>item.timer>0);if(this.added)for(const item of done)this.excrete(c,item);
   if(c.age>=c.lifespan)c.dead=true;
   if(r.age>=60){c.release=null;c.softStrand=null;}
   return;
  }
  this.swim(c,sim,pointer);
 }
 swim(c,sim,pointer){
  const w=sim.width,h=sim.height,rng=this.rng,hx=c.x[0],hy=c.y[0],cos=Math.cos(c.heading),sin=Math.sin(c.heading);
  const look=c.widths[0]*2+10,sx=hx+cos*look,sy=hy+sin*look,sense=c.sense,R=sim.matrix[c.species]||[0,0,0,0,0,0],type=sim.type,energy=sim.energy,pvx=sim.vx,pvy=sim.vy;
  // One neighbourhood pass gathers rules 1–4.
  let preyX=0,preyY=0,preyW=0,compX=0,compY=0,compW=0,affX=0,affY=0,fearX=0,fearY=0,fearW=0,flowX=0,flowY=0,flowW=0;
  const diet=c.diet,fear=c.fear,near=sense*.45,offX=sx-hx,offY=sy-hy;
  forEachNear(sim,sx,sy,sense,(i,dx,dy,d2)=>{
   const d=Math.sqrt(d2)+1e-6,fall=1-d/sense,t=type[i];
   if(t===diet){const k=(energy[i]-.25)*fall;if(k>0){preyX+=dx*k;preyY+=dy*k;preyW+=k;}}
   else if(t===fear){const ex=dx+offX,ey=dy+offY,e=Math.hypot(ex,ey)+1e-6;if(e<near){const k=1-e/near;fearX-=ex/e*k;fearY-=ey/e*k;fearW+=k;}}
   const a=R[t]*fall;affX+=dx/d*a;affY+=dy/d*a;compX+=dx*fall;compY+=dy*fall;compW+=fall;
   if(d<near){flowX+=pvx[i];flowY+=pvy[i];flowW++;}
  });
  c.wander=clamp(c.wander*.95+(rng()-.5)*.14,-.6,.6);
  const hunger=clamp(1.7-c.energy,.15,1.2);
  let dx=Math.cos(c.heading+c.wander*.8),dy=Math.sin(c.heading+c.wander*.8);
  const mood=c.mood=this.mood(c.species),hostile=Math.max(0,-mood),friendly=Math.max(0,mood);
  c.hunting=mood<-.2&&preyW>.6&&c.energy<1.45;
  // Friends seek company: steer toward the particle crowd.
  if(friendly>.05&&compW>.5){const tx=sx+compX/compW-hx,ty=sy+compY/compW-hy,l=Math.hypot(tx,ty)||1;dx+=tx/l*.9*friendly;dy+=ty/l*.9*friendly;}
  if(c.hunting){const tx=sx+preyX/preyW-hx,ty=sy+preyY/preyW-hy,l=Math.hypot(tx,ty)||1;dx+=tx/l*1.4*hunger;dy+=ty/l*1.4*hunger;}
  const affL=Math.hypot(affX,affY);if(affL>.01){dx+=affX/affL*.45*Math.min(1,affL/4);dy+=affY/affL*.45*Math.min(1,affL/4);}
  let afraid=false;
  if(fearW>2&&hostile>.05){const l=Math.hypot(fearX,fearY)||1,k=Math.min(2.2,fearW*.25)*hostile;dx+=fearX/l*k;dy+=fearY/l*k;afraid=true;}
  // Rules 5–6: schooling with same species, escape from bigger fish whose diet is our colour.
  let cohX=0,cohY=0,aliX=0,aliY=0,mates=0;
  for(const o of this.list){
   if(o===c)continue;const ox=wrappedDelta(o.x[0]-hx,w),oy=wrappedDelta(o.y[0]-hy,h),d=Math.hypot(ox,oy);if(d<.001)continue;
   if(o.diet===c.species&&d<200){const k=2.4*(1-d/200);dx-=ox/d*k;dy-=oy/d*k;afraid=true;if(d<110&&c.burst<=0){c.burst=30;this.escapes++;}}
   const personal=(c.length+o.length)*.3+8;
   if(d<personal){const k=2.6*(1-d/personal);dx-=ox/d*k;dy-=oy/d*k;}
   if(o.species===c.species&&o.style===c.style&&d<170){cohX+=ox;cohY+=oy;aliX+=Math.cos(o.heading);aliY+=Math.sin(o.heading);mates++;}
  }
  if(mates&&c.schooling>0){const k=c.schooling*(c.hunting?.4:1),cl=Math.hypot(cohX,cohY)||1,al=Math.hypot(aliX,aliY)||1;dx+=cohX/cl*.45*k+aliX/al*.7*k;dy+=cohY/cl*.45*k+aliY/al*.7*k;}
  if(pointer?.force){const px=wrappedDelta(pointer.x-hx,w),py=wrappedDelta(pointer.y-hy,h),d=Math.hypot(px,py);if(d<320&&d>.001){const k=(pointer.force<0?-2.2:1.4)*(1-d/320);dx+=px/d*k;dy+=py/d*k;if(pointer.force<0&&d<160&&c.burst<=0){c.burst=25;this.escapes++;}}}
  c.fleeing=afraid||c.burst>0;
  const turn=c.turn*(c.fleeing?2:c.hunting?1.4:1);c.heading+=clamp(angleDelta(Math.atan2(dy,dx),c.heading),-turn,turn);
  // Locomotion: tail-beat oscillation, burst-and-coast escapes, drift with the current (rule 4).
  const vigor=.62+.38*Math.min(1.6,c.energy);c.burst=Math.max(0,c.burst-1);
  const burst=c.burst>0?1+.9*Math.min(1,c.burst/15):1;
  c.phase+=c.freq*(c.hunting?1.3:1)*burst;
  const behavior=c.behavior;
  if(behavior){const dx=behavior.steerX,dy=behavior.steerY;if(Math.hypot(dx,dy)>.0001){const desired=Math.atan2(dy,dx);c.heading+=angleDelta(desired,c.heading)*.035;}}
  c.speed=c.baseSpeed*vigor*(c.hunting?1.15:1)*burst*(behavior?.activity??1)*(behavior?.speed??1);
  const move=c.heading+Math.sin(c.phase)*c.amp/burst;
  const fx=flowW?flowX/flowW*.35:0,fy=flowW?flowY/flowW*.35:0;
  c.vx=Math.cos(move)*c.speed+fx;c.vy=Math.sin(move)*c.speed+fy;c.x[0]+=c.vx;c.y[0]+=c.vy;
  if(c.x[0]<0)shift(c,w,0);else if(c.x[0]>=w)shift(c,-w,0);
  if(c.y[0]<0)shift(c,0,h);else if(c.y[0]>=h)shift(c,0,-h);
  for(let i=1;i<c.x.length;i++){
   let a=Math.atan2(c.y[i]-c.y[i-1],c.x[i]-c.x[i-1]);
   const ref=i===1?c.heading+Math.PI:Math.atan2(c.y[i-1]-c.y[i-2],c.x[i-1]-c.x[i-2]),diff=angleDelta(a,ref);
   if(Math.abs(diff)>c.maxBend)a=ref+Math.sign(diff)*c.maxBend;
   c.x[i]=c.x[i-1]+Math.cos(a)*c.spacing;c.y[i]=c.y[i-1]+Math.sin(a)*c.spacing;
  }
  this.interact(c,sim);
  c.energy=Math.max(.25,c.energy-.0007*burst);
  // Digestion, aging, starvation.
  if(c.stomach.length){for(const item of c.stomach)item.timer--;const done=c.stomach.filter(item=>item.timer<=0);if(done.length){c.stomach=c.stomach.filter(item=>item.timer>0);if(this.added)for(const item of done)this.excrete(c,item);}}
  c.age++;c.starve=c.energy<=.2501?c.starve+1:0;if(c.age>=c.lifespan||c.starve>2400)c.dead=true;
 }
 // Rule 1 bite (energy transfer only) and rule 8 wake.
 interact(c,sim){
  if(!sim.count)return;
  const head=c.widths[0],mx=c.x[0]+Math.cos(c.heading)*(head+2),my=c.y[0]+Math.sin(c.heading)*(head+2);
  const type=sim.type,cooldown=sim.feedCooldown;
  forEachNear(sim,mx,my,head*1.4+6,i=>{
   if(c.mood>-.2||type[i]!==c.diet||c.stomach.length>=STOMACH||this.removed?.has(i)||(cooldown&&cooldown[i]>0))return;
   this.removed?.add(i);c.stomach.push({type:type[i],timer:150+Math.floor(this.rng()*150)});c.energy=Math.min(2,c.energy+.3);c.bites++;this.bites++;
  });
  // Particles answer the mood: friends gather on a ring and escort, enemies (prey colour most) flee.
  {const vx=sim.vx,vy=sim.vy,mob=sim.mobility,m=c.mood??-1,R=c.length*1.4+40,ring=c.length*.7+12,mx2=c.x[Math.floor(c.x.length/2)],my2=c.y[Math.floor(c.x.length/2)];
   forEachNear(sim,mx2,my2,R,(j,dx,dy,d2)=>{
    const d=Math.sqrt(d2);if(d<.01)return;const k=1-d/R;
    if(m>0){const pull=Math.max(-1,Math.min(1,(d-ring)/ring))*.22*m*k;vx[j]-=dx/d*pull;vy[j]-=dy/d*pull;vx[j]+=(c.vx-vx[j])*.04*m*k;vy[j]+=(c.vy-vy[j])*.04*m*k;}
    else{const flee=(type[j]===c.diet?.7:.18)*-m*k;vx[j]+=dx/d*flee;vy[j]+=dy/d*flee;}
    const cap=5*(mob?mob[j]:1),sp=vx[j]*vx[j]+vy[j]*vy[j];if(sp>cap*cap){const f=cap/Math.sqrt(sp);vx[j]*=f;vy[j]*=f;}
   });}
  if(!this.wake)return;
  const vx=sim.vx,vy=sim.vy,mob=sim.mobility,fat=.85+.15*Math.min(2,c.energy),step=c.x.length>12?2:1;
  for(let s=0;s<c.x.length;s+=step){
   const R=c.widths[s]*fat+8;
   forEachNear(sim,c.x[s],c.y[s],R,(j,dx,dy,d2)=>{
    const d=Math.sqrt(d2);if(d<.01)return;const k=(1-d/R),push=k*1.1;
    vx[j]+=dx/d*push+c.vx*.12*k;vy[j]+=dy/d*push+c.vy*.12*k;
    const cap=5*(mob?mob[j]:1),sp=vx[j]*vx[j]+vy[j]*vy[j];if(sp>cap*cap){const f=cap/Math.sqrt(sp);vx[j]*=f;vy[j]*=f;}
   });
  }
 }
 stats(){const styles={};let stomach=0;for(const c of this.list){styles[c.style]=(styles[c.style]||0)+1;stomach+=c.stomach.length;}return {fish:this.list.length,total:this.list.length,styles,bites:this.bites,births:this.births,deaths:this.deaths,mood:this.list.length?this.list.reduce((p,c)=>p+(c.mood??-1),0)/this.list.length:this.mood(0),friends:this.list.filter(c=>(c.mood??-1)>0).length,excreted:this.excreted,stomach,escapes:this.escapes,fleeing:this.list.filter(c=>c.fleeing).length,hunting:this.list.filter(c=>c.hunting).length};}
 serialize(){
  return this.list.map(c=>{
   const n=c.x.length,points=new Float32Array(n*2);for(let i=0;i<n;i++){points[i*2]=c.x[i];points[i*2+1]=c.y[i];}
   const b=c.attachment?c.organism:c.behavior;
   return {id:c.id,maturity:b?.maturity??0,personality:b?.name,resting:!!b?.resting,gaze:b?.gaze,role:c.attachment?.role,stretch:c.attachment?.role==='leg'?(c.legStretch||1):1,kind:'rectangle',style:c.style,species:c.species,energy:c.energy,phase:c.phase,heading:c.heading,hunting:c.hunting,fleeing:c.fleeing,burst:c.burst,points,widths:c.widths,tail:c.tail,fin:c.fin,pattern:c.pattern,life:Math.min(1,c.age/60),mood:c.mood??-1,stomach:c.stomach.map(item=>item.type)};
  });
 }
}
