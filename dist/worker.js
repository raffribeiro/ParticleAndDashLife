import {BigBang} from './big-bang.js?v=1.24.0';
let opening=null;
import {LifeCycle} from './life-cycle.js?v=1.24.0';
let life=new LifeCycle();
import {BehaviorCycle} from './behavior-cycle.js?v=1.24.0';
const behaviorCycle=new BehaviorCycle();let matrixRevision=-1;
import {Ecology} from './ecology.js?v=1.24.0';
const ecology=new Ecology();
import {Disturbances} from './disturbance.js?v=1.24.0';
const disturbances=new Disturbances();let pendingEvent=null;
import {Simulation} from './simulation.js?v=1.24.0';
import {Creatures} from './creatures.js?v=1.24.0';
import {Walkers} from './walkers.js?v=1.24.0';
import {Combat} from './combat.js?v=1.24.0';
const combat=new Combat();let lastPublish=0;
const walkers=new Walkers();
const creatures=new Creatures((Math.random()*2**32)>>>0);
let sim=null,paused=false,visible=true,pointer=null,revision=0,timer=null;
function publish(ms=0){let mobilityMin=1.4,mobilityMax=.6;for(let i=0;i<sim.count;i++){mobilityMin=Math.min(mobilityMin,sim.mobility[i]);mobilityMax=Math.max(mobilityMax,sim.mobility[i]);}const events=[...(creatures.events||[]).splice(0),...walkers.events.splice(0)].slice(-16);const snapshot={behavior:behaviorCycle.snapshot(sim),events,mobilityMin,mobilityMax,revision,count:sim.count,width:sim.width,height:sim.height,consumed:sim.consumed,stepMs:ms,disturbanceEvent:pendingEvent,disturbanceCount:disturbances.count,nextDisturbance:Math.max(0,disturbances.interval-disturbances.elapsed),creatures:creatures.serialize(),bonds:sim.bondPairs(),walkers:walkers.serialize(sim),combat:combat.serialize(walkers,sim),habitats:ecology.patches,ecosystem:{resting:[...creatures.list,...walkers.list].filter(c=>c.behavior?.resting).length,memories:creatures.list.filter(c=>c.memory).length,hunters:walkers.list.filter(a=>a.traits?.hunt>=.5).length,evaders:walkers.list.filter(a=>a.traits?.hunt<.5).length,births:life.births,hunting:walkers.list.filter(a=>a.behavior?.hunting).length,organisms:walkers.list.length,fragments:walkers.fragments||0,shed:walkers.shedCount||0,plans:walkers.list.reduce((m,w)=>(m[w.plan||'lizard']=(m[w.plan||'lizard']||0)+1,m),{}),eaten:walkers.eaten||0},creatureStats:creatures.stats(),changed:sim.changedIndices&&sim.changedIndices.size?Int32Array.from(sim.changedIndices):null};if(sim.changedIndices)sim.changedIndices.clear();const transfer=[];for(const key of ['x','y','vx','vy','type','energy','fx','size','pulse','minor']){if(!sim[key])continue;snapshot[key]=sim[key].slice();transfer.push(snapshot[key].buffer);}postMessage(snapshot,transfer);pendingEvent=null;}
function schedule(){if(!sim||paused||!visible){clearTimeout(timer);timer=null;return;}if(timer!==null)return;timer=setTimeout(run,1000/60);}
function run(){timer=null;if(!sim||paused||!visible)return;const start=performance.now();if(opening?.step(sim)){publish(performance.now()-start);timer=setTimeout(run,1000/60);return;}behaviorCycle.advance(sim,1/60);sim.step(1,pointer?.force?pointer:null);ecology.step(sim,creatures.list,walkers.list,pointer,1,walkers);creatures.step(sim,pointer);walkers.step(sim,1,creatures.list);life.step(sim,creatures,walkers);combat.step(sim,walkers,creatures.list,creatures);{const p=sim.pulse;if(p)for(let i=0;i<sim.count;i++)p[i]=p[i]>.004?p[i]*.92:0;}{const ev=disturbances.advance(sim,1/60);if(ev)pendingEvent=ev;}if(pendingEvent?.kind==='pulse')creatures.scare(pendingEvent.x,pendingEvent.y,pendingEvent.radius,sim.width,sim.height);const elapsed=performance.now()-start;if(performance.now()-lastPublish>=1000/60-4){publish(elapsed);lastPublish=performance.now();}timer=setTimeout(run,Math.max(0,1000/60-(performance.now()-start)));}
globalThis.onmessage=({data:m})=>{if(m.kind==='init'){sim=new Simulation(m.count,m.width,m.height);life=new LifeCycle(m.count);opening=new BigBang(sim);publish();}
 if(!sim)return;
 if(m.kind==='reset'){revision=m.revision;sim.reset(m.count);life=new LifeCycle(m.count);ecology.reset();behaviorCycle.manual(behaviorCycle.key);walkers.reset();combat.reset();creatures.reseed(creatures.seed+1);opening=new BigBang(sim);disturbances.elapsed=0;disturbances.count=0;disturbances.wave=null;publish();}
 if(m.kind==='spawn-creatures'){creatures.reseed(m.seed);creatures.step(sim,null);publish();}
 if(m.kind==='disturb'){pendingEvent=disturbances.trigger(sim);if(pendingEvent.kind==='pulse')creatures.scare(pendingEvent.x,pendingEvent.y,pendingEvent.radius,sim.width,sim.height);publish();}
 if(m.kind==='config'){behaviorCycle.configure(m.behaviorCycle);disturbances.configure(m.disturbance);paused=m.paused;visible=m.visible;pointer=m.pointer;if(m.matrixRevision===undefined||m.matrixRevision!==matrixRevision){sim.matrix=m.matrix;matrixRevision=m.matrixRevision;behaviorCycle.manual(m.behaviorKey);}sim.radius=m.radius;sim.force=m.force;sim.ecology=m.ecology;if(m.dynamicMobility!==undefined)sim.dynamicMobility=!!m.dynamicMobility;if(m.inertia!==undefined)sim.setInertia(m.inertia);if(m.bonding!==undefined)sim.bonding=!!m.bonding;walkers.configure(m.walkers);combat.configure(m.combat);if(m.wiggle!==undefined)sim.wiggle=Math.max(0,Math.min(2,+m.wiggle||0));creatures.configure(m.creatures);if(sim.width!==m.width||sim.height!==m.height){creatures.resize(sim.width,sim.height,m.width,m.height);for(let i=0;i<sim.count;i++){sim.x[i]=sim.x[i]/sim.width*m.width;sim.y[i]=sim.y[i]/sim.height*m.height;if(sim.x[i]>=m.width)sim.x[i]=0;if(sim.y[i]>=m.height)sim.y[i]=0;}sim.width=m.width;sim.height=m.height;publish();}}
 schedule();};
