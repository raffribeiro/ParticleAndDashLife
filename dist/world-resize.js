import {wrappedDelta} from './simulation.js?v=1.29.1';
import {shiftFish,shiftWalker} from './body-transform.js?v=1.29.1';
const wrap=(v,size)=>(v%size+size)%size;
function rebaseFish(c,x,y,W,H){
 const px=v=>x+wrappedDelta(v-x,W),py=v=>y+wrappedDelta(v-y,H),pair=p=>{if(p){p[0]=px(p[0]);p[1]=py(p[1]);}};
 for(let i=0;i<c.x.length;i++){c.x[i]=px(c.x[i]);c.y[i]=py(c.y[i]);}
 if(c.softStrand)for(let i=0;i<c.softStrand.x.length;i++){c.softStrand.x[i]=px(c.softStrand.x[i]);c.softStrand.y[i]=py(c.softStrand.y[i]);}
 for(const p of c.legJoints||[])pair(p);pair(c.attachment?.lastRoot);
}
function rebaseWalker(sim,w,fish,x,y){
 const W=sim.width,H=sim.height,px=v=>x+wrappedDelta(v-x,W),py=v=>y+wrappedDelta(v-y,H),pair=p=>{if(p){p[0]=px(p[0]);p[1]=py(p[1]);}};
 for(const i of w.members){sim.x[i]=px(sim.x[i]);sim.y[i]=py(sim.y[i]);}
 if(w.body){const b=w.body;b.x=px(b.x);b.y=py(b.y);if(b.lastX!==undefined){b.lastX=px(b.lastX);b.lastY=py(b.lastY);}}
 if(w.anatomy){w.anatomy.cx=px(w.anatomy.cx);w.anatomy.cy=py(w.anatomy.cy);}
 for(const l of w.legs||[]){l.fx=px(l.fx);l.fy=py(l.fy);pair(l.from);pair(l.to);pair(l.knee);}
 for(const p of w.tail||[])pair(p);
 for(const c of fish)if(c.attachment?.walker===w.id)rebaseFish(c,x,y,W,H);
}
// Move each organism as one unit; resizing the viewport must not stretch its skeleton.
export function resizeWorld(sim,creatures,walkers,width,height){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1||width===sim.width&&height===sim.height)return;
 const oldW=sim.width,oldH=sim.height,members=new Set(),moved=new Set();walkers.remap(sim);
 for(const w of walkers.list){
  if(!w.members.length)continue;
  const [x,y]=walkers.centroid(sim,w.members),dx=wrap(x,oldW)/oldW*width-x,dy=wrap(y,oldH)/oldH*height-y;
  rebaseWalker(sim,w,creatures.list,x,y);
  shiftWalker(sim,w,creatures.list,dx,dy,{width,height,stop:false});
  for(const i of w.members)members.add(i);
  for(const c of creatures.list)if(c.attachment?.walker===w.id)moved.add(c);
  if(w.body){w.body.width=width;w.body.height=height;}
 }
 for(const c of creatures.list)if(!moved.has(c)){const x=c.x[0],y=c.y[0];rebaseFish(c,x,y,oldW,oldH);shiftFish(c,wrap(x,oldW)/oldW*width-x,wrap(y,oldH)/oldH*height-y,false);}
 for(let i=0;i<sim.count;i++)if(!members.has(i)){sim.x[i]=wrap(sim.x[i]/oldW*width,width);sim.y[i]=wrap(sim.y[i]/oldH*height,height);}
 sim.width=width;sim.height=height;sim.gridReady=false;
}
