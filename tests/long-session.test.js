import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../dist/simulation.js';
import {Creatures} from '../dist/creatures.js';
import {Walkers} from '../dist/walkers.js';
import {Ecology} from '../dist/ecology.js';
import {LifeCycle} from '../dist/life-cycle.js';
import {Combat} from '../dist/combat.js';
import {TrailHistory} from '../dist/trail-history.js';
import {EventEffects} from '../dist/effects.js';

test('repeated feeding, births, combat, effects and trails stay within finite budgets',()=>{
 let seed=17;const rng=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 const sim=new Simulation(120,500,400,rng),fish=new Creatures(19),walkers=new Walkers(rng),ecology=new Ecology(),life=new LifeCycle(120),combat=new Combat(rng),history=new TrailHistory(),effects=new EventEffects();fish.target=6;walkers.max=6;sim.bonding=true;
 let maxBiomass=0;
 for(let tick=0;tick<6000;tick++){
  sim.step();ecology.step(sim,fish.list,walkers.list,null,1,walkers);fish.step(sim);walkers.step(sim,1,fish.list);life.step(sim,fish,walkers,tick*1000/60);combat.step(sim,walkers,fish.list,fish);
  maxBiomass=Math.max(maxBiomass,life.total(sim,fish));
  if(tick%5===0){history.update(sim,tick*1000/60);effects.update([...fish.events||[],...walkers.events],tick*1000/60);fish.events=[];walkers.events=[];}
  assert.ok(life.total(sim,fish)<=140,'birth and feeding budgets must remain bounded');assert.ok(walkers.list.length<=walkers.max+4);assert.ok(combat.fx.length<=64);assert.ok(effects.items.length<=24);assert.ok(history.valid<=24);assert.ok(sim.x.every(Number.isFinite));
 }
 assert.ok(maxBiomass>=110);assert.ok(history.data.length<=128*2*24*4);assert.equal(ecology.patches.length,6);
 effects.update([],1e9);assert.equal(effects.items.length,0);
});
