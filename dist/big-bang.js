export class BigBang{
 constructor(sim){this.tick=0;this.hold=18;this.duration=60;this.launched=false;
  const radius=Math.max(1,Math.min(22,Math.min(sim.width,sim.height)*.035));
  this.originX=new Float32Array(sim.count);this.originY=new Float32Array(sim.count);
  for(let i=0;i<sim.count;i++){const angle=i*2.3999632297,r=radius*Math.sqrt(sim.rng());this.originX[i]=Math.cos(angle)*r/sim.width;this.originY[i]=Math.sin(angle)*r/sim.height;sim.x[i]=sim.width*.5+this.originX[i]*sim.width;sim.y[i]=sim.height*.5+this.originY[i]*sim.height;sim.vx[i]=sim.vy[i]=0;}
  sim.gridReady=false;
 }
 get particleScale(){
  if(this.tick>=this.duration)return 1;
  if(this.tick<=this.hold){const t=this.tick/this.hold;return .78+.16*Math.sin(Math.PI*t)+.14*t*t*Math.sin(12*t+22*t*t);}
  const age=this.tick-this.hold-1;return 1+.7*Math.exp(-age/6)*Math.cos(age*.48);
 }
 get colorMix(){const t=Math.max(0,Math.min(1,(this.tick-this.hold)/(this.duration-this.hold)));return t*t*(3-2*t);}
 get emission(){if(this.tick>=this.duration)return 0;if(this.tick<=this.hold)return .85*Math.pow(this.tick/this.hold,.65);return Math.exp(-(this.tick-this.hold-1)/8);}
 step(sim,dt=1){
  if(this.tick>=this.duration)return false;this.tick+=dt;
  if(this.tick<=this.hold){
   const t=this.tick/this.hold,e=t*t*(3-2*t),squeeze=1-e*.91;
   const settle=Math.min(1,(1-t)*this.hold*2),tension=t*t*settle,phase=12*t+22*t*t;
   const amplitude=Math.min(8,Math.min(sim.width,sim.height)*.012)*tension,squash=1+.28*Math.sin(phase)*tension;
   for(let i=0;i<sim.count;i++){
    const wiggleX=Math.sin(phase+i*1.7)*amplitude*.4+Math.sin(phase*1.3)*amplitude*.6;
    const wiggleY=Math.cos(phase*1.17+i*2.3)*amplitude*.4+Math.cos(phase*1.1)*amplitude*.6;
    sim.x[i]=sim.width*.5+this.originX[i]*sim.width*squeeze*squash+wiggleX;
    sim.y[i]=sim.height*.5+this.originY[i]*sim.height*squeeze/squash+wiggleY;
    sim.vx[i]=sim.vy[i]=0;
   }
   sim.gridReady=false;return true;
  }
  if(!this.launched){this.launched=true;const speed=Math.min(sim.width,sim.height)*.018;
   // Non-linear blast: each particle gets its own launch speed across an 80% range (slowest = 20% of the fastest,
   // skewed toward the slow end so a few shards fly far) and its own drag, so the cloud never expands as one shell.
   this.drag=new Float32Array(sim.count);
   for(let i=0;i<sim.count;i++){const a=i*2.3999632297+(sim.rng()-.6)*.6,r=Math.pow(sim.rng(),1.6),v=speed*2.1*(.2+.8*r);sim.vx[i]=Math.cos(a)*v;sim.vy[i]=Math.sin(a)*v;this.drag[i]=.035+sim.rng()*.06;}
  }
  for(let i=0;i<sim.count;i++){sim.x[i]=((sim.x[i]+sim.vx[i]*dt)%sim.width+sim.width)%sim.width;sim.y[i]=((sim.y[i]+sim.vy[i]*dt)%sim.height+sim.height)%sim.height;const k=Math.exp(-(this.drag?.[i]??.055)*dt);sim.vx[i]*=k;sim.vy[i]*=k;}
  sim.gridReady=false;return true;
 }
}
