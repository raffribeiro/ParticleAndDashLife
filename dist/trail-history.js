import {wrappedDelta} from './simulation.js?v=1.25.3';
export class TrailHistory {
 constructor(){this.size=24;this.interval=80;this.version=0;this.valid=0;}
 offset(id,age){const slot=(this.newest-Math.min(age,this.valid-1)+this.size)%this.size;return (id*this.size+slot)*4;}
 point(id,age){const o=this.offset(id,age);return [this.data[o],this.data[o+1]];}
 resize(s){
  const old=this.data,keep=Math.min(this.count,s.count);
  if(this.count!==s.count){
   this.count=s.count;this.columns=Math.min(128,s.count);this.textureWidth=this.columns*this.size;this.textureHeight=Math.ceil(s.count/this.columns);
   this.data=new Float32Array(this.textureWidth*this.textureHeight*4);this.data.set(old.subarray(0,keep*this.size*4));
   for(let i=keep;i<s.count;i++)this.fill(i,s);
  }
  if(s.changed)for(const i of s.changed)if(i<s.count)this.fill(i,s);
  this.version++;
 }
 fill(i,s){for(let j=0;j<this.size;j++){const o=(i*this.size+j)*4;this.data[o]=s.x[i];this.data[o+1]=s.y[i];}}
 update(s,now){
  const reset=!this.data||this.worldWidth!==s.width||this.worldHeight!==s.height||this.revision!==(s.historyRevision??0);
  // Count changes (fish eat, excrete, die, condense): keep existing trails, restart only changed rows.
  if(!reset&&(this.count!==s.count||s.changed?.length))this.resize(s);
  if(reset){
   this.count=s.count;this.worldWidth=s.width;this.worldHeight=s.height;this.revision=s.historyRevision??0;
   this.columns=Math.min(128,s.count);this.textureWidth=this.columns*this.size;this.textureHeight=Math.ceil(s.count/this.columns);
   this.data=new Float32Array(this.textureWidth*this.textureHeight*4);this.newest=0;this.valid=1;
   for(let i=0;i<s.count;i++)for(let j=0;j<this.size;j++){const o=(i*this.size+j)*4;this.data[o]=s.x[i];this.data[o+1]=s.y[i];}
  }else{
   if(now-this.lastSample<this.interval)return false;
   const previous=this.newest;this.newest=(this.newest+1)%this.size;
   for(let i=0;i<s.count;i++){
    const from=(i*this.size+previous)*4,to=(i*this.size+this.newest)*4;
    const px=this.data[from],py=this.data[from+1];
    this.data[to]=px+wrappedDelta(s.x[i]-((px%s.width+s.width)%s.width),s.width);
    this.data[to+1]=py+wrappedDelta(s.y[i]-((py%s.height+s.height)%s.height),s.height);
   }
   this.valid=Math.min(this.size,this.valid+1);
  }
  this.lastSample=now;this.version++;return true;
 }
}
