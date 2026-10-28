// Measure actual rendered frames, not display refresh callbacks or an idle start screen.
export const QUALITY_LEVELS=[
 {name:'High',population:1,scale:1,bloomLightls:5,post:true,texture:'full',trails:1,backdrop:true},
 {name:'Balanced',population:1,scale:.9,bloomLightls:4,post:true,texture:'full',trails:1,backdrop:true},
 {name:'Light',population:0.85,scale:.75,bloomLightls:3,post:true,texture:'static',trails:.6,backdrop:true},
 {name:'Economy',population:0.65,scale:.6,bloomLightls:3,post:true,texture:'static',trails:.3,backdrop:false},
 {name:'Minimal',population:0.5,scale:.45,bloomLightls:2,post:true,texture:'off',trails:0,backdrop:false},
 {name:'Essential',population:0.35,scale:.35,bloomLightls:2,post:false,texture:'off',trails:0,backdrop:false},
 {name:'Maximum performance',population:0.22,scale:.25,bloomLightls:2,post:false,texture:'off',trails:0,backdrop:false}
];
const p95=a=>{const v=[...a].sort((x,y)=>x-y);return v[Math.max(0,Math.ceil(v.length*.95)-1)]||0;};
export class PerformanceGovernor{
 constructor(){this.deviceCapacity=Infinity;this.desiredPopulation=300;this.populationCeiling=100;this.populationCapacity=300;this.populationStable=0;this.populationChanged=-Infinity;this.enabled=true;this.level=0;this.fps=0;this.frameMs=0;this.stepMs=0;this.drawMs=0;this.calibrated=false;this.calibrationWindows=0;this.lastChange=-Infinity;this.restart();}
 beginPopulation(requested){this.desiredPopulation=Math.max(40,Math.min(12000,Math.round(requested)));this.populationCapacity=Math.min(this.desiredPopulation,this.deviceCapacity);this.populationCeiling=this.sessionLocked?Math.min(this.populationCapacity,this.desiredPopulation*this.quality.population):Math.min(this.populationCapacity,120);this.populationStable=0;this.restart();}
 get populationScale(){return this.enabled?Math.min(this.quality.population,this.populationCeiling/this.desiredPopulation):1;}
 applyPreflight(result){this.deviceCapacity=result.capacity;this.populationCapacity=Math.min(this.desiredPopulation,this.deviceCapacity);this.populationCeiling=Math.min(this.populationCeiling,this.populationCapacity);this.level=result.level;this.restart();}
 lockSession(){this.sessionLocked=true;this.populationCeiling=Math.min(this.populationCapacity,this.desiredPopulation*this.quality.population);this.calibrated=true;}
 get startingPopulation(){return this.sessionLocked?Math.max(40,Math.floor(this.desiredPopulation*this.populationScale)):Math.min(120,this.desiredPopulation);}
 get quality(){return QUALITY_LEVELS[this.enabled?this.level:0];}
 restart(){this.previous=null;this.longStalls=0;this.warmup=1500;this.elapsed=0;this.intervals=[];this.draws=[];this.steps=[];this.slow=0;this.stable=0;this.populationStable=0;this.calibrated=false;this.calibrationWindows=0;}
 setEnabled(value){this.enabled=!!value;this.level=0;this.restart();}
 sample(now,{active=true,drawMs=0,stepMs=0,populationTotal=this.populationCeiling}={}){
  if(this.sessionLocked)return false;
  if(!active){this.previous=null;this.longStalls=0;this.elapsed=0;this.intervals=[];this.draws=[];this.steps=[];this.slow=this.stable=this.populationStable=0;return false;}
  if(this.previous===null){this.previous=now;return false;}
  let dt=now-this.previous;this.previous=now;
  // Ignore one suspension-like stall; repeated visible stalls mean genuine overload.
  if(dt>2000){this.longStalls++;if(this.longStalls>=2)dt=1000;}else this.longStalls=0;
  if(dt<=0||dt>2000){this.elapsed=0;this.intervals=[];this.draws=[];this.steps=[];this.slow=this.stable=this.populationStable=0;return false;}
  if(this.warmup>0){this.warmup-=dt;return false;}
  this.elapsed+=dt;this.intervals.push(dt);this.draws.push(drawMs);this.steps.push(stepMs);
  if(this.elapsed<1000)return false;
  this.fps=this.intervals.length*1000/this.elapsed;this.frameMs=p95(this.intervals);this.drawMs=p95(this.draws);this.stepMs=p95(this.steps);
  const seconds=this.elapsed/1000;this.elapsed=0;this.intervals=[];this.draws=[];this.steps=[];
  this.calibrationWindows++;if(this.calibrationWindows>=3)this.calibrated=true;
  const slow=this.fps<57.5||this.frameMs>24||this.drawMs>12||this.stepMs>1000/60;
  this.slow=slow?this.slow+1:0;this.stable=!slow&&this.fps>=59&&this.drawMs<7&&this.stepMs<12?this.stable+seconds:0;
  this.populationStable=this.stable>0?this.populationStable+seconds:0;
  if(!this.enabled||now-this.lastChange<2500)return false;
  if(this.slow>=(this.calibrated?2:1)&&this.level<QUALITY_LEVELS.length-1){
   this.level=Math.min(QUALITY_LEVELS.length-1,this.level+(this.fps<42?2:1));this.lastChange=now;this.populationCeiling=Math.min(this.populationCeiling,Math.max(100,this.desiredPopulation*this.quality.population));this.slow=this.stable=this.populationStable=0;return true;
  }
  if(this.stable>=25&&now-this.lastChange>=30000&&this.level>0){this.level--;this.lastChange=now;this.stable=0;return true;}
  const budget=Math.max(Math.min(100,this.desiredPopulation),this.desiredPopulation*this.populationScale);
  if(this.calibrated&&this.populationStable>=5&&now-this.populationChanged>=8000&&populationTotal>=budget*.9&&this.populationCeiling<Math.min(this.populationCapacity,this.desiredPopulation*this.quality.population)){
   this.populationCeiling=Math.min(this.populationCapacity,this.desiredPopulation*this.quality.population,this.populationCeiling+Math.max(20,Math.min(80,this.desiredPopulation*.05)));this.populationChanged=now;this.populationStable=0;return true;
  }
  return false;
 }
 get limited(){return this.calibrated&&this.level===QUALITY_LEVELS.length-1&&this.fps<57.5;}
 get physicsLimited(){return this.calibrated&&this.stepMs>1000/60;}
 get summary(){if(!this.enabled)return 'Automatic adjustment off';if(this.sessionLocked)return `Fixed quality · ${this.quality.name} · initial benchmark complete`;if(!this.calibrated)return 'Calibrating simulation…';return `${Math.round(this.fps)} fps · ${this.quality.name}${this.limited?' · device limit':this.physicsLimited?' · simulation at capacity':''}`;}
}
