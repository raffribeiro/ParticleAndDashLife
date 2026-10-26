// Measure actual rendered frames, not display refresh callbacks or an idle start screen.
export const QUALITY_LEVELS=[
 {name:'Alta',scale:1,bloomLevels:5,post:true,texture:'full',trails:1,backdrop:true},
 {name:'Equilibrada',scale:.9,bloomLevels:4,post:true,texture:'full',trails:1,backdrop:true},
 {name:'Leve',scale:.75,bloomLevels:3,post:true,texture:'static',trails:.6,backdrop:true},
 {name:'Econômica',scale:.6,bloomLevels:3,post:true,texture:'static',trails:.3,backdrop:false},
 {name:'Mínima',scale:.45,bloomLevels:2,post:true,texture:'off',trails:0,backdrop:false},
 {name:'Essencial',scale:.35,bloomLevels:2,post:false,texture:'off',trails:0,backdrop:false},
 {name:'Máximo desempenho',scale:.25,bloomLevels:2,post:false,texture:'off',trails:0,backdrop:false}
];
const p95=a=>{const v=[...a].sort((x,y)=>x-y);return v[Math.max(0,Math.ceil(v.length*.95)-1)]||0;};
export class PerformanceGovernor{
 constructor(){this.enabled=true;this.level=0;this.fps=0;this.frameMs=0;this.stepMs=0;this.drawMs=0;this.calibrated=false;this.calibrationWindows=0;this.lastChange=-Infinity;this.restart();}
 get quality(){return QUALITY_LEVELS[this.enabled?this.level:0];}
 restart(){this.previous=null;this.longStalls=0;this.warmup=1500;this.elapsed=0;this.intervals=[];this.draws=[];this.steps=[];this.slow=0;this.stable=0;this.calibrated=false;this.calibrationWindows=0;}
 setEnabled(value){this.enabled=!!value;this.level=0;this.restart();}
 sample(now,{active=true,drawMs=0,stepMs=0}={}){
  if(!active){this.previous=null;this.longStalls=0;this.elapsed=0;this.intervals=[];this.draws=[];this.steps=[];this.slow=this.stable=0;return false;}
  if(this.previous===null){this.previous=now;return false;}
  let dt=now-this.previous;this.previous=now;
  // Ignore one suspension-like stall; repeated visible stalls mean genuine overload.
  if(dt>2000){this.longStalls++;if(this.longStalls>=2)dt=1000;}else this.longStalls=0;
  if(dt<=0||dt>2000){this.elapsed=0;this.intervals=[];this.draws=[];this.steps=[];this.slow=this.stable=0;return false;}
  if(this.warmup>0){this.warmup-=dt;return false;}
  this.elapsed+=dt;this.intervals.push(dt);this.draws.push(drawMs);this.steps.push(stepMs);
  if(this.elapsed<1000)return false;
  this.fps=this.intervals.length*1000/this.elapsed;this.frameMs=p95(this.intervals);this.drawMs=p95(this.draws);this.stepMs=p95(this.steps);
  const seconds=this.elapsed/1000;this.elapsed=0;this.intervals=[];this.draws=[];this.steps=[];
  this.calibrationWindows++;if(this.calibrationWindows>=3)this.calibrated=true;
  const slow=this.fps<57.5||this.frameMs>24||this.drawMs>12;
  this.slow=slow?this.slow+1:0;this.stable=!slow&&this.fps>=59&&this.drawMs<7&&this.stepMs<12?this.stable+seconds:0;
  if(!this.enabled||now-this.lastChange<2500)return false;
  if(this.slow>=(this.calibrated?2:1)&&this.level<QUALITY_LEVELS.length-1){
   this.level=Math.min(QUALITY_LEVELS.length-1,this.level+(this.fps<42?2:1));this.lastChange=now;this.slow=this.stable=0;return true;
  }
  if(this.stable>=25&&now-this.lastChange>=30000&&this.level>0){this.level--;this.lastChange=now;this.stable=0;return true;}
  return false;
 }
 get limited(){return this.calibrated&&this.level===QUALITY_LEVELS.length-1&&this.fps<57.5;}
 get physicsLimited(){return this.calibrated&&this.stepMs>1000/60;}
 get summary(){if(!this.enabled)return 'Ajuste automático desligado';if(!this.calibrated)return 'Calibrando durante a simulação…';return `${Math.round(this.fps)} fps · ${this.quality.name}${this.limited?' · limite do aparelho':this.physicsLimited?' · simulação no limite':''}`;}
}
