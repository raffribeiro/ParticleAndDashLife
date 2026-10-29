const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// One fixed-size state per living body: no trail of past targets or timers.
export function updatePursuit(a,{targetId=null,mode='idle',distance=0,tick=0,dt=1,panic=false}={}){
 const s=a.pursuit??={targetId:null,mode:'idle',stamina:.8,pace:1,lastDistance:distance,stalled:0,elapsed:0,panic:false,burst:0};
 const step=clamp(dt,0,2),active=targetId!==null&&['engage','flee','kite'].includes(mode);
 if(s.targetId!==targetId){s.stalled=0;s.elapsed=0;s.lastDistance=distance;}
 s.targetId=active?targetId:null;s.mode=active?mode:'idle';s.panic=active&&panic;
 let desired=1;
 if(active){
  s.elapsed=Math.min(3600,s.elapsed+step);
  const progress=s.lastDistance-distance;s.lastDistance=distance;
  s.stalled=mode==='engage'&&progress<.015*step?Math.min(600,s.stalled+step):Math.max(0,s.stalled-step*2);
  const id=a.id||0,individual=.88+(((id+1)*2654435761)>>>0)%101/100*.24;
  const period=210+(id%5)*23,phase=((tick+id*67)%period)/period;
  const burst=phase<.23&&s.stamina>.18?Math.sin(Math.PI*phase/.23):0;s.burst=burst;
  const skill=mode==='engage'?(a.traits?.hunt??.5):(a.traits?.escape??.5),endurance=.85+skill*.4;
  s.stamina=clamp(s.stamina+(burst>0?-.0045/endurance:(mode==='engage'?.0013:.0009)*endurance)*step,0,1);
  const urgency=mode==='engage'?.5+.12*Math.min(1,s.stalled/300):.36;
  desired=clamp(individual*(.76+.24*s.stamina)*(1+burst*urgency),.6,1.65);
  if(panic)desired=Math.max(desired,1.18);
 }else{s.stamina=clamp(s.stamina+.003*step,0,1);s.stalled=0;s.elapsed=0;s.burst=0;}
 s.pace+=(desired-s.pace)*(1-Math.exp(-.07*step));return s;
}
export function pursuitDirection(a,target,dx,dy,distance,mode,tick){
 let x=dx,y=dy;
 if(mode==='engage'){
  const lead=Math.min(26,distance/2.4)*clamp((distance-70)/80,0,1),limit=distance*.45;
  x+=clamp(target.body?.vx||0,-5,5)*lead;y+=clamp(target.body?.vy||0,-5,5)*lead;
  x=dx+clamp(x-dx,-limit,limit);y=dy+clamp(y-dy,-limit,limit);
 }
 const length=Math.hypot(x,y)||1,ux=x/length,uy=y/length;
 const sway=(mode==='flee'||mode==='kite')?Math.sin(tick*.024+(a.id||0)*1.7)*.22*Math.min(1,distance/120):0;
 const scale=1/Math.sqrt(1+sway*sway);return [(ux-uy*sway)*scale,(uy+ux*sway)*scale];
}
