const CREATURE_INTERVAL=120,MAX_VOICES=4;

export function createAudioController({map={},createContext=()=>new (globalThis.AudioContext||globalThis.webkitAudioContext)(),fetcher=(...args)=>fetch(...args),now=()=>performance.now()}={}){
 const paths=Object.values(map).filter(path=>typeof path==='string'&&path),enabled=paths.length>0;
 let context=null,accepted=false,startPlayed=false,revision=0,generation=0,paused=true,visible=true,epoch=0;
 const active=new Set(),buffers=new Map(),loading=new Map(),failed=new Set(),seen=new Set(),lastCreature=new Map();
 function stop(invalidateLoads=true){if(invalidateLoads){epoch++;loading.clear();}for(const source of active){try{source.stop();}catch{}}active.clear();}
 function setState(next){const identityChanged=next.revision!==revision||next.generation!==generation;if(identityChanged){seen.clear();lastCreature.clear();stop(accepted);}revision=next.revision;generation=next.generation;paused=!!next.paused;visible=!!next.visible;if(!visible||paused)stop(accepted);else if(accepted)warmAll();}
 function ensureContext(){if(!enabled)return null;if(!context)context=createContext();return context;}
 function warm(path){if(buffers.has(path)||loading.has(path)||failed.has(path))return;const token=epoch,job=Promise.resolve().then(async()=>{const response=await fetcher(path);if(!response?.ok)throw Error('audio request failed');const buffer=await ensureContext().decodeAudioData(await response.arrayBuffer());if(token===epoch)buffers.set(path,buffer);}).catch(()=>failed.add(path)).finally(()=>{if(loading.get(path)===job)loading.delete(path);});loading.set(path,job);}
 function warmAll(){for(const path of new Set(paths))warm(path);}
 function allowed(event){if(!visible)return false;if(paused&&event.id!=='ui.start'&&!(event.id==='world.pulse'&&(event.origin==='tap'||event.origin==='manual')))return false;if(!event.id.startsWith('creature.'))return true;const time=now(),last=lastCreature.get(event.id);if(last!==undefined&&time-last<CREATURE_INTERVAL)return false;lastCreature.set(event.id,time);return true;}
 function play(event){const path=map[event.id],buffer=buffers.get(path);if(!accepted||!path||!buffer||!allowed(event)||active.size>=MAX_VOICES)return;if(paused&&!(event.id==='world.pulse'&&(event.origin==='tap'||event.origin==='manual'))&&event.id!=='ui.start')return;let source;try{source=ensureContext().createBufferSource();source.buffer=buffer;source.connect(context.destination);source.onended=()=>active.delete(source);active.add(source);source.start();}catch{if(source)active.delete(source);}}
 function prepare(){if(!enabled)return;try{ensureContext();warmAll();}catch{}}
 function acceptStart(event){if(accepted)return;accepted=true;if(!enabled)return;let ctx;try{ctx=ensureContext();}catch{return;}try{Promise.resolve(ctx.resume?.()).catch(()=>{});}catch{}warmAll();if(!startPlayed){startPlayed=true;play(event);}}
 function handle(message){if(!accepted||message.revision!==revision||message.generation!==generation||!Array.isArray(message.events))return;for(const event of message.events){const key=event.revision+':'+event.sequence;if(event.revision!==revision||seen.has(key))continue;seen.add(key);if(seen.size>512)seen.delete(seen.values().next().value);play(event);}}
 return {prepare,acceptStart,handle,setState,stop};
}
