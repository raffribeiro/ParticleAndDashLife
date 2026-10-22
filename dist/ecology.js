import {featureLevel} from './features.js?v=1.25.1';
import {ensureNeeds,nourish,metabolize,damageFactor} from './needs.js?v=1.25.1';
import {ensureTraits} from './traits.js?v=1.25.1';
import {wrappedDelta,VALENCE} from './simulation.js?v=1.25.1';
const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const NAMES=['curioso','tímido','territorial','sociável'];
export function personalityFor(id){const h=((id+1)*2654435761)>>>0;return {name:NAMES[h%4],speed:.75+(h%101)/200,curiosity:(h%4)===1?-.85:.4+(h%31)/50};}
export class Ecology{
 constructor(){this.time=0;this.patches=[];this.bridges=[];}
 reset(){this.time=0;this.patches=[];this.bridges=[];}
 ensure(a,fish=false){if(!fish)ensureTraits(a);if(!a.behavior){const p=personalityFor(a.id);a.behavior={...p,activity:1,restUntil:0,nextRest:this.time+480+(a.id%7)*90,resting:false,attention:0,steerX:0,steerY:0,maturity:0,gaze:a.heading||0};}return a.behavior;}
 hunt(a,sim,fish,animals,walkers){
  const b=a.behavior;b.hunting=false;
  const traits=ensureTraits(a);if(!a.body||b.resting||traits.hunt<.5)return;
  const mean=a.members.reduce((n,i)=>n+sim.energy[i],0)/a.members.length;if(mean>1.35&&ensureNeeds(a).hunger<.35)return;
  const W=sim.width,H=sim.height,diet=(sim.type[a.members[0]]+1)%6;let prey=null,best=160+traits.hunt*120;
  for(const c of fish){if(c.dead||c.attachment||c.species!==diet)continue;const dx=wrappedDelta(c.x[0]-a.body.x,W),dy=wrappedDelta(c.y[0]-a.body.y,H),d=Math.hypot(dx,dy);if(d<best){best=d;prey={fish:c,dx,dy};}}
  for(const other of animals){if(other===a||!other.body||other.clan&&other.clan===a.clan||sim.type[other.members[0]]!==diet)continue;const dx=wrappedDelta(other.body.x-a.body.x,W),dy=wrappedDelta(other.body.y-a.body.y,H),d=Math.hypot(dx,dy);if(d<best){best=d;prey={animal:other,dx,dy};}}
  if(!prey)return;b.hunting=true;b.gaze=Math.atan2(prey.dy,prey.dx);b.steerX+=prey.dx/(best||1)*(.035+traits.hunt*.045);b.steerY+=prey.dy/(best||1)*(.035+traits.hunt*.045);
  for(const i of a.members)sim.energy[i]=Math.max(.3,sim.energy[i]-.0003);
  if(prey.fish){const c=prey.fish;c.heading=Math.atan2(prey.dy,prey.dx);c.burst=Math.max(c.burst,12);}
  if(best>24*(1+(a.growth||0)*.3)||this.time<(a.nextBite||0))return;
  a.nextBite=this.time+Math.round(150-traits.hunt*65);let gained=0;
  if(prey.fish){const c=prey.fish,capacity=a.members.reduce((n,i)=>n+Math.max(0,2-sim.energy[i]),0);gained=Math.min(.35+traits.hunt*.25+(a.growth||0)*.2,Math.max(0,c.energy-.2),capacity);c.energy-=gained;if(c.energy<=.3)c.dead=true;}
  else{const other=prey.animal;for(const i of other.members){const amount=Math.min(.12+traits.hunt*.12+(a.growth||0)*.08+featureLevel(a,'muscle')*.025,Math.max(0,sim.energy[i]-.2))*damageFactor(other);sim.energy[i]-=amount;gained+=amount;}
   const victim=ensureNeeds(other);victim.health=Math.max(0,victim.health-gained/other.members.length*.3);
   const remaining=other.members.reduce((n,i)=>n+sim.energy[i],0)/other.members.length;
   if(remaining<.3){const members=new Set(other.members);sim.bonds=sim.bonds.filter(pair=>{if(members.has(pair[0])&&members.has(pair[1])){sim.dropBond(pair);return false;}return true;});other.cohesion=0;}
  }
  for(const i of a.members)sim.energy[i]=Math.min(2,sim.energy[i]+gained/a.members.length);
  if(gained>.01){a.fertility=Math.min(2,(a.fertility||0)+gained*.6);nourish(a,gained/a.members.length*.9);}
  if(gained>.01)walkers?.events.push({kind:'contest',x:a.body.x+prey.dx,y:a.body.y+prey.dy,species:sim.type[a.members[0]]});
 }
 step(sim,fish,animals,cursor,dt=1,walkers=null){
  this.time+=dt;const W=sim.width,H=sim.height,t=this.time/60;
  this.patches=Array.from({length:3},(_,k)=>({x:(.18+k*.31+.04*Math.sin(t*.035+k))*W,y:(.5+.27*Math.sin(k*2+t*.022))*H,radius:Math.max(70,Math.min(W,H)*.18),species:k*2}));
  for(let i=0;i<sim.count;i++){
   let food=0,fx=0,fy=0;
   for(const p of this.patches){const dx=wrappedDelta(sim.x[i]-p.x,W),dy=wrappedDelta(sim.y[i]-p.y,H),d=Math.hypot(dx,dy),q=Math.max(0,1-d/p.radius);food+=q*q;fx-=dy/(d||1)*q*.004;fy+=dx/(d||1)*q*.004;}
   sim.energy[i]=Math.min(2,sim.energy[i]+food*.0015*dt);sim.vx[i]+=fx*dt;sim.vy[i]+=fy*dt;
  }
  const peers=new Map(fish.map(c=>[c.id,c]));
  for(const a of [...fish,...animals]){
   const isFish=!!a.x,b=this.ensure(a,isFish),x=isFish?a.x[0]:(a.body?.x??sim.x[a.members[0]]),y=isFish?a.y[0]:(a.body?.y??sim.y[a.members[0]]);
   b.steerX=0;b.steerY=0;b.fleeing=false;b.attention=Math.max(0,b.attention-dt);b.maturity=clamp((a.age||0)/(isFish?(a.lifespan||3000):3600),0,1);
   let px=0,py=0,d=Infinity;if(cursor){px=wrappedDelta(cursor.x-x,W);py=wrappedDelta(cursor.y-y,H);d=Math.hypot(px,py);}
   if(d>=160){const angle=(a.heading||0)-b.gaze;b.gaze+=Math.atan2(Math.sin(angle),Math.cos(angle))*.1;}
   if(d<160){b.gaze=Math.atan2(py,px);b.attention+=dt*2;b.restUntil=0;}
   if(this.time>=b.nextRest&&d>=160){b.restUntil=this.time+120+(a.id%4)*45;b.nextRest=this.time+600+(a.id%7)*90;}
   const alarm=isFish&&(a.fleeing||a.burst>0);if(alarm)b.restUntil=0;
   const threatened=d<160&&(b.name==='tímido'||cursor?.force<0);b.resting=this.time<b.restUntil&&!threatened&&d>=160;
   const target=b.resting?.12:1;b.activity+=(target-b.activity)*(1-Math.exp(-dt*.06));
   if(d<160&&(threatened||b.attention>20)){const direction=threatened?-1:b.curiosity;b.steerX+=px/(d||1)*direction*.04;b.steerY+=py/(d||1)*direction*.04;}
   if(isFish){
    a.reunionDelay=Math.max(0,(a.reunionDelay||0)-dt);
    if(a.memory){a.memory.ticks-=dt;if(a.memory.ticks<=0)a.memory=null;else if(!a.attachment&&!a.release&&!a.reunionDelay){
     const friends=a.memory.partners.map(id=>peers.get(id)).filter(c=>c&&!c.dead);
     for(const c of friends.slice(0,4)){const dx=wrappedDelta(c.x[0]-x,W),dy=wrappedDelta(c.y[0]-y,H),length=Math.hypot(dx,dy);if(length>25&&length<200){b.steerX+=dx/length*.008;b.steerY+=dy/length*.008;}}
    }}
    if(a.energy<.8){const p=this.patches[(a.species||0)%3],dx=wrappedDelta(p.x-x,W),dy=wrappedDelta(p.y-y,H),length=Math.hypot(dx,dy)||1;b.steerX+=dx/length*.016;b.steerY+=dy/length*.016;}
   }else{
    let nourishment=0;for(const p of this.patches){const distance=Math.hypot(wrappedDelta(p.x-x,W),wrappedDelta(p.y-y,H));nourishment+=Math.max(0,1-distance/p.radius);}
    a.fertility=Math.min(2,(a.fertility||0)+nourishment*.0015*dt);
    const needs=metabolize(a,nourishment*.0022,dt);
    if(needs.hunger>.55){b.restUntil=0;b.resting=false;b.activity=Math.max(b.activity,1);}
    if(needs.health<.15)a.cohesion=Math.max(0,a.cohesion-.015*dt);
    let energy=0;for(const i of a.members)energy+=sim.energy[i];if(energy/a.members.length<.9||needs.hunger>.35){const p=this.patches.reduce((best,p)=>Math.hypot(wrappedDelta(p.x-x,W),wrappedDelta(p.y-y,H))<Math.hypot(wrappedDelta(best.x-x,W),wrappedDelta(best.y-y,H))?p:best),dx=wrappedDelta(p.x-x,W),dy=wrappedDelta(p.y-y,H),length=Math.hypot(dx,dy)||1;b.steerX+=dx/length*(.014+needs.hunger*.035);b.steerY+=dy/length*(.014+needs.hunger*.035);}
    for(const other of animals){if(other===a||!other.body)continue;const dx=wrappedDelta(other.body.x-x,W),dy=wrappedDelta(other.body.y-y,H),length=Math.hypot(dx,dy)||1;
     if(length<140){const friendly=b.name==='sociável'||a.clan&&a.clan===other.clan,force=friendly?(length>45?.012:-.008):-.018;b.steerX+=dx/length*force;b.steerY+=dy/length*force;}
    }
    const traits=ensureTraits(a);b.profile=traits.hunt>=.5?'caçador':'evasivo';
    if(traits.escape>.5)for(const predator of animals){if(predator===a||!predator.body||ensureTraits(predator).hunt<.5)continue;
     const dx=wrappedDelta(predator.body.x-x,W),dy=wrappedDelta(predator.body.y-y,H),distance=Math.hypot(dx,dy)||1;
     if(distance<150+traits.escape*80){b.steerX-=dx/distance*.075*traits.escape;b.steerY-=dy/distance*.075*traits.escape;b.restUntil=0;b.resting=false;b.activity=Math.max(b.activity,1.2);b.fleeing=true;}
    }
    this.hunt(a,sim,fish,animals,walkers);
    for(const i of a.members){sim.vx[i]+=b.steerX*dt;sim.vy[i]+=b.steerY*dt;if(b.resting){sim.vx[i]*=Math.exp(-dt*.035);sim.vy[i]*=Math.exp(-dt*.035);}}
   }
  }
  // A territorial neighbour can challenge a limb; ownership changes only through release.
  if(walkers&&this.time%180<dt)for(const a of animals){if(a.behavior?.name!=='territorial'||!a.body)continue;
   for(const c of fish){if(!c.attachment||c.attachment.walker===a.id||c.release||(c.contestUntil||0)>this.time)continue;
    const owner=animals.find(w=>w.id===c.attachment.walker);if(!owner?.body)continue;
    const d=Math.hypot(wrappedDelta(c.x[0]-a.body.x,W),wrappedDelta(c.y[0]-a.body.y,H)),old=Math.hypot(wrappedDelta(c.x[0]-owner.body.x,W),wrappedDelta(c.y[0]-owner.body.y,H));
    if(d<35&&d<old*.65){walkers.releaseFish(c);c.contestUntil=this.time+900;walkers.events.push({kind:'contest',x:c.x[0],y:c.y[0],species:c.species});break;}
   }
  }
  // Organisms never fuse: separate bodies fight instead (fusion bridges removed).
 }
}
