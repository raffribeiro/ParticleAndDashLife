// Representative, isolated worker scene. None of these entities belong to the live world.
import {Simulation} from './simulation.js?v=1.43.4';
import {Creatures} from './creatures.js?v=1.43.4';
import {Walkers} from './walkers.js?v=1.43.4';
import {LifeCycle} from './life-cycle.js?v=1.43.4';
import {Combat} from './combat.js?v=1.43.4';
import {Ecology} from './ecology.js?v=1.43.4';
export const percentile95=values=>[...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*.95)-1)]||0;
export async function benchmarkScene({count,width,height,radius=150,force=1.5,fish=30},yieldTask=()=>new Promise(r=>setTimeout(r,0))){
 let seed=73;const rng=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
 const sim=new Simulation(count,width,height,rng),creatures=new Creatures(73),walkers=new Walkers(rng),life=new LifeCycle(count),combat=new Combat(rng),ecology=new Ecology();
 sim.preset('symbiosis');sim.radius=radius;sim.force=force;sim.setInertia(1);walkers.configure({enabled:true,max:24});creatures.configure({enabled:true,count:Math.min(fish,Math.floor(count/10))});
 // Local clusters stress neighbour interactions and assembled locomotion rather than testing an empty canvas.
 for(let i=0;i<sim.count;i++){const cell=i%6;sim.x[i]=((cell%3+.5)*width/3+(rng()-.5)*Math.min(120,width/3)+width)%width;sim.y[i]=((Math.floor(cell/3)+.5)*height/2+(rng()-.5)*Math.min(120,height/2)+height)%height;}
 creatures.step(sim);walkers.remap(sim);
 for(let k=0;k<Math.min(12,Math.floor(sim.count/25));k++){
  const ids=Array.from({length:8},(_,j)=>k*8+j),cx=(k%3+.5)*width/3,cy=(Math.floor(k/3)%2+.5)*height/2;
  for(let j=0;j<ids.length;j++){const i=ids[j],a=j/8*Math.PI*2;sim.x[i]=cx+Math.cos(a)*12;sim.y[i]=cy+Math.sin(a)*12;sim.type[i]=1;if(j){const previous=ids[j-1];sim.bonds.push([previous,i]);sim.bondCount[previous]++;sim.bondCount[i]++;sim.bondKeys.add(previous*65536+i);}}
  walkers.create(sim,ids);
 }sim.gridReady=false;
 const samples=[];
 for(let frame=0;frame<12;frame++){
  const start=performance.now();sim.step();ecology.step(sim,creatures.list,walkers.list,null,1,walkers);creatures.step(sim);walkers.step(sim,1,creatures.list);life.step(sim,creatures,walkers);combat.step(sim,walkers,creatures.list,creatures);
  if(frame>=4)samples.push(performance.now()-start);await yieldTask();
 }
 const snapshot={count:sim.count,width,height,creatures:creatures.serialize(),walkers:walkers.serialize(sim),bonds:sim.bondPairs(),combat:combat.serialize(walkers,sim),historyRevision:-1,openingColorMix:1,openingScale:1,openingGlow:0};
 for(const key of ['x','y','vx','vy','type','energy','fx','size','pulse','minor'])snapshot[key]=sim[key].slice();
 return {cpuMs:percentile95(samples),snapshot};
}
