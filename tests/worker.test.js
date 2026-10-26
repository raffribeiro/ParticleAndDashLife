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

test('paused worker resizes stroke skeletons coherently through a fullscreen round trip',async()=>{
 const url=new URL('../dist/worker.js',import.meta.url).href,bridge=`const {parentPort}=await import('node:worker_threads');globalThis.postMessage=(...args)=>parentPort.postMessage(...args);await import(${JSON.stringify(url)});parentPort.on('message',data=>globalThis.onmessage({data}));`;
 const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(bridge))),messages=[];worker.on('message',m=>messages.push(m));const wait=async p=>{const end=Date.now()+5000;while(!p()){if(Date.now()>end)throw Error('resize worker timeout');await new Promise(r=>setTimeout(r,10));}};
 const cfg={kind:'config',paused:false,visible:true,pointer:null,matrix:PRESETS.symbiosis.matrix,radius:85,force:.65,ecology:false,width:900,height:650,walkers:{enabled:false},creatures:{enabled:true,count:5}};
 try{worker.postMessage({kind:'init',count:300,width:900,height:650});worker.postMessage(cfg);await wait(()=>messages.at(-1)?.openingColorMix===1&&messages.at(-1)?.creatures.length);worker.postMessage({...cfg,paused:true});await wait(()=>messages.at(-1)?.paused===true);const before=messages.at(-1),f=before.creatures[0],length=Math.hypot(f.points[2]-f.points[0],f.points[3]-f.points[1]);worker.postMessage({...cfg,paused:true,width:1400,height:900});await wait(()=>messages.at(-1)?.width===1400);const grown=messages.at(-1).creatures.find(c=>c.id===f.id);assert.ok(Math.abs(Math.hypot(grown.points[2]-grown.points[0],grown.points[3]-grown.points[1])-length)<.001);worker.postMessage({...cfg,paused:true});await wait(()=>messages.at(-1)?.width===900);const restored=messages.at(-1);assert.equal(restored.count,before.count);const points=restored.creatures.find(c=>c.id===f.id).points;assert.ok(points.every((v,i)=>Math.abs(v-f.points[i])<.001));assert.ok(restored.x.every(Number.isFinite));}finally{await worker.terminate();}
});

test('worker adjusts optimized population budgets without resetting the running simulation',async()=>{
 const url=new URL('../dist/worker.js',import.meta.url).href,bridge=`const {parentPort}=await import('node:worker_threads');globalThis.postMessage=(...args)=>parentPort.postMessage(...args);await import(${JSON.stringify(url)});parentPort.on('message',data=>globalThis.onmessage({data}));`;
 const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(bridge))),messages=[];worker.on('message',m=>messages.push(m));
 const wait=async predicate=>{const end=Date.now()+6000;while(!predicate()){if(Date.now()>end)throw Error('population budget timeout');await new Promise(r=>setTimeout(r,20));}};
 try{worker.postMessage({kind:'init',count:600,width:900,height:650});worker.postMessage({kind:'config',paused:false,visible:true,pointer:null,matrix:PRESETS.symbiosis.matrix,radius:85,force:.65,ecology:false,width:900,height:650,walkers:{enabled:false},combat:{enabled:false},creatures:{enabled:false,count:0},populationTarget:600,populationScale:1});
  await wait(()=>messages.at(-1)?.openingColorMix===1);const before=messages.at(-1).count;
  worker.postMessage({kind:'population-budget',target:600,factor:.35});await wait(()=>messages.at(-1)?.populationBudget===210&&messages.at(-1).count<before-30);
  const reduced=messages.at(-1);assert.equal(reduced.populationRequested,600);assert.equal(reduced.revision,0);assert.equal(reduced.openingColorMix,1);
  worker.postMessage({kind:'population-budget',target:600,factor:1});await wait(()=>messages.at(-1)?.populationBudget===600&&messages.at(-1).count>reduced.count);assert.equal(messages.at(-1).revision,0);
 }finally{await worker.terminate();}
});
