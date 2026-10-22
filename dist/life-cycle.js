import {inheritFeatures} from './features.js?v=1.25.1';
import {ensureNeeds} from './needs.js?v=1.25.1';
import {VALENCE,wrappedDelta} from './simulation.js?v=1.25.1';
import {inheritTraits,reproductionRules} from './traits.js?v=1.25.1';
import {createFish} from './creatures.js?v=1.25.1';
import {SPECIES_PATTERN} from './simulation.js?v=1.25.1';
export class LifeCycle{
 constructor(target=300){this.target=target;this.tick=0;this.births=0;this.catches=0;}
 total(sim,creatures){return sim.count+creatures.list.reduce((n,c)=>n+4+c.stomach.length,0);}
 grow(a,sim,walkers){
  // Hunters grow when fed; the Colosso faction always grows toward big bodies.
  if(((a.traits?.hunt||0)<.5||(a.growth||0)<.15)&&a.faction!==1||a.members.length>=14)return false;
  const owned=new Set(walkers.list.flatMap(w=>w.members)),[cx,cy]=walkers.centroid(sim,a.members);let pair=null,best=45;
  for(let i=0;i<sim.count;i++){if(owned.has(i)||sim.bondCount[i]>=VALENCE[sim.type[i]])continue;const d=Math.hypot(wrappedDelta(sim.x[i]-cx,sim.width),wrappedDelta(sim.y[i]-cy,sim.height));if(d>=best)continue;
   for(const j of a.members){if(sim.bondCount[j]>=VALENCE[sim.type[j]]||sim.matrix[sim.type[i]][sim.type[j]]<0||sim.matrix[sim.type[j]][sim.type[i]]<0||sim.bondKeys.has(Math.min(i,j)*65536+Math.max(i,j))||Math.hypot(wrappedDelta(sim.x[i]-sim.x[j],sim.width),wrappedDelta(sim.y[i]-sim.y[j],sim.height))>sim.radius*.45)continue;pair=[j,i];best=d;break;}
  }
  if(!pair)return false;const [j,i]=pair;sim.bonds.push(pair);sim.bondCount[j]++;sim.bondCount[i]++;sim.bondKeys.add(Math.min(i,j)*65536+Math.max(i,j));a.members.push(i);return true;
 }
 reproduce(a,sim,creatures,walkers){
  const rules=reproductionRules(a);
  if(ensureNeeds(a).reserve<.4||a.needs.health<.5)return false;
  if(a.age<rules.maturity||a.cohesion<.8||walkers.list.length>=walkers.max||this.tick<(a.nextBirth||0)||!creatures.enabled)return false;
  const energy=a.members.reduce((n,i)=>n+sim.energy[i],0)/a.members.length;
  const addFish=creatures.list.length<creatures.target+2,cost=3+(addFish?4:0);
  if((energy<1.18&&(energy<.9||(a.fertility||0)<rules.reserve))||this.total(sim,creatures)+cost>this.target*1.1)return false;
  const [x,y]=walkers.centroid(sim,a.members),angle=a.heading+Math.PI*.5,type=sim.type[a.members[0]]%4,dx=Math.cos(angle),dy=Math.sin(angle),start=sim.count;
  const added=Array.from({length:3},(_,k)=>({x:x+dx*(30+k*8),y:y+dy*(30+k*8),vx:dx*.5,vy:dy*.5,type,energy:1,stage:0}));
  sim.rebuild(new Set(),added);walkers.remap(sim);
  for(const [i,j] of [[start,start+1],[start+1,start+2]]){sim.bonds.push([i,j]);sim.bondCount[i]++;sim.bondCount[j]++;sim.bondKeys.add(i*65536+j);}
  const child=walkers.create(sim,[start,start+1,start+2]);child.clan=a.clan;child.heading=a.heading+.2;child.traits=inheritTraits(a,walkers.rng);inheritFeatures(a,child,walkers.rng);child.nextBirth=this.tick+reproductionRules(child).cooldown;a.nextBirth=this.tick+rules.cooldown;
  for(const i of a.members)sim.energy[i]=Math.max(.3,sim.energy[i]-rules.energyCost);
  if(addFish){const c=createFish('rect',creatures.rng,x+dx*55,y+dy*55,a.heading,type,creatures.nextId++);c.memory={clan:a.clan,partners:[],ticks:900};creatures.list.push(c);creatures.births++;}
  a.needs.reserve=Math.max(0,a.needs.reserve-.25);a.fertility=0;this.births++;walkers.events.push({kind:'birth',x:x+dx*30,y:y+dy*30,species:type});return true;
 }
 spawn(sim,walkers,count){
  const added=[];for(let k=0;k<count;k++){const x=Math.random()*sim.width,y=Math.random()*sim.height,type=SPECIES_PATTERN[Math.floor(Math.random()*SPECIES_PATTERN.length)];added.push({x,y,vx:0,vy:0,type,energy:1,stage:0});walkers.events.push({kind:'birth',x,y,species:type});}
  sim.rebuild(new Set(),added);walkers.remap(sim);this.spawned=(this.spawned||0)+count;
 }
 step(sim,creatures,walkers){
  this.tick++;
  if(this.tick%120===0&&walkers.enabled)for(const a of [...walkers.list]){this.grow(a,sim,walkers);this.reproduce(a,sim,creatures,walkers);}
  // The wheel keeps turning: below target, new circles are born; old free circles are recycled into new ones.
  if(this.tick%30===0&&this.total(sim,creatures)<this.target*.98)this.spawn(sim,walkers,2);
  if(this.tick%90===45){const protectedIds=new Set(walkers.list.flatMap(a=>a.members));let old=-1,oldest=.85;for(let i=0;i<sim.count;i++){if(protectedIds.has(i)||sim.bondCount[i])continue;const t=sim.age[i]/sim.lifespan[i];if(t>oldest){oldest=t;old=i;}}
   if(old>=0&&sim.count>40){walkers.events.push({kind:'death',x:sim.x[old],y:sim.y[old],species:sim.type[old]});sim.rebuild(new Set([old]));walkers.remap(sim);this.spawn(sim,walkers,1);}}
  if(this.tick%60!==0||this.total(sim,creatures)<=this.target*1.02)return;
  const protectedIds=new Set(walkers.list.flatMap(a=>a.members)),eligible=[];
  for(let i=0;i<sim.count;i++)if(!protectedIds.has(i)&&sim.count-eligible.length>40)eligible.push(i);
  eligible.sort((a,b)=>sim.age[b]/sim.lifespan[b]-sim.age[a]/sim.lifespan[a]);
  const removed=eligible.slice(0,Math.min(2,Math.ceil(this.total(sim,creatures)-this.target*1.02)));
  if(removed.length){for(const i of removed)walkers.events.push({kind:'death',x:sim.x[i],y:sim.y[i],species:sim.type[i]});sim.rebuild(new Set(removed));walkers.remap(sim);}
 }
}
