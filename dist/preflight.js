import {TrailHistory} from './trail-history.js?v=1.44.0';
// GPU probes use the real renderer. Redraw the nucleus before the browser presents a frame.
// Small pure helpers are kept here so the main thread does not import the worker scene.
const percentile95=values=>[...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*.95)-1)]||0;
export const benchmarkCounts=requested=>[...new Set([Math.min(120,requested),240,480,960,1920,3840,requested].filter(n=>n<=requested))].sort((a,b)=>a-b);
import {QUALITY_LEVELS} from './performance.js?v=1.44.0';
export async function runPreflight({requested,measureCPU,measureGPU,onProgress=()=>{}}){
 let best=Math.min(100,requested),level=0,lastCPU=0,lastGPU=0,limited=false;
 for(const count of benchmarkCounts(requested)){
  onProgress(count);const result=await measureCPU(count);lastCPU=result.cpuMs;
  let gpu=await measureGPU(result.snapshot,QUALITY_LEVELS[level]);lastGPU=gpu;
  if(count===Math.min(120,requested))while(gpu>12.5&&level<QUALITY_LEVELS.length-1){level++;gpu=await measureGPU(result.snapshot,QUALITY_LEVELS[level]);lastGPU=gpu;}
  if(lastCPU>12.5||gpu>12.5){limited=best<=100;if(limited)level=Math.max(level,4);break;}best=count;
 }
 return {capacity:Math.min(requested,Math.max(Math.min(100,requested),Math.floor(best*.8))),level,cpuMs:lastCPU,gpuMs:lastGPU,limited};
}
export async function measureRender(renderer,snapshot,restore,profile,nextFrame=()=>new Promise(r=>requestAnimationFrame(r))){
 const previousQuality=renderer.quality,previousScale=renderer.scale,previousHistory=renderer.history,samples=[],intervals=[];let previousFrame=null;
 const probeHistory=previousHistory&&snapshot.x?new TrailHistory():previousHistory;
 if(probeHistory&&snapshot.x){const now=performance.now();for(let i=0;i<24;i++){const age=(23-i)*81,dt=age/(1000/60),W=snapshot.width,H=snapshot.height;probeHistory.update({...snapshot,x:Float32Array.from(snapshot.x,(x,k)=>((x-(snapshot.vx?.[k]||0)*dt)%W+W)%W),y:Float32Array.from(snapshot.y,(y,k)=>((y-(snapshot.vy?.[k]||0)*dt)%H+H)%H)},now-age);}}
 const drawLive=()=>{renderer.history=previousHistory;renderer.draw({...restore});};
 try{
  renderer.quality=profile;renderer.scale=profile.scale;
  for(let i=0;i<5;i++){
   const timestamp=await nextFrame();if(Number.isFinite(timestamp)){if(previousFrame!==null&&i>=2)intervals.push(Math.max(0,timestamp-previousFrame-1000/60));previousFrame=timestamp;}const start=performance.now();
   try{renderer.history=probeHistory;renderer.draw(snapshot);renderer.gl.finish();if(i>=2)samples.push(performance.now()-start);}finally{drawLive();}
  }
  return Math.max(percentile95(samples),percentile95(intervals));
 }finally{renderer.quality=previousQuality;renderer.scale=previousScale;drawLive();}
}
