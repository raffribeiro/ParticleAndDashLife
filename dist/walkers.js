import {stepSoftStrand} from './soft-strand.js?v=1.39.2';
import {featureLevel} from './features.js?v=1.39.2';
import {factionOf,FACTION_OF} from './combat.js?v=1.39.2';
// Walkers: bonded particle clusters that grow line legs and walk.
// Every FORM_EVERY steps, connected bond components of ≥3 particles may become walkers.
// Legs hang from the cluster's outer particles (2-bone IK), step in alternating groups,
// and push the cluster during each stride. Anatomy fades as its connected body falls apart.
import {wrappedDelta,VALENCE} from './simulation.js?v=1.39.2';
const TAU=Math.PI*2,clamp=(v,a,b)=>v<a?a:v>b?b:v;
// Size sets the general speed (small = fast, big = slow); the pace gene adds individual variation on top.
export const sizePace=n=>Math.max(.3,Math.min(1.3,Math.pow(4/Math.max(1,n),.65)));
// Body-plan shape and swim/walk character.
export const PLAN_LENGTH={lizard:1,spider:.75,centipede:1.6,snake:1.8,jelly:.85},PLAN_CRUISE={lizard:1,spider:1.15,centipede:1,snake:1.1,jelly:.9};
export const planAt=(w,u)=>{const P=w.parts||[w.plan,w.plan];return u<.5?P[0]:P[1];};
// Cruise factor; jellyfish parts swim in pulses (a half-jelly hybrid lurches at half the pulse depth).
export const planCruise=w=>{const P=w.parts||[w.plan,w.plan],base=((PLAN_CRUISE[P[0]]??1)+(PLAN_CRUISE[P[1]]??1))/2,j=(P[0]==='jelly')+(P[1]==='jelly');
 if(!j)return base;const pulse=Math.max(0,Math.sin(w.phase*2.2-.6))*2;return base*(j===2?pulse:.5+.5*pulse);};
export const PLAN_NAMES={lizard:'lagartos',spider:'aranhas',centipede:'centopeias',snake:'serpentes',jelly:'águas-vivas'};
export const FORM_EVERY=90,MAX_LEGS=6;
// Upkeep: every circle of a body pays UPKEEP·n energy per step (total ∝ n²). Particles recover ~0.0005/step,
// so bodies above ~12 circles need food. Starving bodies (mean energy < 0.6 for 3 s) break into smaller pieces.
export const UPKEEP=.00004,STARVE_LEVEL=.6,STARVE_STEPS=180;
export function solveKnee(hx,hy,fx,fy,upper,lower,bend){
 let dx=fx-hx,dy=fy-hy,d=Math.hypot(dx,dy);if(d<1e-6){dx=1;dy=0;d=1e-6;}
 const reach=clamp(d,Math.abs(upper-lower)+1e-4,upper+lower-1e-4),a=Math.acos(clamp((upper*upper+reach*reach-lower*lower)/(2*upper*reach),-1,1)),base=Math.atan2(dy,dx)+a*bend;
 return [hx+Math.cos(base)*upper,hy+Math.sin(base)*upper];
}
// Connected components of the bond graph (union-find).
export function components(n,bonds){
 const parent=new Int32Array(n);for(let i=0;i<n;i++)parent[i]=i;
 const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 for(const [a,b] of bonds)if(a<n&&b<n){const ra=find(a),rb=find(b);if(ra!==rb)parent[ra]=rb;}
 const groups=new Map();for(const [a,b] of bonds)for(const i of [a,b])if(i<n){const r=find(i);if(!groups.has(r))groups.set(r,new Set());groups.get(r).add(i);}
 return [...groups.values()].map(s=>[...s]);
}
// Components restricted to a member list (no allocation proportional to the whole population).
export function localComponents(members,edges){
 const parent=new Map(members.map(i=>[i,i]));const find=i=>{while(parent.get(i)!==i){parent.set(i,parent.get(parent.get(i)));i=parent.get(i);}return i;};
 for(const [a,b] of edges){if(!parent.has(a)||!parent.has(b))continue;const ra=find(a),rb=find(b);if(ra!==rb)parent.set(ra,rb);}
 const groups=new Map();for(const [a,b] of edges)for(const i of [a,b])if(parent.has(i)){const r=find(i);if(!groups.has(r))groups.set(r,new Set());groups.get(r).add(i);}
 return [...groups.values()].map(s=>[...s]);
}
export class Walkers {
 constructor(rng=Math.random){this.rng=rng;this.list=[];this.enabled=true;this.max=5;this.tick=0;this.formed=0;this.nextId=1;this.events=[];}
 configure(o){if(!o)return;if(o.enabled!==undefined)this.enabled=!!o.enabled;if(o.max!==undefined)this.max=clamp(Math.round(+o.max||0),0,20);}
 reset(){this.list=[];this.tick=0;this.events=[];}
 // Follow particle index changes made by Simulation.rebuild (swap-remove).
 remap(sim){
  if(!sim.remapLog?.length)return;
  for(const now of sim.remapLog)for(const w of this.list){
   for(const c of this.fish||[])if(c.attachment?.walker===w.id&&c.attachment.role==='leg'){
    const id=c.attachment.hip??Number(c.attachment.slot.slice(4));if(now.has(id)){c.attachment.hip=now.get(id);c.attachment.slot='leg:'+now.get(id);}else this.releaseFish(c);
   }
if(w.fusion?.bridge){const p=w.fusion.bridge;w.fusion.bridge=now.has(p[0])&&now.has(p[1])?[now.get(p[0]),now.get(p[1])]:null;}if(w.body)w.body.slots=new Map([...w.body.slots].filter(([i])=>now.has(i)).map(([i,p])=>[now.get(i),p]));w.members=w.members.filter(i=>now.has(i)).map(i=>now.get(i));for(const l of w.legs)l.hip=now.has(l.hip)?now.get(l.hip):-1;w.legs=w.legs.filter(l=>l.hip>=0);}
  for(const now of sim.remapLog)for(const o of this.thrown||[])o.i=now.has(o.i)?now.get(o.i):-1;
  sim.remapLog.length=0;sim.bodyBondKeys=new Set();for(const w of this.list){const ids=new Set(w.members);for(const [a,b] of sim.bonds)if(ids.has(a)&&ids.has(b))sim.bodyBondKeys.add(Math.min(a,b)*65536+Math.max(a,b));}
 }
 centroid(sim,members){const x0=sim.x[members[0]],y0=sim.y[members[0]];let sx=0,sy=0;for(const i of members){sx+=wrappedDelta(sim.x[i]-x0,sim.width);sy+=wrappedDelta(sim.y[i]-y0,sim.height);}return [x0+sx/members.length,y0+sy/members.length];}
 // Faction strategy decides how a bonded cluster becomes bodies:
 // Enxame splits into connected packs of 3–4, Colosso takes ≥4 and keeps up to 14 (then grows), Místico takes up to 8.
 partition(comp,sim){
  const f=factionOf(sim,comp);
  if(f===this.blockedFaction)return [];
  const size=f===1?14:f===0?4:8,set=new Set(comp),adj=new Map(comp.map(i=>[i,[]]));
  for(const [a,b] of sim.bonds)if(set.has(a)&&set.has(b)){adj.get(a).push(b);adj.get(b).push(a);}
  const free=new Set(comp),parts=[];
  for(const seed of comp){if(!free.has(seed))continue;const part=[seed],queue=[seed];free.delete(seed);
   while(queue.length&&part.length<size){const i=queue.shift();for(const j of adj.get(i)){if(!free.has(j)||part.length>=size)continue;free.delete(j);part.push(j);queue.push(j);}}
   if(part.length>=(f===1?4:3))parts.push(part);else for(const i of part)free.add(i);}
  if(parts.length>1){const owner=new Map();parts.forEach((p,k)=>p.forEach(i=>owner.set(i,k)));
   sim.bonds=sim.bonds.filter(b=>{const oa=owner.get(b[0]),ob=owner.get(b[1]);if(oa!==undefined&&ob!==undefined&&oa!==ob){sim.dropBond(b);return false;}return true;});}
  return parts;
 }
 // Fed bodies retain their mass. Starvation or growth beyond their comfortable size sheds weak outer matter.
 shed(w,sim,dt=1){
  const n=w.members.length,healthy=(w.needs?.reserve??.75)>.15&&(w.needs?.health??1)>.35,threshold=healthy?((w.faction??factionOf(sim,w.members))===1?20:12):7;if(n<=threshold||!sim.minor)return;const hips=new Set((w.legs||[]).map(l=>l.hip));
  for(const i of [...w.members]){if(w.members.length<=6)break;const m=sim.minor[i];if(!m||hips.has(i))continue;
   const scale=.1+.4*(m-1)/39;if(this.rng()>=.0025*(n-threshold)*(1.7-2*scale)*dt)continue;
   sim.bonds=sim.bonds.filter(b=>{if(b[0]===i||b[1]===i){sim.dropBond(b);return false;}return true;});
   w.members=w.members.filter(k=>k!==i);w.body?.slots?.delete(i);if(sim.owner&&i<sim.owner.length)sim.owner[i]=0;
   const [cx,cy]=this.centroid(sim,w.members);let dx=wrappedDelta(sim.x[i]-cx,sim.width),dy=wrappedDelta(sim.y[i]-cy,sim.height),d=Math.hypot(dx,dy)||1;
   sim.vx[i]+=dx/d*1.4;sim.vy[i]+=dy/d*1.4;sim.feedCooldown[i]=60;this.shedCount=(this.shedCount||0)+1;}
 }
 // Small bodies (≤ 6 circles) forage: steer toward the nearest free secondary circle and absorb it on contact.
 forage(w,sim,dt=1){
  const n=w.members.length;if(n>6||!sim.minor||!sim.owner||sim.ownerX!==sim.x||(this.tick+w.id)%6)return;
  const [cx,cy]=this.centroid(sim,w.members);let pick=-1,best=170;
  for(let i=0;i<sim.count;i++){if(!sim.minor[i]||sim.owner[i]||sim.feedCooldown[i]>30)continue;const d=Math.hypot(wrappedDelta(sim.x[i]-cx,sim.width),wrappedDelta(sim.y[i]-cy,sim.height));if(d<best){best=d;pick=i;}}
  w.prey=pick;if(pick<0)return;
  let near=w.members[0],nd=Infinity;for(const k of w.members){const d=Math.hypot(wrappedDelta(sim.x[pick]-sim.x[k],sim.width),wrappedDelta(sim.y[pick]-sim.y[k],sim.height));if(d<nd){nd=d;near=k;}}
  if(nd<20){const key=Math.min(near,pick)*65536+Math.max(near,pick);if(!sim.bondKeys.has(key)){sim.bonds.push([near,pick]);sim.bondKeys.add(key);sim.bondCount[near]++;sim.bondCount[pick]++;}
   w.members.push(pick);sim.owner[pick]=w.id+1;for(const k of w.members)sim.energy[k]=Math.min(3.9,sim.energy[k]+.12);if(sim.pulse)sim.pulse[pick]=Math.max(sim.pulse[pick],.7);this.eaten=(this.eaten||0)+1;return;}
  const dx=wrappedDelta(sim.x[pick]-cx,sim.width),dy=wrappedDelta(sim.y[pick]-cy,sim.height),d=Math.hypot(dx,dy)||1,k=.35*(w.pace??1);
  for(const i of w.members){sim.vx[i]+=dx/d*k;sim.vy[i]+=dy/d*k;}
 }
 upkeep(w,sim,dt=1){
  const n=w.members.length;if(n<3)return;
  const cost=UPKEEP*n*dt;let mean=0;for(const i of w.members){sim.energy[i]=Math.max(.2,sim.energy[i]-cost);mean+=sim.energy[i];}mean/=n;
  w.upkeep={cost:cost*n,mean};
  w.starve=mean<STARVE_LEVEL?(w.starve||0)+dt:Math.max(0,(w.starve||0)-dt*2);
  if(w.starve>=STARVE_STEPS&&n>=6){w.starve=0;this.fragment(w,sim);}
 }
 // Break a starving body into connected halves (or smaller); pieces of ≥3 become independent organisms.
 fragment(w,sim){
  const members=w.members,set=new Set(members),adj=new Map(members.map(i=>[i,[]]));
  for(const [a,b] of sim.bonds)if(set.has(a)&&set.has(b)){adj.get(a).push(b);adj.get(b).push(a);}
  const size=Math.max(3,Math.ceil(members.length/2)),free=new Set(members),parts=[];
  for(const seed of members){if(!free.has(seed))continue;const part=[seed],queue=[seed];free.delete(seed);
   while(queue.length&&part.length<size){const i=queue.shift();for(const j of adj.get(i)){if(!free.has(j)||part.length>=size)continue;free.delete(j);part.push(j);queue.push(j);}}
   parts.push(part);}
  if(parts.length<2)return [];
  const owner=new Map();parts.forEach((p,k)=>p.forEach(i=>owner.set(i,k)));
  sim.bonds=sim.bonds.filter(b=>{const oa=owner.get(b[0]),ob=owner.get(b[1]);if(oa!==undefined&&ob!==undefined&&oa!==ob){sim.dropBond(b);return false;}return true;});
  const keep=parts.filter(p=>p.length>=3).sort((a,b)=>b.length-a.length);if(!keep.length)return [];
  w.members=keep[0];w.legs=w.legs.filter(l=>w.members.includes(l.hip));w.body&&w.body.slots&&[...w.body.slots.keys()].forEach(i=>{if(!w.members.includes(i))w.body.slots.delete(i);});
  const pieces=[];
  for(const part of keep.slice(1)){const c=this.create(sim,part);c.faction=w.faction;c.traits=w.traits?{...w.traits}:undefined;c.features=w.features?{...w.features}:undefined;c.cohesion=.6;pieces.push(c);
   for(const i of part){const a=this.rng()*Math.PI*2;sim.vx[i]+=Math.cos(a)*1.2;sim.vy[i]+=Math.sin(a)*1.2;}}
  this.fragments=(this.fragments||0)+1;const [x,y]=this.centroid(sim,w.members);this.events.push({kind:'break',x,y,species:sim.type[w.members[0]]});
  return pieces;
 }
 // Low diversity encourages new bodies to assemble from local free matter; no births or teleports.
 seedColony(sim){
  if(this.list.length>=Math.max(1,this.max-2))return null;
  const owned=new Set(this.list.flatMap(w=>w.members)),flying=new Set((this.thrown||[]).map(o=>o.i)),free=[];
  for(let i=0;i<sim.count;i++)if(!owned.has(i)&&!flying.has(i))free.push(i);
  if(free.length<8)return null;
  let best=null,bestScore=-Infinity;
  for(let k=0;k<Math.min(24,free.length);k++){
   const seed=free[(Math.floor(this.rng()*free.length)+k*17)%free.length],type=sim.type[seed],f=FACTION_OF[type];
   const near=free.filter(i=>sim.type[i]===type&&Math.hypot(wrappedDelta(sim.x[i]-sim.x[seed],sim.width),wrappedDelta(sim.y[i]-sim.y[seed],sim.height))<100);
   if(near.length<8)continue;
   const target=[8,14,10][f],group=[seed],edges=[],degrees=new Map([[seed,0]]),remaining=new Set(near.filter(i=>i!==seed));
   while(group.length<target&&remaining.size){let pair=null,distance=Math.min(60,sim.radius*.4);
    for(const a of group){if(degrees.get(a)>=VALENCE[type])continue;for(const b of remaining){const d=Math.hypot(wrappedDelta(sim.x[b]-sim.x[a],sim.width),wrappedDelta(sim.y[b]-sim.y[a],sim.height));if(d<distance){distance=d;pair=[a,b];}}}
    if(!pair)break;const [a,b]=pair;group.push(b);remaining.delete(b);degrees.set(a,degrees.get(a)+1);degrees.set(b,1);edges.push(pair);
   }
   if(group.length<8)continue;
   const nearest=Math.min(240,...this.list.map(w=>{const [x,y]=this.centroid(sim,w.members);return Math.hypot(wrappedDelta(x-sim.x[seed],sim.width),wrappedDelta(y-sim.y[seed],sim.height));}));
   const same=this.list.filter(w=>(w.faction??factionOf(sim,w.members))===f).length,score=group.length+nearest/25-same*4;
   if(score>bestScore){best={group,edges,f};bestScore=score;}
  }
  if(!best)return null;
  const ids=new Set(best.group);sim.bonds=sim.bonds.filter(b=>{if(ids.has(b[0])||ids.has(b[1])){sim.dropBond(b);return false;}return true;});
  for(const [a,b] of best.edges){sim.bonds.push([a,b]);sim.bondCount[a]++;sim.bondCount[b]++;sim.bondKeys.add(Math.min(a,b)*65536+Math.max(a,b));}
  const w=this.create(sim,best.group);w.faction=best.f;return w;
 }
 create(sim,members){
  const [cx,cy]=this.centroid(sim,members),rng=this.rng;
  const outer=[...members].sort((a,b)=>Math.hypot(wrappedDelta(sim.x[b]-cx,sim.width),wrappedDelta(sim.y[b]-cy,sim.height))-Math.hypot(wrappedDelta(sim.x[a]-cx,sim.width),wrappedDelta(sim.y[a]-cy,sim.height)));
  // Procedural body plan: lizard (paired legs), spider (radial legs, round body), centipede (many legs along a long
  // body), snake (no legs, travelling lateral wave) or jellyfish (no legs, pulsing bell that swims in bursts).
  // 25% are hybrids: the front half follows one plan and the back half another (odd, mismatched gaits).
  const pick=()=>{const roll=rng();return roll<.3?'lizard':roll<.5?'spider':roll<.7?'centipede':roll<.85?'snake':'jelly';};
  const A=pick();let B=A;if(rng()<.25){for(let k=0;k<6&&B===A;k++)B=pick();}
  const parts=[A,B],plan=A===B?A:'hybrid',isLegless=q=>q==='snake',legged=parts.filter(q=>!isLegless(q));
  const legCount=!legged.length?0:legged.length===1&&plan==='hybrid'?clamp(Math.ceil(members.length/2),2,3):clamp(members.length,legged.includes('lizard')?3:4,MAX_LEGS);
  const SIZE={spider:1.15,centipede:.8},size=(13+rng()*6)*((SIZE[A]??1)+(SIZE[B]??1))/2,rotation=rng()*TAU;
  const legPlan=k=>plan!=='hybrid'?A:legged.length===1?legged[0]:(k<legCount/2?A:B);
  const mountFor=k=>{const q=legPlan(k);let m;
   if(q==='jelly'){const n=Math.max(1,legCount-1),a=Math.PI+((plan==='hybrid'?.5:k/n)-.5)*Math.PI*.9+(plan==='hybrid'?(rng()-.5)*.8:0);m=[Math.cos(a)*.28,Math.sin(a)*.3];}
   else if(q==='spider'){const a=(k+.5)/legCount*TAU;m=[Math.cos(a)*.3,Math.sin(a)*.36];}
   else if(q==='centipede'){const P=Math.ceil(legCount/2),j=k>>1;m=[(.45-.9*j/Math.max(1,P-1))*1.4,(k%2?1:-1)*.22];}
   else m=[Math.cos(rotation+(k+.35*rng())/legCount*TAU)*.46,Math.sin(rotation+(k+.35*rng())/legCount*TAU)*.28];
   if(plan==='hybrid'){const front=q===A&&(legged.length===2||!isLegless(A));m[0]=(front?1:-1)*(.12+Math.abs(m[0])*.6);}
   return m;};
  // Pace gene: log-uniform 0.35×–2.4×, so organisms move at clearly different speeds.
  const w={id:this.nextId++,pace:Math.exp(Math.log(.35)+rng()*Math.log(2.4/.35)),plan,parts,members:[...members],heading:rng()*TAU,wander:0,age:0,lifespan:2400+rng()*2400,phase:0,cohesion:0,tail:null,
   legs:outer.slice(0,legCount).map((hip,k)=>({hip,tentacle:legPlan(k)==='jelly',mount:mountFor(k),group:legPlan(k)==='centipede'?(k>>1)%2^(k%2):k%2,upper:size,lower:size*1.15,stride:size*.9,t:1,fx:sim.x[hip],fy:sim.y[hip],from:[0,0],to:[0,0],init:false,knee:[sim.x[hip],sim.y[hip]],lift:0,bend:k%2?1:-1}))};
  this.list.push(w);this.formed++;return w;
 }
 merge(a,b,sim,fish,bridge=null){
  if(a===b)return;
  a.fusion={until:this.tick+360,bridge};a.clan=a.clan||'colony:'+a.id;
  a.members=[...new Set([...a.members,...b.members])];a.legs=[...a.legs,...b.legs].slice(0,MAX_LEGS);
  const valid=new Set(a.legs.map(l=>'leg:'+l.hip));
  const occupied=new Set(fish.filter(c=>c.attachment?.walker===a.id).map(c=>c.attachment.slot));
  for(const c of fish)if(c.attachment?.walker===b.id){if((c.attachment.role==='leg'&&!valid.has(c.attachment.slot))||occupied.has(c.attachment.slot))this.releaseFish(c);else{c.attachment.walker=a.id;c.attachment.clan=a.clan;occupied.add(c.attachment.slot);}}
  this.list=this.list.filter(w=>w!==b);this.events.push({kind:'assemble',x:sim.x[a.members[0]],y:sim.y[a.members[0]],species:sim.type[a.members[0]]});
 }
 releaseFish(c){
  if(!c.attachment)return;
  const part=c.attachment,owner=this.list.find(w=>w.id===part.walker),body=owner?.body;
  let dx=body?wrappedDelta(c.x[0]-body.x,body.width||1e9):Math.cos(c.heading||0),dy=body?wrappedDelta(c.y[0]-body.y,body.height||1e9):Math.sin(c.heading||0),d=Math.hypot(dx,dy);
  if(d<1){dx=Math.cos(c.heading||0);dy=Math.sin(c.heading||0);d=1;}
  c.softStrand=null;c.legJoints=null;c.legStretch=1;c.organism=null;
  c.recruitAfter=Math.max(c.recruitAfter||0,this.tick+300);c.reunionDelay=300;
  if(!c.dead){c.memory={clan:part.clan||'colony:'+part.walker,partners:part.partners||[],ticks:900};
   c.release={age:0,vx:dx/d*.8+(body?.vx||0)*.3,vy:dy/d*.8+(body?.vy||0)*.3};}
  const leg=owner?.legs.find(l=>'leg:'+l.hip===part.slot);if(leg){leg.init=false;leg.stretch=1;}
  c.attachment=null;
 }

 step(sim,dt=1,fish=null){
  this.fish=fish;sim.bodyBondKeys=new Set();
  this.remap(sim);this.tick++;
  // Ownership map: bonds between two different organisms are cut, so bodies collide and fight instead of fusing.
  if(!sim.owner||sim.owner.length<sim.count)sim.owner=new Int32Array(Math.ceil(sim.count*1.25));else sim.owner.fill(0);
  for(const w of this.list)for(const i of w.members)if(i<sim.count)sim.owner[i]=w.id+1;sim.ownerX=sim.x;
  {const o=sim.owner;let cut=false;for(const b of sim.bonds){const p=o[b[0]],q=o[b[1]];if(p&&q&&p!==q){cut=true;break;}}
   if(cut)sim.bonds=sim.bonds.filter(b=>{const p=o[b[0]],q=o[b[1]];if(p&&q&&p!==q){sim.dropBond(b);return false;}return true;});}
  for(const w of this.list)if(w.fusion&&this.tick>=w.fusion.until){const pair=w.fusion.bridge;
   if(pair){sim.bonds=sim.bonds.filter(b=>{if(b[0]===pair[0]&&b[1]===pair[1]||b[0]===pair[1]&&b[1]===pair[0]){sim.dropBond(b);return false;}return true;});}
   w.fusion=null;
  }
  if(!this.enabled){this.list=[];if(fish)for(const c of fish)this.releaseFish(c);return;}
  // Anatomy follows the largest surviving connected part, never an unrelated bond.
  this.list=this.list.filter(w=>{
   w.age+=dt;
   const members=new Set(w.members),edges=(sim.bonds||[]).filter(([a,b])=>members.has(a)&&members.has(b));
   const groups=localComponents(w.members,edges).sort((a,b)=>b.length-a.length),alive=groups[0]||[];
   const connected=alive.length>=3;
   w.cohesion=clamp(w.cohesion+(connected?dt/45:-dt/240),0,1);
   if(connected&&w.cohesion>.65&&!w.celebrated){w.celebrated=true;const [x,y]=this.centroid(sim,w.members);this.events.push({kind:'assemble',x,y,species:sim.type[w.members[0]]});}
   const valid=w.members.filter(i=>i<sim.count);
   w.fractureTime=connected&&alive.length===valid.length?0:(w.fractureTime||0)+dt;
   w.members=connected&&w.fractureTime>=180?alive:valid;
   w.legs=w.legs.filter(l=>w.members.includes(l.hip));
   const keep=w.members.length>=3&&(connected||w.cohesion>0);
   if(!keep&&w.celebrated&&w.body)this.events.push({kind:'break',x:w.body.x,y:w.body.y,species:sim.type[w.members[0]]??0});
   return keep;
  });
  // Form new walkers from bonded clusters.
  if(this.tick%FORM_EVERY===0&&this.list.length<Math.max(1,this.max-2)&&sim.bonds?.length){
   const taken=new Set();for(const w of this.list)for(const i of w.members)taken.add(i);
   const freeBonds=sim.bonds.filter(([a,b])=>!taken.has(a)&&!taken.has(b));
   for(const comp of components(sim.count,freeBonds)){if(this.list.length>=Math.max(1,this.max-2))break;if(comp.length<3)continue;if(this.rng()<(this.formChance??.6))for(const part of this.partition(comp,sim)){if(this.list.length>=Math.max(1,this.max-2))break;const w=this.create(sim,part);w.faction=factionOf(sim,part);for(const i of part)sim.owner[i]=w.id+1;}}
  }
  if(this.tick%180===0){const target=Math.min(Math.max(1,this.max-2),Math.max(3,Math.floor(sim.count/60))),large=this.list.filter(w=>w.members.length>=8).length;
   if(this.list.length<target||large<Math.min(4,Math.ceil(target/2)))this.seedColony(sim);
  }
  if(fish){
   const live=new Set(this.list.map(w=>w.id));
   for(const c of fish)if(c.attachment&&!live.has(c.attachment.walker))this.releaseFish(c);
  }
  for(const w of this.list){
   const members=new Set(w.members);for(const [a,b] of sim.bonds||[])if(members.has(a)&&members.has(b))sim.bodyBondKeys.add(Math.min(a,b)*65536+Math.max(a,b));
   if(fish)this.recruit(w,sim,fish);
   this.walk(w,sim,dt);
   this.upkeep(w,sim,dt);
   this.shed(w,sim,dt);this.forage(w,sim,dt);
   if(fish)this.poseParts(w,sim,fish,dt);
  }
 }
 recruit(w,sim,fish){
  w.materialParts=true;
  const [cx,cy]=this.centroid(sim,w.members);
  const legs=w.legs.map(l=>({slot:'leg:'+l.hip,role:'leg',motion:'single-knee',hip:l.hip}));
  const slots=[...legs.slice(0,4),{slot:'head',role:'head'},{slot:'tail',role:'tail'},...legs.slice(4)];
  const valid=new Set(slots.map(s=>s.slot));
  for(const c of fish)if(c.attachment?.walker===w.id&&(!valid.has(c.attachment.slot)||c.dead))this.releaseFish(c);
  for(const slot of slots){
   if(fish.some(c=>c.attachment?.walker===w.id&&c.attachment.slot===slot.slot))continue;
   if(w.cohesion<=0)continue;
   let best=null,distance=75;
   for(const c of fish){if(c.dead||c.attachment||c.release||(c.recruitAfter||0)>this.tick)continue;const mount=slot.role==='leg'?this.hipPosition(w,w.legs.find(l=>l.hip===slot.hip),sim):[cx,cy];const d=Math.hypot(wrappedDelta(c.x[0]-mount[0],sim.width),wrappedDelta(c.y[0]-mount[1],sim.height));const score=d/(w.clan&&c.memory?.clan===w.clan?1.6:1);if(d<75&&score<distance){distance=score;best=c;}}
   if(best){w.clan=w.clan||best.memory?.clan||'colony:'+w.id;best.attachment={walker:w.id,clan:w.clan,blend:0,...slot};
    if(slot.role==='leg'){const l=w.legs.find(l=>l.hip===slot.hip),length=(best.spacing||3.4)*(best.x.length-1);l.upper=length*.48;l.lower=length*.52;l.stride=length*.22;l.init=false;}
   }
  }
  w.legCount=fish.filter(c=>c.attachment?.walker===w.id&&c.attachment.role==='leg').length;
 }
 poseParts(w,sim,fish,dt){
  const a=w.anatomy;if(!a)return;
  for(const c of fish){const part=c.attachment;if(part?.walker!==w.id)continue;
   c.organism=w.behavior||null;part.partners=fish.filter(o=>o!==c&&o.attachment?.walker===w.id).map(o=>o.id).slice(0,8);
   part.blend=Math.min(1,(part.blend||0)+dt/40);
   const join=part.blend*part.blend*(3-2*part.blend);
   let X,Y;
   if(part.role==='leg'){
    const l=w.legs.find(l=>'leg:'+l.hip===part.slot);if(!l)continue;
    if(l.tentacle){const root=this.hipPosition(w,l,sim);
     stepSoftStrand(c,root,[w.body?.vx||0,w.body?.vy||0],this.tick,sim.width,sim.height,dt,join);continue;}
    c.softStrand=null;
    const [x,y]=this.hipPosition(w,l,sim),ox=c.x[0],oy=c.y[0];
    if(!part.docked){
     // Follow the moving mount during approach so a fast torso cannot outrun docking.
     const driftX=part.lastRoot?wrappedDelta(x-part.lastRoot[0],sim.width):0,driftY=part.lastRoot?wrappedDelta(y-part.lastRoot[1],sim.height):0;
     part.lastRoot=[x,y];
     if(Math.hypot(driftX,driftY)>12){this.releaseFish(c);continue;}
     const dx=wrappedDelta(x-ox-driftX,sim.width),dy=wrappedDelta(y-oy-driftY,sim.height),distance=Math.hypot(dx,dy),step=Math.min(1,1.6/Math.max(.001,distance));
     // Approach as one intact fish, rather than stretching every vertebra toward the hip.
     for(let k=0;k<c.x.length;k++){c.x[k]+=driftX+dx*step;c.y[k]+=driftY+dy*step;}
     c.vx=driftX+dx*step;c.vy=driftY+dy*step;c.legJoints=null;c.legStretch=1;part.blend=.001;
     if(distance>2)continue;
     part.docked=true;part.dockPose=Array.from(c.x,(_,k)=>[wrappedDelta(c.x[k]-x,sim.width),wrappedDelta(c.y[k]-y,sim.height)]);
     continue;
    }
    if(part.blend>=.95&&Math.hypot(wrappedDelta(x-ox,sim.width),wrappedDelta(y-oy,sim.height))>Math.max(10,(l.upper+l.lower)*.45)){
     this.releaseFish(c);w.legCount=fish.filter(f=>f.attachment?.walker===w.id&&f.attachment.role==='leg').length;continue;
    }
    let dx=wrappedDelta(l.fx-x,sim.width),dy=wrappedDelta(l.fy-y,sim.height)-l.lift*3;
    const d=Math.hypot(dx,dy)||1,base=l.upper+l.lower;
    // Measure strain before IK clamps the displayed limb to its elastic limit.
    const speed=Math.hypot(w.body?.vx||0,w.body?.vy||0);
    const forwardX=speed>.12?w.body.vx/speed:a.hx,forwardY=speed>.12?w.body.vy/speed:a.hy;
    const behind=dx*forwardX+dy*forwardY<-.65*base;
    const overloaded=part.blend>=.95&&behind&&d>base*1.22;
    part.strain=overloaded?(part.strain||0)+dt:Math.max(0,(part.strain||0)-dt*2);
    if(part.strain>=24){
     c.recruitAfter=this.tick+180;this.releaseFish(c);c.legJoints=null;c.legStretch=1;
     l.init=false;l.stretch=1;
     w.legCount=fish.filter(f=>f.attachment?.walker===w.id&&f.attachment.role==='leg').length;
     this.events.push({kind:'break',x:c.x[0],y:c.y[0],species:c.species});continue;
    }
    const desired=clamp(d/(base*.94),1,1.28);
    l.stretch=(l.stretch??1)+(desired-(l.stretch??1))*(1-Math.exp(-.18*dt));
    // Enough extension to preserve contact, capped to avoid rubber-band limbs.
    const stretch=Math.min(1.28,Math.max(l.stretch,d/(base*.99))),limit=base*stretch*.99;
    if(d>limit){dx*=limit/d;dy*=limit/d;}
    const minimum=Math.abs(l.upper-l.lower)*stretch+.001,actual=Math.hypot(dx,dy);if(actual<minimum){const angle=actual>1e-6?Math.atan2(dy,dx):w.heading;dx=Math.cos(angle)*minimum;dy=Math.sin(angle)*minimum;}
    const fx=x+dx,fy=y+dy;
    const knee=solveKnee(x,y,fx,fy,l.upper*stretch,l.lower*stretch,l.bend);
    c.legStretch=stretch;const J=c.legJoints=[[x,y],knee,[fx,fy]];
    // Solve the displayed limb directly: no smoothing of a planted foot after IK.
    for(let k=0;k<c.x.length;k++){
     const u=k/(c.x.length-1),split=l.upper/(l.upper+l.lower),j=u<split?0:1,f=u<split?u/split:(u-split)/(1-split);
     const tx=J[j][0]+(J[j+1][0]-J[j][0])*f,ty=J[j][1]+(J[j+1][1]-J[j][1])*f;
     const source=part.dockPose?.[k];
     c.x[k]=source?x+source[0]+wrappedDelta(tx-x-source[0],sim.width)*join:tx+wrappedDelta(c.x[k]-tx,sim.width)*(1-join);
     c.y[k]=source?y+source[1]+wrappedDelta(ty-y-source[1],sim.height)*join:ty+wrappedDelta(c.y[k]-ty,sim.height)*(1-join);
    }
    c.vx=wrappedDelta(c.x[0]-ox,sim.width);c.vy=wrappedDelta(c.y[0]-oy,sim.height);
    c.heading=Math.atan2(c.y[0]-c.y[1],c.x[0]-c.x[1]);
    continue;
   }else{
    const root=part.role==='head'?[a.cx+a.hx*a.bodyLength*.25,a.cy+a.hy*a.bodyLength*.25]:w.tail[0];
    stepSoftStrand(c,root,[w.body?.vx||0,w.body?.vy||0],this.tick,sim.width,sim.height,dt,join);
   }
  }
 }
 updateBody(w,sim,dt){
  const [cx,cy]=this.centroid(sim,w.members),W=sim.width,H=sim.height;
  let vx=0,vy=0;for(const i of w.members){vx+=sim.vx[i];vy+=sim.vy[i];}vx/=w.members.length;vy/=w.members.length;
  const P2=w.parts||[w.plan,w.plan],stretch=((PLAN_LENGTH[P2[0]]??1)+(PLAN_LENGTH[P2[1]]??1))/2;const b=w.body||(w.body={x:cx,y:cy,vx,vy,heading:w.heading,slots:new Map(),length:(12+Math.sqrt(w.members.length)*5)*stretch,width:W,height:H});
  if(b.width!==W||b.height!==H){b.x*=W/b.width;b.y*=H/b.height;if(b.lastX!==undefined){b.lastX*=W/b.width;b.lastY*=H/b.height;}b.width=W;b.height=H;}
  const targetLength=(12+Math.sqrt(w.members.length)*5)*(1+(w.growth||0)*.6)*stretch;b.length+=(targetLength-b.length)*(1-Math.exp(-.025*dt));
  // Mass controls a bounded peripheral clearance; never measure displaced hips as body size.
  const targetSpread=1+Math.min(.65,Math.max(0,Math.sqrt(w.members.length)-Math.sqrt(3))*.3+(w.growth||0)*.15);
  b.legSpread??=targetSpread;
  b.legSpread+=(targetSpread-b.legSpread)*(1-Math.exp(-.025*dt));
  const mix=1-Math.exp(-.1*dt);
  const actualVX=b.lastX===undefined?0:wrappedDelta(cx-b.lastX,W)/Math.max(dt,.001),actualVY=b.lastY===undefined?0:wrappedDelta(cy-b.lastY,H)/Math.max(dt,.001);
  b.lastX=cx;b.lastY=cy;b.vx+=(actualVX-b.vx)*mix;b.vy+=(actualVY-b.vy)*mix;
  b.x+=b.vx*dt;b.y+=b.vy*dt;
  b.x+=wrappedDelta(cx-b.x,W)*mix;b.y+=wrappedDelta(cy-b.y,H)*mix;
  if(w.materialParts&&Math.hypot(b.vx,b.vy)>.12){const target=Math.atan2(b.vy,b.vx),diff=Math.atan2(Math.sin(target-b.heading),Math.cos(target-b.heading));const tail=(this.fish||[]).some(c=>c.attachment?.walker===w.id&&c.attachment.role==='tail');b.heading+=clamp(diff,-(tail?.032:.013)*dt,(tail?.032:.013)*dt);}
  for(const [k,i] of w.members.entries())if(!b.slots.has(i)){
   const u=k/Math.max(1,w.members.length-1),L=b.length;let p;
   const q=planAt(w,u),hyb=w.plan==='hybrid',side=u<.5?1:-1;
   if(q==='spider'){const r=Math.sqrt(hyb?u*2%1:u)*.26*L,a=k*2.39996;p=[Math.cos(a)*r+(hyb?side*.25*L:0),Math.sin(a)*r];}
   else if(q==='jelly'){const a=k/Math.max(1,w.members.length)*TAU;p=k===0&&!hyb?[0,0]:[Math.cos(a)*.3*L*(hyb?.6:1)+(hyb?side*.25*L:0),Math.sin(a)*.3*L];}
   else if(q==='snake'||q==='centipede')p=[(.5-u)*L,(k%2?1:-1)*.04*L];
   else p=[(.5-u)*L,(k%2?1:-1)*Math.sin(Math.PI*u)*L*.24];
   p.push(u);b.slots.set(i,p);
  }
  if(w.materialParts)for(const l of w.legs)if(b.slots.has(l.hip)&&l.mount)b.slots.set(l.hip,[l.mount[0]*b.length*b.legSpread,l.mount[1]*b.length*b.legSpread]);
  const members=new Set(w.members);for(const i of b.slots.keys())if(!members.has(i))b.slots.delete(i);
  w.heading=b.heading;return b;
 }
 hipPosition(w,l,sim){
  if(!w.materialParts||!w.body)return [sim.x[l.hip],sim.y[l.hip]];
  const b=w.body,p=b.slots.get(l.hip)||[0,0],hx=Math.cos(b.heading),hy=Math.sin(b.heading);
  return [b.x+hx*p[0]-hy*p[1],b.y+hy*p[0]+hx*p[1]];
 }
 // Small damped weight shift toward the current support footprint, not a timed wobble.
 transferWeight(w,sim,dt){
  const [cx,cy]=this.centroid(sim,w.members),W=sim.width,H=sim.height;
  const material=new Set((this.fish||[]).filter(c=>c.attachment?.walker===w.id&&c.attachment.role==='leg'&&(c.attachment.blend??1)>=.9).map(c=>c.attachment.slot));
  const support=w.legs.filter(l=>l.init&&l.t>=1&&(!w.materialParts||material.has('leg:'+l.hip)));
  let tx=0,ty=0;
  for(const l of support){tx+=wrappedDelta(l.fx-cx,W);ty+=wrappedDelta(l.fy-cy,H);}
  if(support.length){tx=tx/support.length*.14;ty=ty/support.length*.14;}
  const length=Math.hypot(tx,ty);if(length>4){tx*=4/length;ty*=4/length;}
  const weight=w.weight||(w.weight={x:0,y:0,vx:0,vy:0});
  // Critically damped spring: carries the weight smoothly through lift-off and touchdown.
  const h=Math.max(0,dt),omega=.12,e=Math.exp(-omega*h);
  for(const [key,velocity,target] of [['x','vx',tx],['y','vy',ty]]){
   const error=weight[key]-target,c=weight[velocity]+omega*error;
   weight[key]=target+(error+c*h)*e;weight[velocity]=(weight[velocity]-omega*c*h)*e;
  }
  if(!support.length)return;
  let vx=0,vy=0;for(const i of w.members){vx+=sim.vx[i];vy+=sim.vy[i];}vx/=w.members.length;vy/=w.members.length;
  const fx=clamp(weight.x*.004-vx*.002,-.018,.018)*w.cohesion*h;
  const fy=clamp(weight.y*.004-vy*.002,-.018,.018)*w.cohesion*h;
  for(const i of w.members){sim.vx[i]+=fx;sim.vy[i]+=fy;}
 }
 walk(w,sim,dt){
  const b=this.updateBody(w,sim,dt),cx=b.x,cy=b.y,W=sim.width,H=sim.height;
  const hx=Math.cos(w.heading),hy=Math.sin(w.heading);let striding=0;
  const behavior=w.behavior,activity=behavior?.activity??1;
  // Soft organization of existing body points; no spawn, snap or rigid teleport.
  const blend=w.cohesion,bodyLength=b.length;
  // More legs = more agility (combat rule): cadence rises with mounted legs, size slows the body.
  // More legs = slower but sturdier (sturdiness lives in combat stats).
  w.locomotion=1/(1+.12*Math.max(0,(w.materialParts?w.legCount:w.legs.length)-2))*sizePace(w.members.length)*(w.pace??1);
  w.phase+=dt*.035*w.locomotion*(.4+.6*activity);
  let meanVX=0,meanVY=0;for(const i of w.members){meanVX+=sim.vx[i];meanVY+=sim.vy[i];}meanVX/=w.members.length;meanVY/=w.members.length;
  const corrections=[];let totalX=0,totalY=0;
  for(const i of w.members){
   const p0=w.body.slots.get(i),q=planAt(w,p0[2]??0),p=q==='snake'?[p0[0],p0[1]+Math.sin(w.phase*2.4-(p0[2]??0)*TAU*.9)*bodyLength*.13]:q==='centipede'?[p0[0],p0[1]+Math.sin(w.phase*1.6-(p0[2]??0)*TAU)*bodyLength*.04]:p0;
   const tx=cx+hx*p[0]-hy*p[1],ty=cy+hy*p[0]+hx*p[1];
   const breath=q==='jelly'?1+.24*Math.sin(w.phase*2.2):w.behavior?.resting?1+.045*Math.sin(w.phase*.6):1;
   const dx=wrappedDelta(cx+(tx-cx)*breath-sim.x[i],W),dy=wrappedDelta(cy+(ty-cy)*breath-sim.y[i],H);
   const fx=clamp(dx*.018,-.16,.16)+(meanVX-sim.vx[i])*.08,fy=clamp(dy*.018,-.16,.16)+(meanVY-sim.vy[i])*.08;
   corrections.push([i,fx,fy]);totalX+=fx;totalY+=fy;
  }
  for(const [i,fx,fy] of corrections){sim.vx[i]+=(fx-totalX/w.members.length)*blend*dt;sim.vy[i]+=(fy-totalY/w.members.length)*blend*dt;}
  // Tail segments follow each other with lag, in the same unwrapped coordinate frame.
  const tx=cx-hx*bodyLength*.55,ty=cy-hy*bodyLength*.55;
  if(!w.tail)w.tail=Array.from({length:8},(_,k)=>[tx-hx*k*4,ty-hy*k*4]);
  w.tail[0]=[tx,ty];
  for(let k=1;k<w.tail.length;k++){
   const prev=w.tail[k-1],old=w.tail[k];
   const ox=prev[0]+wrappedDelta(old[0]-prev[0],W),oy=prev[1]+wrappedDelta(old[1]-prev[1],H);
   const targetX=prev[0]-hx*4-hy*Math.sin(w.phase-k*.6)*1.5;
   const targetY=prev[1]-hy*4+hx*Math.sin(w.phase-k*.6)*1.5;
   const mix=1-Math.exp(-.18*dt);old[0]=ox+(targetX-ox)*mix;old[1]=oy+(targetY-oy)*mix;
   const dx=old[0]-prev[0],dy=old[1]-prev[1],length=Math.hypot(dx,dy)||1;
   if(length>5){old[0]=prev[0]+dx/length*5;old[1]=prev[1]+dy/length*5;}
  }
  w.anatomy={cx,cy,hx,hy,bodyLength};
  const material=new Map((this.fish||[]).filter(c=>c.attachment?.walker===w.id&&c.attachment.role==='leg').map(c=>[c.attachment.slot,c.attachment]));
  const active=w.legs.filter(l=>!w.materialParts||(material.get('leg:'+l.hip)?.blend??0)>=.9);
  let candidate=null,urgency=0;const busy=active.some(l=>l.t<1);
  for(const l of w.legs){
   // Jellyfish legs are tentacles: they trail behind the bell, sway, and contract with each pulse (never plant).
   if(l.tentacle){const [px,py]=this.hipPosition(w,l,sim),len=(l.upper+l.lower)*(1-.3*Math.max(0,Math.sin(w.phase*2.2))),sway=Math.sin(w.phase*1.4+l.hip*.7)*.55;
    const a=Math.atan2(-hy,-hx)+sway*.6,a2=a+sway*.7;l.knee=[px+Math.cos(a)*len*.5,py+Math.sin(a)*len*.5];l.fx=l.knee[0]+Math.cos(a2)*len*.5;l.fy=l.knee[1]+Math.sin(a2)*len*.5;l.t=1;l.init=false;l.lift=0;continue;}
   const [px,py]=this.hipPosition(w,l,sim),mx=l.mount?.[0]??.2,my=l.mount?.[1]??.3,dl=Math.hypot(mx,my)||1,reach=(l.upper+l.lower)*(behavior?.resting?.4:.62);
   const rx=px+(hx*mx-hy*my)/dl*reach,ry=py+(hy*mx+hx*my)/dl*reach;
   if(!l.init){l.fx=rx;l.fy=ry;l.t=1;l.init=true;l.plantedAt=this.tick;}
   if(active.includes(l)&&l.t<1){
    // Re-aim during the swing: a fast body must not outrun a stale world-space landing target.
    if(w.materialParts&&w.body){const b=w.body,predict=Math.max(2,(1-l.t)*(l.duration||12));let dx=rx+b.vx*predict-px,dy=ry+b.vy*predict-py;const d=Math.hypot(dx,dy)||1,limit=(l.upper+l.lower)*.9;if(d>limit){dx*=limit/d;dy*=limit/d;}l.to=[px+dx,py+dy];}
    l.t=Math.min(1,l.t+dt/(l.duration||12));const e=l.t*l.t*l.t*(l.t*(l.t*6-15)+10);
    l.fx=l.from[0]+(l.to[0]-l.from[0])*e;l.fy=l.from[1]+(l.to[1]-l.from[1])*e;striding++;
    if(l.t===1)l.plantedAt=this.tick;
   }
   if(active.includes(l)&&l.t===1&&!busy&&this.tick-(l.plantedAt||0)>(w.materialParts&&active.length<=2?2:5)){
    const dist=Math.hypot(wrappedDelta(l.fx-rx,W),wrappedDelta(l.fy-ry,H)),extension=Math.hypot(wrappedDelta(l.fx-px,W),wrappedDelta(l.fy-py,H))/(l.upper+l.lower);
    const score=Math.max(dist/l.stride,extension/.84);
    if((dist>l.stride||extension>.84)&&score>urgency){urgency=score;candidate={l,px,py,rx,ry};}
   }
   // Leash: a foot left behind (fast body, shove, drag, waiting for its turn) slides along instead of stretching
   // the leg across the screen; it re-plants from the leashed spot on its next step.
   {const fx=wrappedDelta(l.fx-px,W),fy=wrappedDelta(l.fy-py,H),d=Math.hypot(fx,fy),max=(l.upper+l.lower)*1.15;
    if(d>max){const k=max/d;l.fx=px+fx*k;l.fy=py+fy*k;if(l.t<1&&l.to){l.to=[l.fx,l.fy];l.from=[l.fx,l.fy];}}}
   l.lift=l.t<1?Math.sin(Math.PI*l.t):0;
   l.knee=solveKnee(px,py,px+wrappedDelta(l.fx-px,W),py+wrappedDelta(l.fy-py,H),l.upper,l.lower,l.bend);
  }
  if(candidate&&(!behavior?.resting||w.legs.some(l=>l.t===1&&Math.hypot(wrappedDelta(l.fx-cx,W),wrappedDelta(l.fy-cy,H))>bodyLength))){
   const {l,px,py,rx,ry}=candidate,b=w.body,speed=Math.hypot(b.vx,b.vy);
   l.duration=clamp(l.stride/Math.max(.3,speed)*.65,w.materialParts&&active.length<=2?4:7,16)/Math.max(.6,w.locomotion);
   const prediction=Math.min(l.duration*.65,12);let dx=rx+b.vx*prediction-px,dy=ry+b.vy*prediction-py;
   const d=Math.hypot(dx,dy)||1,limit=(l.upper+l.lower)*.85;if(d>limit){dx*=limit/d;dy*=limit/d;}
   l.from=[px+wrappedDelta(l.fx-px,W),py+wrappedDelta(l.fy-py,H)];l.to=[px+dx,py+dy];l.t=0;
  }
  this.transferWeight(w,sim,dt);
  // Propulsion only while legs are mid-stride (plus a little to start the gait).
  const drive=w.materialParts&&w.legCount===0?0:(.012+.03*striding/Math.max(1,w.legs.length));
  const thrust=drive*dt*w.locomotion*activity*(behavior?.speed??1)*(1+(w.growth||0)*.35+featureLevel(w,'muscle')*.1);
  // Reduce the common translational speed, retaining internal particle motion.
  let vx=0,vy=0;for(const i of w.members){vx+=sim.vx[i];vy+=sim.vy[i];}
  vx/=w.members.length;vy/=w.members.length;
  const speed=Math.hypot(vx,vy),cap=2.4*w.locomotion*(behavior?.fleeing?1.35:1)*(1+featureLevel(w,'agility')*.08)/(1+(w.growth||0)*.2+featureLevel(w,'armor')*.04);
  const drag=Math.max(0,1-cap/(speed||1));
  for(const i of w.members){sim.vx[i]-=vx*drag;sim.vy[i]-=vy*drag;}
  // Cruise: the body's common velocity is eased toward a speed set by its pace gene (slow drifters vs. darting ones).
  // Meander: a slow lateral sway (own frequency and phase per organism, drifting over time) plus occasional
  // sharp turns, stronger in bigger bodies, so large organisms wander instead of walking straight.
  {const m=w.meander||(w.meander={f:.006+this.rng()*.014,p:this.rng()*TAU,turn:0,next:120+this.rng()*480});const n=w.members.length,sp=Math.hypot(vx,vy);
   m.p+=m.f*dt*(1+.4*Math.sin(this.tick*.0013+w.id));m.next-=dt;if(m.next<=0){m.turn=(this.rng()<.5?-1:1)*(.8+this.rng()*.8);m.next=180+this.rng()*600;}m.turn*=Math.exp(-.02*dt);
   if(sp>.05){const px=-vy/sp,py=vx/sp,amp=(.012+.0045*Math.min(20,n))*(Math.sin(m.p)+m.turn)*dt*Math.max(.4,activity);for(const i of w.members){sim.vx[i]+=px*amp;sim.vy[i]+=py*amp;}}}
  {const cruise=.9*(w.pace??1)*sizePace(w.members.length)*Math.max(.35,activity)*planCruise(w),sp=Math.hypot(vx,vy);if(sp<cruise){const hx=sp>.05?vx/sp:Math.cos(w.heading),hy=sp>.05?vy/sp:Math.sin(w.heading),add=(cruise-sp)*.05*dt;for(const i of w.members){sim.vx[i]+=hx*add;sim.vy[i]+=hy*add;}}}
  const hasTail=(this.fish||[]).some(c=>c.attachment?.walker===w.id&&c.attachment.role==='tail');
  for(const i of w.members){if(w.growth)sim.energy[i]=Math.max(.2,sim.energy[i]-.00015*w.growth*dt);sim.vx[i]+=hx*thrust;sim.vy[i]+=hy*thrust;if(hasTail){const lateral=-hy*sim.vx[i]+hx*sim.vy[i];sim.vx[i]+=hy*lateral*.008*dt;sim.vy[i]-=hx*lateral*.008*dt;}}
  const walking=active.filter(l=>!l.tentacle);
  if(w.materialParts&&walking.length){
   let mx=0,my=0;for(const i of w.members){mx+=sim.vx[i];my+=sim.vy[i];}mx/=w.members.length;my/=w.members.length;
   const capacity=walking.length===1?.85:walking.length===2?1.2:1.8,sp=Math.hypot(mx,my),loss=Math.max(0,1-capacity/(sp||1));
   for(const i of w.members){sim.vx[i]-=mx*loss;sim.vy[i]-=my*loss;}
  }
 }
 serialize(sim){
  return this.list.map(w=>{const legs=new Float32Array(w.legs.length*7);w.legs.forEach((l,k)=>{const [px,py]=this.hipPosition(w,l,sim),W=sim.width,H=sim.height;
   // Never draw a leg longer than it can reach (fresh legs, teleports): fold it onto the hip instead of a screen-wide streak.
   let kx=wrappedDelta(l.knee[0]-px,W),ky=wrappedDelta(l.knee[1]-py,H),fx=wrappedDelta(l.fx-px,W),fy=wrappedDelta(l.fy-py,H);const reach=(l.upper+l.lower)*1.3;
   if(!(Math.hypot(kx,ky)<=reach)||!(Math.hypot(fx,fy)<=reach)){kx=ky=fx=fy=0;}
   legs.set([px,py,px+kx,py+ky,px+fx,py+fy,l.lift],k*7);});
   const a=w.anatomy;
   const head=a?new Float32Array([a.cx,a.cy,a.cx+a.hx*a.bodyLength*.7,a.cy+a.hy*a.bodyLength*.7,a.hx,a.hy]):null;
   const tail=w.tail?new Float32Array(w.tail.flat()):null;
   return {id:w.id,members:Int32Array.from(w.members.filter(i=>i<sim.count)),species:sim.type[w.members[0]]??0,legs,head,tail,materialParts:!!w.materialParts,legCount:w.legCount??w.legs.length,life:w.cohesion};});
 }
}
