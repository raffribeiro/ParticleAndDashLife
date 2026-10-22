import test from 'node:test';import assert from 'node:assert/strict';
import {Simulation,wrappedDelta} from '../dist/simulation.js';import {Walkers,components} from '../dist/walkers.js';
const lcg=seed=>()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
const cluster=()=>{const s=new Simulation(5,800,600,lcg(2));s.ecology=false;s.force=0;s.wiggle=0;s.matrix=s.matrix.map(r=>r.map(()=>.8));s.type.set([0,0,0,0,0]);s.x.set([400,415,430,408,422]);s.y.set([300,300,300,312,312]);s.bonds=[[0,1],[1,2],[0,3],[3,4]];s.bondKeys=new Set();s.bondCount.set([2,2,1,2,1]);return s;};
test('connected bond components',()=>{assert.deepEqual(components(6,[[0,1],[1,2],[4,5]]).map(c=>c.sort()).sort((a,b)=>a.length-b.length),[[4,5],[0,1,2]]);});
test('a bonded cluster becomes a walker with IK legs and walks forward',()=>{const s=cluster(),w=new Walkers(lcg(5));const wk=w.create(s,[0,1,2,3,4]);wk.heading=0;wk.lifespan=1e9;wk.meander={f:0,p:0,turn:0,next:1e9};w.rng=()=>.5;const c0=w.centroid(s,wk.members);for(let t=0;t<240;t++){s.step();w.step(s);}const c1=w.centroid(s,wk.members);assert.equal(w.list.length,1);assert.ok(Math.hypot(wrappedDelta(c1[0]-c0[0],s.width),wrappedDelta(c1[1]-c0[1],s.height))>20,'moved '+(c1[0]-c0[0]));for(const l of wk.legs){const px=s.x[l.hip],py=s.y[l.hip];assert.ok(Math.abs(Math.hypot(wrappedDelta(l.knee[0]-px,800),wrappedDelta(l.knee[1]-py,600))-l.upper)<1e-6);}const out=w.serialize(s);assert.equal(out[0].legs.length,wk.legs.length*7);});
test('walkers follow index swaps and dissolve when bonds are gone',()=>{const s=cluster(),w=new Walkers(lcg(5));const wk=w.create(s,[0,1,2,3,4]);wk.lifespan=1e9;s.rebuild(new Set([1]),[]);w.step(s);assert.ok(!wk.members.includes(4)||s.count>4);assert.ok(wk.members.every(i=>i<s.count));s.bonds=[];s.bondCount.fill(0);for(let t=0;t<260;t++)w.step(s);assert.equal(w.list.length,0);});
test('walkers form spontaneously from bonded clusters',()=>{const s=cluster(),w=new Walkers(()=>.1);for(let t=0;t<90;t++)w.step(s);assert.equal(w.list.length,1);assert.equal(w.formed,1);});
test('anatomy grows from existing particles and fades after separation',()=>{
 const s=cluster(),w=new Walkers(()=>.5),animal=w.create(s,[0,1,2,3,4]),count=s.count;
 for(let t=0;t<50;t++)w.step(s);
 const out=w.serialize(s)[0];assert.equal(out.life,1);assert.equal(out.head.length,6);assert.equal(out.tail.length,16);
 assert.equal(s.count,count);assert.ok([...out.head,...out.tail].every(Number.isFinite));
 s.bonds=[];s.bondCount.fill(0);w.step(s);assert.equal(w.list.length,1);assert.ok(w.serialize(s)[0].life<1);
 for(let t=0;t<260;t++)w.step(s);assert.equal(w.list.length,0);assert.equal(s.count,count);
});
test('separate bonded pairs cannot keep an animal alive',()=>{
 const s=cluster(),w=new Walkers(()=>.5);w.create(s,[0,1,2,3,4]);for(let t=0;t<50;t++)w.step(s);
 s.bonds=[[0,1],[2,3]];s.bondCount.set([1,1,1,1,0]);for(let t=0;t<260;t++)w.step(s);assert.equal(w.list.length,0);
});
test('anatomy remains finite across the world seam',()=>{
 const s=cluster(),w=new Walkers(()=>.5);s.x.set([799,2,5,798,4]);w.create(s,[0,1,2,3,4]);
 for(let t=0;t<60;t++)w.step(s);const a=w.serialize(s)[0];assert.ok([...a.head,...a.tail,...a.legs].every(Number.isFinite));
 for(let k=2;k<a.tail.length;k+=2)assert.ok(Math.hypot(a.tail[k]-a.tail[k-2],a.tail[k+1]-a.tail[k-1])<12);
});
const fishParts=n=>Array.from({length:n},(_,id)=>({id:id+1,x:Float64Array.from({length:10},(_,k)=>400-k*3.4),y:new Float64Array(10).fill(300),spacing:3.4,dead:false}));
test('nearby existing fish become exclusive body parts and are released on dissolution',()=>{
 const s=cluster(),w=new Walkers(()=>.5),pool=fishParts(8),a=w.create(s,[0,1,2,3,4]);
 const ids=pool.map(c=>c.id);for(let t=0;t<50;t++)w.step(s,1,pool);
 const attached=pool.filter(c=>c.attachment);assert.ok(attached.length>=3);assert.deepEqual(pool.map(c=>c.id),ids);assert.equal(s.count,5);
 assert.equal(new Set(attached.map(c=>c.attachment.slot)).size,attached.length);
 assert.ok(attached.some(c=>c.attachment.role==='leg'));assert.ok(attached.some(c=>c.attachment.role==='head'));
 assert.equal(w.serialize(s)[0].materialParts,true);
 s.bonds=[];for(let t=0;t<260;t++)w.step(s,1,pool);assert.ok(pool.every(c=>!c.attachment));
});
test('more assembled legs = slower: lower speed cap (sturdiness comes from combat stats)',()=>{
 const run=n=>{const s=cluster(),w=new Walkers(()=>.5),a=w.create(s,[0,1,2,3,4]),pool=fishParts(8);a.legs=a.legs.slice(0,n);s.vx.fill(5);s.vy.fill(0);w.step(s,1,pool);assert.ok(Math.hypot(s.vx.reduce((a,b)=>a+b,0)/s.count,s.vy.reduce((a,b)=>a+b,0)/s.count)<2.4*a.locomotion+.05);return a.locomotion;};
 assert.ok(run(5)<run(3));
});
test('assembled legs use one knee with fixed bones and an exact planted foot',()=>{
 const s=cluster(),w=new Walkers(()=>.5),pool=fishParts(8);w.create(s,[0,1,2,3,4]);
 for(let t=0;t<120;t++)w.step(s,1,pool);
 const c=pool.find(c=>c.attachment?.role==='leg');assert.equal(c.attachment.motion,'single-knee');
 assert.equal(c.legJoints.length,3);
 const total=c.spacing*(c.x.length-1);
 for(let k=1;k<3;k++)assert.ok(Math.abs(Math.hypot(c.legJoints[k][0]-c.legJoints[k-1][0],c.legJoints[k][1]-c.legJoints[k-1][1])-total*(k===1?.48:.52))<.05);
 const a=w.list[0],l=a.legs.find(l=>c.attachment.slot==='leg:'+l.hip);
 assert.equal(l.t,1);const foot=[l.fx,l.fy];
 for(let t=0;t<20;t++)w.step(s,1,pool);
 assert.deepEqual([l.fx,l.fy],foot);
 assert.ok(Math.hypot(c.x.at(-1)-l.fx,c.y.at(-1)-l.fy)<.01);
 assert.ok([...c.x,...c.y].every(Number.isFinite));
});

test('moving single-knee legs stretch elastically within the limit',()=>{
 const s=cluster(),w=new Walkers(()=>.5),pool=fishParts(8);w.create(s,[0,1,2,3,4]);
 for(let t=0;t<150;t++){for(let i=0;i<s.count;i++){s.x[i]=(s.x[i]+1.5)%s.width;s.vx[i]=1.5;}w.step(s,1,pool);
  for(const c of pool.filter(c=>c.attachment?.role==='leg')){const J=c.legJoints,total=c.spacing*(c.x.length-1)*(c.legStretch||1);assert.ok(c.legStretch>=1&&c.legStretch<=1.28);for(let k=1;k<3;k++)assert.ok(Math.abs(Math.hypot(J[k][0]-J[k-1][0],J[k][1]-J[k-1][1])-total*(k===1?.48:.52))<.01);}
 }
});
test('body transfers weight toward planted material legs, ignoring airborne and missing legs',()=>{
 const s=cluster(),w=new Walkers(()=>.5),a=w.create(s,[0,1,2,3,4]);a.cohesion=1;a.materialParts=true;
 const [cx,cy]=w.centroid(s,a.members);a.legs.forEach((l,k)=>{l.init=true;l.t=k===0?1:.5;l.fx=cx;l.fy=cy+(k===0?20:-100);});
 w.fish=[{attachment:{walker:a.id,role:'leg',slot:'leg:'+a.legs[0].hip}}];
 w.transferWeight(a,s,1);assert.ok(a.weight.y>0);assert.ok(a.weight.y<4);assert.ok(s.vy.every(v=>v>0));
 const foot=[a.legs[0].fx,a.legs[0].fy];for(let i=0;i<100;i++)w.transferWeight(a,s,1);
 assert.ok(Math.hypot(a.weight.x,a.weight.y)<=4.001);assert.deepEqual([a.legs[0].fx,a.legs[0].fy],foot);
 w.fish=[];const before=a.weight.y;w.transferWeight(a,s,1);assert.ok(a.weight.y<before);
});
test('body reference preserves local slots when member order changes',()=>{
 const s=cluster(),w=new Walkers(()=>.5),a=w.create(s,[0,1,2,3,4]);w.updateBody(a,s,1);
 const slots=[...a.body.slots].map(([id,p])=>[id,[...p]]);a.members.reverse();w.updateBody(a,s,1);
 for(const [id,p] of slots)assert.deepEqual(a.body.slots.get(id),p);
 const x=a.body.x;s.x[0]+=40;w.updateBody(a,s,1);assert.ok(Math.abs(a.body.x-x)<2);
});
test('body reference follows translation continuously across the world seam',()=>{
 const s=cluster(),w=new Walkers(()=>.5);s.x.set([799,2,5,798,4]);const a=w.create(s,[0,1,2,3,4]);w.updateBody(a,s,1);
 const before=a.body.x;for(let i=0;i<s.count;i++){s.x[i]=(s.x[i]+2)%s.width;s.vx[i]=2;}w.updateBody(a,s,1);
 assert.ok(a.body.x>before);assert.ok(a.body.x-before<3);assert.ok(Number.isFinite(a.body.heading));
});
test('random peripheral mounts remain stable and vary between organisms',()=>{
 const s=cluster(),w=new Walkers(lcg(5)),a=w.create(s,[0,1,2,3,4]),b=w.create(s,[0,1,2,3,4]);
 const mounts=a.legs.map(l=>[...l.mount]);assert.notDeepEqual(mounts,b.legs.map(l=>l.mount));
 a.materialParts=true;w.updateBody(a,s,1);a.legs.reverse();w.updateBody(a,s,1);
 for(const l of a.legs)assert.ok(mounts.some(p=>p[0]===l.mount[0]&&p[1]===l.mount[1]));
});
test('fish approach a leg gradually and detach without changing their pose',()=>{
 const s=cluster(),w=new Walkers(()=>.5),a=w.create(s,[0,1,2,3,4]),pool=fishParts(8),c=pool[0],x=c.x[0],y=c.y[0];
 w.step(s,1,pool);assert.ok(c.attachment.blend>0&&c.attachment.blend<.1);assert.ok(Math.hypot(c.x[0]-x,c.y[0]-y)<2);
 const pose=[...c.x,...c.y];w.releaseFish(c);assert.equal(c.attachment,null);assert.ok(c.release);assert.deepEqual([...c.x,...c.y],pose);
});
test('gait schedules one assembled leg at a time',()=>{
 const s=cluster(),w=new Walkers(()=>.5),a=w.create(s,[0,1,2,3,4]),pool=fishParts(8);let steps=0;
 for(let t=0;t<200;t++){for(let i=0;i<s.count;i++){s.x[i]=(s.x[i]+.6)%s.width;s.vx[i]=.6;}w.step(s,1,pool);
  const swinging=a.legs.filter(l=>l.t<1);assert.ok(swinging.length<=1);if(swinging.length)steps++;
 }assert.ok(steps>0);
});

test('formed creatures survive a brief interruption of their body bonds',()=>{
 const s=cluster(),w=new Walkers(()=>.5),a=w.create(s,[0,1,2,3,4]);for(let t=0;t<50;t++)w.step(s);const bonds=s.bonds;s.bonds=[];
 for(let t=0;t<90;t++)w.step(s);assert.equal(w.list[0],a);assert.ok(a.cohesion>.5);
 s.bonds=bonds;for(let t=0;t<50;t++)w.step(s);assert.equal(a.cohesion,1);assert.equal(w.list[0].id,a.id);
});
test('more body mass spreads leg roots outward smoothly without changing mount direction',()=>{
 const s=new Simulation(14,800,600,lcg(2)),w=new Walkers(()=>.5);
 const a=w.create(s,[0,1,2]);a.materialParts=true;w.updateBody(a,s,1);
 const l=a.legs[0],mount=[...l.mount],radius=()=>Math.hypot(...a.body.slots.get(l.hip))/a.body.length;
 const small=radius();a.members=Array.from({length:14},(_,i)=>i);w.updateBody(a,s,1);
 const first=radius();assert.ok(first>small);assert.ok(first-small<.04,'growth does not teleport roots');
 for(let t=0;t<240;t++)w.updateBody(a,s,1);
 assert.ok(radius()>small*1.3,'dense bodies expose more of their legs');
 const p=a.body.slots.get(l.hip);assert.ok(Math.abs(p[0]*mount[1]-p[1]*mount[0])<1e-8);
 assert.deepEqual(l.mount,mount);assert.equal(s.count,14);
});
test('upkeep grows with body size; a starving big body breaks into smaller organisms',async()=>{const {UPKEEP,STARVE_STEPS}=await import('../dist/walkers.js');
 const s=new Simulation(12,800,600,()=>.5);s.ecology=false;s.force=0;s.matrix=s.matrix.map(r=>r.map(()=>.6));const ids=[...Array(12).keys()];ids.forEach(i=>{s.x[i]=300+(i%4)*10;s.y[i]=300+Math.floor(i/4)*10;s.type[i]=1;});
 for(let j=1;j<12;j++){s.bonds.push([j-1,j]);s.bondCount[j-1]++;s.bondCount[j]++;s.bondKeys.add((j-1)*65536+j);}
 const w=new Walkers(()=>.5);const a=w.create(s,ids);a.lifespan=1e9;a.cohesion=1;
 const before=s.energy[0];w.upkeep(a,s,1);assert.ok(Math.abs(before-s.energy[0]-UPKEEP*12)<1e-6,'cost per circle ∝ n');
 s.energy.fill(.4);for(let t=0;t<STARVE_STEPS;t++)w.upkeep(a,s,1);assert.equal(w.list.length,2);assert.ok(w.list.every(o=>o.members.length>=3&&o.members.length<=6));assert.equal(w.fragments,1);
 const owner=new Map();w.list.forEach((o,k)=>o.members.forEach(i=>owner.set(i,k)));assert.ok(s.bonds.every(([p,q])=>owner.get(p)===owner.get(q)),'no bonds between pieces');});
test('bigger bodies are slower in general: size pace falls with circle count',async()=>{const {sizePace}=await import('../dist/walkers.js');assert.ok(sizePace(3)>1.1);assert.ok(sizePace(12)<.55);assert.ok(sizePace(3)>sizePace(12)*2);assert.ok(sizePace(24)>=.3);});
test('a leg left beyond its elastic reach detaches after sustained backward strain',()=>{
 const s=cluster(),w=new Walkers(()=>.5),pool=fishParts(8),a=w.create(s,[0,1,2,3,4]);
 for(let t=0;t<80;t++)w.step(s,1,pool);
 const c=pool.find(c=>c.attachment?.role==='leg'),l=a.legs.find(l=>'leg:'+l.hip===c.attachment.slot),base=l.upper+l.lower;
 const [x,y]=w.hipPosition(a,l,s);a.body.vx=1;a.body.vy=0;l.fx=x-base*1.6;l.fy=y;l.lift=0;
 for(let t=0;t<10;t++)w.poseParts(a,s,pool,1);assert.ok(c.attachment,'brief strain is tolerated');
 const ids=pool.map(c=>c.id),count=s.count;
 for(let t=0;t<20;t++)w.poseParts(a,s,pool,1);
 assert.equal(c.attachment,null);assert.ok(c.release);assert.equal(c.legJoints,null);assert.ok(c.recruitAfter>w.tick);
 assert.deepEqual(pool.map(c=>c.id),ids);assert.equal(s.count,count);
 c.release=null;w.recruit(a,s,pool);assert.equal(c.attachment,null,'cannot instantly snap back');
});
test('leg strain recovers and a long forward reach does not count as lagging behind',()=>{
 const s=cluster(),w=new Walkers(()=>.5),pool=fishParts(8),a=w.create(s,[0,1,2,3,4]);for(let t=0;t<80;t++)w.step(s,1,pool);
 const c=pool.find(c=>c.attachment?.role==='leg'),l=a.legs.find(l=>'leg:'+l.hip===c.attachment.slot),base=l.upper+l.lower,[x,y]=w.hipPosition(a,l,s);a.body.vx=1;a.body.vy=0;l.lift=0;
 l.fx=x-base*1.6;l.fy=y;for(let t=0;t<8;t++)w.poseParts(a,s,pool,1);
 l.fx=x+base*1.6;for(let t=0;t<40;t++)w.poseParts(a,s,pool,1);assert.ok(c.attachment);assert.equal(c.attachment.strain,0);
});
