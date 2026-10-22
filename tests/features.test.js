import test from 'node:test';import assert from 'node:assert/strict';
import {mutateFeature,feedingFeatures,inheritFeatures} from '../dist/features.js';
import {nourish,metabolize,damageFactor} from '../dist/needs.js';
test('food accumulates before producing a persistent random feature',()=>{const a={};assert.equal(feedingFeatures(a,.3,()=>0),null);assert.equal(feedingFeatures(a,.35,()=>0),'armor');assert.equal(a.features.armor,1);});
test('features have bounded levels and diversity',()=>{const a={};for(let i=0;i<100;i++)mutateFeature(a,()=>.99);assert.equal(Object.keys(a.features).length,4);assert.ok(Object.values(a.features).every(v=>v<=3));});
test('offspring inherit independently and receive a mutation',()=>{const p={features:{armor:2}},c={};inheritFeatures(p,c,()=>0);assert.equal(c.features.armor,3);assert.equal(p.features.armor,2);});
test('armor and digestion change survival and food efficiency',()=>{const a={},b={features:{armor:2,digestion:2}};nourish(a,.1);nourish(b,.1);assert.ok(damageFactor(b)<damageFactor(a));assert.ok(b.needs.reserve>a.needs.reserve);const before=b.needs.reserve;metabolize(b,0);assert.ok(b.needs.reserve<before);});
