import test from 'node:test';import assert from 'node:assert/strict';
import {EventEffects} from '../dist/effects.js';
test('event effects deduplicate snapshots, expire, and bound their cost',()=>{
 const fx=new EventEffects(),events=[{kind:'death',x:10,y:20,species:0}];
 fx.update(events,0);fx.update(events,16);assert.equal(fx.items.length,1);
 for(let k=0;k<100;k++)fx.update([{kind:'birth',x:0,y:0,species:1}],k+20);
 assert.ok(fx.items.length<=24);fx.update([],3000);assert.equal(fx.items.length,0);
});
import {CreatureMesh} from '../dist/creature-mesh.js';
import {DEFAULT_PALETTE} from '../dist/color.js';
import {Creatures,createFish,seededRandom} from '../dist/creatures.js';
test('a real death emits a coloured event without replacing the biomass rules',()=>{
 const cs=new Creatures(1),c=createFish('rect',seededRandom(2),100,100,0,2,1);cs.added=[];c.dead=true;
 cs.dissolve(c);assert.equal(cs.events[0].kind,'death');assert.equal(cs.events[0].species,2);assert.equal(cs.added.length,4);
});
test('event geometry remains finite and local',()=>{
 const m=new CreatureMesh(null,null);m.palette=DEFAULT_PALETTE;m.world=[800,600];
 m.build([{kind:'event',event:'death',x:400,y:300,species:2,t:.4}],null);
 assert.ok(m.n>0);assert.ok(m.data.subarray(0,m.n*9).every(Number.isFinite));
 for(let k=0;k<m.n;k++)assert.ok(Math.hypot(m.data[k*9]-400,m.data[k*9+1]-300)<40);
});
import {Simulation} from '../dist/simulation.js';
test('released fish ease back into swimming without a first-frame jump',()=>{
 const sim=new Simulation(10,800,600,()=>.5),cs=new Creatures(2),c=createFish('rect',seededRandom(3),200,200,0,0,1);
 cs.wake=false;cs.removed=new Set();cs.added=[];c.release={age:0};const x=c.x[0],y=c.y[0];
 cs.update(c,sim,null);assert.ok(Math.hypot(c.x[0]-x,c.y[0]-y)<.1);
 for(let k=0;k<35;k++)cs.update(c,sim,null);assert.equal(c.release,null);assert.ok([...c.x,...c.y].every(Number.isFinite));
});
