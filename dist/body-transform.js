const wrap=(v,size)=>(v%size+size)%size;
const shiftPair=(p,dx,dy)=>{if(p){p[0]+=dx;p[1]+=dy;}};
export function shiftFish(c,dx,dy,stop=true){
 for(let i=0;i<c.x.length;i++){c.x[i]+=dx;c.y[i]+=dy;}
 if(c.softStrand)for(let i=0;i<c.softStrand.x.length;i++){c.softStrand.x[i]+=dx;c.softStrand.y[i]+=dy;}
 for(const p of c.legJoints||[])shiftPair(p,dx,dy);
 shiftPair(c.attachment?.lastRoot,dx,dy);if(stop)c.vx=c.vy=0;
}

export function shiftWalker(sim,o,fish,dx,dy,{width=sim.width,height=sim.height,stop=true}={}){
  for(const i of o.members){if(i>=sim.count)continue;sim.x[i]=wrap(sim.x[i]+dx,width);sim.y[i]=wrap(sim.y[i]+dy,height);if(stop)sim.vx[i]=sim.vy[i]=0;if(Math.abs(dx)+Math.abs(dy)>.01)(sim.changedIndices??=new Set()).add(i);}
  if(o.body){o.body.x+=dx;o.body.y+=dy;if(o.body.lastX!==undefined){o.body.lastX+=dx;o.body.lastY+=dy;}if(stop)o.body.vx=o.body.vy=0;}
  if(o.anatomy){o.anatomy.cx+=dx;o.anatomy.cy+=dy;}
  for(const l of o.legs||[]){l.fx+=dx;l.fy+=dy;for(const p of [l.from,l.to,l.knee])shiftPair(p,dx,dy);}
  for(const p of o.tail||[])shiftPair(p,dx,dy);
  for(const c of fish)if(c.attachment?.walker===o.id)shiftFish(c,dx,dy,stop);
  sim.gridReady=false;
}
