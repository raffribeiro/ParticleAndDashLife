import test from 'node:test';import assert from 'node:assert/strict';
import {Ecology,personalityFor} from '../dist/ecology.js';
import {Simulation} from '../dist/simulation.js';
const world=()=>new Simulation(30,800,600,()=>.5);
const animal=(id=1)=>({id,members:[0,1,2],age:100,heading:0,body:{x:400,y:300},cohesion:1});
test('personalities are stable and varied',()=>{assert.deepEqual(personalityFor(3),personalityFor(3));assert.ok(new Set(Array.from({length:12},(_,i)=>personalityFor(i).name)).size>=3);});
test('environment currents and food remain bounded and preserve population',()=>{const e=new Ecology(),s=world(),n=s.count;for(let k=0;k<100;k++)e.step(s,[],[],null,1);assert.equal(s.count,n);assert.ok(s.energy.every(x=>x<=2));assert.ok(s.vx.every(Number.isFinite));assert.equal(e.patches.length,6);});
test('rest wakes for a nearby cursor and gaze precedes pursuit',()=>{const e=new Ecology(),s=world(),a=animal();e.step(s,[],[a],null,1);a.behavior.restUntil=e.time+100;e.step(s,[],[a],null,1);assert.ok(a.behavior.resting);e.step(s,[],[a],{x:420,y:300,force:0},1);assert.equal(a.behavior.resting,false);assert.ok(Number.isFinite(a.behavior.gaze));});
test('partner memory expires and age markings grow',()=>{const e=new Ecology(),s=world(),f={id:1,x:[400],y:[300],age:100,lifespan:1000,heading:0,memory:{ticks:2,clan:'a',partners:[]}};e.step(s,[f],[],null,1);e.step(s,[f],[],null,1);assert.equal(f.memory,null);assert.ok(f.behavior.maturity>0);});
import {Walkers} from '../dist/walkers.js';
test('separate organisms never fuse; a bond between two bodies is cut',()=>{
 const s=new Simulation(6,800,600,()=>.5);s.type.fill(0);s.radius=150;s.matrix=s.matrix.map(r=>r.map(()=>.8));s.x.set([100,110,105,125,135,130]);s.y.fill(300);s.bonds=[[0,1],[1,2],[3,4],[4,5]];s.bondCount.set([1,2,1,1,2,1]);s.bondKeys=new Set(s.bonds.map(([a,b])=>a*65536+b));
 const w=new Walkers(()=>.5),a=w.create(s,[0,1,2]),b=w.create(s,[3,4,5]),e=new Ecology();e.ensure(a).name='sociável';e.ensure(b);e.time=119;
 e.step(s,[],w.list,null,1,w);assert.equal(w.list.length,2);
 s.bonds.push([2,3]);w.step(s,1,[]);assert.ok(!s.bonds.some(([i,j])=>(i===2&&j===3)||(i===3&&j===2)));assert.equal(s.count,6);
});
test('juicy events have a short snap lifetime',async()=>{const {EventEffects}=await import('../dist/effects.js');const f=new EventEffects();f.update([{kind:'death',x:10,y:10,species:0}],0);assert.equal(f.items[0].duration,320);f.update([],321);assert.equal(f.items.length,0);});
import {Creatures} from '../dist/creatures.js';
test('integrated ecology preserves biomass through rest, life cycles and formation',()=>{
 const s=new Simulation(160,800,600),cs=new Creatures(7),ws=new Walkers(()=>.2),e=new Ecology();cs.target=12;s.bonding=true;
 let rested=false,memory=false;
 for(let t=0;t<1300;t++){
  s.step();e.step(s,cs.list,ws.list,t%200<40?{x:400,y:300,force:0}:null,1,ws);cs.step(s);ws.step(s,1,cs.list);
  const biomass=s.count+cs.list.reduce((n,c)=>n+4+c.stomach.length,0);assert.equal(biomass,160);
  assert.ok(s.x.every(Number.isFinite));assert.ok(cs.list.every(c=>c.x.every(Number.isFinite)));
  rested ||= cs.list.some(c=>c.behavior?.resting);memory ||=cs.list.some(c=>c.memory);
  cs.events=[];ws.events=[];
 }assert.ok(rested);assert.ok(e.patches.length===6);
});
test('a mounted tail improves the turn response of the body',()=>{
 const run=tail=>{const s=world(),ws=new Walkers(()=>.5),a=ws.create(s,[0,1,2]);a.materialParts=true;a.heading=0;ws.fish=tail?[{attachment:{walker:a.id,role:'tail'}}]:[];ws.updateBody(a,s,1);for(const i of a.members)s.y[i]+=3;ws.updateBody(a,s,1);return a.body.heading;};assert.ok(run(true)>run(false));
});
test('a hungry organism pursues prey, feeds on contact and respects bite cooldown',()=>{
 const s=world(),ws=new Walkers(()=>.5),a=ws.create(s,[0,1,2]),e=new Ecology();s.type.fill(0);s.energy.fill(1);a.body={x:400,y:300};a.cohesion=1;e.ensure(a).name='territorial';
 const prey={id:70,species:1,energy:1,x:[410],y:[300],heading:0,burst:0};
 e.hunt(a,s,[prey],[a],ws);assert.ok(a.behavior.hunting);assert.ok(prey.energy<1);assert.ok(s.energy[0]>1);assert.ok(a.fertility>0);
 const energy=prey.energy;e.hunt(a,s,[prey],[a],ws);assert.equal(prey.energy,energy);
});
test('evasives steer away from a nearby hunter',()=>{const s=world(),ws=new Walkers(()=>.5),h=ws.create(s,[0,1,2]),a=ws.create(s,[3,4,5]),e=new Ecology();h.body={x:370,y:300};a.body={x:400,y:300};h.traits={hunt:.8,escape:.2,fecundity:.2};a.traits={hunt:.2,escape:.8,fecundity:.8};e.step(s,[],[h,a],null,1,ws);assert.ok(a.behavior.fleeing);assert.ok(a.behavior.steerX>0);});
test('successful feeding grows the hunter and increases strength',()=>{const s=world(),ws=new Walkers(()=>.5),a=ws.create(s,[0,1,2]),e=new Ecology();s.type.fill(0);s.energy.fill(1);a.body={x:400,y:300};e.ensure(a);a.traits={hunt:.8,escape:.2,fecundity:.2};const prey={id:70,species:1,energy:2,x:[410],y:[300],heading:0,burst:0};e.hunt(a,s,[prey],[a],ws);assert.ok(a.growth>0);assert.ok(a.strength>1);});
test('well-fed grown prey lose less energy to the same attack',()=>{
 const attack=growth=>{const s=world(),e=new Ecology(),hunter=animal(1),prey={...animal(2),members:[3,4,5],growth,body:{x:410,y:300}};s.type.fill(0);for(const i of prey.members)s.type[i]=1;s.energy.fill(1);e.ensure(hunter);e.ensure(prey);hunter.traits={hunt:.8,escape:.2,fecundity:.2};e.hunt(hunter,s,[],[hunter,prey],null);return 1-s.energy[3];};
 assert.ok(attack(1)<attack(0)*.7);
});
test('hungry creatures wake and replenish reserves inside nutrient patches',()=>{
 const s=world(),e=new Ecology(),a=animal(2);e.step(s,[],[],null,0);a.body={x:e.patches[0].x,y:e.patches[0].y};e.ensure(a);a.behavior.restUntil=1000;a.needs={reserve:.05,health:.5,hunger:.95,resistance:1};
 e.step(s,[],[a],null,1);assert.equal(a.behavior.resting,false);assert.ok(a.needs.reserve>.05);assert.ok(a.growth>0);
});

test('large independent bodies push apart even when their centres coincide',()=>{const s=world(),e=new Ecology(),a=animal(1),b={...animal(2),members:[3,4,5]};a.body.length=b.body.length=55;a.traits=b.traits={hunt:0,escape:0,fecundity:1};s.vx.fill(0);s.vy.fill(0);e.step(s,[],[a,b],null);assert.ok(Math.hypot(s.vx[0]-s.vx[3],s.vy[0]-s.vy[3])>.1);});

test('nutrient patches support several distinct territories across both halves of the scene',()=>{const s=world(),e=new Ecology();e.step(s,[],[],null,0);assert.equal(e.patches.length,6);assert.ok(Math.max(...e.patches.map(p=>p.x))-Math.min(...e.patches.map(p=>p.x))>s.width*.5);assert.ok(e.patches.filter(p=>p.y<s.height/2).length>=2);assert.ok(e.patches.filter(p=>p.y>s.height/2).length>=2);});
