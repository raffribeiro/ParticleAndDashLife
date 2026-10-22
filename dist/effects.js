// Decorative events never enter the simulation or alter its population.
export class EventEffects{
 constructor(){this.items=[];this.last=null;this.revision=undefined;}
 update(events,now,revision=0){
  if(revision!==this.revision){this.items=[];this.last=null;this.revision=revision;}
  this.items=this.items.filter(e=>now-e.born<e.duration);
  if(events&&events!==this.last){this.last=events;for(const e of events){
   if(!Number.isFinite(e.x)||!Number.isFinite(e.y))continue;
   this.items.push({...e,kind:'event',event:e.kind,born:now,duration:e.kind==='death'?320:240});
  }this.items=this.items.slice(-24);}
  return this.items.map(e=>({...e,t:Math.max(0,Math.min(1,(now-e.born)/e.duration))}));
 }
}
