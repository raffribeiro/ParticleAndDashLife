import test from 'node:test';
import assert from 'node:assert/strict';
import {PerformanceGovernor,QUALITY_LEVELS} from '../dist/performance.js';
function run(g,hz,seconds,options={}){let now=g.previous??0;for(let k=0;k<Math.ceil(hz*seconds);k++){now+=1000/hz;g.sample(now,{drawMs:2,stepMs:4,...options});}return now;}
test('calibrates using real 60fps frames without degrading quality',()=>{const g=new PerformanceGovernor();run(g,60,6);assert.ok(g.calibrated);assert.equal(g.level,0);assert.ok(g.fps>59);});
test('sustained missed frames progressively activate all fallbacks without changing population',()=>{const g=new PerformanceGovernor();run(g,35,22);assert.equal(g.level,QUALITY_LEVELS.length-1);assert.ok(g.limited);assert.equal(g.quality.post,false);assert.equal(g.quality.trails,0);assert.equal(g.quality.scale,.25);assert.ok(QUALITY_LEVELS.every(q=>!('count' in q)));});
test('pause and tab suspension are excluded from calibration',()=>{const g=new PerformanceGovernor();run(g,60,2);g.sample(100000,{active:false});g.sample(200000,{active:true});assert.equal(g.level,0);assert.equal(g.calibrated,false);run(g,60,5);assert.ok(g.calibrated);assert.equal(g.level,0);});
test('a long scheduling stall cannot trigger a cascade of degradations',()=>{const g=new PerformanceGovernor();run(g,60,6);g.sample(g.previous+10000);run(g,60,3);assert.equal(g.level,0);});
test('quality recovers slowly and only one level at a time',()=>{const g=new PerformanceGovernor();run(g,40,14);const level=g.level;run(g,60,15);assert.equal(g.level,level);run(g,60,20);assert.equal(g.level,level-1);});
test('CPU submission pressure can trigger fallbacks even before fps collapses',()=>{const g=new PerformanceGovernor();run(g,60,8,{drawMs:15});assert.ok(g.level>0);});
test('turning automatic quality off restores user render quality and stays fixed',()=>{const g=new PerformanceGovernor();run(g,40,10);assert.ok(g.level>0);g.setEnabled(false);run(g,30,10);assert.equal(g.level,0);assert.equal(g.quality.scale,1);assert.equal(g.summary,'Ajuste automático desligado');});
test('very slow visible devices still reach the emergency fallback',()=>{const g=new PerformanceGovernor();run(g,2,30,{drawMs:150});assert.equal(g.level,QUALITY_LEVELS.length-1);assert.ok(g.limited);});
test('physics overload is reported even when rendering reaches 60fps',()=>{const g=new PerformanceGovernor();run(g,60,6,{stepMs:25});assert.ok(g.physicsLimited);assert.match(g.summary,/simulação no limite/);});
test('persistent multi-second visible frames still trigger emergency fallbacks',()=>{const g=new PerformanceGovernor();run(g,.4,75,{drawMs:2400});assert.equal(g.level,QUALITY_LEVELS.length-1);assert.ok(g.limited);});
