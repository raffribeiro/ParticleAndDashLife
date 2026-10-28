import {PRESETS} from './simulation.js?v=1.42.0';
// Aleatório mode cycles through the four behaviors with a 4 s cross-fade.
const KEYS=['symbiosis','currents','predator','colonies'];
export class BehaviorCycle{
 constructor(){this.enabled=true;this.interval=30;this.elapsed=0;this.key='symbiosis';this.fade=null;}
 configure(o){if(!o)return;if(o.enabled!==undefined)this.enabled=!!o.enabled;if(o.interval!==undefined)this.interval=Math.max(10,Math.min(120,+o.interval||30));if(o.kick&&o.kick!==this.lastKick){this.lastKick=o.kick;this.elapsed=this.interval;}}
 manual(key){this.key=KEYS.includes(key)?key:'custom';this.elapsed=0;this.fade=null;}
 advance(sim,dt){
  if(!this.enabled)return;
  if(this.fade){const f=this.fade;f.age=Math.min(4,f.age+dt);const t=f.age/4,e=t*t*(3-2*t);sim.matrix=f.from.map((r,a)=>r.map((v,b)=>v+(PRESETS[this.key].matrix[a][b]-v)*e));if(f.age>=4){sim.matrix=PRESETS[this.key].matrix.map(r=>[...r]);this.fade=null;}return;}
  this.elapsed+=dt;if(this.elapsed+1e-8<this.interval)return;
  this.elapsed=0;this.key=KEYS[(KEYS.indexOf(this.key)+1)%KEYS.length];this.fade={age:0,from:sim.matrix.map(r=>[...r])};
 }
 snapshot(sim){return {key:this.key,changing:!!this.fade,next:Math.max(0,this.interval-this.elapsed),matrix:sim.matrix};}
}
