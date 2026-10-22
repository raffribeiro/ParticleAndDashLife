import test from 'node:test';import assert from 'node:assert/strict';
import {splitDrawLayers} from '../dist/draw-order.js';
test('tails and legs stay behind body particles; heads stay above free fish',()=>{
 const list=[{id:5,role:'head'},{id:3},{id:4,role:'leg'},{id:2,role:'tail'},{id:1}];
 const a=splitDrawLayers(list),b=splitDrawLayers([...list].reverse());
 assert.deepEqual(a.under.map(c=>c.id),[2,4]);assert.deepEqual(a.over.map(c=>c.id),[1,3,5]);assert.deepEqual(a,b);assert.equal(list[0].id,5);
});
