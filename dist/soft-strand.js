import {wrappedDelta} from './simulation.js?v=1.39.0';
// Water-damped chain: only its root is driven; the tip keeps momentum.
export function stepSoftStrand(c,root,flow,time,W,H,dt=1,join=1){
 const n=c.x.length;if(n<2)return;
 const ox=c.x[0],oy=c.y[0],step=Math.min(2,Math.max(0,dt));
 const state=c.softStrand??={x:Float64Array.from(c.x),y:Float64Array.from(c.y)};
 for(let k=1;k<n;k++){
  const x=c.x[k],y=c.y[k],u=k/(n-1),phase=time*.025-k*.55+(c.id||0)*1.7;
  const vx=wrappedDelta(x-state.x[k],W),vy=wrappedDelta(y-state.y[k],H);
  state.x[k]=x;state.y[k]=y;
  c.x[k]=x+vx*Math.exp(-.16*step)+((flow[0]||0)*.035+Math.sin(phase)*.055*u)*step*step;
  c.y[k]=y+vy*Math.exp(-.16*step)+((flow[1]||0)*.035+Math.cos(phase*.83)*.055*u)*step*step;
 }
 c.x[0]=ox+wrappedDelta(root[0]-ox,W)*join;c.y[0]=oy+wrappedDelta(root[1]-oy,H)*join;
 const spacing=c.spacing||3.4;
 for(let pass=0;pass<6;pass++)for(let k=1;k<n;k++){
  let dx=wrappedDelta(c.x[k]-c.x[k-1],W),dy=wrappedDelta(c.y[k]-c.y[k-1],H),d=Math.hypot(dx,dy);
  if(d<1e-6){dx=-Math.cos(c.heading||0)*spacing;dy=-Math.sin(c.heading||0)*spacing;d=spacing;}
  const f=(d-spacing)/d,share=k===1?0:.5;
  c.x[k-1]+=dx*f*share;c.y[k-1]+=dy*f*share;c.x[k]-=dx*f*(1-share);c.y[k]-=dy*f*(1-share);
 }
 // Keep each segment in the same unwrapped neighbourhood as its parent.
 for(let k=1;k<n;k++){c.x[k]=c.x[k-1]+wrappedDelta(c.x[k]-c.x[k-1],W);c.y[k]=c.y[k-1]+wrappedDelta(c.y[k]-c.y[k-1],H);}
 c.legJoints=null;c.legStretch=1;c.vx=wrappedDelta(c.x[0]-ox,W);c.vy=wrappedDelta(c.y[0]-oy,H);c.heading=Math.atan2(c.y[0]-c.y[1],c.x[0]-c.x[1]);
}
