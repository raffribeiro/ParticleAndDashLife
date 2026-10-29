import test from 'node:test';import assert from 'node:assert/strict';
import {Simulation,wrappedDelta} from '../dist/simulation.js';
import {Walkers} from '../dist/walkers.js';
import {Combat,typeMultiplier,factionOf,statsFor,abilitiesFor,FACTION_OF,MAX_MEMBERS} from '../dist/combat.js';
const prime=(c,s,orgs)=>{for(const a of orgs){a.faction=factionOf(s,a.members);a.stats=statsFor(a,s);c.state(a,a.stats);}};
const lcg=seed=>()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
// World with organisms made of bonded chains of a given species at given centres.
function world(specs,{W=900,H=600}={}){
 const total=specs.reduce((n,s)=>n+s.n,0)+40,s=new Simulation(total,W,H,lcg(3));s.ecology=false;s.force=0;s.wiggle=0;s.matrix=s.matrix.map(r=>r.map(()=>.5));
 let k=0;const groups=[];
 for(const sp of specs){const ids=[];for(let j=0;j<sp.n;j++){const i=k++;s.type[i]=sp.type;s.x[i]=sp.x+(j%4)*9;s.y[i]=sp.y+Math.floor(j/4)*9;s.vx[i]=s.vy[i]=0;ids.push(i);}for(let j=1;j<ids.length;j++){s.bonds.push([ids[j-1],ids[j]]);s.bondCount[ids[j-1]]++;s.bondCount[ids[j]]++;s.bondKeys.add(ids[j-1]*65536+ids[j]);}groups.push(ids);}
 for(let i=k;i<total;i++){s.x[i]=(i*37)%W;s.y[i]=H-5;s.type[i]=1;}
 const w=new Walkers(lcg(9));w.max=20;const orgs=groups.map(g=>{const a=w.create(s,g);a.lifespan=1e9;a.cohesion=1;a.celebrated=true;return a;});
 w.step(s,1,[]);return {s,w,orgs,c:new Combat(lcg(11))};
}
test('type triangle and faction mapping',()=>{assert.equal(typeMultiplier(0,1),1.3);assert.equal(typeMultiplier(1,2),1.3);assert.equal(typeMultiplier(2,0),1.3);assert.equal(typeMultiplier(1,0),.77);assert.equal(typeMultiplier(1,1),1);assert.deepEqual(FACTION_OF,[0,1,2,2,1,0]);const s=new Simulation(4,100,100,()=>.5);s.type.set([2,3,3,0]);assert.equal(factionOf(s,[0,1,2,3]),2);});
test('every trait is an advantage with a cost: legs → sturdier but slower, circles → power/HP but slower',()=>{const s=new Simulation(30,400,400,()=>.5);const base={id:1,members:[0,1,2,3],legs:[],body:{length:12}};
 const few={...base,legCount:1},many={...base,legCount:5};const a=statsFor(few,s),b=statsFor(many,s);assert.ok(b.speed<a.speed&&b.maxHp>a.maxHp&&b.armor<a.armor&&b.knockback<a.knockback);
 const small=statsFor({...base,members:[0,1,2,3],legCount:2},s),big=statsFor({...base,members:Array.from({length:16},(_,i)=>i),legCount:2},s);assert.ok(big.power>small.power&&big.maxHp>small.maxHp&&big.speed<small.speed);
 assert.ok(big.power/small.power<Math.sqrt(16/4)+1e-9,'power grows with √n (diminishing returns)');
 const armored=statsFor({...base,legCount:2,features:{armor:2}},s);assert.ok(armored.armor<small.armor&&armored.maxHp>small.maxHp);
 const headed=statsFor({...base,legCount:2},s,[{attachment:{walker:1,role:'head'}}]);assert.ok(headed.crit>small.crit);});
test('two half-size bodies out-damage one big body (√n), so splitting into packs stays competitive',()=>{const s=new Simulation(30,400,400,()=>.5);const one=statsFor({id:1,members:Array.from({length:20},(_,i)=>i),legCount:2,body:{length:20}},s),half=statsFor({id:2,members:Array.from({length:10},(_,i)=>i),legCount:2,body:{length:16}},s);assert.ok(2*half.power>one.power*1.3);assert.ok(half.speed>one.speed);});
test('abilities follow faction and composition (max two)',()=>{const s=new Simulation(30,400,400,()=>.5);s.type.fill(0);const sw={id:1,members:[0,1,2,3],legCount:3};let st=statsFor(sw,s);assert.equal(st.faction,0);assert.deepEqual(abilitiesFor(st,sw,s),['dash']);
 s.type.fill(1);const co={id:2,members:Array.from({length:12},(_,i)=>i),legCount:2};st=statsFor(co,s);assert.deepEqual(abilitiesFor(st,co,s),['shock','shield']);assert.deepEqual(abilitiesFor(st,co,s,true),['shock','split']);
 s.type.fill(2);const my={id:3,members:[0,1,2,3],legCount:2};st=statsFor(my,s);assert.deepEqual(abilitiesFor(st,my,s),['orb','regen']);});
test('melee: enemies engage, damage applies knockback and spin (rigid-body reaction), damage severs circles',()=>{
 const {s,w,orgs,c}=world([{n:6,type:0,x:400,y:300},{n:6,type:1,x:430,y:300}]);const [a,b]=orgs;
 let spun=false,hit=false;for(let t=0;t<240;t++){s.step();w.step(s,1,[]);c.step(s,w,[]);if(b.body?.av)spun=true;if(b.combat&&b.combat.hp<b.combat.maxHp)hit=true;}
 assert.ok(hit,'took damage');assert.ok(spun,'angular reaction');assert.ok(c.severed>0||c.kills>0,'pieces cut off');
 for(let i=0;i<s.count;i++)assert.ok(Number.isFinite(s.x[i])&&Number.isFinite(s.vx[i]));});
test('killing breaks the body apart and credits the attacker',()=>{const {s,w,orgs,c}=world([{n:6,type:0,x:200,y:200},{n:3,type:1,x:500,y:400}]);const [a,b]=orgs;c.step(s,w,[]);b.combat.hp=1;c.damage(a,b,50,s,w,[],[1,0]);assert.ok(b.dead);assert.ok(!w.list.includes(b));assert.equal(a.combat.kills,1);});
test('star power-up: invincible, double damage, enemies flee',()=>{const {s,w,orgs,c}=world([{n:5,type:0,x:300,y:300},{n:5,type:1,x:600,y:300}]);const [a,b]=orgs;c.step(s,w,[]);
 c.stars=[{x:a.body.x,y:a.body.y,vx:0,vy:0,life:500,age:0}];c.nextStar=1e9;c.step(s,w,[]);assert.ok(a.combat.starUntil>c.tick);assert.equal(c.stars.length,0);
 const hp=a.combat.hp;assert.equal(c.damage(b,a,40,s,w,[],[1,0]),0);assert.equal(a.combat.hp,hp);
 b.body.x=a.body.x+150;b.body.y=a.body.y;c.step(s,w,[]);assert.equal(b.combat.mode,'flee');});
test('agar.io: a body ≥30% bigger engulfs a smaller one inside it, and eats free pellets',()=>{const {s,w,orgs,c}=world([{n:12,type:1,x:300,y:300},{n:4,type:0,x:310,y:305}]);c.agarEnabled=true;const [big,small]=orgs;prime(c,s,orgs);
 big.body.x=small.body.x;big.body.y=small.body.y;const before=big.members.length;const ok=c.engulf(big,small,s,w,[]);assert.ok(ok);assert.ok(small.dead);assert.equal(big.members.length,before+4);assert.ok(big.members.length<=MAX_MEMBERS);
 const pellet=s.count-1;s.x[pellet]=big.body.x+2;s.y[pellet]=big.body.y;s.bondCount[pellet]=0;c.tick=big.id%45;const n=big.members.length;c.agar(big,s,w,[],new Set(big.members));assert.equal(big.members.length,n+1);});
test('agar.io: big bodies split toward prey, siblings share a clan and are not enemies',()=>{const {s,w,orgs,c}=world([{n:12,type:1,x:300,y:300}]);const [a]=orgs;c.step(s,w,[]);const child=c.split(a,s,w,[],[1,0]);assert.ok(child);assert.equal(child.clan,a.clan);assert.equal(a.members.length+child.members.length,12);assert.ok(child.members.every(i=>!a.members.includes(i)));});
test('mass decay above 14 circles sheds members; never above the cap',()=>{const {s,w,orgs,c}=world([{n:18,type:1,x:300,y:300}]);c.agarEnabled=true;const [a]=orgs;prime(c,s,orgs);c.tick=(a.id*7+120)%240;const n=a.members.length;c.agar(a,s,w,[],new Set(a.members));assert.equal(a.members.length,n-1);});
test('faction share scaling softens the leading faction',()=>{const {s,w,c}=world([{n:4,type:0,x:100,y:100},{n:4,type:0,x:300,y:100},{n:4,type:5,x:500,y:100},{n:4,type:1,x:100,y:400}]);c.step(s,w,[]);assert.ok(c.factionScale[0]<1);assert.ok(c.factionScale[1]>=1);});

test('agar.io logic is off by default: no pellets, no engulf, no split',()=>{const {s,w,orgs,c}=world([{n:12,type:1,x:300,y:300},{n:4,type:0,x:310,y:305}]);assert.equal(c.agarEnabled,false);for(let k=0;k<200;k++){s.step();w.step(s,1,[]);c.step(s,w,[]);}assert.equal(c.engulfed,0);assert.equal(c.splits,0);assert.ok(orgs[0].members.length<=12);});

test('same-type neighbours can coexist peacefully between occasional feuds',()=>{const {s,w,orgs,c}=world([{n:6,type:1,x:300,y:300},{n:6,type:1,x:330,y:300}]);c.rng=()=>.99;prime(c,s,orgs);for(let i=0;i<130;i++)c.step(s,w,[]);assert.ok(orgs.every(a=>!a.combat.engaged));assert.ok(orgs.every(a=>a.combat.hp===a.combat.maxHp));});
test('nearby creatures of the same type sometimes feud, then observe a truce',()=>{const {s,w,orgs,c}=world([{n:6,type:1,x:300,y:300},{n:6,type:1,x:330,y:300}]);c.rng=()=>0;c.tick=119;prime(c,s,orgs);c.step(s,w,[]);const [a,b]=orgs;assert.equal(a.combat.rivalId,b.id);assert.equal(b.combat.rivalId,a.id);assert.ok(c.rivals(a,b));assert.ok(a.combat.damage>0||b.combat.damage>0);const until=a.combat.rivalUntil;c.tick=until;c.step(s,w,[]);assert.equal(c.rivals(a,b),false);assert.ok(a.combat.rivalAfter>c.tick);assert.equal(a.combat.engaged,false);});
test('same-clan relatives remain allies even when a feud would otherwise trigger',()=>{const {s,w,orgs,c}=world([{n:6,type:1,x:300,y:300},{n:6,type:1,x:330,y:300}]);for(const a of orgs)a.clan='family';c.rng=()=>0;c.tick=119;c.step(s,w,[]);assert.ok(orgs.every(a=>!a.combat.engaged&&!a.combat.rivalId));});

test('an evenly paced retreat opens a contact window instead of preserving a straight-line stalemate',()=>{
 const {s,w,orgs,c}=world([{type:1,n:8,x:200,y:300},{type:2,n:8,x:360,y:300}],{W:10000,H:700}),[hunter,prey]=orgs;
 for(const a of orgs){a.legs=[];a.legCount=0;a.materialParts=true;a.plan='lizard';a.parts=['lizard','lizard'];a.pace=1;a.heading=0;a.behavior={activity:1,speed:1,fleeing:a===prey};a.meander={f:0,p:0,turn:0,next:Infinity};for(const i of a.members){s.vx[i]=1;s.vy[i]=0;}}
 prime(c,s,orgs);for(const a of orgs)for(const ability of ['dash','orb','shield','regen','shock','split'])a.combat.cd[ability]=Infinity;
 let contact=false,minGap=Infinity,minPace=Infinity,maxPace=0;
 for(let tick=0;tick<2400&&!contact;tick++){
  s.energy.fill(1.3);prey.combat.hp=prey.combat.maxHp*.2;s.step();w.tick++;for(const a of orgs)w.walk(a,s,1);c.step(s,w,[]);
  const gap=Math.hypot(wrappedDelta(prey.body.x-hunter.body.x,s.width),wrappedDelta(prey.body.y-hunter.body.y,s.height));minGap=Math.min(minGap,gap);minPace=Math.min(minPace,hunter.pursuit?.pace??1);maxPace=Math.max(maxPace,hunter.pursuit?.pace??1);contact=(hunter.combat.cd.melee||0)>0;
 }
 assert.ok(contact,`pursuer never reached melee range; closest gap ${minGap}, reach ${hunter.stats.radius+prey.stats.radius+4}, modes ${hunter.combat.mode}/${prey.combat.mode}, pace ${hunter.pursuit?.pace}/${prey.pursuit?.pace}`);assert.ok(maxPace-minPace>.15);assert.equal(s.count,56);assert.ok(s.vx.every(Number.isFinite));
});
