import test from 'node:test';
import assert from 'node:assert/strict';
import {FrameClock} from '../dist/timing.js';
test('60 Hz on 60 and 120 Hz displays without accumulated drift',()=>{for(const hz of [60,120]){const c=new FrameClock(60);let draws=0;for(let i=0;i<=hz*10;i++)if(c.due(i*1000/hz))draws++;assert.ok(draws>=599&&draws<=602,`${hz}: ${draws}`);}});
test('resuming a suspended frame clock does not create catch-up bursts',()=>{const c=new FrameClock(60);c.due(0);assert.equal(c.due(5000),true);assert.equal(c.due(5001),false);});

test('opening waits 15 seconds after readiness, idles indefinitely and restores immediately on Start',async()=>{const {OpeningIdle}=await import('../dist/timing.js');const idle=new OpeningIdle();assert.equal(idle.update(0,{ready:false}),false);assert.equal(idle.update(10000,{ready:true}),false);assert.equal(idle.update(24999,{ready:true}),false);assert.equal(idle.update(25000,{ready:true}),true);assert.equal(idle.update(3600000,{ready:true}),true);assert.equal(idle.update(3600001,{ready:true,started:true}),false);assert.equal(idle.update(3600002,{ready:true,hidden:true}),false);assert.equal(idle.update(3600003,{ready:true}),false);});
test('changing between 60 and 30 fps preserves cadence without catch-up after a long wait',()=>{const clock=new FrameClock();clock.due(0);clock.setRate(30);let draws=0;for(let i=0;i<600;i++)if(clock.due(i*1000/60))draws++;assert.ok(draws>=299&&draws<=301);clock.setRate(60);assert.equal(clock.due(3600000),true);assert.equal(clock.due(3600001),false);});
