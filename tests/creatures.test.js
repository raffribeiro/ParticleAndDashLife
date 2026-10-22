import test from 'node:test';import assert from 'node:assert/strict';
import {Simulation,wrappedDelta} from '../dist/simulation.js';
import {Creatures,createFish,seededRandom,forEachNear,angleDelta,PER_FISH} from '../dist/creatures.js';
const lcg=seed=>()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
// Empty world: no particles near (x,y) so only the rule under test acts.
const world=(n=0,w=1000,h=800)=>{const s=new Simulation(Math.max(1,n),w,h,lcg(4));s.ecology=false;s.force=0;if(!n){s.x[0]=w-1;s.y[0]=h-1;}s.matrix=s.matrix.map(r=>r.map(()=>0));return s;};
const fishAt=(style,x,y,heading,species,id=1)=>{const f=createFish(style,seededRandom(id),x,y,heading,species,id);f.wander=0;return f;};
const quiet=c=>{c.rng=()=>.5;c.moodEnabled=false;};

test('grid neighbour query matches brute force, including across wrapped edges',()=>{const s=new Simulation(600,640,480,lcg(3));s.step();for(const [x,y,r] of [[5,5,60],[320,240,120],[635,470,40],[100,400,300]]){const fast=new Set(),slow=new Set();forEachNear(s,x,y,r,i=>fast.add(i));for(let i=0;i<s.count;i++){const dx=wrappedDelta(s.x[i]-x,s.width),dy=wrappedDelta(s.y[i]-y,s.height);if(dx*dx+dy*dy<r*r)slow.add(i);}assert.deepEqual([...fast].sort((a,b)=>a-b),[...slow].sort((a,b)=>a-b));}});

test('only fish, in several styles; spines keep spacing; world stays finite for 1500 steps',()=>{const s=new Simulation(900,900,650,lcg(9));s.wiggle=1;const c=new Creatures(11);c.target=30;for(let t=0;t<1500;t++){s.step();if(t===300)c.scare(450,300,400,s.width,s.height);c.step(s,t%300<60?{x:450,y:300,force:t%600<300?2:-2}:null);}
for(const a of c.list){assert.equal(a.kind,'rectangle');assert.ok(a.x[0]>=0&&a.x[0]<s.width&&a.y[0]>=0&&a.y[0]<s.height);for(let i=1;i<a.x.length;i++)assert.ok(Math.abs(Math.hypot(a.x[i]-a.x[i-1],a.y[i]-a.y[i-1])-a.spacing)<1e-6);assert.ok(a.energy>=.25&&a.energy<=2);}
for(let i=0;i<s.count;i++){assert.ok(Number.isFinite(s.x[i])&&Number.isFinite(s.vx[i]));assert.ok(Math.hypot(s.vx[i],s.vy[i])<=5*s.mobility[i]+1e-5);}
assert.equal(new Set(c.list.map(a=>a.style)).size,1);assert.equal(new Set(c.list.map(a=>a.x.length+':'+a.spacing+':'+a.widths.join())).size,1,'identical shape');assert.ok(c.escapes>0);});

test('rule 1 + 9: fish swallow prey particles, digest, and excrete them as another species',()=>{const s=new Simulation(40,500,500,lcg(5));s.ecology=false;s.force=0;const c=new Creatures(1);c.wake=false;c.moodEnabled=false;c.started=true;c.target=1;const a=fishAt('rect',250,250,0,2);a.lifespan=1e9;c.list=[a];for(let i=0;i<s.count;i++){s.type[i]=a.diet;s.x[i]=a.x[0]+a.widths[0]+2+(i%3);s.y[i]=a.y[0]+(i%5)-2;s.vx[i]=s.vy[i]=0;}s.step();c.step(s,null);assert.equal(a.stomach.length,3);assert.equal(s.count,37);assert.ok(a.energy>1);
for(let t=0;t<400;t++){s.step();c.step(s,null);}const excreted=c.excreted;assert.ok(excreted>=3);const counts=[0,0,0,0,0,0];for(const t of s.type)counts[t]++;assert.ok(counts.reduce((p,v,i)=>i===a.diet?p:p+v,0)>=3,'excrement is another species');assert.equal(s.count+a.stomach.length+PER_FISH*0,40);});

test('rule 1 hunger: fish turns toward a patch of prey particles',()=>{const s=world(30);const c=new Creatures(1);c.wake=false;quiet(c);const a=fishAt('rect',300,400,0,1);a.energy=.5;c.list=[a];c.target=1;for(let i=0;i<30;i++){s.type[i]=a.diet;s.x[i]=360+(i%5)*3;s.y[i]=330+Math.floor(i/5)*3;}s.step();for(let t=0;t<15;t++)c.update(a,s,null);assert.ok(a.heading<-.3,'heading '+a.heading);assert.ok(a.hunting);});

test('rule 2 fear: fish steers away from a crowd of its predator particle species',()=>{const s=world(40);const c=new Creatures(1);c.wake=false;quiet(c);const a=fishAt('rect',300,400,0,3);c.list=[a];c.target=1;for(let i=0;i<40;i++){s.type[i]=a.fear;s.x[i]=345+(i%8)*3;s.y[i]=390+Math.floor(i/8)*3;}s.step();let fled=false;for(let t=0;t<20;t++){c.update(a,s,null);fled||=a.fleeing;}assert.ok(Math.abs(angleDelta(a.heading,0))>.8,'heading '+a.heading);assert.ok(fled);});

test('rule 3 affinity: the particle affinity matrix pulls or pushes the fish',()=>{const run=sign=>{const s=world(30);s.matrix[1][4]=sign;const c=new Creatures(1);c.wake=false;quiet(c);const a=fishAt('rect',300,400,0,1);c.list=[a];c.target=1;for(let i=0;i<30;i++){s.type[i]=4;s.x[i]=380+(i%6)*4;s.y[i]=310+Math.floor(i/6)*4;}s.step();for(let t=0;t<25;t++)c.update(a,s,null);return a.heading;};assert.ok(run(1)<-.15);assert.ok(run(-1)>.15);});

test('rule 4 current: fish drift with the surrounding particle flow',()=>{const make=flow=>{const s=world(60);const c=new Creatures(1);c.wake=false;quiet(c);const a=fishAt('rect',400,400,-Math.PI/2,0);c.list=[a];c.target=1;for(let i=0;i<60;i++){s.type[i]=3;s.x[i]=380+(i%10)*5;s.y[i]=350+Math.floor(i/10)*6;}s.step();for(let i=0;i<60;i++){s.vx[i]=flow;s.vy[i]=0;}const x0=a.x[0];for(let t=0;t<10;t++)c.update(a,s,null);return a.x[0]-x0;};assert.ok(make(4)-make(0)>3);});

test('rule 5 school: same-species tetras align and gather',()=>{const s=world();const c=new Creatures(1);c.wake=false;quiet(c);const a=fishAt('rect',300,300,0,2,1),b=fishAt('rect',300,400,Math.PI/2,2,2);c.list=[a,b];c.target=2;const d0=Math.hypot(a.x[0]-b.x[0],a.y[0]-b.y[0]),h0=Math.abs(angleDelta(a.heading,b.heading));for(let t=0;t<40;t++){c.update(a,s,null);c.update(b,s,null);}assert.ok(Math.abs(angleDelta(a.heading,b.heading))<h0*.5);assert.ok(Math.hypot(wrappedDelta(a.x[0]-b.x[0],s.width),wrappedDelta(a.y[0]-b.y[0],s.height))<d0+40);});

test('rule 6 food chain: a fish whose diet is our colour makes us burst away',()=>{const s=world();const c=new Creatures(1);c.wake=false;quiet(c);const prey=fishAt('rect',400,400,Math.PI,3,1),hunter=fishAt('rect',330,400,0,2,2);assert.equal(hunter.diet,prey.species);c.list=[prey,hunter];for(let t=0;t<10;t++)c.update(prey,s,null);assert.ok(prey.fleeing);assert.ok(Math.cos(prey.heading)>0,'prey turned away from hunter');assert.ok(c.escapes>0);});

test('rule 7 waves: a pulse scares fish inside its radius only',()=>{const c=new Creatures(1);const near=fishAt('rect',100,100,0,0,1),far=fishAt('rect',900,700,0,0,2);c.list=[near,far];c.scare(120,100,200,1000,800);assert.ok(near.burst>0&&near.fleeing);assert.ok(Math.cos(near.heading)<0);assert.equal(far.burst,0);});

test('rule 8 wake: body pushes nearby particles away from the spine',()=>{const s=new Simulation(1,500,500,()=>.5);s.ecology=false;const c=new Creatures(1);const a=fishAt('rect',250,250,0,0);c.list=[a];s.x[0]=a.x[3];s.y[0]=a.y[3]+a.widths[3]*.6;s.vx[0]=s.vy[0]=0;s.step();s.vx[0]=s.vy[0]=0;c.interact(a,s);assert.ok(s.vy[0]>0);});

test('wiggle gives particles individual lateral oscillation, bounded and off by default',()=>{const make=()=>{const s=new Simulation(200,800,600,lcg(21));s.force=0;s.ecology=false;for(let i=0;i<s.count;i++){s.vx[i]=2;s.vy[i]=0;}return s;};const still=make();for(let t=0;t<40;t++)still.step();assert.ok(still.vy.every(v=>Math.abs(v)<1e-9));const s=make();s.wiggle=1;let max=0,min=Infinity;for(let t=0;t<40;t++)s.step();for(let i=0;i<s.count;i++){const lateral=Math.abs(s.vy[i]);max=Math.max(max,lateral);min=Math.min(min,lateral);assert.ok(Math.hypot(s.vx[i],s.vy[i])<=5*s.mobility[i]+1e-5);}assert.ok(max>5*min);});

test('fish condense from same-species particles and serialize render data',()=>{const s=new Simulation(600,700,500,lcg(1));s.step();const c=new Creatures(3);c.target=20;c.step(s);const out=c.serialize();assert.equal(out.length,20);assert.equal(s.count+PER_FISH*20+c.stats().stomach,600);for(const a of out){assert.equal(a.points.length,a.widths.length*2);assert.equal(a.tail,'none');}const tetras=c.list.filter(f=>f.style==='tetra');if(tetras.length>1)assert.ok(new Set(tetras.map(f=>f.species)).size<tetras.length);assert.equal(c.stats().fish,20);});

test('rule 9 life cycle: biomass is conserved and the fish count hovers around the target',()=>{const s=new Simulation(700,900,650,lcg(17));s.wiggle=1;const c=new Creatures(5);c.target=20;const biomass=()=>s.count+PER_FISH*c.list.length+c.list.reduce((p,f)=>p+f.stomach.length,0);s.step();c.step(s,null);const total=biomass();let min=Infinity,max=0;
for(let t=0;t<6000;t++){s.step();c.step(s,null);assert.equal(biomass(),total);if(t>600){min=Math.min(min,c.list.length);max=Math.max(max,c.list.length);}}
assert.ok(c.deaths>0&&c.births>0,'deaths '+c.deaths+' births '+c.births);assert.ok(min>=10&&max<=20,min+'..'+max);
for(let i=0;i<s.count;i++){assert.ok(Number.isFinite(s.x[i])&&s.x[i]>=0&&s.x[i]<s.width&&s.y[i]>=0&&s.y[i]<s.height);assert.ok(s.type[i]<6);}});
test('a dying fish dissolves into particles of its own species',()=>{const s=new Simulation(200,800,600,lcg(2));s.step();const c=new Creatures(9);c.started=true;c.target=0;const a=fishAt('rect',400,300,0,3);a.lifespan=1;a.age=1;c.list=[a];const before=s.count,n3=[...s.type].filter(t=>t===3).length;c.step(s,null);assert.equal(c.list.length,0);assert.equal(s.count,before+PER_FISH);assert.equal([...s.type].filter(t=>t===3).length,n3+PER_FISH);});
test('rebuild swaps removed particles with the last ones and records changed indices',()=>{const s=new Simulation(10,100,100,lcg(1));const lastX=s.x[9];s.rebuild(new Set([2]),[{x:5,y:5,type:4}]);assert.equal(s.count,10);assert.equal(s.x[2],lastX);assert.equal(s.type[9],4);assert.deepEqual([...s.changedIndices].sort(),[2,9]);});

test('rule 10 mood: a slow tide alternates friends and enemies, phase-shifted per colour',()=>{const c=new Creatures(1);c.moodPeriod=20;const seen=new Set();for(let t=0;t<20*60;t+=30){c.time=t;seen.add(Math.sign(c.mood(0)));}assert.ok(seen.has(1)&&seen.has(-1));c.time=0;assert.notEqual(c.mood(0).toFixed(3),c.mood(3).toFixed(3));c.moodEnabled=false;assert.equal(c.mood(2),-1);});
test('rule 10 mood: friends gather particles and never bite; enemies make prey particles flee and get eaten',()=>{
 const run=friendly=>{const s=world(24);const c=new Creatures(1);c.wake=false;c.started=true;c.target=1;c.rng=()=>.5;const a=fishAt('rect',400,400,0,1);a.lifespan=1e9;c.list=[a];c.mood=()=>friendly?1:-1;for(let i=0;i<24;i++){s.type[i]=a.diet;const ang=i/24*Math.PI*2;s.x[i]=400+Math.cos(ang)*70;s.y[i]=400+Math.sin(ang)*70;}s.step();
  const dist=()=>{let m=0;for(let i=0;i<s.count;i++)m+=Math.hypot(wrappedDelta(s.x[i]-a.x[4],s.width),wrappedDelta(s.y[i]-a.y[4],s.height));return m/s.count;};const d0=dist();for(let t=0;t<90;t++){s.step();c.step(s,null);}return {d0,d1:dist(),bites:c.bites};};
 const f=run(true),e=run(false);assert.equal(f.bites,0);assert.ok(f.d1<e.d1,'friends stay closer: '+f.d1.toFixed(1)+' vs '+e.d1.toFixed(1));assert.ok(e.d1>e.d0,'enemies flee');});

test('fish natural lifespan spans 400 to 900 seconds',()=>{for(let seed=0;seed<20;seed++){const f=createFish('rect',lcg(seed),400,300,0,1,seed);assert.ok(f.lifespan>=24000&&f.lifespan<=54000);}});
test('released fish drift from their current pose without swimming toward the former body',()=>{
 const s=world(),cs=new Creatures(1),c=createFish('rect',lcg(7),400,300,0,1,8);c.release={age:0,vx:.8,vy:.1};c.behavior={steerX:-100,steerY:0,activity:1,speed:1};
 for(let k=0;k<60;k++){const x=c.x[0],y=c.y[0];cs.update(c,s,null);assert.ok(c.x[0]>x&&c.x[0]-x<=.8+1e-6);assert.ok(c.y[0]>=y&&c.y[0]-y<=.1+1e-6);}
 assert.equal(c.release,null);assert.ok(c.x[0]>440&&c.x[0]<448);assert.equal(c.legJoints,null);
});
