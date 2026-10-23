import test from 'node:test';import assert from 'node:assert/strict';import {Worker} from 'node:worker_threads';
import {PRESETS} from '../dist/simulation.js';
test('worker streams finite states, pauses, resets and resumes',async()=>{
const url=new URL('../dist/worker.js',import.meta.url).href;
const bridge=`const {parentPort}=await import('node:worker_threads');globalThis.postMessage=(...args)=>parentPort.postMessage(...args);await import(${JSON.stringify(url)});parentPort.on('message',data=>globalThis.onmessage({data}));`;
const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(bridge)));let messages=[];worker.on('message',m=>messages.push(m));
const wait=async predicate=>{const end=Date.now()+3000;while(!predicate()){if(Date.now()>end)throw Error('worker timeout');await new Promise(r=>setTimeout(r,10));}};
const config={kind:'config',paused:false,visible:true,pointer:null,matrix:PRESETS.symbiosis.matrix,radius:85,force:.65,ecology:true,width:900,height:650};
try{worker.postMessage({kind:'init',waitForFrame:true,count:300,width:900,height:650});worker.postMessage(config);await wait(()=>messages.length>=1);
assert.equal(messages[0].openingWaiting,true);const waitingCount=messages.length;await new Promise(r=>setTimeout(r,80));assert.equal(messages.length,waitingCount,'opening must wait until the first frame is visible');
worker.postMessage({kind:'start-opening',revision:999});await new Promise(r=>setTimeout(r,40));assert.equal(messages.length,waitingCount,'a stale frame must not start the opening');
worker.postMessage({kind:'start-opening',revision:0});await wait(()=>messages.length>=3);assert.ok(messages.at(-1).x.every(Number.isFinite));assert.ok(messages.at(-1).mobilityMin>=.6);assert.ok(messages.at(-1).mobilityMax<=1.40001);const before=messages.length;const flood=setInterval(()=>worker.postMessage(config),1);await new Promise(r=>setTimeout(r,120));clearInterval(flood);assert.ok(messages.length>before+1,"pointer updates must not starve physics");worker.postMessage({...config,paused:true});await new Promise(r=>setTimeout(r,60));const count=messages.length;await new Promise(r=>setTimeout(r,60));assert.equal(messages.length,count);worker.postMessage({kind:'reset',revision:1,count:500});await wait(()=>messages.at(-1)?.revision===1);{const m=messages.at(-1);assert.equal(m.count+4*m.creatureStats.fish+m.creatureStats.stomach,500,'biomass after reset');}worker.postMessage(config);await wait(()=>messages.length>count+2);worker.postMessage({kind:"disturb"});await wait(()=>messages.some(m=>m.disturbanceEvent?.kind==="pulse"));worker.postMessage({kind:"disturb"});await wait(()=>messages.some(m=>m.disturbanceEvent?.kind==="affinities"));assert.ok(messages.find(m=>m.disturbanceEvent?.kind==="affinities").disturbanceEvent.matrix.flat().every(Number.isFinite));}finally{await worker.terminate();}
});

test('worker handles click pulses and fish drag/drop while paused, rejects stale gestures',async()=>{
 const url=new URL('../dist/worker.js',import.meta.url).href;
 const bridge=`const {parentPort}=await import('node:worker_threads');globalThis.postMessage=(...args)=>parentPort.postMessage(...args);await import(${JSON.stringify(url)});parentPort.on('message',data=>globalThis.onmessage({data}));`;
 const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(bridge)));const messages=[];worker.on('message',m=>messages.push(m));
 const wait=async p=>{const end=Date.now()+4000;while(!p()){if(Date.now()>end)throw Error('interaction worker timeout');await new Promise(r=>setTimeout(r,10));}};
 const config={kind:'config',paused:false,visible:true,pointer:null,matrix:PRESETS.symbiosis.matrix,radius:85,force:.65,ecology:false,width:900,height:650,walkers:{enabled:false},creatures:{enabled:true,count:5}};
 try{
  worker.postMessage({kind:'init',count:300,width:900,height:650});worker.postMessage(config);
  await wait(()=>messages.at(-1)?.openingColorMix===1&&messages.at(-1)?.creatures.length>0);
  worker.postMessage({...config,paused:true});await wait(()=>messages.at(-1)?.paused===true);
  const fish=messages.at(-1).creatures[0],x=fish.points[0],y=fish.points[1];let n=messages.length;
  worker.postMessage({kind:'interact',action:'grab',revision:0,x,y});await wait(()=>messages.length>n);n=messages.length;
  worker.postMessage({kind:'interact',action:'move',revision:0,x:x+80,y:y+30});await wait(()=>messages.length>n);const moved=messages.at(-1);assert.equal(moved.dragging,true);
  const after=moved.creatures.find(c=>c.id===fish.id);assert.ok(Math.abs(after.points[0]-x-80)<.001);assert.ok(Math.abs(after.points[1]-y-30)<.001);n=messages.length;
  worker.postMessage({kind:'interact',action:'drop',revision:0,x:x+80,y:y+30});await wait(()=>messages.length>n);assert.equal(messages.at(-1).dragging,false);n=messages.length;
  worker.postMessage({kind:'interact',action:'click',revision:999,x:200,y:150});await new Promise(r=>setTimeout(r,40));assert.equal(messages.length,n);
  worker.postMessage({kind:'interact',action:'click',revision:0,x:200,y:150});await wait(()=>messages.length>n);const event=messages.at(-1).disturbanceEvent;assert.equal(event.kind,'pulse');assert.equal(event.x,200);assert.equal(event.y,150);
 }finally{await worker.terminate();}
});
