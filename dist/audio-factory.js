import {createAudioController} from './audio.js?v=1.46.3';
import {audioMap} from './audio-map.js?v=1.46.3';

// Single app composition seam for the audio lifecycle adapter.
export function createAppAudio({factory=createAudioController,map=audioMap,...options}={}){
 const adapter=factory({map,...options});
 let revision=0,generation=0,sequence=0,paused=true,visible=true,startAccepted=false;
 function setState(state){if(state.revision!==revision||state.generation!==generation)sequence=0;revision=state.revision;generation=state.generation;paused=!!state.paused;visible=!!state.visible;adapter.setState(state);}
 function eligible(event){return visible&&(!paused||event.id==='world.pulse'&&(event.origin==='tap'||event.origin==='manual'));}
 function handle(message){
  if(message.revision!==revision||message.generation!==generation||!Array.isArray(message.events))return;
  const events=[];
  for(const event of message.events){
   if(event.revision!==revision||!Number.isInteger(event.sequence)||event.sequence<=sequence)continue;
   sequence=event.sequence;
   if(eligible(event))events.push(event);
  }
  if(events.length)adapter.handle({...message,events});
 }
 function acceptStart(event){if(startAccepted||!event||event.id!=='ui.start'||event.origin!=='app'||event.revision!==revision||event.generation!==generation)return;startAccepted=true;adapter.acceptStart(event);}
 return {prepare:()=>adapter.prepare(),acceptStart,handle,setState,stop:(...args)=>adapter.stop(...args)};
}
