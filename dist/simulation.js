import {DEFAULT_PALETTE} from './color.js?v=1.25.2';
// 60-30-10: species 0–1 30% each, 2–3 15% each, 4–5 5% each (deterministic interleave).
export const SPECIES_PATTERN=[0,1,2,3,4,5,0,1,0,1,2,3,0,1,0,1,2,3,0,1];
// Species colours come from a harmonic OKLCH palette; mutated in place when the palette changes.
export const COLORS=[...DEFAULT_PALETTE.colors];
export const PRESETS={
 symbiosis:{name:'Simbiose',description:'Afinidades suaves. Colônias que se encontram e se reorganizam.',matrix:Array.from({length:6},(_,a)=>Array.from({length:6},(_,b)=>a===b?.32:((a+1)%6===b?.65:((b+1)%6===a?.18:-.22))))},
 currents:{name:'Correntes',description:'Perseguições brandas. Grupos coesos que avançam em fila, como cardumes na correnteza.',matrix:Array.from({length:6},(_,a)=>Array.from({length:6},(_,b)=>a===b?.55:((a+1)%6===b?.55:((b+1)%6===a?.1:-.15))))},
 predator:{name:'Predador e presa',description:'Três pares de cores: uma caça, a outra foge. Grupos coesos em perseguição.',matrix:Array.from({length:6},(_,a)=>Array.from({length:6},(_,b)=>a===b?.6:((a>>1)===(b>>1)?(a%2===0?.8:-.6):-.1)))},
 colonies:{name:'Colônias',description:'Cada espécie encontra seu lugar. Ilhas de cor e membranas vivas.',matrix:Array.from({length:6},(_,a)=>Array.from({length:6},(_,b)=>a===b?.85:-.35))}
};
// Geometry follows energy (with hysteresis): hungry → triangle (1), balanced → circle (0), well fed → square (2).
// Particle life cycle: seed ○ (tiny) → juvenile △ (growing) → adult □ (full size) → elder □ (shrinking) → reborn as seed.
// Each particle has its own genetic max size (0.55×–1.6×, mildly skewed for a fairly uniform look). Visual only.
export const SIZE_CLASSES=64,SIZE_MIN=.55,SIZE_MAX=1.6;
export const sizeFactor=k=>SIZE_MIN+k*(SIZE_MAX-SIZE_MIN)/(SIZE_CLASSES-1);
// Secondary particles: 60% of particles drawn at 10–50% size (minor = 1..40 encodes the scale; 0 = full size).
// Their bonds are weaker (see bond loop).
export const MINOR_SHARE=.6;export const minorDraw=rng=>rng()<MINOR_SHARE?1+Math.floor(rng()*40):0;
export function sizeClass(r){return Math.min(SIZE_CLASSES-1,Math.floor(SIZE_CLASSES*Math.pow(r,1.4)));}
export const lifespanSteps=r=>12000+r*18000; // 200–500 s at 60 Hz, normal energy
export function stageFor(t){
 if(t<.15)return {stage:0,shape:0,growth:.45+.2*t/.15};
 if(t<.45)return {stage:1,shape:1,growth:.65+.35*(t-.15)/.3};
 if(t<.8)return {stage:2,shape:2,growth:1};
 return {stage:3,shape:2,growth:1-.45*Math.min(1,(t-.8)/.2)};
}
// Render effect code: stage × 50 + transition progress (0–49 over 45 steps ≈ 0.75 s).
export const TRANSITION_STEPS=45;
export const fxCode=(stage,timer)=>stage*50+Math.min(49,Math.round(timer/TRANSITION_STEPS*49));
export function sizeNow(maxClass,growth){const f=sizeFactor(maxClass)*growth;return Math.max(0,Math.min(SIZE_CLASSES-1,Math.round((f-SIZE_MIN)/(SIZE_MAX-SIZE_MIN)*(SIZE_CLASSES-1))));}
// Bonds: mutually attracted particles that come close link with springs (valence per species role).
export const VALENCE=[2,2,3,3,1,1];
export function wrappedDelta(d,size){return d-Math.round(d/size)*size;}
export function interaction(q,affinity){if(q<=0||q>=1)return 0;return q<.22?q/.22-1:affinity*(1-Math.abs(2*(q-.22)/.78-1));}
export function mobilityTarget(density,energy){return Math.max(.6,Math.min(1.4,1.1+.3*(energy-1)-.5*Math.min(1,density/12)));}
export class Simulation{
 constructor(count=2800,width=1500,height=950,rng=Math.random){this.width=width;this.height=height;this.rng=rng;this.radius=85;this.force=.65;this.setInertia(.8);this.ecology=true;this.dynamicMobility=true;this.wiggle=0;this.bonding=false;this.consumed=0;this.matrix=PRESETS.symbiosis.matrix.map(r=>[...r]);this.reset(count);}
 reset(count=this.count){this.count=Math.max(1,Math.min(12000,Math.round(count)));this.x=new Float32Array(this.count);this.y=new Float32Array(this.count);this.vx=new Float32Array(this.count);this.vy=new Float32Array(this.count);this.type=new Uint8Array(this.count);this.energy=new Float32Array(this.count);this.feedCooldown=new Float32Array(this.count);this.mobility=new Float32Array(this.count).fill(1);this.next=new Int32Array(this.count);this.cellIndex=new Int32Array(this.count);this.particleOrder=new Int32Array(this.count);this.forceX=new Float64Array(this.count);this.forceY=new Float64Array(this.count);this.densities=new Float64Array(this.count);this.morph=new Float32Array(this.count);this.shape=new Uint8Array(this.count);this.size=new Uint8Array(this.count);this.sizeMax=new Uint8Array(this.count);this.age=new Float32Array(this.count);this.lifespan=new Float32Array(this.count);this.stage=new Uint8Array(this.count);this.bondCount=new Uint8Array(this.count);this.bonds=[];this.bodyBondKeys=new Set();this.bondKeys=new Set();this.bondCandidates=[];this.stageTimer=new Float32Array(this.count);this.fx=new Uint8Array(this.count);this.pulse=new Float32Array(this.count);this.minor=new Uint8Array(this.count);this.wiggleAmp=new Float32Array(this.count);this.wiggleFreq=new Float32Array(this.count);this.wigglePhase=new Float32Array(this.count);this.gridReady=false;this.changedIndices=null;this.consumed=0;for(let i=0;i<this.count;i++){this.x[i]=this.rng()*this.width;this.y[i]=this.rng()*this.height;this.type[i]=SPECIES_PATTERN[i%SPECIES_PATTERN.length];this.energy[i]=1;if(this.x[i]>=this.width)this.x[i]=0;if(this.y[i]>=this.height)this.y[i]=0;const r=this.rng();this.wiggleAmp[i]=.012+.11*r*r*r;this.wiggleFreq[i]=.05+.16*this.rng();this.wigglePhase[i]=this.rng()*Math.PI*2;this.sizeMax[i]=sizeClass(this.rng());this.minor[i]=minorDraw(this.rng);this.lifespan[i]=lifespanSteps(this.rng());this.age[i]=this.rng()*this.lifespan[i];const st=stageFor(this.age[i]/this.lifespan[i]);this.shape[i]=st.shape;this.morph[i]=st.shape;this.size[i]=sizeNow(this.sizeMax[i],st.growth);this.stage[i]=st.stage;this.stageTimer[i]=TRANSITION_STEPS;this.fx[i]=fxCode(st.stage,TRANSITION_STEPS);}}
 // Remove and add particles in one pass. Removal is swap-with-last so few indices change;
 // changed indices are recorded so the renderer can reset only those trails.
 rebuild(removed,added=[]){
  const keys=['x','y','vx','vy','type','energy','feedCooldown','mobility','wiggleAmp','wiggleFreq','wigglePhase','morph','shape','size','sizeMax','age','lifespan','stage','stageTimer','fx','pulse','minor'];
  const changed=this.changedIndices||(this.changedIndices=new Set());let m=this.count;
  const orig=Int32Array.from({length:this.count},(_,i)=>i);
  for(const i of [...removed].filter(i=>i>=0&&i<this.count).sort((a,b)=>b-a)){m--;if(i!==m){for(const k of keys)this[k][i]=this[k][m];if(orig)orig[i]=orig[m];changed.add(i);}changed.delete(m);}
  // Remap bonds through the same swaps; drop bonds that touch removed particles.
  {const now=new Map();for(let i=0;i<m;i++)now.set(orig[i],i);if(this.bonds?.length)this.bonds=this.bonds.filter(b=>now.has(b[0])&&now.has(b[1])).map(b=>[now.get(b[0]),now.get(b[1])]);(this.remapLog||(this.remapLog=[])).push(now);if(this.remapLog.length>8)this.remapLog.shift();}
  const total=Math.max(1,m+added.length);
  for(const k of keys){const A=new this[k].constructor(total);A.set(this[k].subarray(0,Math.min(m,total)));this[k]=A;}
  added.forEach((p,j)=>{const i=m+j;if(i>=total)return;this.x[i]=((p.x%this.width)+this.width)%this.width;this.y[i]=((p.y%this.height)+this.height)%this.height;if(this.x[i]>=this.width)this.x[i]=0;if(this.y[i]>=this.height)this.y[i]=0;
   this.vx[i]=p.vx||0;this.vy[i]=p.vy||0;this.type[i]=p.type;this.energy[i]=p.energy??1;this.feedCooldown[i]=30;this.mobility[i]=1;this.sizeMax[i]=sizeClass(this.rng());this.lifespan[i]=lifespanSteps(this.rng());this.age[i]=(p.stage??0)*this.lifespan[i];{const st=stageFor(p.stage??0);this.shape[i]=st.shape;this.morph[i]=st.shape;this.size[i]=sizeNow(this.sizeMax[i],st.growth);this.stage[i]=st.stage;this.stageTimer[i]=0;this.fx[i]=fxCode(st.stage,0);}const r=this.rng();this.wiggleAmp[i]=.012+.11*r*r*r;this.wiggleFreq[i]=.05+.16*this.rng();this.wigglePhase[i]=this.rng()*Math.PI*2;changed.add(i);});
  this.count=total;if(this.bonds){this.bondCount=new Uint8Array(total);this.bondKeys=new Set();for(const b of this.bonds){this.bondCount[b[0]]++;this.bondCount[b[1]]++;this.bondKeys.add(b[0]<b[1]?b[0]*65536+b[1]:b[1]*65536+b[0]);}}this.next=new Int32Array(total);this.cellIndex=new Int32Array(total);this.particleOrder=new Int32Array(total);this.forceX=new Float64Array(total);this.forceY=new Float64Array(total);this.densities=new Float64Array(total);this.gridReady=false;
 }
 dropBond(b,remove=true){this.bondCount[b[0]]=Math.max(0,this.bondCount[b[0]]-1);this.bondCount[b[1]]=Math.max(0,this.bondCount[b[1]]-1);this.bondKeys.delete(b[0]<b[1]?b[0]*65536+b[1]:b[1]*65536+b[0]);}
 // Springs keep bonded pairs at a rest length; bonds break when stretched, when affinity turns
 // repulsive, or rarely by chance. New bonds form from this step's close, mutually attracted pairs.
 updateBonds(dt){
  const x=this.x,y=this.y,vx=this.vx,vy=this.vy,w=this.width,h=this.height,t=this.type,M=this.matrix,count=this.bondCount,r=this.radius,rest=r*.2,breakD=r*.5,k=.035*dt;
  const kept=[],minor=this.minor;
  // Cluster size per particle (union-find over bonds) so secondary particles weaken further in bigger groups.
  let comp=null;if(minor&&this.bonds.length){const n=this.count,par=this.ufParent&&this.ufParent.length>=n?this.ufParent:(this.ufParent=new Int32Array(Math.ceil(n*1.25))),sz=this.ufSize&&this.ufSize.length>=n?this.ufSize:(this.ufSize=new Int32Array(par.length));
   for(let i=0;i<n;i++){par[i]=i;sz[i]=1;}const find=i=>{while(par[i]!==i){par[i]=par[par[i]];i=par[i];}return i;};
   for(const [p,q] of this.bonds){if(p>=n||q>=n)continue;let x=find(p),y=find(q);if(x===y)continue;if(sz[x]<sz[y]){const t=x;x=y;y=t;}par[y]=x;sz[x]+=sz[y];}
   comp=i=>sz[find(i)];}
  for(const b of this.bonds){const [a,c]=b;const dx=wrappedDelta(x[c]-x[a],w),dy=wrappedDelta(y[c]-y[a],h),d=Math.hypot(dx,dy)||1e-6;
   const body=this.bodyBondKeys?.has(Math.min(a,c)*65536+Math.max(a,c));
   // Secondary (half-size) particles hold weaker bonds: half the spring, shorter reach, break 3× more often.
   const weak=minor&&(minor[a]||minor[c]);
   // Weak bonds lose more in larger clusters: +12% softer spring and +25% break rate per circle beyond 3.
   const extra=weak&&comp?Math.max(0,comp(a)-3):0,soft=weak?.5/(1+extra*.12):1,reach=weak?.75/(1+extra*.04):1,fragile=weak?3*(1+extra*.25):1;
   if(d>breakD*(body?1.4:1)*reach||M[t[a]][t[c]]<(body?-.35:0)||M[t[c]][t[a]]<(body?-.35:0)||this.rng()<(body?.00005:.0003)*fragile*dt){this.dropBond(b);continue;}
   const f=(d-rest)*k*soft/d;vx[a]+=dx*f;vy[a]+=dy*f;vx[c]-=dx*f;vy[c]-=dy*f;kept.push(b);}
  this.bonds=kept;
  if(!this.bonding)return;
  const cand=this.bondCandidates,limit=this.count*1.5,own=this.ownerX===this.x?this.owner:null;
  for(let q=0;q<cand.length&&this.bonds.length<limit;q+=2){const a=cand[q],c=cand[q+1];if(own&&own[a]&&own[c]&&own[a]!==own[c])continue;if(count[a]>=VALENCE[t[a]]||count[c]>=VALENCE[t[c]])continue;const key=a<c?a*65536+c:c*65536+a;if(this.bondKeys.has(key))continue;if(this.rng()>.04)continue;
   this.bondKeys.add(key);count[a]++;count[c]++;this.bonds.push([a,c]);}
  for(const b of this.bonds){const vxm=(vx[b[0]]+vx[b[1]])/2,vym=(vy[b[0]]+vy[b[1]])/2;vx[b[0]]+=(vxm-vx[b[0]])*.02;vy[b[0]]+=(vym-vy[b[0]])*.02;vx[b[1]]+=(vxm-vx[b[1]])*.02;vy[b[1]]+=(vym-vy[b[1]])*.02;}
 }
 bondPairs(){const out=new Int32Array(this.bonds.length*2);this.bonds.forEach((b,i)=>{out[i*2]=b[0];out[i*2+1]=b[1];});return out;}
 setInertia(value){this.inertia=Math.max(0,Math.min(1,Number(value)||0));this.friction=.82+.17*this.inertia;}
 preset(key){this.matrix=PRESETS[key].matrix.map(r=>[...r]);}
 step(dt=1,pointer=null){
 const n=this.count,w=this.width,h=this.height,r=this.radius,r2=r*r,halfW=w/2,halfH=h/2;
 const cols=Math.max(1,Math.floor(w/(r*.5))),rows=Math.max(1,Math.floor(h/(r*.5))),cw=w/cols,ch=h/rows;
 if(!this.cellCounts||this.cellCounts.length!==cols*rows){this.cellCounts=new Int32Array(cols*rows);this.cellStarts=new Int32Array(cols*rows+1);this.cellCursor=new Int32Array(cols*rows);}
 this.cellCounts.fill(0);
 if(this.gridCols!==cols||this.gridRows!==rows){
  this.gridCols=cols;this.gridRows=rows;
  this.neighbors=Array.from({length:cols*rows},(_,c)=>{
   const cells=new Set(),cx=c%cols,cy=Math.floor(c/cols);
   for(let oy=-Math.ceil(r/ch);oy<=Math.ceil(r/ch);oy++)for(let ox=-Math.ceil(r/cw);ox<=Math.ceil(r/cw);ox++)cells.add(((cx+ox+cols)%cols)+((cy+oy+rows)%rows)*cols);
   return [...cells];
  });
 }
 const x=this.x,y=this.y,vx=this.vx,vy=this.vy,types=this.type,energy=this.energy,cooldown=this.feedCooldown;
 const fx=this.forceX,fy=this.forceY,densities=this.densities;
 fx.fill(0);fy.fill(0);densities.fill(0);
 for(let i=0;i<n;i++){
  const c=Math.min(cols-1,Math.floor(x[i]/cw))+Math.min(rows-1,Math.floor(y[i]/ch))*cols;
  this.cellIndex[i]=c;this.cellCounts[c]++;cooldown[i]=Math.max(0,cooldown[i]-dt);
 }
 const starts=this.cellStarts,order=this.particleOrder;
 starts[0]=0;for(let c=0;c<this.cellCounts.length;c++){starts[c+1]=starts[c]+this.cellCounts[c];this.cellCursor[c]=starts[c];}
 // Descending IDs preserve the feeding order of the prior linked-cell lists.
 for(let i=n-1;i>=0;i--)order[this.cellCursor[this.cellIndex[i]]++]=i;
 const damp=Math.pow(this.friction,dt),response=this.force*((1-this.friction)/.18)*dt;
 const mobilityBlend=1-Math.pow(.94,dt),invR=1/r,invDensityRadius=1/(r*.6);
 let transfers=0;const wiggle=this.wiggle,bonding=this.bonding,bondR=r*.3,candidates=this.bondCandidates;candidates.length=0;const bondCount=this.bondCount;
 for(let i=0;i<n;i++){
  let ax=fx[i],ay=fy[i],density=densities[i];
  const xi=x[i],yi=y[i],ti=types[i],prey=(ti+1)%6,rule=this.matrix[ti];
  const cx=Math.min(cols-1,Math.floor(xi/cw)),cy=Math.min(rows-1,Math.floor(yi/ch));
  for(const c of this.neighbors[cx+cy*cols])for(let k=starts[c];k<starts[c+1];k++){
   const j=order[k];
   if(i===j)continue;
   // Lower-index pairs already contributed both directed forces and densities.
   const canFeed=this.ecology&&types[j]===prey&&cooldown[i]===0&&cooldown[j]===0;
   if(j<i&&!canFeed){if(!this.ecology||cooldown[i]>0||energy[i]>=2)break;continue;}
   let dx=x[j]-xi,dy=y[j]-yi;
   if(dx>halfW)dx-=w;else if(dx< -halfW)dx+=w;
   if(dy>halfH)dy-=h;else if(dy< -halfH)dy+=h;
   let d2=dx*dx+dy*dy;
   if(d2>=r2)continue;
   if(j>i){
    if(d2<.0001){dx=.001;dy=0;d2=.000001;}
    const d=Math.sqrt(d2),invD=1/d,q=d*invR;
    let forceA,forceB;
    if(q<.22){forceA=forceB=(q/.22-1)*invD;}
    else{const shape=(1-Math.abs(2*(q-.22)/.78-1))*invD;forceA=rule[types[j]]*shape;forceB=this.matrix[types[j]][ti]*shape;}
    ax+=forceA*dx;ay+=forceA*dy;fx[j]-=forceB*dx;fy[j]-=forceB*dy;
    if(d<r*.6){const weight=1-d*invDensityRadius;density+=weight;densities[j]+=weight;}
    if(bonding&&d<bondR&&bondCount[i]<VALENCE[ti]&&bondCount[j]<VALENCE[types[j]]&&rule[types[j]]>.2&&this.matrix[types[j]][ti]>.2)candidates.push(i,j);
   }
   // Feeding remains in directed particle order and never changes positions.
   if(canFeed&&d2<36){
    const transfer=Math.min(.25,Math.max(0,energy[j]-.3),Math.max(0,2-energy[i]));
    if(transfer>.001){energy[i]+=transfer;energy[j]-=transfer;cooldown[i]=cooldown[j]=30;transfers++;}
   }
  }
  if(pointer){
   const dx=wrappedDelta(pointer.x-xi,w),dy=wrappedDelta(pointer.y-yi,h),d=Math.hypot(dx,dy);
   if(d>1&&d<180){ax+=dx/d*pointer.force*(1-d/180);ay+=dy/d*pointer.force*(1-d/180);}
  }
  const target=mobilityTarget(density,this.ecology?energy[i]:1);
  this.mobility[i]=this.dynamicMobility?this.mobility[i]+(target-this.mobility[i])*mobilityBlend:1;
  const mobility=this.mobility[i],cap=5*mobility;
  vx[i]=(vx[i]+ax*response*mobility)*damp;vy[i]=(vy[i]+ay*response*mobility)*damp;
  if(wiggle>0){
   // Lateral oscillation: each particle has its own amplitude and frequency (mostly subtle, a few strong).
   const phase=this.wigglePhase[i]+=this.wiggleFreq[i]*dt,swing=Math.sin(phase)*this.wiggleAmp[i]*wiggle*dt*mobility*(bondCount[i]?.3:1);
   const sp=Math.sqrt(vx[i]*vx[i]+vy[i]*vy[i]);
   if(sp>.05){const ux=vx[i]/sp,uy=vy[i]/sp;vx[i]-=uy*swing;vy[i]+=ux*swing;}else{vx[i]+=Math.cos(phase*.37+i)*swing;vy[i]+=Math.sin(phase*.37+i)*swing;}
  }
  const speed2=vx[i]*vx[i]+vy[i]*vy[i];
  if(speed2>cap*cap){const scale=cap/Math.sqrt(speed2);vx[i]*=scale;vy[i]*=scale;}
 }
 if(bonding||this.bonds.length)this.updateBonds(dt);
 for(let i=0;i<n;i++){
  x[i]=(x[i]+vx[i]*dt+w)%w;y[i]=(y[i]+vy[i]*dt+h)%h;
  if(x[i]>=w)x[i]=0;if(y[i]>=h)y[i]=0;
  if(this.ecology)energy[i]=energy[i]>1?Math.max(1,energy[i]-.004*dt):Math.min(1,energy[i]+.0005*dt);
 }
 // Life cycle: aging runs faster for well-fed particles; shape morphs, size follows the stage.
 const stageArr=this.stage,timer=this.stageTimer,fxOut=this.fx,shape=this.shape,morph=this.morph,size=this.size,sizeMax=this.sizeMax,age=this.age,life=this.lifespan,ease=1-Math.pow(.94,dt);
 let rebirths=0;
 for(let i=0;i<n;i++){
  age[i]+=dt*(.5+.5*Math.min(2,energy[i]));
  if(age[i]>=life[i]){if(bondCount[i])this.breakAll=true;age[i]=0;life[i]=lifespanSteps(this.rng());sizeMax[i]=sizeClass(this.rng());this.minor[i]=minorDraw(this.rng);rebirths++;}
  const st=stageFor(age[i]/life[i]);shape[i]=st.shape;morph[i]+=(st.shape-morph[i])*ease;size[i]=sizeNow(sizeMax[i],st.growth);
  if(st.stage!==stageArr[i]){stageArr[i]=st.stage;timer[i]=0;}else if(timer[i]<TRANSITION_STEPS)timer[i]+=dt;fxOut[i]=fxCode(st.stage,timer[i]);
 }
 this.rebirths=(this.rebirths||0)+rebirths;
 if(this.breakAll){this.breakAll=false;this.bonds=this.bonds.filter(b=>{const keep=age[b[0]]>1&&age[b[1]]>1;if(!keep)this.dropBond(b,false);return keep;});}
 this.consumed+=transfers;this.gridReady=true;
 }
}
