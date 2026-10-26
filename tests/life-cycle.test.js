import test from 'node:test';import assert from 'node:assert/strict';
import {LifeCycle} from '../dist/life-cycle.js';import {Simulation} from '../dist/simulation.js';import {Walkers} from '../dist/walkers.js';import {Creatures} from '../dist/creatures.js';
const setup=()=>{const s=new Simulation(100,800,600,()=>.5),w=new Walkers(()=>.5),c=new Creatures(2);s.type.fill(0);s.energy.fill(1.5);const a=w.create(s,[0,1,2]);a.age=700;a.cohesion=1;w.updateBody(a,s,1);return {s,w,c,a};};
test('a fed adult creates offspring within the population budget',()=>{const {s,w,c,a}=setup(),life=new LifeCycle(120);assert.ok(life.reproduce(a,s,c,w));assert.equal(w.list.length,2);assert.equal(s.count,103);assert.equal(c.list.length,1);assert.ok(life.total(s,c)<=132);assert.ok(s.energy[0]<1.5);});
test('crowding prevents reproduction and excess particles are recycled gradually',()=>{const {s,w,c,a}=setup(),life=new LifeCycle(80);assert.equal(life.reproduce(a,s,c,w),false);const before=s.count;for(let k=0;k<61;k++)life.step(s,c,w);assert.ok(s.count<before);assert.ok(s.count>=before-2);});
test('moderate excess is trimmed so later births are possible',()=>{const {s,w,c}=setup(),life=new LifeCycle(95);for(let k=0;k<60;k++)life.step(s,c,w);assert.equal(s.count,98);});
test('repeated reproductive cycles keep the population within its budget',()=>{
 const {s,w,c,a}=setup(),life=new LifeCycle(100);for(let k=0;k<2800;k++){s.energy.fill(1.5);life.step(s,c,w);assert.ok(life.total(s,c)<=110);assert.ok(w.list.length<=w.max);w.events=[];}
 assert.ok(life.births>=2);assert.ok(c.list.length<=c.target+2);
});
test('a grown hunter incorporates nearby compatible particles without spawning mass',()=>{const {s,w,c,a}=setup(),life=new LifeCycle(100);a.traits={hunt:.8,escape:.2,fecundity:.2};a.growth=.3;s.matrix=s.matrix.map(r=>r.map(()=>.8));const before=s.count;assert.ok(life.grow(a,s,w));assert.equal(a.members.length,4);assert.equal(s.count,before);});

test('fed colossi can grow beyond fourteen members but keep a bounded mass',()=>{const {s,w,a}=setup(),life=new LifeCycle(100);s.type.fill(1);s.matrix=s.matrix.map(r=>r.map(()=>.8));a.faction=1;const count=s.count;while(life.grow(a,s,w)){}assert.equal(a.members.length,24);assert.equal(new Set(a.members).size,24);assert.equal(s.count,count);});

test('optimized budget removes free particles gradually while preserving bodies, fish and projectiles through pool remaps',()=>{
 const s=new Simulation(300,800,600,()=>.5),w=new Walkers(()=>.5),c=new Creatures(2),life=new LifeCycle(300);const a=w.create(s,[0,1,2]);const positions=a.members.map(i=>[s.x[i],s.y[i]]);const orb={i:299};w.thrown=[orb];s.age[299]=s.lifespan[299]*.99;const fish={id:42,stomach:[]};c.list=[fish];
 life.configurePopulation(300,.22);assert.equal(life.requestedTarget,300);assert.equal(life.target,100);
 for(let k=0;k<360;k++){const before=s.count;life.step(s,c,w);assert.ok(before-s.count<=6);assert.deepEqual(a.members.map(i=>[s.x[i],s.y[i]]),positions);assert.ok(orb.i>=0&&orb.i<s.count);assert.equal(c.list[0],fish);}
 assert.ok(s.count<200);assert.ok(s.count>=40);assert.equal(w.list[0],a);assert.equal(a.members.length,3);
});
test('restoring full population budget replenishes gradually without resetting existing bodies',()=>{
 const {s,w,c,a}=setup(),life=new LifeCycle(300);a.age=0;life.configurePopulation(300,.22);life.configurePopulation(300,1);const before=s.count;for(let k=0;k<120;k++)life.step(s,c,w);assert.ok(s.count>before);assert.ok(s.count<=before+8);assert.equal(life.target,300);assert.equal(life.requestedTarget,300);assert.equal(w.list[0],a);
});
test('a fully assembled population is not forcefully dismantled to meet the optimized target',()=>{
 const {s,w,c,a}=setup(),life=new LifeCycle(300);s.reset(300);a.members=Array.from({length:s.count},(_,i)=>i);life.configurePopulation(300,.22);for(let k=0;k<60;k++)life.step(s,c,w);assert.equal(a.members.length,300);assert.equal(s.count,300);
});
test('optimized trimming follows wall time even when physics slows down, without catch-up mass deletion',()=>{const s=new Simulation(300,800,600,()=>.5),w=new Walkers(()=>.5),c=new Creatures(2),life=new LifeCycle(300);life.configurePopulation(300,.22);life.step(s,c,w,0);const first=s.count;life.step(s,c,w,100);assert.equal(s.count,first);life.step(s,c,w,3000);assert.equal(s.count,first-6);});
