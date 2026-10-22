export class DoubleTap{
 constructor(){this.active=new Map();this.last=null;this.blocked=false;}
 down(id,x,y,time){if(this.active.size){this.blocked=true;this.last=null;}this.active.set(id,{x,y,time,moved:false});}
 move(id,x,y){const p=this.active.get(id);if(p&&Math.hypot(x-p.x,y-p.y)>14)p.moved=true;}
 cancel(id){this.active.delete(id);this.last=null;if(!this.active.size)this.blocked=false;}
 up(id,x,y,time){const p=this.active.get(id);this.move(id,x,y);this.active.delete(id);if(!p)return false;
 const valid=!this.blocked&&!p.moved&&time-p.time<=280;
 if(!this.active.size)this.blocked=false;
 if(!valid){this.last=null;return false;}
 const prev=this.last;this.last={x,y,time};
 if(prev&&time-prev.time<=340&&Math.hypot(x-prev.x,y-prev.y)<=32){this.last=null;return true;}return false;
 }
}
