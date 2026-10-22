import {canvasSize} from './canvas-size.js?v=1.25.2';
import {FarParticles} from './far-particles.js?v=1.25.2';
import {splitDrawLayers} from './draw-order.js?v=1.25.2';
import {EventEffects} from './effects.js?v=1.25.2';
import {TrailHistory} from './trail-history.js?v=1.25.2';
import {CurvedTrails} from './curved-trails.js?v=1.25.2';
import {COLORS} from './simulation.js?v=1.25.2';
import {Bloom} from './bloom.js?v=1.25.2';
import {Backdrop} from './backdrop.js?v=1.25.2';
import {CreatureMesh} from './creature-mesh.js?v=1.25.2';
import {DEFAULT_PALETTE} from './color.js?v=1.25.2';
const STRIP=[-.5,-.5,.5,-.5,-.5,.5,.5,.5];
const TRIANGLES=[-.5,-.5,.5,-.5,-.5,.5,-.5,.5,.5,-.5,.5,.5];
export class Renderer {
 constructor(canvas){
  this.canvas=canvas;
  const gl=this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:false});
  if(!gl)throw Error('Seu navegador não disponibilizou WebGL. Ative a aceleração gráfica e recarregue.');
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const p=this.program=gl.createProgram();
  gl.attachShader(p,shader(gl.VERTEX_SHADER,`
   attribute vec2 corner;attribute vec2 pos;attribute vec2 velocity;attribute vec3 color;attribute float energy;
   uniform float prediction;uniform vec2 viewport;uniform vec2 world;uniform float layer;
   varying vec3 tint;varying float e;varying vec2 local;varying float headSize;varying float stg;varying float prog;varying float seed;varying float pulse;varying float minor;
   void main(){float q=floor(energy/4.+.0001);float en=energy-q*4.;pulse=fract(en*2.+.001)/.98;en=floor(en*2.+.001)/2.;float k=floor(q/201.+.0001);float fx=q-k*201.;minor=k;stg=floor(fx/50.+.0001);prog=(fx-stg*50.)/49.;seed=fract(sin(dot(pos,vec2(12.9898,78.233)))*43758.5453);// Uniform size for every circle (stage only animates: pop, ripple, breath, hollowing).
   headSize=24.*1.6;local=corner*headSize*.3;vec2 head=mod(pos+velocity*prediction,world)/world*vec2(2.,-2.)+vec2(-1.,1.);gl_Position=vec4(head+local/viewport*vec2(2.,-2.),0.,1.);
   // Two passes: hit/pulsing particles (pulse > 0.04) are drawn in the top pass, above bodies and limbs.
   if((pulse>.04?1.:0.)!=layer)gl_Position=vec4(2.,2.,2.,1.);tint=color;e=en;}`));
  gl.attachShader(p,shader(gl.FRAGMENT_SHADER,`
   precision mediump float;varying vec3 tint;varying float e;varying vec2 local;varying float headSize;varying float stg;varying float prog;varying float seed;varying float pulse;varying float minor;uniform float glow;uniform float emission;uniform float time;
   void main(){
    // Coordinates in the original particle units (quad is 1.6× larger to fit ripples).
    vec2 p=local*2./headSize*1.6;float d=length(p);float t=prog;float aa=2.4/max(headSize/1.6,8.);
    // Scale-only animation: birth grows from zero with a small overshoot (ease-out-back); later stage
    // changes give a soft pop; elders shrink. No rings, no ripples.
    float c1=1.7,u=t-1.;float grow=stg<.5?max(0.,1.+(c1+1.)*u*u*u+c1*u*u):1.;
    float pop=stg<.5?1.:1.+.18*exp(-5.*t)*sin(t*14.);float breath=(stg>1.5&&stg<2.5)?1.+.06*sin(time*1.6+seed*6.2832):1.;
    float R=.36*grow*pop*breath*(stg>2.5?1.-.35*t:1.)*(1.+pulse)*(minor>.5?.1+.4*(minor-1.)/39.:1.);float core=1.-smoothstep(R-aa,R+aa,d);
    float ring=0.;float flash=0.;
    float halo=exp(-d*d*7.)*(1.-smoothstep(.65,1.,d))*glow*.12*(1.+emission*5.);
    float opacity=clamp((core*.9*(stg>2.5?.75:1.)+halo+ring*.8)*(0.85+e*.15),0.,.97);
    float light=clamp(.5-(p.x+p.y)*.8,0.,1.);
    vec3 graded=tint*mix(.92,1.06,light)*(1.+.25*pulse);
    graded*=1.+emission*.6;graded/=max(1.,max(graded.r,max(graded.g,graded.b))/.98);
    gl_FragColor=vec4(clamp(graded,0.,.98),opacity);}`));
  gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));gl.useProgram(p);
  const extension=gl.getExtension('ANGLE_instanced_arrays');
  this.instancing=extension&&typeof extension.drawArraysInstancedANGLE==='function'?extension:null;
  this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  const attributes=this.attributes=this.instancing?[['pos',2,0],['color',3,8],['energy',1,20],['velocity',2,24]]:[['corner',2,0],['pos',2,8],['color',3,16],['energy',1,28],['velocity',2,32]];
  for(const [name,size,offset] of attributes){const a=gl.getAttribLocation(p,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,this.instancing?32:40,offset);if(this.instancing)this.instancing.vertexAttribDivisorANGLE(a,1);}
  if(this.instancing){const quad=this.quadBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(STRIP),gl.STATIC_DRAW);const a=gl.getAttribLocation(p,'corner');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);this.instancing.vertexAttribDivisorANGLE(a,0);}
  this.palette=COLORS.map(c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255));
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  this.glow=.65;this.trail=.65;this.scale=1;this.showBonds=false;this.bloom=new Bloom(gl,this.instancing);this.backdrop=new Backdrop(gl,this.instancing);this.farParticles=new FarParticles(gl,this.instancing);this.creatures=new CreatureMesh(gl,this.instancing);this.underMesh=new CreatureMesh(gl,this.instancing);this.eventMesh=new CreatureMesh(gl,this.instancing);this.blobMesh=new CreatureMesh(gl,this.instancing);this.effects=new EventEffects();this.setPalette(DEFAULT_PALETTE);this.history=new TrailHistory();this.curves=new CurvedTrails(gl,this.instancing,this.palette);
  this.uniforms=Object.fromEntries(['world','glow','emission','prediction','viewport','time','layer'].map(name=>[name,gl.getUniformLocation(p,name)]));
 }
 // Palette arrays are mutated in place so CurvedTrails keeps its reference.
 setPalette(p){this.paletteInfo=p;p.rgb.forEach((c,i)=>{if(this.palette[i])this.palette[i].splice(0,3,...c);});this.background=p.background;if(p.backdrop)this.backdrop.colors=p.backdrop;this.creatures.palette=p;this.underMesh.palette=p;this.eventMesh.palette=p;if(this.blobMesh)this.blobMesh.palette=p;this.lastX=null;}
 drawParticles(s,predict,layer){const gl=this.gl;
  gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  for(const [name,size,offset] of this.attributes){const a=gl.getAttribLocation(this.program,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,size,gl.FLOAT,false,this.instancing?32:40,offset);if(this.instancing)this.instancing.vertexAttribDivisorANGLE(a,1);}
  if(this.instancing){gl.bindBuffer(gl.ARRAY_BUFFER,this.quadBuffer);const a=gl.getAttribLocation(this.program,'corner');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);this.instancing.vertexAttribDivisorANGLE(a,0);}
  gl.uniform2f(this.uniforms.world,s.width,s.height);gl.uniform1f(this.uniforms.glow,this.glow*2);gl.uniform1f(this.uniforms.emission,s.openingGlow||0);
  gl.uniform1f(this.uniforms.prediction,predict);gl.uniform1f(this.uniforms.time,performance.now()/1000);gl.uniform2f(this.uniforms.viewport,this.cssWidth||s.width,this.cssHeight||s.height);gl.uniform1f(this.uniforms.layer,layer);
  if(this.instancing)this.instancing.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP,0,4,s.count);else gl.drawArrays(gl.TRIANGLES,0,s.count*6);
 }
 draw(s,predict=0){
  const gl=this.gl,css=canvasSize(this.canvas,s),dpr=Math.min(devicePixelRatio,1.25)*this.scale,w=Math.max(1,Math.round(css.width*dpr)),h=Math.max(1,Math.round(css.height*dpr));
  this.cssWidth=css.width;this.cssHeight=css.height;
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  const baseBloom=this.bloom.intensity;this.bloom.intensity=baseBloom*(1+3*(s.openingGlow||0));
  const bloom=this.bloom.begin(w,h);if(!bloom&&typeof gl.bindFramebuffer==='function'){gl.bindFramebuffer(gl.FRAMEBUFFER,null);}gl.viewport(0,0,w,h);
  if(this.lastX!==s.x||this.lastWidth!==s.width||this.lastHeight!==s.height){
   const stride=this.instancing?8:60;
   gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
   // Capacity grows with headroom: fish birth/death changes the count often.
   if(!this.data||this.data.length<s.count*stride){this.data=new Float32Array(Math.ceil(s.count*1.25)*stride);gl.bufferData(gl.ARRAY_BUFFER,this.data.byteLength,gl.DYNAMIC_DRAW);}
   for(let i=0;i<s.count;i++){
    const c=this.palette[s.type[i]],copies=this.instancing?1:6;
    for(let vertex=0;vertex<copies;vertex++){
     let offset=this.instancing?i*8:i*60+vertex*10;
     if(!this.instancing){this.data[offset++]=TRIANGLES[vertex*2];this.data[offset++]=TRIANGLES[vertex*2+1];}
     this.data[offset]=s.x[i];this.data[offset+1]=s.y[i];this.data[offset+2]=c[0];this.data[offset+3]=c[1];this.data[offset+4]=c[2];// Packed: (size class × 201 + stage×50 + transition progress) × 4 + energy.
     this.data[offset+5]=((s.minor?.[i]??0)*201+(s.fx?.[i]??149))*4+Math.floor(Math.min(3.99,s.energy[i])*2)/2+Math.min(1,s.pulse?.[i]||0)*.49;this.data[offset+6]=s.vx[i];this.data[offset+7]=s.vy[i];
    }
   }
   gl.bufferSubData(gl.ARRAY_BUFFER,0,this.data.subarray(0,s.count*stride));this.history.update(s,performance.now());s.changed=null;this.lastX=s.x;this.lastWidth=s.width;this.lastHeight=s.height;
  }
  gl.clearColor(...this.background,1);gl.clear(gl.COLOR_BUFFER_BIT);this.backdrop.draw(w,h,performance.now()/1000);
  this.curves.draw(s,this.history,predict,this.trail,this.buffer);
  if(this.layerSource!==s.creatures){this.layers=splitDrawLayers(s.creatures||[]);this.layerSource=s.creatures;}
  this.underMesh.showBonds=this.showBonds;
  if(this.layers?.under.length||s.walkers?.length||(this.showBonds&&s.bonds?.length))this.underMesh.draw(this.layers?.under||[],[s.width,s.height],this.glow,s);
  this.drawParticles(s,predict,0);
  // Bonds act in the physics only; their lines are not drawn (set showBonds to draw them).
  this.creatures.showBonds=this.showBonds;
  if(this.layers?.over.length)this.creatures.draw(this.layers.over,[s.width,s.height],this.glow);
  const events=this.effects.update(s.events,performance.now(),s.historyRevision);s.events=null;
  // Combat layer (HP arcs, shields, star auras, orbs, power-ups, impact effects) on top of everything.
  const cb=s.combat;let items=[];
  if(cb){const animated=cb.stars.length;this.cbFrame=(this.cbFrame||0)+1;
   if(cb!==this.cbSource||(animated&&this.cbFrame%2===0)){const list=[];for(const o of cb.stars){o.kind='cbStar';o.species=4;list.push(o);}this.cbItems=list;this.cbSource=cb;}
   items=this.cbItems;}
  if(items.length)this.eventMesh.draw(items,[s.width,s.height],this.glow);
  this.drawParticles(s,predict,1);
  if(bloom)this.bloom.end(this.background);this.bloom.intensity=baseBloom;
 }
}
