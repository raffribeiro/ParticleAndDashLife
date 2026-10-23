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
