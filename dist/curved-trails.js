import {wrappedDelta} from './simulation.js?v=1.25.6';
function program(gl,vertex,fragment,attributes){
 const p=gl.createProgram();
 for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(p,shader);}
 attributes.forEach((name,index)=>gl.bindAttribLocation(p,index,name));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;
}
export class CurvedTrails {
 constructor(gl,instancing,palette){
  this.gl=gl;this.instancing=instancing;this.palette=palette;
  this.gpu=!!(instancing&&gl.getExtension('OES_texture_float')&&Number(gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS))>=1);
 }
 initGPU(){
  const gl=this.gl;
  this.program=program(gl,`
   precision highp float;
   attribute vec2 path;attribute vec2 pos;attribute vec3 color;attribute float energy;attribute vec2 velocity;attribute float id;
   uniform sampler2D historyTexture;uniform vec2 textureSize;uniform float columns;uniform float newest;uniform float samples;
   uniform vec2 world;uniform vec2 viewport;uniform float prediction;uniform float amount;
   varying vec3 tint;varying float age;varying float side;varying float power;
   vec2 readPoint(float index){float slot=mod(newest-max(0.,index-1.)+24.,24.);vec2 uv=vec2(mod(id,columns)*24.+slot+.5,floor(id/columns)+.5)/textureSize;return texture2D(historyTexture,uv).xy;}
   vec2 delta(vec2 d){return d-floor(d/world+.5)*world;}
   vec2 samplePoint(float index,vec2 live){if(index<.5)return live;return readPoint(clamp(index,1.,samples));}
   void main(){
    vec2 latest=readPoint(1.);vec2 live=latest+delta(pos+velocity*prediction-mod(latest,world));
    // Generous per-particle variation of trail length: 8%–240% of the slider (capped at the full history).
    float rnd=fract(sin(id*12.9898+1.7)*43758.5453);float amt=min(1.,amount*mix(.08,2.4,pow(rnd,1.3)));
    float f=path.x*max(.001,amt*samples),index=floor(f),t=fract(f);
    vec2 p0=samplePoint(max(0.,index-1.),live),p1=samplePoint(index,live),p2=samplePoint(min(samples,index+1.),live),p3=samplePoint(min(samples,index+2.),live);
    vec2 a=2.*p0-5.*p1+4.*p2-p3,b=-p0+3.*p1-3.*p2+p3;
    vec2 point=.5*(2.*p1+(-p0+p2)*t+a*t*t+b*t*t*t);
    vec2 tangent=.5*((-p0+p2)+2.*a*t+3.*b*t*t)*viewport/world;
    float speed=length(tangent);vec2 normal=speed>.001?vec2(-tangent.y,tangent.x)/speed:vec2(0.,1.);
    float width=mix(1.35,.08,pow(path.x,.75));
    vec2 anchor=mod(pos+velocity*prediction,world),projected=anchor+point-live;
    gl_Position=vec4(projected/world*vec2(2.,-2.)+vec2(-1.,1.)+normal*path.y*width*2.5/viewport*vec2(2.,-2.),0.,1.);
    tint=color;age=path.x;side=path.y;power=min(1.,.85+energy*.15);
   }`,
   `precision mediump float;varying vec3 tint;varying float age;varying float side;varying float power;void main(){float opacity=exp(-side*side*4.)*pow(max(0.,1.-age),1.4)*.34*power;gl_FragColor=vec4(tint,opacity);}`,
   ['path','pos','color','energy','velocity','id']);
  this.uniforms=Object.fromEntries(['historyTexture','textureSize','columns','newest','samples','world','viewport','prediction','amount'].map(name=>[name,gl.getUniformLocation(this.program,name)]));
  const mesh=new Float32Array(37*4);for(let i=0;i<=36;i++){mesh[i*4]=mesh[i*4+2]=i/36;mesh[i*4+1]=-1;mesh[i*4+3]=1;}
  this.mesh=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.mesh);gl.bufferData(gl.ARRAY_BUFFER,mesh,gl.STATIC_DRAW);
  this.ids=gl.createBuffer();this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 }
 draw(s,h,predict,amount,stateBuffer){
  if(amount<=0||h.valid<2)return;
  if(!this.gpu){this.drawFallback(s,h,predict,amount);return;}
  const gl=this.gl,ext=this.instancing;if(!this.program)this.initGPU();gl.useProgram(this.program);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);
  if(this.lastData!==h.data){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,h.textureWidth,h.textureHeight,0,gl.RGBA,gl.FLOAT,h.data);this.lastData=h.data;this.lastVersion=h.version;
   const ids=Float32Array.from({length:s.count},(_,i)=>i);gl.bindBuffer(gl.ARRAY_BUFFER,this.ids);gl.bufferData(gl.ARRAY_BUFFER,ids,gl.STATIC_DRAW);
  }else if(this.lastVersion!==h.version){gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,h.textureWidth,h.textureHeight,gl.RGBA,gl.FLOAT,h.data);this.lastVersion=h.version;}
  gl.bindBuffer(gl.ARRAY_BUFFER,stateBuffer);
  for(const [index,size,offset] of [[1,2,0],[2,3,8],[3,1,20],[4,2,24]]){gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,size,gl.FLOAT,false,32,offset);ext.vertexAttribDivisorANGLE(index,1);}
  gl.bindBuffer(gl.ARRAY_BUFFER,this.ids);gl.enableVertexAttribArray(5);gl.vertexAttribPointer(5,1,gl.FLOAT,false,0,0);ext.vertexAttribDivisorANGLE(5,1);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.mesh);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);ext.vertexAttribDivisorANGLE(0,0);
  const u=this.uniforms;gl.uniform1i(u.historyTexture,0);gl.uniform2f(u.textureSize,h.textureWidth,h.textureHeight);gl.uniform1f(u.columns,h.columns);gl.uniform1f(u.newest,h.newest);gl.uniform1f(u.samples,h.valid);
  gl.uniform2f(u.world,s.width,s.height);gl.uniform2f(u.viewport,s.width,s.height);gl.uniform1f(u.prediction,predict);gl.uniform1f(u.amount,amount);
  ext.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP,0,74,s.count);
 }
 initFallback(){
  const gl=this.gl;this.fallbackProgram=program(gl,
   `attribute vec2 coord;attribute vec3 color;attribute float age;attribute vec2 velocity;uniform vec2 world;uniform float prediction;varying vec3 tint;varying float lifetime;void main(){gl_Position=vec4((coord+velocity*prediction)/world*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);tint=color;lifetime=age;}`,
   `precision mediump float;varying vec3 tint;varying float lifetime;uniform float amount;void main(){float alpha=pow(max(0.,1.-lifetime/max(.001,amount)),1.4)*.3;gl_FragColor=vec4(tint,alpha);}`,
   ['coord','color','age','velocity']);this.fallbackUniforms=Object.fromEntries(['world','prediction','amount'].map(name=>[name,gl.getUniformLocation(this.fallbackProgram,name)]));this.fallbackBuffer=gl.createBuffer();
 }
 drawFallback(s,h,predict,amount){
  const gl=this.gl;if(!this.fallbackProgram)this.initFallback();gl.useProgram(this.fallbackProgram);gl.bindBuffer(gl.ARRAY_BUFFER,this.fallbackBuffer);
  const required=s.count*h.size*2*8;
  if(!this.fallbackData||this.fallbackData.length<required){this.fallbackData=new Float32Array(Math.ceil(required*1.25));gl.bufferData(gl.ARRAY_BUFFER,this.fallbackData.byteLength,gl.DYNAMIC_DRAW);this.fallbackX=null;}
  if(this.fallbackX!==s.x||this.fallbackVersion!==h.version){
   let offset=0;
   for(let i=0;i<s.count;i++){
    const last=h.offset(i,0),latestX=h.data[last],latestY=h.data[last+1];
    const liveX=latestX+wrappedDelta(s.x[i]-((latestX%s.width+s.width)%s.width),s.width),liveY=latestY+wrappedDelta(s.y[i]-((latestY%s.height+s.height)%s.height),s.height);
    const shiftX=s.x[i]-liveX,shiftY=s.y[i]-liveY,c=this.palette[s.type[i]];
    for(let segment=0;segment<h.valid;segment++)for(let end=0;end<2;end++){
     const age=segment+end;let x=s.x[i],y=s.y[i];
     if(age>0){const o=h.offset(i,age-1);x=h.data[o]+shiftX;y=h.data[o+1]+shiftY;}
     this.fallbackData[offset++]=x;this.fallbackData[offset++]=y;this.fallbackData[offset++]=c[0];this.fallbackData[offset++]=c[1];this.fallbackData[offset++]=c[2];this.fallbackData[offset++]=age/h.valid;this.fallbackData[offset++]=age===0?s.vx[i]:0;this.fallbackData[offset++]=age===0?s.vy[i]:0;
    }
   }
   this.fallbackVertices=offset/8;gl.bufferSubData(gl.ARRAY_BUFFER,0,this.fallbackData.subarray(0,offset));this.fallbackX=s.x;this.fallbackVersion=h.version;
  }
  for(const [index,size,offset] of [[0,2,0],[1,3,8],[2,1,20],[3,2,24]]){gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,size,gl.FLOAT,false,32,offset);if(this.instancing)this.instancing.vertexAttribDivisorANGLE(index,0);}
  gl.uniform2f(this.fallbackUniforms.world,s.width,s.height);gl.uniform1f(this.fallbackUniforms.prediction,predict);gl.uniform1f(this.fallbackUniforms.amount,amount);gl.lineWidth(1);gl.drawArrays(gl.LINES,0,this.fallbackVertices);
 }
}
