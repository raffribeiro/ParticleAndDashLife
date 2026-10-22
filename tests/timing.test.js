import test from 'node:test';
import assert from 'node:assert/strict';
import {FrameClock} from '../dist/timing.js';
test('60 Hz on 60 and 120 Hz displays without accumulated drift',()=>{for(const hz of [60,120]){const c=new FrameClock(60);let draws=0;for(let i=0;i<=hz*10;i++)if(c.due(i*1000/hz))draws++;assert.ok(draws>=599&&draws<=602,`${hz}: ${draws}`);}});
test('resuming a suspended frame clock does not create catch-up bursts',()=>{const c=new FrameClock(60);c.due(0);assert.equal(c.due(5000),true);assert.equal(c.due(5001),false);});
