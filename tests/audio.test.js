import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudioController} from '../dist/audio.js';
import {advanceAudioState,setupAudioStart} from '../dist/app-events.js';
import {BigBang} from '../dist/big-bang.js';
import {Simulation} from '../dist/simulation.js';

const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function settle(){await flush();await flush();await flush();}
function harness(map={}){
 let now=0,contexts=0,resumes=0,requests=0,started=0,stopped=0;
 const sources=[];
 const context={state:'suspended',destination:{},resume(){resumes++;this.state='running';return Promise.resolve();},decodeAudioData:async data=>data,createBufferSource(){const source={connect(){},start(){started++;},stop(){stopped++;},onended:null};sources.push(source);return source;}};
 const controller=createAudioController({map,now:()=>now,createContext:()=>{contexts++;return context;},fetcher:async path=>{requests++;if(path.includes('broken'))throw Error('media failed');return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};}});
 return {controller,sources,set now(value){now=value;},get contexts(){return contexts;},get resumes(){return resumes;},get requests(){return requests;},get started(){return started;},get stopped(){return stopped;}};
}
const state=(controller,overrides={})=>controller.setState({revision:2,generation:3,paused:false,visible:true,...overrides});
const batch=(events,overrides={})=>({kind:'audio-events',revision:2,generation:3,events,...overrides});
const startEvent=(overrides={})=>({id:'ui.start',origin:'app',revision:2,generation:3,...overrides});
async function warm(h){h.controller.prepare();await settle();h.controller.acceptStart(startEvent());}

test('empty audio map creates no context and makes no media request during prepare, setup or Start',async()=>{const h=harness();state(h.controller);h.controller.prepare();h.controller.acceptStart(startEvent());h.controller.handle(batch([{id:'world.big-bang',revision:2,sequence:1}]));await settle();assert.equal(h.contexts,0);assert.equal(h.requests,0);});

test('prepare before the gesture is silent and ready ui.start plays once from the received first Start event',async()=>{const h=harness({'ui.start':'audio/start.ogg'});state(h.controller,{paused:true});h.controller.prepare();assert.equal(h.contexts,1);assert.equal(h.resumes,0);assert.equal(h.started,0);await settle();assert.equal(h.requests,1);assert.equal(h.resumes,0);assert.equal(h.started,0,'preparation must not play before the gesture');const event=startEvent();const result=h.controller.acceptStart(event);assert.equal(result,undefined);assert.equal(h.resumes,1);assert.equal(h.started,1,'ready ui.start must play inside the accepted gesture even while initial state is paused');h.controller.acceptStart(event);h.controller.setState({revision:3,generation:4,paused:true,visible:true});h.controller.acceptStart({...event,revision:3,generation:4});assert.equal(h.started,1,'second Start and reset must not repeat ui.start');});

test('default adapter plays the exact Start event it receives instead of manufacturing an id',async()=>{const h=harness({'world.big-bang':'audio/bang.ogg'});state(h.controller,{paused:false});h.controller.prepare();await settle();h.controller.acceptStart({id:'world.big-bang',origin:'app',revision:2,generation:3});assert.equal(h.started,1);});

test('accepted app state is applied before ui.start so its source is not stopped by the gesture',async()=>{
 const h=harness({'ui.start':'audio/start.ogg'});let generation=0,paused=true;
 h.controller.setState({revision:2,generation,paused,visible:true});
 const accept=setupAudioStart({audio:h.controller,onAccepted:()=>{paused=false;generation=advanceAudioState({audio:h.controller,revision:2,generation,paused,visible:true});}});
 assert.equal(h.started,0,'setup must stay silent before the gesture');
 await settle();
 assert.equal(accept(true,startEvent({generation:1})),true);
 assert.equal(h.started,1,'the accepted gesture must create ui.start exactly once');
 assert.equal(h.stopped,0,'the accepted state transition must happen before ui.start exists');
 assert.equal(accept(true),false);
 assert.equal(h.started,1,'a second click must not replay ui.start');
});

test('AudioContext creation failure cannot escape the accepted Start gesture',()=>{const controller=createAudioController({map:{'ui.start':'audio/start.ogg'},createContext:()=>{throw Error('audio unavailable');}});state(controller);assert.doesNotThrow(()=>controller.acceptStart(startEvent()));});

test('duplicate and old-revision events are ignored after media is warm',async()=>{const h=harness({'world.big-bang':'audio/bang.ogg'});state(h.controller);await warm(h);h.controller.handle(batch([{id:'world.big-bang',revision:2,sequence:4},{id:'world.big-bang',revision:2,sequence:4}]));h.controller.handle(batch([{id:'world.big-bang',revision:1,sequence:5}],{revision:1}));assert.equal(h.started,1);});

test('one failed media file is isolated from later valid playback',async()=>{const h=harness({'world.big-bang':'audio/broken.ogg','world.pulse':'audio/pulse.ogg'});state(h.controller);await warm(h);h.controller.handle(batch([{id:'world.big-bang',revision:2,sequence:1},{id:'world.pulse',revision:2,sequence:2,origin:'manual'}]));assert.equal(h.requests,2);assert.equal(h.started,1);});

test('pending preparation never delays Start or replays ui.start when media resolves',async()=>{
 let resolveFetch,started=0;const context={state:'suspended',destination:{},resume(){this.state='running';return Promise.resolve();},decodeAudioData:async x=>x,createBufferSource:()=>({connect(){},start(){started++;},stop(){},onended:null})};
 const controller=createAudioController({map:{'ui.start':'audio/start.ogg'},createContext:()=>context,fetcher:()=>new Promise(resolve=>{resolveFetch=resolve;}),now:()=>0});state(controller,{paused:true});controller.prepare();await flush();const result=controller.acceptStart(startEvent());assert.equal(result,undefined);assert.equal(started,0);resolveFetch({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});await settle();assert.equal(started,0,'ui.start must not be scheduled after its accepted gesture');
});

test('accepted Start generation change preserves pending preparation without late ui.start',async()=>{
 let resolveFetch,started=0;const context={state:'suspended',destination:{},resume(){this.state='running';return Promise.resolve();},decodeAudioData:async x=>x,createBufferSource:()=>({connect(){},start(){started++;},stop(){},onended:null})};
 const path='audio/shared.ogg',controller=createAudioController({map:{'ui.start':path,'world.big-bang':path},createContext:()=>context,fetcher:()=>new Promise(resolve=>{resolveFetch=resolve;}),now:()=>0});state(controller);const accept=setupAudioStart({audio:controller,onAccepted:()=>controller.setState({revision:2,generation:4,paused:false,visible:true})});await flush();accept(true,startEvent({generation:4}));resolveFetch({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});await settle();assert.equal(started,0,'pending ui.start must not replay after the gesture');controller.handle(batch([{id:'world.big-bang',revision:2,sequence:1}],{generation:4}));assert.equal(started,1,'the accepted Start generation change must not discard the shared preparation');
});

test('failed preparation does not block accepted Start or produce delayed playback',async()=>{const h=harness({'ui.start':'audio/broken.ogg'});state(h.controller,{paused:true});h.controller.prepare();const result=h.controller.acceptStart(startEvent());assert.equal(result,undefined);await settle();assert.equal(h.started,0);assert.equal(h.requests,1);});

test('twenty events during one retained fetch play zero late sounds and the next ready event plays',async()=>{
 let resolveFetch,started=0,requests=0;const context={state:'running',destination:{},resume:()=>Promise.resolve(),decodeAudioData:async x=>x,createBufferSource:()=>({connect(){},start(){started++;},stop(){},onended:null})};
 const controller=createAudioController({map:{'world.pulse':'audio/pulse.ogg'},createContext:()=>context,fetcher:()=>{requests++;return new Promise(resolve=>{resolveFetch=resolve;});},now:()=>0});state(controller);controller.prepare();controller.acceptStart(startEvent());await flush();assert.equal(requests,1);
 controller.handle(batch(Array.from({length:20},(_,i)=>({id:'world.pulse',revision:2,sequence:i+1,origin:'manual'}))));resolveFetch({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});await settle();assert.equal(started,0,'events observed while media is pending are dropped, not attached to the fetch');
 controller.handle(batch([{id:'world.pulse',revision:2,sequence:21,origin:'manual'}]));assert.equal(started,1,'the next eligible event may use the ready buffer');
});

test('pause and visibility cut active voices and invalidate late media completions',async()=>{
 let resolveFetch,started=0;const context={state:'running',destination:{},resume:()=>Promise.resolve(),decodeAudioData:async x=>x,createBufferSource:()=>({connect(){},start(){started++;},stop(){},onended:null})};
 const controller=createAudioController({map:{'world.big-bang':'audio/bang.ogg'},createContext:()=>context,fetcher:()=>new Promise(resolve=>{resolveFetch=resolve;}),now:()=>0});state(controller);controller.prepare();controller.acceptStart(startEvent());await flush();controller.handle(batch([{id:'world.big-bang',revision:2,sequence:1}]));controller.setState({revision:2,generation:4,paused:false,visible:false});controller.setState({revision:2,generation:5,paused:false,visible:true});resolveFetch({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});await settle();assert.equal(started,0,'old load must not replay after returning');
 const h=harness({'world.big-bang':'audio/bang.ogg'});state(h.controller);await warm(h);h.controller.handle(batch([{id:'world.big-bang',revision:2,sequence:2}]));h.controller.setState({revision:2,generation:4,paused:true,visible:true});assert.equal(h.stopped,1);
});

test('playback is capped at four voices with no queued replay',async()=>{const map=Object.fromEntries(['world.big-bang','world.pulse','creature.birth','creature.death','creature.assemble','creature.break'].map(id=>[id,'audio/'+id+'.ogg'])),h=harness(map);state(h.controller);await warm(h);h.controller.handle(batch(Object.keys(map).map((id,i)=>({id,revision:2,sequence:i+1,origin:'manual',species:i}))));assert.equal(h.started,4);for(const source of h.sources)source.onended?.();await flush();assert.equal(h.started,4,'overflow is dropped, never queued');});

test('creature event types have a 120 ms minimum interval',async()=>{const h=harness({'creature.birth':'audio/birth.ogg'});state(h.controller);await warm(h);h.controller.handle(batch([{id:'creature.birth',revision:2,sequence:1,species:1}]));h.now=119;h.controller.handle(batch([{id:'creature.birth',revision:2,sequence:2,species:2}]));h.now=120;h.controller.handle(batch([{id:'creature.birth',revision:2,sequence:3,species:3}]));assert.equal(h.started,2);});

test('only explicit pulse may play while paused and visible',async()=>{const h=harness({'world.pulse':'audio/pulse.ogg'});state(h.controller,{paused:true});await warm(h);h.controller.setState({revision:2,generation:3,paused:true,visible:true});h.controller.handle(batch([{id:'world.pulse',revision:2,sequence:1,origin:'auto'},{id:'world.pulse',revision:2,sequence:2,origin:'tap'}]));assert.equal(h.started,1);h.controller.setState({revision:2,generation:4,paused:true,visible:false});h.controller.handle(batch([{id:'world.pulse',revision:2,sequence:3,origin:'manual'}],{generation:4}));assert.equal(h.started,1);});

test('messages from a prior visibility generation stay invalid after returning',async()=>{const h=harness({'world.big-bang':'audio/bang.ogg'});state(h.controller);await warm(h);h.controller.setState({revision:2,generation:4,paused:false,visible:false});h.controller.setState({revision:2,generation:5,paused:false,visible:true});await settle();h.controller.handle(batch([{id:'world.big-bang',revision:2,sequence:9}],{generation:3}));assert.equal(h.started,0);});

test('real Big Bang producer reaches the ready audio adapter exactly once',async()=>{const h=harness({'world.big-bang':'audio/bang.ogg'});state(h.controller);await warm(h);const sim=new Simulation(40,800,600,()=>.5),events=[],bigBang=new BigBang(sim,event=>events.push({...event,revision:2,sequence:events.length+1}));while(bigBang.step(sim)){}h.controller.handle(batch(events));assert.equal(events.filter(event=>event.id==='world.big-bang').length,1);assert.equal(h.started,1);});
