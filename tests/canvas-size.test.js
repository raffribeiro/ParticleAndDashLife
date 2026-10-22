import test from 'node:test';import assert from 'node:assert/strict';
import {canvasSize} from '../dist/canvas-size.js';
test('canvas dimensions follow its container instead of window or drawing buffer',()=>{const c={clientWidth:420,clientHeight:240,width:1600,height:900};assert.deepEqual(canvasSize(c),{width:420,height:240});c.clientWidth=240;c.clientHeight=420;assert.deepEqual(canvasSize(c),{width:240,height:420});});
test('hidden canvas remains finite and rectangle is a valid fallback',()=>{assert.deepEqual(canvasSize({clientWidth:0,clientHeight:0}),{width:1,height:1});assert.deepEqual(canvasSize({getBoundingClientRect:()=>({width:320,height:180})}),{width:320,height:180});});
