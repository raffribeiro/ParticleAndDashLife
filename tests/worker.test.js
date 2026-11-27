import test from 'node:test';import assert from 'node:assert/strict';import {Worker} from 'node:worker_threads';
import {writeFileSync} from 'node:fs';
import {PRESETS} from '../dist/simulation.js';
const transportTracePath=process.env.AUDIO_TRANSPORT_TRACE;
function traceTransport(worker){
 const started=performance.now(),timeline=[],messages=[];
 const at=()=>Math.round((performance.now()-started)*1000)/1000;
 const compact=m=>m.kind==='audio-events'?m:m.kind==='barrier'?m:{kind:'snapshot',revision:m.revision,count:m.count,openingWaiting:m.openingWaiting,openingColorMix:m.openingColorMix};
 let audioBatches=0,replayed=false;const deliver=(message,direction)=>{timeline.push({atMs:at(),direction,message:compact(message)});messages.push(message);};
 worker.on('message',message=>{deliver(message,'worker->harness');if(message.kind==='audio-events'&&++audioBatches===2&&process.env.AUDIO_INJECT_REPLAY&&!replayed){replayed=true;deliver(structuredClone(message),'harness-replay->harness');}});
 return {messages,send(message,label){timeline.push({atMs:at(),direction:'harness->worker',label,message});worker.postMessage(message);},finish(){if(transportTracePath)writeFileSync(transportTracePath,JSON.stringify({startedAt:new Date().toISOString(),timeline},null,2)+'\n');}};
}
function assertUniqueAudioSequence(batches){
 const identities=new Set(),events=[];let previous=-1;
 for(const batch of batches){assert.ok(batch.events.length<=24,'every audio batch stays within the transport ceiling');assert.equal(batch.sequence,batch.events.at(-1).sequence,'envelope sequence identifies its tail event');for(const event of batch.events){assert.equal(event.revision,batch.revision,'event revision matches its envelope');assert.ok(Number.isInteger(event.sequence),'event has an integer sequence');const identity=`${batch.generation}:${event.revision}:${event.sequence}`;assert.ok(!identities.has(identity),`replayed audio identity ${identity} (${event.id}/${event.origin??'none'})`);assert.ok(event.sequence>previous,`audio sequence ${event.sequence} must follow ${previous}`);identities.add(identity);events.push({...event,generation:batch.generation});previous=event.sequence;}}
 return events;
}
test('worker streams finite states, pauses, resets and resumes',async()=>{
const url=new URL('../dist/worker.js',import.meta.url).href;
const bridge=`const {parentPort}=await import('node:worker_threads');globalThis.postMessage=(...args)=>parentPort.postMessage(...args);await import(${JSON.stringify(url)});parentPort.on('message',data=>globalThis.onmessage({data}));`;
const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(bridge)));let messages=[];worker.on('message',m=>{if(m.kind!=='audio-events')messages.push(m);});
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
 const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(bridge)));const messages=[];worker.on('message',m=>{if(m.kind!=='audio-events')messages.push(m);});
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
 const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(bridge))),messages=[];worker.on('message',m=>{if(m.kind!=='audio-events')messages.push(m);});const wait=async p=>{const end=Date.now()+5000;while(!p()){if(Date.now()>end)throw Error('resize worker timeout');await new Promise(r=>setTimeout(r,10));}};
 const cfg={kind:'config',paused:false,visible:true,pointer:null,matrix:PRESETS.symbiosis.matrix,radius:85,force:.65,ecology:false,width:900,height:650,walkers:{enabled:false},creatures:{enabled:true,count:5}};
 try{worker.postMessage({kind:'init',count:300,width:900,height:650});worker.postMessage(cfg);await wait(()=>messages.at(-1)?.openingColorMix===1&&messages.at(-1)?.creatures.length);worker.postMessage({...cfg,paused:true});await wait(()=>messages.at(-1)?.paused===true);const before=messages.at(-1),f=before.creatures[0],length=Math.hypot(f.points[2]-f.points[0],f.points[3]-f.points[1]);worker.postMessage({...cfg,paused:true,width:1400,height:900});await wait(()=>messages.at(-1)?.width===1400);const grown=messages.at(-1).creatures.find(c=>c.id===f.id);assert.ok(Math.abs(Math.hypot(grown.points[2]-grown.points[0],grown.points[3]-grown.points[1])-length)<.001);worker.postMessage({...cfg,paused:true});await wait(()=>messages.at(-1)?.width===900);const restored=messages.at(-1);assert.equal(restored.count,before.count);const points=restored.creatures.find(c=>c.id===f.id).points;assert.ok(points.every((v,i)=>Math.abs(v-f.points[i])<.001));assert.ok(restored.x.every(Number.isFinite));}finally{await worker.terminate();}
});

test('worker adjusts optimized population budgets without resetting the running simulation',async()=>{
 const url=new URL('../dist/worker.js',import.meta.url).href,bridge=`const {parentPort}=await import('node:worker_threads');globalThis.postMessage=(...args)=>parentPort.postMessage(...args);await import(${JSON.stringify(url)});parentPort.on('message',data=>globalThis.onmessage({data}));`;
 const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(bridge))),messages=[];worker.on('message',m=>{if(m.kind!=='audio-events')messages.push(m);});
 const wait=async predicate=>{const end=Date.now()+6000;while(!predicate()){if(Date.now()>end)throw Error('population budget timeout');await new Promise(r=>setTimeout(r,20));}};
 try{worker.postMessage({kind:'init',count:600,width:900,height:650});worker.postMessage({kind:'config',paused:false,visible:true,pointer:null,matrix:PRESETS.symbiosis.matrix,radius:85,force:.65,ecology:false,width:900,height:650,walkers:{enabled:false},combat:{enabled:false},creatures:{enabled:false,count:0},populationTarget:600,populationScale:1});
  await wait(()=>messages.at(-1)?.openingColorMix===1);const before=messages.at(-1).count;
  worker.postMessage({kind:'population-budget',target:600,factor:.35});await wait(()=>messages.at(-1)?.populationBudget===210&&messages.at(-1).count<before-30);
  const reduced=messages.at(-1);assert.equal(reduced.populationRequested,600);assert.equal(reduced.revision,0);assert.equal(reduced.openingColorMix,1);
  worker.postMessage({kind:'population-budget',target:600,factor:1});await wait(()=>messages.at(-1)?.populationBudget===600&&messages.at(-1).count>reduced.count);assert.equal(messages.at(-1).revision,0);
 }finally{await worker.terminate();}
});

test('preflight worker scene does not advance or mutate the waiting live universe',async()=>{
 const url=new URL('../dist/worker.js',import.meta.url).href,bridge=`const {parentPort}=await import('node:worker_threads');globalThis.postMessage=(...args)=>parentPort.postMessage(...args);await import(${JSON.stringify(url)});parentPort.on('message',data=>globalThis.onmessage({data}));`;
 const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(bridge))),messages=[];worker.on('message',m=>{if(m.kind!=='audio-events')messages.push(m);});const wait=async p=>{const end=Date.now()+6000;while(!p()){if(Date.now()>end)throw Error('preflight worker timeout');await new Promise(r=>setTimeout(r,20));}};
 try{worker.postMessage({kind:'init',waitForFrame:true,count:120,populationTarget:1400,width:900,height:650});await wait(()=>messages.length);const before=messages[0];worker.postMessage({kind:'benchmark',id:7,options:{count:240,width:900,height:650}});await wait(()=>messages.some(m=>m.kind==='benchmark-result'));const result=messages.find(m=>m.kind==='benchmark-result');assert.equal(result.error,undefined);assert.equal(result.id,7);assert.ok(result.snapshot.walkers.length>0);
 worker.postMessage({kind:'config',paused:true,visible:true,matrix:PRESETS.symbiosis.matrix,radius:150,force:1.5,width:900,height:650,populationTarget:1400,populationScale:120/1400});await wait(()=>messages.at(-1)?.paused===true);const after=messages.at(-1);assert.equal(after.populationRequested,1400);assert.equal(after.populationBudget,120);assert.equal(after.count,120);assert.equal(after.openingWaiting,true);assert.deepEqual(after.x,before.x);assert.deepEqual(after.y,before.y);
 }finally{await worker.terminate();}
});

test('slow consumers keep only one in-flight snapshot and receive the newest reset after acknowledgement',async()=>{
 const url=new URL('../dist/worker.js',import.meta.url).href,bridge=`const {parentPort}=await import('node:worker_threads');globalThis.postMessage=(...args)=>parentPort.postMessage(...args);await import(${JSON.stringify(url)});parentPort.on('message',data=>data.kind==='barrier'?parentPort.postMessage({barrier:true}):globalThis.onmessage({data}));`;
 const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(bridge))),messages=[];worker.on('message',m=>{if(m.kind!=='audio-events')messages.push(m);});const wait=async p=>{const end=Date.now()+6000;while(!p()){if(Date.now()>end)throw Error('backpressure timeout');await new Promise(r=>setTimeout(r,10));}};
 try{worker.postMessage({kind:'init',backpressure:true,waitForFrame:true,count:80,width:500,height:400});await wait(()=>messages.length===1);for(let i=0;i<100;i++)worker.postMessage({kind:'disturb'});worker.postMessage({kind:'reset',waitForFrame:true,revision:9,count:70});worker.postMessage({kind:'barrier'});await wait(()=>messages.some(m=>m.barrier));assert.equal(messages.filter(m=>!m.barrier).length,1);worker.postMessage({kind:'snapshot-ack'});await wait(()=>messages.some(m=>m.revision===9));const latest=messages.find(m=>m.revision===9);assert.equal(latest.count,70);assert.ok(latest.events.length<=16);assert.ok(latest.x.every(Number.isFinite));worker.postMessage({kind:'snapshot-ack'});worker.postMessage({kind:'start-opening',revision:9});await wait(()=>messages.filter(m=>m.revision===9).length===2);await new Promise(r=>setTimeout(r,300));assert.equal(messages.filter(m=>m.revision===9).length,2);worker.postMessage({kind:'snapshot-ack'});await wait(()=>messages.filter(m=>m.revision===9).length===3);
 }finally{await worker.terminate();}
});

test('audio transport keeps one unacknowledged batch across three timeout windows and resumes without replay',async()=>{
 const url=new URL('../dist/worker.js',import.meta.url).href,bridge=`const {parentPort}=await import('node:worker_threads');globalThis.postMessage=(...args)=>parentPort.postMessage(...args);await import(${JSON.stringify(url)});parentPort.on('message',data=>data.kind==='barrier'?parentPort.postMessage({kind:'barrier'}):globalThis.onmessage({data}));`;
 const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(bridge))),trace=traceTransport(worker),messages=trace.messages,send=trace.send.bind(trace);const wait=async p=>{const end=Date.now()+9000;while(!p()){if(Date.now()>end)throw Error('audio transport timeout');await new Promise(r=>setTimeout(r,10));}};
 try{
  send({kind:'init',backpressure:true,waitForFrame:true,count:180,width:800,height:600},'init');await wait(()=>messages.some(m=>m.revision===0&&!m.kind));
  send({kind:'config',paused:false,visible:true,audioGeneration:0,pointer:null,matrix:PRESETS.symbiosis.matrix,radius:85,force:.65,ecology:false,width:800,height:600,disturbance:{enabled:false,pulseOnly:true}},'configure');
  send({kind:'start-opening',revision:0},'start opening');send({kind:'disturb',revision:0},'first manual pulse');await wait(()=>messages.some(m=>m.kind==='audio-events'));
  for(let i=0;i<100;i++)send({kind:'disturb',revision:0},`burst pulse ${i+1}`);send({kind:'barrier'},'burst processed barrier');await wait(()=>messages.some(m=>m.kind==='barrier'));await new Promise(r=>setTimeout(r,4700));
  const audio=messages.filter(m=>m.kind==='audio-events');assert.equal(audio.length,1,'audio channel waits for its own ACK, not the visual ACK');assert.equal(messages.filter(m=>m.revision===0&&!m.kind).length,1,'visual snapshot remains independently backpressured');
  const first=audio[0];assert.ok(first.events.length<=24);assert.ok(Number.isInteger(first.sequence));send({kind:'audio-ack',revision:0,generation:0,sequence:first.sequence+1},'wrong ACK');await new Promise(r=>setTimeout(r,100));assert.equal(messages.filter(m=>m.kind==='audio-events').length,1,'only the exact batch ACK releases the slot');send({kind:'audio-ack',revision:0,generation:0,sequence:first.sequence},'ACK first batch');await wait(()=>messages.filter(m=>m.kind==='audio-events').length>=2);
  const second=messages.filter(m=>m.kind==='audio-events')[1];assert.ok(second.events.some(e=>e.id==='world.big-bang'),'Big Bang survives pulse coalescing');assert.equal(second.events.filter(e=>e.id==='world.big-bang').length,1);assert.ok(second.events.every(e=>e.revision===0&&Number.isInteger(e.sequence)));
  send({kind:'audio-ack',revision:second.revision,generation:second.generation,sequence:second.sequence},'ACK burst batch');await new Promise(r=>setTimeout(r,200));let batches=messages.filter(m=>m.kind==='audio-events'),events=assertUniqueAudioSequence(batches);assert.equal(events.filter(e=>e.id==='world.big-bang').length,1,'Big Bang identity is emitted once even when later events are legitimate');
  const acked=new Set([`${first.revision}:${first.generation}:${first.sequence}`,`${second.revision}:${second.generation}:${second.sequence}`]);const acknowledgeNew=()=>{for(const batch of messages.filter(m=>m.kind==='audio-events')){const key=`${batch.revision}:${batch.generation}:${batch.sequence}`;if(acked.has(key))continue;acked.add(key);send({kind:'audio-ack',revision:batch.revision,generation:batch.generation,sequence:batch.sequence},'ACK legitimate later batch');}};acknowledgeNew();
  const sequenceBeforeResume=Math.max(...events.map(e=>e.sequence));send({kind:'disturb',revision:0},'post-ACK manual pulse');let resumed=null;while(!resumed){await wait(()=>{batches=messages.filter(m=>m.kind==='audio-events');resumed=batches.flatMap(m=>m.events).find(e=>e.id==='world.pulse'&&e.origin==='manual'&&e.sequence>sequenceBeforeResume);return resumed||batches.some(batch=>!acked.has(`${batch.revision}:${batch.generation}:${batch.sequence}`));});events=assertUniqueAudioSequence(batches);acknowledgeNew();}
  assert.equal(events.filter(e=>e.id==='world.big-bang').length,1);assert.equal(events.filter(e=>e.revision===resumed.revision&&e.sequence===resumed.sequence).length,1,'resumed pulse identity is accepted once');assert.ok(resumed.sequence>sequenceBeforeResume,'resume produces a new event after all earlier identities');
 }finally{trace.finish();await worker.terminate();}
});

test('coalesced manual and tap pulses move revisions to the tail around one Big Bang',async()=>{
 const url=new URL('../dist/worker.js',import.meta.url).href,bridge=`const {parentPort}=await import('node:worker_threads');globalThis.postMessage=(...args)=>parentPort.postMessage(...args);await import(${JSON.stringify(url)});parentPort.on('message',data=>data.kind==='barrier'?parentPort.postMessage({kind:'barrier'}):globalThis.onmessage({data}));`;
 const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(bridge))),messages=[];worker.on('message',m=>messages.push(m));const wait=async p=>{const end=Date.now()+6000;while(!p()){if(Date.now()>end)throw Error('audio ordering timeout');await new Promise(r=>setTimeout(r,10));}};
 try{
  worker.postMessage({kind:'init',waitForFrame:true,count:120,width:600,height:400});worker.postMessage({kind:'config',paused:false,visible:true,audioGeneration:0,pointer:null,matrix:PRESETS.symbiosis.matrix,radius:85,force:.65,ecology:false,width:600,height:400,walkers:{enabled:false},combat:{enabled:false},creatures:{enabled:false,count:0},disturbance:{enabled:false,pulseOnly:true}});await wait(()=>messages.some(m=>m.openingWaiting));worker.postMessage({kind:'disturb',revision:0});await wait(()=>messages.some(m=>m.kind==='audio-events'));
  const first=messages.find(m=>m.kind==='audio-events');worker.postMessage({kind:'disturb',revision:0});worker.postMessage({kind:'start-opening',revision:0});await wait(()=>messages.some(m=>m.openingColorMix===1));worker.postMessage({kind:'interact',action:'click',revision:0,x:30,y:30});worker.postMessage({kind:'disturb',revision:0});worker.postMessage({kind:'barrier'});await wait(()=>messages.some(m=>m.kind==='barrier'));worker.postMessage({kind:'audio-ack',revision:first.revision,generation:first.generation,sequence:first.sequence??first.events.at(-1).sequence});await wait(()=>messages.filter(m=>m.kind==='audio-events').length===2);
  const second=messages.filter(m=>m.kind==='audio-events')[1],pulses=second.events.filter(e=>e.id==='world.pulse');assert.deepEqual(pulses.map(e=>e.origin),['tap','manual']);assert.equal(second.events.filter(e=>e.id==='world.big-bang').length,1);assert.ok(second.events.every((event,index,events)=>index===0||events[index-1].sequence<event.sequence),'batch sequence must be strictly increasing');assert.equal(second.sequence,second.events.at(-1).sequence);
 }finally{await worker.terminate();}
});

test('audio reset drops queued old revisions and waits for the old batch ACK before the new game',async()=>{
 const url=new URL('../dist/worker.js',import.meta.url).href,bridge=`const {parentPort}=await import('node:worker_threads');globalThis.postMessage=(...args)=>parentPort.postMessage(...args);await import(${JSON.stringify(url)});parentPort.on('message',data=>data.kind==='barrier'?parentPort.postMessage({kind:'barrier'}):globalThis.onmessage({data}));`;
 const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(bridge))),messages=[];worker.on('message',m=>messages.push(m));const wait=async p=>{const end=Date.now()+6000;while(!p()){if(Date.now()>end)throw Error('audio reset timeout');await new Promise(r=>setTimeout(r,10));}};
 try{
  worker.postMessage({kind:'init',waitForFrame:true,count:100,width:600,height:400});await wait(()=>messages.some(m=>m.revision===0&&!m.kind));worker.postMessage({kind:'start-opening',revision:0});await wait(()=>messages.some(m=>m.kind==='audio-events'&&m.events.some(e=>e.id==='world.big-bang')));const oldBatch=messages.find(m=>m.kind==='audio-events');
  worker.postMessage({kind:'reset',waitForFrame:true,revision:7,count:100});worker.postMessage({kind:'disturb',revision:0});worker.postMessage({kind:'interact',action:'click',revision:0,x:20,y:20});worker.postMessage({kind:'barrier'});await wait(()=>messages.some(m=>m.kind==='barrier'));worker.postMessage({kind:'start-opening',revision:7});await new Promise(r=>setTimeout(r,900));assert.equal(messages.filter(m=>m.kind==='audio-events'&&m.revision===7).length,0,'reset must preserve the occupied slot');worker.postMessage({kind:'audio-ack',revision:oldBatch.revision,generation:oldBatch.generation,sequence:oldBatch.sequence??oldBatch.events.at(-1).sequence});await wait(()=>messages.some(m=>m.kind==='audio-events'&&m.revision===7&&m.events.some(e=>e.id==='world.big-bang')));
  const next=messages.filter(m=>m.kind==='audio-events'&&m.revision===7).flatMap(m=>m.events);assert.equal(next.filter(e=>e.id==='world.big-bang').length,1);assert.equal(next[0].id,'world.big-bang');assert.equal(next[0].sequence,1);assert.ok(next.every(e=>e.revision===7));assert.ok(next.every((event,index,events)=>index===0||events[index-1].sequence<event.sequence));assert.ok(messages.filter(m=>m.kind==='audio-events'&&m.revision===0).flatMap(m=>m.events).filter(e=>e.id==='world.big-bang').length===1);
 }finally{await worker.terminate();}
});
