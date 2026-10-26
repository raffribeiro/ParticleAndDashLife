// Real-time combat between organisms (walkers), with factions, abilities, dismemberment,
// rigid-body reactions and a Mario-star power-up. agar.io growth (pellets, engulf, split/merge,
// mass decay) is kept behind `agarEnabled` and is off: bodies grow by the earlier rules
// (life-cycle growth, regeneration) and shrink by upkeep fragmentation.
//
// Factions (by particle colour, ~35/35/30% of matter):
//   0 Enxame   – small bodies, attacks in packs (damage bonus per nearby ally), dash.
//   1 Colosso  – waits to form bigger bodies, grows, shockwave and shield.
//   2 Místico  – keeps distance, orbs and regeneration.
// Type triangle (Pokémon-like): Enxame > Colosso > Místico > Enxame (×1.3 / ×0.77).
// Every body feature is an advantage with a cost:
//   circles (members) → power √n and HP ∝ n, but speed ÷ (1 + 0.04 n)
//   legs (mounted fish) → agility: speed, dodge, attack rate
//   head → crit chance; tail → turn rate and dash reach; armor/muscle/regeneration/agility features.
// Anti-dominance: √n damage, mass decay above 14 circles, cap 24, type triangle, underdog bonus,
// faction share scaling (leading faction hits softer, rare factions hit harder), post-kill fatigue.
import {wrappedDelta,SPECIES_PATTERN} from './simulation.js?v=1.39.1';
import {featureLevel} from './features.js?v=1.39.1';
import {ensureNeeds,nourish} from './needs.js?v=1.39.1';
import {ensureTraits} from './traits.js?v=1.39.1';
const TAU=Math.PI*2,clamp=(v,a,b)=>v<a?a:v>b?b:v;
export const FACTIONS=[{key:'swarm',name:'Enxame'},{key:'colossus',name:'Colosso'},{key:'mystic',name:'Místico'}];
export const FACTION_OF=[0,1,2,2,1,0];
export const MAX_MEMBERS=24,DECAY_ABOVE=14;
// Faction strategy caps body size: packs stay small, colossi grow big.
export const FACTION_CAP=[6,24,10];
export function typeMultiplier(attacker,defender){if((attacker+1)%3===defender)return 1.3;if((defender+1)%3===attacker)return .77;return 1;}
export function factionOf(sim,members){const n=[0,0,0];for(const i of members)if(i<sim.count)n[FACTION_OF[sim.type[i]]]++;return n.indexOf(Math.max(...n));}
const ABILITY_ORDER=[['dash','orb','shield','regen','shock','split'],['shock','split','shield','dash','regen','orb'],['orb','regen','shield','split','dash','shock']];
export const ABILITY_NAMES={dash:'Investida',shock:'Onda de choque',orb:'Arremesso',shield:'Escudo',regen:'Regenerar',split:'Divisão'};
const COOLDOWN={dash:240,shock:420,orb:180,shield:600,regen:720,split:900};
// Body → stats. Each trait buys something and costs something.
export function statsFor(a,sim,fish=[]){
 const n=a.members.length,legs=a.legCount??a.legs?.length??0,parts=fish.filter(c=>c.attachment?.walker===a.id);
 const head=parts.some(c=>c.attachment.role==='head'),tail=parts.some(c=>c.attachment.role==='tail');
 const armor=featureLevel(a,'armor'),muscle=featureLevel(a,'muscle'),agi=featureLevel(a,'agility'),regen=featureLevel(a,'regeneration');
 const faction=a.faction??factionOf(sim,a.members);
 return {n,legs,head,tail,faction,
  power:3.4*Math.sqrt(n)*(1+.12*muscle)*(1+(a.growth||0)*.25),
  maxHp:10*n*(1+.25*armor)*(1+.15*legs),
  speed:clamp((1+.04*agi)/(1+.12*Math.max(0,legs-2))*Math.max(.3,Math.min(1.3,Math.pow(4/Math.max(1,n),.65)))*(a.pace??1),.2,3),
  dodge:Math.min(.32,.03*agi),
  attackEvery:Math.round(54/(1+.08*legs)),
  crit:head?.14:.04,
  turn:tail?1.6:1,
  armor:1/(1+.2*armor+.08*legs),
  regen:.0004*(1+regen)*(faction===2?1.5:1),
  knockback:(faction===1?.6:1)/(1+.1*legs),
  radius:(a.body?.length??12)*.5+6
 };
}
export function abilitiesFor(st,a,sim,agar=false){
 const accent=a.members.some(i=>sim.type[i]>=4);
 const ok={dash:st.legs>=3||st.faction===0,shock:st.n>=6||st.faction===1,orb:st.n>=4&&(st.faction===2||accent||st.n>=7),shield:featureLevel(a,'armor')>=1||st.n>=9||st.faction===1,regen:featureLevel(a,'regeneration')>=1||st.faction===2,split:st.n>=10};
 // Divisão is an agar.io mechanic: only when that mode is on.
 return ABILITY_ORDER[st.faction].filter(k=>ok[k]&&(k!=='split'||agar)).slice(0,2);
}
export class Combat{
 constructor(rng=Math.random){this.rng=rng;this.enabled=true;this.agarEnabled=false;this.tick=0;this.orbs=[];this.stars=[];this.fx=[];this.kills=0;this.severed=0;this.engulfed=0;this.splits=0;this.nextStar=900;this.starCount=0;}
 configure(o){if(!o)return;if(o.enabled!==undefined)this.enabled=!!o.enabled;}
 reset(){this.ripples=[];this.bal=null;this.orbs=[];this.stars=[];this.fx=[];this.tick=0;this.nextStar=900;}
 state(a,st){const c=a.combat??(a.combat={hp:st.maxHp,maxHp:st.maxHp,cd:{},damage:0,kills:0,fatigue:0,shieldUntil:0,starUntil:0,dashUntil:0});
  if(c.maxHp!==st.maxHp){c.hp=Math.min(st.maxHp,c.hp*(c.maxHp?st.maxHp/c.maxHp:1));c.maxHp=st.maxHp;}return c;}
 // Feedback is a scale pulse on the particles themselves (decays in the worker); no overlay shapes.
 pulse(sim,i,v){if(sim.pulse&&i>=0&&i<sim.count&&sim.pulse[i]<v)sim.pulse[i]=v;}
 effect(kind,x,y,species,extra={}){this.fx.push({kind,x,y,species,age:0,duration:extra.duration||24,...extra});if(this.fx.length>64)this.fx.shift();}
 // Remove a member from an organism: its bonds break, it flies off; a leg mounted there is cut loose too.
 sever(a,i,sim,walkers,fish,dir=[0,0]){
  if(!a.members.includes(i))return;
  sim.bonds=sim.bonds.filter(b=>{if(b[0]===i||b[1]===i){sim.dropBond(b);return false;}return true;});
  a.members=a.members.filter(m=>m!==i);
  this.pulse(sim,i,1);// Torn parts fly off: along the blow plus outward from the body, with some scatter.
  {const b=a.body,ox=b?wrappedDelta(sim.x[i]-b.x,sim.width):0,oy=b?wrappedDelta(sim.y[i]-b.y,sim.height):0,od=Math.hypot(ox,oy)||1;
   sim.vx[i]+=dir[0]*4+ox/od*3.5+(this.rng()-.5)*2.5;sim.vy[i]+=dir[1]*4+oy/od*3.5+(this.rng()-.5)*2.5;sim.feedCooldown[i]=90;}sim.energy[i]=Math.max(.4,sim.energy[i]*.7);
  for(const c of fish)if(c.attachment?.walker===a.id&&c.attachment.hip===i)this.cutLimb(c,walkers,dir);
  a.legs=(a.legs||[]).filter(l=>l.hip!==i);this.severed++;this.effect('sever',sim.x[i],sim.y[i],sim.type[i],{duration:20});
 }
 cutLimb(c,walkers,dir){walkers.releaseFish(c);c.burst=45;c.heading=Math.atan2(dir[1],dir[0])+(this.rng()-.5)*1.5;c.spin=(this.rng()-.5)*.4;this.severed++;this.effect('limb',c.x[0],c.y[0],c.species,{duration:20});}
 // Rigid-body response: linear impulse on all members plus an angular kick on the body frame.
 impulse(a,sim,jx,jy,px,py,st){
  const n=a.members.length,kb=st.knockback,b=a.body;
  for(const i of a.members){sim.vx[i]+=jx/Math.sqrt(n)*kb;sim.vy[i]+=jy/Math.sqrt(n)*kb;}
  if(b){const rx=wrappedDelta(px-b.x,sim.width),ry=wrappedDelta(py-b.y,sim.height),r=Math.max(6,st.radius),torque=(rx*jy-ry*jx)/(n*r*r*.5);b.av=clamp((b.av||0)+torque*kb*3.6,-.4,.4);}
  // The member closest to the impact takes extra local deformation (springs restore it).
  let near=-1,best=Infinity;for(const i of a.members){const d=Math.hypot(wrappedDelta(sim.x[i]-px,sim.width),wrappedDelta(sim.y[i]-py,sim.height));if(d<best){best=d;near=i;}}
  if(near>=0){sim.vx[near]+=jx*.6*kb;sim.vy[near]+=jy*.6*kb;}
  return near;
 }
 damage(attacker,target,amount,sim,walkers,fish,dir,kind='hit'){
  const ta=target.combat,ts=target.stats;
  if(!ta||!ts||ta.hp<=0)return 0;
  if(this.tick<ta.starUntil){this.effect('deflect',target.body?.x??0,target.body?.y??0,sim.type[target.members[0]]);return 0;}
  if(kind!=='shock'&&this.rng()<ts.dodge){this.effect('dodge',target.body.x,target.body.y,sim.type[target.members[0]],{duration:14});return 0;}
  let d=amount*ts.armor*(this.tick<ta.shieldUntil?.4:1);ta.hp-=d;ta.damage+=d;ta.lastHit=this.tick;ta.attacker=attacker?.id;
  const px=target.body.x-dir[0]*ts.radius,py=target.body.y-dir[1]*ts.radius;
  // Melee is violent: strong shove scaling with damage (crits and dashes hit much harder).
  const j=(kind==='hit'?3.6+d*.18:1.6+d*.07)*(kind==='shock'?1.8:1);
  const near=this.impulse(target,sim,dir[0]*j,dir[1]*j,px+(this.rng()-.5)*ts.radius,py+(this.rng()-.5)*ts.radius,ts);
  this.pulse(sim,near,.7+Math.min(.3,d/30));for(const i of target.members)this.pulse(sim,i,.25);
  // Impact ripple: a scale wave spreading from the hit point (particles grow up to 2× as the front passes).
  (this.ripples||(this.ripples=[])).push({x:px,y:py,age:0,radius:clamp(80+d*5,80,210),force:clamp(.55+d*.05,.55,1.3)});if(this.ripples.length>16)this.ripples.shift();
  this.effect(kind==='orb'?'burst':'hit',px,py,attacker?sim.type[attacker.members[0]]:0,{duration:14,power:Math.min(1,d/12)});
  // Dismemberment: every chunk of damage worth one circle severs the member nearest the impact;
  // heavy single hits can also cut a mounted leg.
  const share=ta.maxHp/Math.max(1,target.members.length);
  // Any damage costs parts: every hit tears off at least one circle (bodies > 3), heavy hits several.
  if(d>0&&target.members.length>3)ta.damage=Math.max(ta.damage,share*.5);
  while(ta.damage>=share*.5&&target.members.length>2){ta.damage-=share*.5;let pick=near;
   if(!target.members.includes(pick)){pick=target.members[0];}
   const leaf=target.members.filter(i=>sim.bondCount[i]<=1);if(leaf.length&&!leaf.includes(pick))pick=leaf.reduce((p,i)=>Math.hypot(wrappedDelta(sim.x[i]-px,sim.width),wrappedDelta(sim.y[i]-py,sim.height))<Math.hypot(wrappedDelta(sim.x[p]-px,sim.width),wrappedDelta(sim.y[p]-py,sim.height))?i:p,leaf[0]);
   this.sever(target,pick,sim,walkers,fish,dir);}
  if(d>share*.6&&this.rng()<.35){const legs=fish.filter(c=>c.attachment?.walker===target.id&&c.attachment.role==='leg');if(legs.length){const c=legs.reduce((p,c)=>Math.hypot(wrappedDelta(c.x[0]-px,sim.width),wrappedDelta(c.y[0]-py,sim.height))<Math.hypot(wrappedDelta(p.x[0]-px,sim.width),wrappedDelta(p.y[0]-py,sim.height))?c:p);this.cutLimb(c,walkers,dir);}}
  if(ta.hp<=0||target.members.length<3)this.kill(attacker,target,sim,walkers,fish);
  return d;
 }
 kill(attacker,target,sim,walkers,fish){for(const i of target.members)this.pulse(sim,i,.9);
  if(target.dead)return;target.dead=true;const members=new Set(target.members);
  sim.bonds=sim.bonds.filter(b=>{if(members.has(b[0])||members.has(b[1])){sim.dropBond(b);return false;}return true;});
  for(const i of target.members){const a=this.rng()*TAU;sim.vx[i]+=Math.cos(a)*2.5;sim.vy[i]+=Math.sin(a)*2.5;}
  for(const c of fish)if(c.attachment?.walker===target.id)this.cutLimb(c,walkers,[Math.cos(this.rng()*TAU),Math.sin(this.rng()*TAU)]);
  target.cohesion=0;target.members=[];walkers.list=walkers.list.filter(w=>w!==target);
  this.effect('kill',target.body?.x??0,target.body?.y??0,sim.type[[...members][0]]??0,{duration:30});
  if(attacker?.combat){attacker.combat.kills++;attacker.combat.fatigue=this.tick+120;attacker.combat.hp=Math.min(attacker.combat.maxHp,attacker.combat.hp+attacker.combat.maxHp*.2);nourish(attacker,.3);}
  this.kills++;
 }
 bond(sim,a,b){const key=Math.min(a,b)*65536+Math.max(a,b);if(sim.bondKeys.has(key))return;sim.bonds.push([a,b]);sim.bondKeys.add(key);sim.bondCount[a]++;sim.bondCount[b]++;}
 nearestMember(a,sim,x,y){let best=-1,d=Infinity;for(const i of a.members){const e=Math.hypot(wrappedDelta(sim.x[i]-x,sim.width),wrappedDelta(sim.y[i]-y,sim.height));if(e<d){d=e;best=i;}}return best;}
 // agar.io: swallow free pellets and smaller organisms; big bodies shed mass.
 agar(a,sim,walkers,fish,owned){
  const st=a.stats,c=a.combat,b=a.body;if(!b)return;
  const cap=FACTION_CAP[st.faction];
  // Packs that outgrow their cap bud into two (more pack members); others shed.
  if(st.faction===0&&a.members.length>cap+1&&this.tick%60===a.id%60&&walkers.list.length<walkers.max+4&&(this.factionShare?.[0]||0)<=.5){this.split(a,sim,walkers,fish,[Math.cos(b.heading+Math.PI/2),Math.sin(b.heading+Math.PI/2)]);return;}
  if(this.tick%45===a.id%45&&a.members.length<Math.min(MAX_MEMBERS,cap)){
   let pick=-1,best=st.radius+4;
   for(let i=0;i<sim.count;i++){if(owned.has(i))continue;const d=Math.hypot(wrappedDelta(sim.x[i]-b.x,sim.width),wrappedDelta(sim.y[i]-b.y,sim.height));if(d<best){best=d;pick=i;}}
   if(pick>=0){this.bond(sim,pick,this.nearestMember(a,sim,sim.x[pick],sim.y[pick]));a.members.push(pick);owned.add(pick);nourish(a,.05);this.effect('pellet',sim.x[pick],sim.y[pick],sim.type[pick],{duration:12});}
  }
  if(this.tick%240===(a.id*7+120)%240&&a.members.length>Math.min(DECAY_ABOVE,cap+1)){const leaf=a.members.filter(i=>sim.bondCount[i]<=1);const i=leaf.length?leaf[0]:a.members[a.members.length-1];this.sever(a,i,sim,walkers,fish,[Math.cos(b.heading+Math.PI),Math.sin(b.heading+Math.PI)]);this.severed--;this.effect('shed',sim.x[i],sim.y[i],sim.type[i],{duration:16});}
 }
 engulf(a,o,sim,walkers,fish){
  const room=MAX_MEMBERS-a.members.length;if(room<=0)return false;
  const taken=o.members.slice(0,room),rest=o.members.slice(room),set=new Set(o.members);
  sim.bonds=sim.bonds.filter(b=>{if(set.has(b[0])&&set.has(b[1])&&(rest.includes(b[0])||rest.includes(b[1]))){sim.dropBond(b);return false;}return true;});
  this.bond(sim,taken[0],this.nearestMember(a,sim,sim.x[taken[0]],sim.y[taken[0]]));
  a.members.push(...taken);for(const c of fish)if(c.attachment?.walker===o.id)walkers.releaseFish(c);
  o.dead=true;o.members=[];walkers.list=walkers.list.filter(w=>w!==o);
  nourish(a,.4);a.combat.hp=Math.min(a.combat.maxHp+10*taken.length,a.combat.hp+10*taken.length);
  this.engulfed++;this.effect('engulf',a.body.x,a.body.y,sim.type[a.members[0]],{duration:30});return true;
 }
 split(a,sim,walkers,fish,dir){
  if(a.members.length<(a.stats?.faction===0?6:10)||!a.body)return false;
  const hx=dir[0],hy=dir[1],proj=i=>wrappedDelta(sim.x[i]-a.body.x,sim.width)*hx+wrappedDelta(sim.y[i]-a.body.y,sim.height)*hy;
  const sorted=[...a.members].sort((p,q)=>proj(q)-proj(p)),front=sorted.slice(0,Math.floor(sorted.length/2)),back=sorted.slice(front.length),fs=new Set(front);
  sim.bonds=sim.bonds.filter(b=>{if(fs.has(b[0])!==fs.has(b[1])&&(a.members.includes(b[0])&&a.members.includes(b[1]))){sim.dropBond(b);return false;}return true;});
  for(let k=1;k<front.length;k++)if(!sim.bonds.some(b=>(b[0]===front[k]||b[1]===front[k])))this.bond(sim,front[k],front[k-1]);
  for(let k=1;k<back.length;k++)if(!sim.bonds.some(b=>(b[0]===back[k]||b[1]===back[k])))this.bond(sim,back[k],back[k-1]);
  a.members=back;const child=walkers.create(sim,front);child.clan=a.clan||(a.clan='colony:'+a.id);child.traits={...ensureTraits(a)};child.features={...(a.features||{})};child.faction=a.faction;child.cohesion=1;child.celebrated=true;child.combat=null;
  for(const i of front){sim.vx[i]+=hx*3.2;sim.vy[i]+=hy*3.2;}
  child.mergeAt=this.tick+900;a.mergeAt=this.tick+900;this.splits++;this.effect('split',a.body.x,a.body.y,sim.type[a.members[0]],{duration:24});return child;
 }
 use(kind,a,target,sim,walkers,fish,enemies,dir,dist){
  const st=a.stats,c=a.combat,cd=Math.round(COOLDOWN[kind]*(st.faction===2?.75:1));c.cd[kind]=this.tick+cd;c.flash={kind,until:this.tick+18};
  if(kind==='dash'){const p=2.4*st.speed*(st.tail?1.25:1);for(const i of a.members){sim.vx[i]+=dir[0]*p;sim.vy[i]+=dir[1]*p;}c.dashUntil=this.tick+24;}
  else if(kind==='shock'){this.effect('shock',a.body.x,a.body.y,sim.type[a.members[0]],{duration:22,radius:st.radius+90});
   for(const o of enemies){const dx=wrappedDelta(o.body.x-a.body.x,sim.width),dy=wrappedDelta(o.body.y-a.body.y,sim.height),d=Math.hypot(dx,dy)||1;if(d<st.radius+90+o.stats.radius)this.damage(a,o,st.power*.9*typeMultiplier(st.faction,o.stats.faction)*this.scale(a),sim,walkers,fish,[dx/d,dy/d],'shock');}}
  // Ranged attack: tears off one of its own circles and hurls it (no separate projectile).
  else if(kind==='orb'){const i=this.throwPart(a,sim,dir);if(i>=0){this.pulse(sim,i,1);const speed=4.6;this.orbs.push({i,x:sim.x[i],y:sim.y[i],vx:dir[0]*speed,vy:dir[1]*speed,owner:a.id,clan:a.clan,faction:st.faction,species:sim.type[i],damage:st.power*.95*this.scale(a),life:80});this.effect('sever',sim.x[i],sim.y[i],sim.type[i],{duration:12});}}
  else if(kind==='shield'){c.shieldUntil=this.tick+150;}
  else if(kind==='regen'){c.regenUntil=this.tick+180;const owned=new Set(walkers.list.flatMap(w=>w.members));let pick=-1,best=70;
   for(let i=0;i<sim.count;i++){if(owned.has(i))continue;const d=Math.hypot(wrappedDelta(sim.x[i]-a.body.x,sim.width),wrappedDelta(sim.y[i]-a.body.y,sim.height));if(d<best){best=d;pick=i;}}
   if(pick>=0&&a.members.length<MAX_MEMBERS){this.bond(sim,pick,this.nearestMember(a,sim,sim.x[pick],sim.y[pick]));a.members.push(pick);this.effect('regrow',sim.x[pick],sim.y[pick],sim.type[pick],{duration:20});}}
  else if(kind==='split')this.split(a,sim,walkers,fish,dir);
 }
 stepRipples(sim,dt){
  if(!this.ripples?.length||!sim.pulse)return;const W=sim.width,H=sim.height,speed=7,width=16;
  this.ripples=this.ripples.filter(r=>{r.age+=dt;const front=r.age*speed;if(front>r.radius+width)return false;const fade=1-front/(r.radius+width);
   for(let i=0;i<sim.count;i++){const dx=wrappedDelta(sim.x[i]-r.x,W);if(dx>r.radius+width||dx<-r.radius-width)continue;const d=Math.hypot(dx,wrappedDelta(sim.y[i]-r.y,H)),shell=Math.exp(-(((d-front)/width)**2));
    if(shell>.05){const v=shell*fade;if(sim.pulse[i]<v)sim.pulse[i]=v;
     // Damage repulsion: the front shoves everything it crosses outward from the impact.
     if(d>1){const push=shell*fade*(r.force||.8)*dt;sim.vx[i]+=dx/d*push;sim.vy[i]+=wrappedDelta(sim.y[i]-r.y,H)/d*push;}}}
   return true;});
 }
 // Detach the member that faces the target most (never a leg hip; body keeps ≥3 circles).
 throwPart(a,sim,dir){
  if(a.members.length<4)return -1;const hips=new Set((a.legs||[]).map(l=>l.hip));let pick=-1,best=-Infinity;
  for(const i of a.members){if(hips.has(i))continue;const s=wrappedDelta(sim.x[i]-a.body.x,sim.width)*dir[0]+wrappedDelta(sim.y[i]-a.body.y,sim.height)*dir[1];if(s>best){best=s;pick=i;}}
  if(pick<0)return -1;
  sim.bonds=sim.bonds.filter(b=>{if(b[0]===pick||b[1]===pick){sim.dropBond(b);return false;}return true;});
  a.members=a.members.filter(m=>m!==pick);a.body?.slots?.delete(pick);return pick;
 }
 // Faction balance: the leading faction hits softer, rare factions harder; underdogs get a bonus.
 scale(a){return (this.factionScale?.[a.stats.faction]??1)*(this.bal?.damage??1);}
 // Balance director: every 2 s nudges global damage, aggression and new-organism formation so the scene
 // keeps 50–80% of the organism cap alive, 35–60% of bodies in a fight, and no bloodbath (≤ 3 deaths / 2 s).
 balance(orgs,walkers){
  const b=this.bal||(this.bal={damage:1,aggression:1,formation:.6,lastKills:this.kills,killRate:0,engaged:.4});
  const n=orgs.length,max=walkers.max||24,lo=max*.5,hi=max*.8;
  const eng=n?orgs.filter(a=>a.combat?.engaged).length/n:0;b.engaged=b.engaged*.6+eng*.4;
  const k=this.kills-b.lastKills;b.lastKills=this.kills;b.killRate=b.killRate*.7+k*.3;
  if(n<lo){b.damage*=.92;b.formation=Math.min(.95,b.formation+.08);}
  else if(n>hi){b.damage*=1.06;b.formation=Math.max(.2,b.formation-.08);}
  else{b.damage+=(1-b.damage)*.1;b.formation+=(.6-b.formation)*.1;}
  if(b.engaged<.35)b.aggression*=1.06;else if(b.engaged>.6)b.aggression*=.95;
  if(b.killRate>3)b.damage*=.9;
  b.damage=clamp(b.damage,.35,1.6);b.aggression=clamp(b.aggression,.7,1.8);walkers.formChance=b.formation;
 }
 rivals(a,b){return a.combat?.rivalId===b.id&&this.tick<(a.combat.rivalUntil||0)||b.combat?.rivalId===a.id&&this.tick<(b.combat.rivalUntil||0);}
 hostile(a,b){if(a===b||a.clan&&a.clan===b.clan)return false;return (a.stats?.faction??a.faction)!==(b.stats?.faction??b.faction)||this.rivals(a,b);}
 updateRivalries(orgs,sim){
  const alive=new Set(orgs.map(a=>a.id));
  for(const a of orgs){const c=a.combat;if(c.rivalId&&(!alive.has(c.rivalId)||this.tick>=c.rivalUntil)){c.rivalId=null;c.rivalUntil=0;}}
  if(this.tick%120)return;
  let active=orgs.filter(a=>a.combat.rivalId).length/2;const limit=Math.max(1,Math.floor(orgs.length/6));
  for(const a of orgs){const c=a.combat;if(active>=limit)break;if(c.rivalId||this.tick<(c.rivalAfter||0)||this.tick<c.fatigue||c.hp<c.maxHp*.4)continue;
   let rival=null,best=160;
   for(const b of orgs){const d=b.combat;if(a===b||a.stats.faction!==b.stats.faction||a.clan&&a.clan===b.clan||d.rivalId||this.tick<(d.rivalAfter||0)||this.tick<d.fatigue||d.hp<d.maxHp*.4)continue;
    const distance=Math.hypot(wrappedDelta(b.body.x-a.body.x,sim.width),wrappedDelta(b.body.y-a.body.y,sim.height));if(distance<best){best=distance;rival=b;}
   }
   if(!rival)continue;
   const pressure=Math.max(ensureNeeds(a).hunger,ensureNeeds(rival).hunger),territorial=a.behavior?.name==='territorial'||rival.behavior?.name==='territorial';
   if(this.rng()>.18+pressure*.2+(territorial?.15:0))continue;
   const until=this.tick+180+Math.floor(this.rng()*180),rest=900+Math.floor(this.rng()*600);
   for(const [body,other] of [[a,rival],[rival,a]]){body.combat.rivalId=other.id;body.combat.rivalUntil=until;body.combat.rivalAfter=until+rest;}active++;
  }
 }
 step(sim,walkers,fish,creatures=null,dt=1){
  this.tick++;for(const e of this.fx)e.age+=dt;this.fx=this.fx.filter(e=>e.age<e.duration);
  this.stepStars(sim,walkers,dt);this.stepRipples(sim,dt);
  if(!this.enabled){this.orbs=[];return;}
  const orgs=walkers.list.filter(a=>a.body&&a.members.length>=3&&!a.dead);
  // Star power: the body breathes in scale while it lasts.
  for(const a of orgs)if(this.tick<(a.combat?.starUntil||0))for(const i of a.members)this.pulse(sim,i,.35+.25*Math.sin(this.tick*.12+i));
  for(const a of orgs){if(this.tick%60===a.id%60||a.faction===undefined)a.faction=factionOf(sim,a.members);a.stats=statsFor(a,sim,fish);this.state(a,a.stats);
   const b=a.body;if(b.av){b.heading+=b.av*dt;b.av*=Math.exp(-.07*dt);if(Math.abs(b.av)<1e-4)b.av=0;}}
  if(this.tick%120===0)this.balance(orgs,walkers);
  const counts=[0,0,0];for(const a of orgs)counts[a.stats.faction]++;this.factionCounts=counts;
  const total=Math.max(1,orgs.length);this.factionShare=counts.map(n=>n/total);
  this.factionScale=this.factionShare.map(share=>share>.65?.65:share>.5?.8:share<.2&&orgs.length>=3?1.25:1);
  // Resurgence: a faction absent for 10 s regrows from its own free circles.
  this.absent=this.absent||[0,0,0];counts.forEach((n,f)=>{this.absent[f]=n?0:this.absent[f]+dt;});
  if(this.tick%120===0)for(let f=0;f<3;f++)if(this.absent[f]>600&&walkers.list.length<walkers.max+4){if(this.reseed(f,sim,walkers,orgs))this.absent[f]=0;}
  walkers.blockedFaction=this.factionShare.findIndex(share=>share>.5&&orgs.length>=4);
  this.updateRivalries(orgs,sim);
  const owned=new Set(orgs.flatMap(a=>a.members));
  for(const a of orgs){
   if(a.dead)continue;const st=a.stats,c=a.combat,b=a.body,star=this.tick<c.starUntil;
   c.hp=Math.min(c.maxHp,c.hp+c.maxHp*st.regen*dt*(this.tick<(c.regenUntil||0)?6:1));
   if(this.agarEnabled)this.agar(a,sim,walkers,fish,owned);
   // A short same-type feud takes priority; otherwise pursue ordinary enemies.
   let target=orgs.find(o=>o!==a&&!o.dead&&this.rivals(a,o))||null,best=target?-1:(480+(ensureTraits(a).hunt||0)*100)*(this.bal?.aggression??1),allies=0;
   for(const o of orgs){if(o===a||o.dead)continue;const d=Math.hypot(wrappedDelta(o.body.x-b.x,sim.width),wrappedDelta(o.body.y-b.y,sim.height));
    if(!this.hostile(a,o)){if(d<180)allies++;continue;}if(d<best){best=d;target=o;}}
   c.allies=allies;
   if(!target){c.engaged=false;continue;}
   const dx=wrappedDelta(target.body.x-b.x,sim.width),dy=wrappedDelta(target.body.y-b.y,sim.height),dist=Math.hypot(dx,dy)||1,dir=[dx/dist,dy/dist];
   const ratio=target.members.length/a.members.length,hpFrac=c.hp/c.maxHp,targetStar=this.tick<(target.combat?.starUntil||0);
   // Strategy: swarm commits in packs, colossus fights unless broken, mystic kites; everyone flees a star.
   let mode='engage';
   if(targetStar&&!star)mode='flee';
   else if(!star&&hpFrac<.25)mode='flee';
   else if(!star&&this.tick<c.fatigue)mode='hold';
      else if(st.faction===2&&dist<130&&!star)mode='kite';
   else if(ratio>1.3*1.15&&dist<st.radius+target.stats.radius+40&&!star)mode='flee';
   c.engaged=mode==='engage';c.mode=mode;
   const sign=mode==='engage'?1:mode==='flee'||mode==='kite'?-1:0,accel=.07*Math.min(1.4,this.bal?.aggression??1)*st.speed*(star?1.5:1)*dt;
   if(sign)for(const i of a.members){sim.vx[i]+=dir[0]*accel*sign;sim.vy[i]+=dir[1]*accel*sign;}
   // Face the target (tail turns faster).
   const want=Math.atan2(dir[1],dir[0])+(sign<0?Math.PI:0),diff=Math.atan2(Math.sin(want-b.heading),Math.cos(want-b.heading));b.av=(b.av||0)+clamp(diff,-1,1)*.004*st.turn*dt;
   // agar.io engulf: a body ≥30% bigger swallows a smaller one whose centre is inside it.
   if(this.agarEnabled&&a.members.length>=target.members.length*1.3&&dist<st.radius*.65&&!targetStar){if(this.engulf(a,target,sim,walkers,fish))continue;}
   // Abilities.
   const abilities=abilitiesFor(st,a,sim,this.agarEnabled);c.abilities=abilities;
   const enemies=orgs.filter(o=>o!==a&&!o.dead&&this.hostile(a,o));
   for(const k of abilities){if(this.tick<(c.cd[k]||0))continue;
    if(k==='dash'&&mode==='engage'&&dist>st.radius+target.stats.radius+10&&dist<230){this.use(k,a,target,sim,walkers,fish,enemies,dir,dist);break;}
    if(k==='shock'&&enemies.some(o=>Math.hypot(wrappedDelta(o.body.x-b.x,sim.width),wrappedDelta(o.body.y-b.y,sim.height))<st.radius+80+o.stats.radius)){this.use(k,a,target,sim,walkers,fish,enemies,dir,dist);break;}
    if(k==='orb'&&dist<330&&dist>40){this.use(k,a,target,sim,walkers,fish,enemies,dir,dist);break;}
    if(k==='shield'&&(hpFrac<.6||this.orbs.some(o=>(!o.clan||o.clan!==a.clan)&&(o.faction!==st.faction||c.rivalId===o.owner&&this.tick<c.rivalUntil)&&Math.hypot(wrappedDelta(o.x-b.x,sim.width),wrappedDelta(o.y-b.y,sim.height))<60))){this.use(k,a,target,sim,walkers,fish,enemies,dir,dist);break;}
    if(k==='regen'&&(hpFrac<.55||(st.faction===2&&st.n<5))){this.use(k,a,target,sim,walkers,fish,enemies,dir,dist);break;}
    if(k==='split'&&mode==='engage'&&ratio<.6&&dist<260&&walkers.list.length<walkers.max+3&&(this.factionShare?.[st.faction]||0)<=.5){this.use(k,a,target,sim,walkers,fish,enemies,dir,dist);break;}
   }
   // Melee on contact (dash and star hit harder; packs add up to +45%).
   const contact=st.radius+target.stats.radius+4;
   if(dist<contact&&this.tick>=(c.cd.melee||0)&&mode!=='flee'){
    c.cd.melee=this.tick+st.attackEvery;
    const crit=this.rng()<st.crit?1.6:1,pack=st.faction===0?1+.2*Math.min(3,allies):1,underdog=clamp(Math.sqrt(ratio),1,1.5),dash=this.tick<c.dashUntil?1.5:1;
    const amount=st.power*typeMultiplier(st.faction,target.stats.faction)*pack*underdog*crit*dash*(star?2:1)*this.scale(a)*(.85+this.rng()*.3);
    // Lunge: the attacker snaps forward into the blow.
    {const l=1.1*Math.min(1.6,st.speed+.4)/Math.sqrt(a.members.length);for(const i of a.members){sim.vx[i]+=dir[0]*l;sim.vy[i]+=dir[1]*l;}}
    this.damage(a,target,amount,sim,walkers,fish,dir);
    // Recoil on the attacker (equal and opposite, smaller).
    this.impulse(a,sim,-dir[0]*.8,-dir[1]*.8,b.x+dir[0]*st.radius,b.y+dir[1]*st.radius,st);
   }
  }
  this.stepOrbs(sim,walkers,fish,orgs,dt);
  // Split siblings of the same clan re-merge after their timer (agar.io).
  if(this.agarEnabled)for(const a of orgs)if(!a.dead&&a.mergeAt&&this.tick>=a.mergeAt)for(const o of orgs){if(o===a||o.dead||o.clan!==a.clan||!o.mergeAt||this.tick<o.mergeAt||a.members.length+o.members.length>MAX_MEMBERS)continue;
   const d=Math.hypot(wrappedDelta(o.body.x-a.body.x,sim.width),wrappedDelta(o.body.y-a.body.y,sim.height));if(d<a.stats.radius+o.stats.radius){const i=this.nearestMember(a,sim,o.body.x,o.body.y),j=this.nearestMember(o,sim,a.body.x,a.body.y);this.bond(sim,i,j);a.mergeAt=o.mergeAt=0;walkers.merge(a,o,sim,fish,null);break;}}
 }
 stepOrbs(sim,walkers,fish,orgs,dt){
  const W=sim.width,H=sim.height,flying=new Set();
  // Thrown circles fly kinematically; on hit or expiry they drop as free particles (food).
  const release=o=>{if(o.i>=0&&o.i<sim.count){sim.vx[o.i]=o.vx*.25;sim.vy[o.i]=o.vy*.25;}};
  this.orbs=this.orbs.filter(o=>{if(o.i===undefined||o.i<0||o.i>=sim.count)return false;o.life-=dt;o.x=((o.x+o.vx*dt)%W+W)%W;o.y=((o.y+o.vy*dt)%H+H)%H;
   sim.x[o.i]=o.x;sim.y[o.i]=o.y;sim.vx[o.i]=o.vx;sim.vy[o.i]=o.vy;if(o.life<=0){release(o);return false;}flying.add(o.i);
   const source=orgs.find(a=>a.id===o.owner);
   for(const t of orgs){if(t.dead||t.id===o.owner||(source?!this.hostile(source,t):(o.clan&&t.clan===o.clan)||t.stats.faction===o.faction))continue;const dx=wrappedDelta(t.body.x-o.x,W),dy=wrappedDelta(t.body.y-o.y,H),d=Math.hypot(dx,dy);
    if(d<t.stats.radius+4){const owner=orgs.find(a=>a.id===o.owner)||null,n=Math.hypot(o.vx,o.vy)||1;this.damage(owner,t,o.damage*typeMultiplier(o.faction,t.stats.faction),sim,walkers,fish,[o.vx/n,o.vy/n],'orb');release(o);flying.delete(o.i);return false;}}
   return true;});
  if(flying.size)sim.bonds=sim.bonds.filter(b=>{if(flying.has(b[0])||flying.has(b[1])){sim.dropBond(b);return false;}return true;});
  walkers.thrown=this.orbs;
 }
 // Star power-up: super nutritious; 8 s of invincibility, double damage, speed; enemies flee.
 stepStars(sim,walkers,dt){
  const W=sim.width,H=sim.height;
  if(this.tick>=this.nextStar&&this.stars.length===0){this.stars.push({x:this.rng()*W,y:this.rng()*H,vx:(this.rng()-.5)*.6,vy:(this.rng()-.5)*.6,life:900,age:0});this.nextStar=this.tick+1200+Math.floor(this.rng()*900);this.effect('starspawn',this.stars[0].x,this.stars[0].y,4,{duration:30});}
  this.stars=this.stars.filter(s=>{s.age+=dt;s.life-=dt;s.x=((s.x+s.vx*dt)%W+W)%W;s.y=((s.y+s.vy*dt)%H+H)%H;
   for(const a of walkers.list){if(!a.body||a.dead)continue;const d=Math.hypot(wrappedDelta(a.body.x-s.x,W),wrappedDelta(a.body.y-s.y,H));
    if(d<(a.stats?.radius??14)+6){const st=a.stats||statsFor(a,sim);const c=this.state(a,st);c.starUntil=this.tick+480;c.hp=c.maxHp;nourish(a,1);const n=ensureNeeds(a);n.health=1;for(const i of a.members)sim.energy[i]=2;this.starCount++;this.effect('starget',s.x,s.y,4,{duration:30});return false;}}
   if(s.life<=0)this.nextStar=Math.min(this.nextStar,this.tick+600);return s.life>0;});
 }
 reseed(f,sim,walkers,orgs){
  const owned=new Set(orgs.flatMap(a=>a.members)),free=[];for(let i=0;i<sim.count;i++)if(!owned.has(i)&&FACTION_OF[sim.type[i]]===f)free.push(i);
  for(let k=0;k<12&&free.length>=4;k++){const seed=free[Math.floor(this.rng()*free.length)];const near=free.filter(i=>i!==seed&&Math.hypot(wrappedDelta(sim.x[i]-sim.x[seed],sim.width),wrappedDelta(sim.y[i]-sim.y[seed],sim.height))<90).slice(0,3);
   if(near.length<3)continue;const group=[seed,...near];for(let j=1;j<group.length;j++)this.bond(sim,group[j-1],group[j]);const w=walkers.create(sim,group);w.faction=f;w.cohesion=.5;this.effect('rise',sim.x[seed],sim.y[seed],sim.type[seed],{duration:30});return w;}
  return null;
 }
 stats(){return {factions:this.factionCounts||[0,0,0],kills:this.kills,severed:this.severed,engulfed:this.engulfed,splits:this.splits,stars:this.starCount,starActive:this.stars.length>0,balance:this.bal?{damage:this.bal.damage,aggression:this.bal.aggression,formation:this.bal.formation,engaged:this.bal.engaged}:null};}
 serialize(walkers,sim){
  const orgs=walkers.list.filter(a=>a.body&&a.combat&&!a.dead).map(a=>({x:a.body.x,y:a.body.y,r:a.stats?.radius??14,hp:a.combat.hp/a.combat.maxHp,faction:a.stats?.faction??0,species:sim.type[a.members[0]]??0,shield:this.tick<a.combat.shieldUntil,star:this.tick<a.combat.starUntil?(a.combat.starUntil-this.tick)/480:0,engaged:!!a.combat.engaged,flash:a.combat.flash&&this.tick<a.combat.flash.until?a.combat.flash.kind:null}));
  return {tick:this.tick,orgs,orbs:[],stars:this.stars.map(s=>({x:s.x,y:s.y,age:s.age,life:s.life})),fx:this.fx.map(e=>({...e,t:e.age/e.duration})),stats:this.stats()};
 }
}
