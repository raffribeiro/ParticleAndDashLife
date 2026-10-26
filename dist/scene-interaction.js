import {wrappedDelta} from './simulation.js?v=1.38.0';
import {shiftFish,shiftWalker} from './body-transform.js?v=1.38.0';
// Keep drag state in the simulation: the renderer never owns particle identities.
export class SceneInteraction{
 constructor(){this.cancel();}
 cancel(){this.target=null;this.active=false;}
 pick(sim,walkers,fish,x,y){
  this.cancel();let best=Infinity,target=null;
  const distance=(px,py)=>Math.hypot(wrappedDelta(px-x,sim.width),wrappedDelta(py-y,sim.height));
  for(const w of walkers.list)for(const i of w.members){if(i>=sim.count)continue;const d=distance(sim.x[i],sim.y[i]);if(d<22&&d<best){best=d;target={kind:'walker',object:w};}}
  for(const c of fish.list){if(c.dead)continue;for(let i=0;i<c.x.length;i++){const d=distance(c.x[i],c.y[i]);if(d<12&&d<best){const w=c.attachment&&walkers.list.find(w=>w.id===c.attachment.walker);if(c.attachment&&!w)continue;best=d;target=w?{kind:'walker',object:w}:{kind:'fish',object:c};}}}
  if(!target)return false;
  const [cx,cy]=this.center(target,sim,walkers);this.target=target;this.offset=[wrappedDelta(cx-x,sim.width),wrappedDelta(cy-y,sim.height)];this.point=[x,y];return true;
 }
 center(target,sim,walkers){return target.kind==='walker'?walkers.centroid(sim,target.object.members):[target.object.x[0],target.object.y[0]];}
 move(x,y){if(!this.target||!Number.isFinite(x)||!Number.isFinite(y))return;this.active=true;this.point=[x,y];}
 apply(sim,walkers,fish){
  if(!this.active||!this.target)return;
  walkers.remap(sim);
  const {kind,object:o}=this.target;
  if(kind==='walker'?!walkers.list.includes(o)||!o.members.length:!fish.list.includes(o)||o.dead){this.cancel();return;}
  const [cx,cy]=this.center(this.target,sim,walkers),dx=wrappedDelta(this.point[0]+this.offset[0]-cx,sim.width),dy=wrappedDelta(this.point[1]+this.offset[1]-cy,sim.height);
  if(kind==='fish'){shiftFish(o,dx,dy);return;}
  shiftWalker(sim,o,fish.list,dx,dy);
 }
}
// CSS-pixel threshold is independent of world size and display resolution.
export class SceneGesture{
 down(id,x,y){if(this.pointer)return false;this.pointer={id,x,y,dragging:false};return true;}
 move(id,x,y){const p=this.pointer;if(!p||p.id!==id)return false;if(Math.hypot(x-p.x,y-p.y)>6)p.dragging=true;return p.dragging;}
 up(id,x,y){const p=this.pointer;if(!p||p.id!==id)return null;this.move(id,x,y);this.pointer=null;return p.dragging?'drop':'click';}
 cancel(){this.pointer=null;}
}
