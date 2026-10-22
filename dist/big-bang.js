export class BigBang{
 constructor(sim){this.tick=0;this.hold=18;this.duration=90;this.launched=false;
  const radius=Math.max(1,Math.min(16,Math.min(sim.width,sim.height)*.025));
  for(let i=0;i<sim.count;i++){const angle=i*2.3999632297,r=radius*Math.sqrt(sim.rng());sim.x[i]=sim.width*.5+Math.cos(angle)*r;sim.y[i]=sim.height*.5+Math.sin(angle)*r;sim.vx[i]=sim.vy[i]=0;}
  sim.gridReady=false;
 }
 step(sim,dt=1){
  if(this.tick>=this.duration)return false;this.tick+=dt;
  if(this.tick<=this.hold)return true;
  if(!this.launched){this.launched=true;const speed=Math.min(sim.width,sim.height)*.006;
   for(let i=0;i<sim.count;i++){const a=i*2.3999632297+(sim.rng()-.5)*.15,v=speed*(.5+sim.rng()*.5);sim.vx[i]=Math.cos(a)*v;sim.vy[i]=Math.sin(a)*v;}
  }
  for(let i=0;i<sim.count;i++){sim.x[i]=((sim.x[i]+sim.vx[i]*dt)%sim.width+sim.width)%sim.width;sim.y[i]=((sim.y[i]+sim.vy[i]*dt)%sim.height+sim.height)%sim.height;sim.vx[i]*=Math.exp(-.006*dt);sim.vy[i]*=Math.exp(-.006*dt);}
  sim.gridReady=false;return true;
 }
}
