import test from 'node:test';
import assert from 'node:assert/strict';
import {acknowledgeAudioMessage,setupAudioStart} from '../dist/app-events.js';
import {createAppAudio} from '../dist/audio-factory.js';

const ids=['ui.start','world.big-bang','world.pulse','creature.birth','creature.death','creature.assemble','creature.break'];

function passiveFactory(output,optionsSeen=[]){
 return options=>{optionsSeen.push(options);return {prepare(){},acceptStart(event){output.push(event);},setState(){},handle(message){output.push(...message.events);},stop(){}};};
}

test('passive middleware receives seven real ids with unchanged metadata through the app gate',()=>{
 const map=Object.fromEntries(ids.map(id=>[id,'example/'+id+'.ogg'])),received=[],calls=[];
 const factory=options=>{
  calls.push(options);
  return {
   prepare(){},
   acceptStart(event){received.push(event);},
   setState(){},
   handle(message){received.push(...message.events);},
   stop(){},
  };
 };
 const audio=createAppAudio({factory,map});
 audio.setState({revision:4,generation:2,paused:false,visible:true});
 const accept=setupAudioStart({audio,onAccepted:()=>{}});
 const start={id:'ui.start',origin:'app',revision:4,generation:2};
 assert.equal(accept(true,start),true);
 const events=ids.slice(1).map((id,index)=>({id,x:10+index,y:20+index,species:index%3,origin:'worker-'+index,revision:4,sequence:index+1}));
 const message={kind:'audio-events',revision:4,generation:2,sequence:events.at(-1).sequence,events};
 const acknowledgements=[];
 acknowledgeAudioMessage({audio,worker:{postMessage:value=>acknowledgements.push(value)},message});
 assert.deepEqual(calls,[{map}],'the app factory is the only composition seam');
 assert.deepEqual(received,[start,...events],'the passive middleware records only the real arguments supplied by app and worker');
 assert.deepEqual(received.map(event=>event.id),ids);
 assert.deepEqual(acknowledgements,[{kind:'audio-ack',revision:4,generation:2,sequence:6}]);
});

test('gate rejects stale envelopes, divergent event revisions and duplicates within and across batches while ACK stays original',()=>{
 const received=[],audio=createAppAudio({factory:passiveFactory(received)}),acks=[];
 audio.setState({revision:7,generation:3,paused:false,visible:true});
 const valid={id:'world.pulse',revision:7,sequence:5,origin:'manual',x:12,y:34,species:2};
 const message={kind:'audio-events',revision:7,generation:3,sequence:8,events:[
  valid,
  {...valid},
  {id:'creature.birth',revision:6,sequence:6,origin:'offspring',species:4},
  {id:'creature.death',revision:7,sequence:7,origin:'worker',species:1},
 ]};
 acknowledgeAudioMessage({audio,worker:{postMessage:value=>acks.push(value)},message});
 audio.handle({kind:'audio-events',revision:7,generation:3,sequence:9,events:[valid,{id:'creature.break',revision:7,sequence:8,origin:'fragment',species:5}]});
 audio.handle({kind:'audio-events',revision:6,generation:3,sequence:10,events:[{id:'world.big-bang',revision:6,sequence:10}]});
 audio.handle({kind:'audio-events',revision:7,generation:2,sequence:11,events:[{id:'world.big-bang',revision:7,sequence:11}]});
 assert.deepEqual(received,[valid,message.events[3],{id:'creature.break',revision:7,sequence:8,origin:'fragment',species:5}]);
 assert.equal(received[0],valid,'event identity and metadata must pass without cloning or conversion');
 assert.deepEqual(acks,[{kind:'audio-ack',revision:7,generation:3,sequence:8}]);
});

test('original envelope is acknowledged when a valid batch reaches an adapter that throws',()=>{
 const audio=createAppAudio({factory:()=>({prepare(){},acceptStart(){},setState(){},stop(){},handle(){throw Error('middleware failed');}})}),acks=[];
 audio.setState({revision:3,generation:4,paused:false,visible:true});
 const message={kind:'audio-events',revision:3,generation:4,sequence:17,events:[{id:'world.big-bang',revision:3,sequence:16}]};
 assert.throws(()=>acknowledgeAudioMessage({audio,worker:{postMessage:value=>acks.push(value)},message}),/middleware failed/);
 assert.deepEqual(acks,[{kind:'audio-ack',revision:3,generation:4,sequence:17}]);
});

test('high-water deduplication never reaccepts an old event after more than 512 newer events',()=>{
 const received=[],audio=createAppAudio({factory:passiveFactory(received)});audio.setState({revision:2,generation:9,paused:false,visible:true});
 const events=Array.from({length:700},(_,index)=>({id:'world.big-bang',revision:2,sequence:index+1,origin:'worker'}));
 audio.handle({kind:'audio-events',revision:2,generation:9,sequence:700,events});
 audio.handle({kind:'audio-events',revision:2,generation:9,sequence:701,events:[events[0]]});
 assert.equal(received.length,700);assert.equal(received[0],events[0]);assert.equal(received.at(-1),events.at(-1));
});

test('audio gates are independent per app instance',()=>{
 const first=[],second=[],a=createAppAudio({factory:passiveFactory(first)}),b=createAppAudio({factory:passiveFactory(second)}),event={id:'world.big-bang',revision:1,sequence:1};
 for(const audio of [a,b])audio.setState({revision:1,generation:1,paused:false,visible:true});
 const message={kind:'audio-events',revision:1,generation:1,sequence:1,events:[event]};a.handle(message);a.handle(message);b.handle(message);
 assert.deepEqual(first,[event]);assert.deepEqual(second,[event]);
});

test('app gate rejects a stale local Start and forwards the current one only once',()=>{
 const received=[],audio=createAppAudio({factory:passiveFactory(received)});audio.setState({revision:4,generation:6,paused:true,visible:true});
 const stale={id:'ui.start',origin:'app',revision:4,generation:5},current={...stale,generation:6};
 audio.acceptStart(stale);audio.acceptStart(current);audio.acceptStart(current);
 assert.deepEqual(received,[current]);
});

test('pause, reset and visibility advance the gate without replay while valid new events keep their order',()=>{
 const received=[],audio=createAppAudio({factory:passiveFactory(received)});audio.setState({revision:1,generation:1,paused:true,visible:true});
 const paused=[{id:'world.big-bang',revision:1,sequence:1},{id:'world.pulse',revision:1,sequence:2,origin:'auto'},{id:'world.pulse',revision:1,sequence:3,origin:'tap'}];
 audio.handle({kind:'audio-events',revision:1,generation:1,sequence:3,events:paused});
 audio.setState({revision:1,generation:2,paused:false,visible:false});
 audio.handle({kind:'audio-events',revision:1,generation:2,sequence:1,events:[{id:'world.pulse',revision:1,sequence:1,origin:'manual'}]});
 audio.setState({revision:1,generation:3,paused:false,visible:true});
 audio.handle({kind:'audio-events',revision:1,generation:1,sequence:4,events:[{id:'world.big-bang',revision:1,sequence:4}]});
 audio.setState({revision:2,generation:4,paused:false,visible:true});
 const fresh=[{id:'world.big-bang',revision:2,sequence:1},{id:'creature.birth',revision:2,sequence:2,species:3}];
 audio.handle({kind:'audio-events',revision:2,generation:4,sequence:2,events:fresh});
 assert.deepEqual(received,[paused[2],...fresh]);
});

test('default empty app composition stays inert through its full lifecycle',()=>{
 let contexts=0,requests=0;
 const audio=createAppAudio({createContext:()=>{contexts++;return {};},fetcher:()=>{requests++;return Promise.reject(Error('must not fetch'));}});
 audio.setState({revision:0,generation:0,paused:true,visible:true});
 audio.prepare();
 audio.acceptStart({id:'ui.start',origin:'app',revision:0,generation:0});
 audio.handle({kind:'audio-events',revision:0,generation:0,events:[{id:'world.big-bang',revision:0,sequence:1}]});
 audio.stop();
 assert.equal(contexts,0);
 assert.equal(requests,0);
});

test('default WebAudio crosses the app gate: preparation is silent and a ready received Start plays synchronously',async()=>{
 let contexts=0,requests=0,resumes=0,started=0;
 const context={destination:{},resume(){resumes++;return Promise.resolve();},decodeAudioData:async data=>data,createBufferSource(){return {connect(){},start(){started++;},stop(){},onended:null};}};
 const audio=createAppAudio({map:{'ui.start':'audio/start.ogg'},createContext:()=>{contexts++;return context;},fetcher:async()=>{requests++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};}});
 audio.setState({revision:5,generation:0,paused:true,visible:true});
 const start={id:'ui.start',origin:'app',revision:5,generation:1},accept=setupAudioStart({audio,onAccepted:()=>audio.setState({revision:5,generation:1,paused:false,visible:true})});
 assert.equal(contexts,1);assert.equal(started,0);assert.equal(resumes,0);
 await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(requests,1);assert.equal(started,0,'preparation must stay silent');
 assert.equal(accept(true,start),true);assert.equal(resumes,1);assert.equal(started,1,'ready Start must play before the gesture returns');
});
