import test from 'node:test';import assert from 'node:assert/strict';
import {ensureNeeds,nourish,metabolize,damageFactor} from '../dist/needs.js';
test('activity consumes reserves and prolonged hunger damages health',()=>{const a={};for(let i=0;i<1800;i++)metabolize(a,0);assert.equal(a.needs.reserve,0);assert.equal(a.needs.hunger,1);assert.ok(a.needs.health<.5);});
test('food grows strength and resistance and restores a hungry creature',()=>{const a={};ensureNeeds(a);a.needs.reserve=0;a.needs.health=.4;const before=damageFactor(a);nourish(a,.9);for(let i=0;i<300;i++)metabolize(a,.001);assert.ok(a.growth>0);assert.ok(a.strength>1);assert.ok(damageFactor(a)<before);assert.ok(a.needs.health>.4);});
test('rest saves food and growth remains bounded',()=>{const a={},b={behavior:{resting:true}};metabolize(a,0,100);metabolize(b,0,100);assert.ok(b.needs.reserve>a.needs.reserve);nourish(a,100);assert.equal(a.growth,1);assert.equal(a.needs.reserve,1.5);});
