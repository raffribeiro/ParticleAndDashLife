import test from 'node:test';import assert from 'node:assert/strict';
import {stepSoftStrand} from '../dist/soft-strand.js';
const strand=()=>({id:4,x:Float64Array.from({length:10},(_,i)=>100-i*3.4),y:new Float64Array(10).fill(100),spacing:3.4,heading:0});
test('a strand anchors its root while the tip lags and bends in water',()=>{const c=strand();let bend=0;for(let t=0;t<80;t++){stepSoftStrand(c,[100+t*.5,100+Math.sin(t*.06)*8],[.5,0],t,800,600);bend=Math.max(bend,Math.abs(c.y[9]-c.y[0]));}assert.equal(c.x[0],139.5);assert.ok(bend>1);for(let i=1;i<10;i++)assert.ok(Math.abs(Math.hypot(c.x[i]-c.x[i-1],c.y[i]-c.y[i-1])-3.4)<.8);});
test('soft strands stay finite and connected across a wrapped edge',()=>{const c=strand();for(let t=0;t<1000;t++)stepSoftStrand(c,[(790+t*.5)%800,100],[.5,0],t,800,600);assert.ok([...c.x,...c.y].every(Number.isFinite));for(let i=1;i<10;i++)assert.ok(Math.hypot(c.x[i]-c.x[i-1],c.y[i]-c.y[i-1])<5);});
