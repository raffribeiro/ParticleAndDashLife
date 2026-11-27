import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceAudioState,acknowledgeAudioMessage,createWebglContextLostHandler,setupAudioStart} from '../dist/app-events.js';

test('audio setup prepares immediately and only the first accepted Start reaches the controller',()=>{
 const calls=[],start={id:'ui.start',origin:'app',revision:4,generation:2},gate=setupAudioStart({audio:{prepare:()=>calls.push('prepare'),acceptStart:event=>calls.push(event)},onAccepted:()=>calls.push('accepted')});
 assert.deepEqual(calls,['prepare']);assert.equal(gate(false,start),false);assert.deepEqual(calls,['prepare'],'a refused Start must not unlock audio');assert.equal(gate(true,start),true);assert.deepEqual(calls,['prepare','accepted',start]);assert.equal(gate(true,start),false);assert.deepEqual(calls,['prepare','accepted',start],'Restart or a second accepted callback must not repeat Start');
});

test('real WebGL context loss callback pauses, advances audio identity, syncs worker and shows notice',()=>{
 const calls=[],notice={textContent:'',style:{display:'none'}},audio={setState:value=>calls.push(['audio',value]),stop:()=>calls.push(['stop'])},worker={postMessage:value=>calls.push(['worker',value])};
 let paused=false,generation=4;
 const pause=()=>{paused=true;generation=advanceAudioState({audio,revision:7,generation,paused,visible:true});worker.postMessage({kind:'config',paused,audioGeneration:generation});};
 const callback=createWebglContextLostHandler({pause,notice});let prevented=false;callback({preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.equal(paused,true);assert.equal(generation,5);assert.deepEqual(calls,[['audio',{revision:7,generation:5,paused:true,visible:true}],['worker',{kind:'config',paused:true,audioGeneration:5}]]);assert.equal(notice.style.display,'block');assert.match(notice.textContent,/GPU rendering was interrupted/);
});

test('audio batch is acknowledged in finally when adapter throws',()=>{
 const sent=[],message={kind:'audio-events',revision:3,generation:8,sequence:11,events:[{id:'world.pulse',revision:3,sequence:11}]};
 assert.throws(()=>acknowledgeAudioMessage({audio:{handle(){throw Error('adapter failed');}},worker:{postMessage:value=>sent.push(value)},message}),/adapter failed/);
 assert.deepEqual(sent,[{kind:'audio-ack',revision:3,generation:8,sequence:11}]);
});

test('audio ACK copies the original envelope sequence even when its events end elsewhere',()=>{
 const sent=[],message={kind:'audio-events',revision:3,generation:8,sequence:41,events:[{id:'world.pulse',revision:3,sequence:99}]};
 acknowledgeAudioMessage({audio:{handle(){}},worker:{postMessage:value=>sent.push(value)},message});
 assert.deepEqual(sent,[{kind:'audio-ack',revision:3,generation:8,sequence:41}]);
});
