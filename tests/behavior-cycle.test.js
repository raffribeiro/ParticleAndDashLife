import test from 'node:test';import assert from 'node:assert/strict';
import {BehaviorCycle} from '../dist/behavior-cycle.js';
import {Simulation,PRESETS} from '../dist/simulation.js';
test('behavior cycles smoothly without changing particle identities',()=>{
 const s=new Simulation(10,800,600,()=>.5),c=new BehaviorCycle();c.configure({interval:10});const X=s.x,Y=s.y,V=s.vx;const before=s.matrix.map(r=>[...r]);
 c.advance(s,10);assert.equal(c.key,'currents');assert.deepEqual(s.matrix,before);c.advance(s,2);assert.notDeepEqual(s.matrix,before);assert.notDeepEqual(s.matrix,PRESETS.currents.matrix);
 c.advance(s,2);assert.deepEqual(s.matrix,PRESETS.currents.matrix);assert.equal(s.x,X);assert.equal(s.y,Y);assert.equal(s.vx,V);
 c.advance(s,10);assert.equal(c.key,'predator');
});
test('disabled cycles freeze and manual selection resets the countdown',()=>{
 const s=new Simulation(2),c=new BehaviorCycle();c.configure({enabled:false});c.advance(s,100);assert.equal(c.key,'symbiosis');assert.equal(c.elapsed,0);
 c.configure({enabled:true,interval:10});c.advance(s,5);c.manual('colonies');assert.equal(c.elapsed,0);assert.equal(c.key,'colonies');c.advance(s,10);assert.equal(c.key,'symbiosis');
});

test('automatic cycle visits symbiosis, currents, predator and colonies in turn',()=>{const s=new Simulation(2),c=new BehaviorCycle(),K=['currents','predator','colonies','symbiosis'];for(let i=0;i<12;i++){c.advance(s,30);assert.equal(c.key,K[i%4]);c.advance(s,4);}});
test('a kick starts the next behavior right away',()=>{const s=new Simulation(2),c=new BehaviorCycle();c.configure({kick:1});c.advance(s,1/60);assert.equal(c.key,'currents');});
