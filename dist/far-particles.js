// Out-of-focus decorative motes: one static buffer, one draw, no simulation or blur pass.
const VS=`attribute vec2 corner;attribute vec2 center;attribute float seed;attribute float radius;attribute float paletteRole;uniform vec2 viewport;uniform float time;uniform float backdrop;varying vec2 uv;varying float depth;varying float role;
void main(){if(backdrop>.5){uv=corner*.5+.5;gl_Position=vec4(corner,0.,1.);return;}uv=corner;role=paletteRole;depth=fract(seed*7.13);vec2 drift=vec2(sin(time*.014+seed*6.28),cos(time*.011+seed*9.1))*.1;
 vec2 p=center+drift+vec2(sin(time*.006+seed*11.),cos(time*.008+seed*7.))*.025;
 float r=radius*min(viewport.x,viewport.y);gl_Position=vec4(p*2.-1.+corner*r/viewport*2.,0.,1.);}`;
const FS=`precision mediump float;varying vec2 uv;varying float depth;varying float role;uniform vec3 tintA;uniform vec3 tintB;uniform vec3 tintC;uniform float time;uniform float backdrop;uniform vec2 viewport;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
vec3 dim(vec3 c){return mix(vec3(dot(c,vec3(.2126,.7152,.0722))),c,.35);}
void main(){if(backdrop>.5){
 vec2 p=(uv-.5)*vec2(viewport.x/max(viewport.y,1.),1.)*2.8;float t=time*.055;
 vec2 warp=vec2(noise(p+vec2(t,-t*.6)),noise(p+vec2(4.7,-t*.8)))-.5;
 float field=noise(p+warp*.85+vec2(t*.32,t*.21));
 vec3 color=mix(dim(tintA),dim(tintB),smoothstep(.27,.7,field));
 color=mix(color,dim(tintC),smoothstep(.7,.94,field)*.45);
 float clouds=smoothstep(.2,.8,field);gl_FragColor=vec4(color*(.025+.105*clouds),1.);return;}
 float d=dot(uv,uv);float soft=exp(-d*4.5)*(1.-smoothstep(.5,1.,d));
 vec3 selected=role<.5?tintA:role<1.5?tintB:tintC;float luminance=dot(selected,vec3(.2126,.7152,.0722));vec3 muted=mix(vec3(luminance),selected,.35);vec3 color=muted*(.28+.1*depth);gl_FragColor=vec4(color,soft*(.13+.1*depth));}`;
export class FarParticles{
 constructor(gl,instancing){this.gl=gl;this.instancing=instancing;}
 init(){
  const gl=this.gl,p=this.program=gl.createProgram();
  for(const [type,src] of [[gl.VERTEX_SHADER,VS],[gl.FRAGMENT_SHADER,FS]]){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);}
  ['corner','center','seed','radius','paletteRole'].forEach((name,i)=>gl.bindAttribLocation(p,i,name));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
  this.u=Object.fromEntries(['viewport','time','backdrop','tintA','tintB','tintC'].map(n=>[n,gl.getUniformLocation(p,n)]));
  const quad=[-1,-1,1,-1,-1,1,1,-1,1,1,-1,1],data=this.data=new Float32Array(8*6*7);
  for(let i=0;i<8;i++){const x=.1+((i*.61803398875+.12)%1)*.8,y=.1+((i*.41421356237+.3)%1)*.8,seed=(i*.754877666+.1)%1,radius=.125+((i*.37)%1)*.12;
   for(let k=0;k<6;k++)data.set([quad[k*2],quad[k*2+1],x,y,seed,radius,i<5?0:i<7?1:2],(i*6+k)*7);
  }
  this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
 }
 draw(w,h,time,palette){
  if(!this.program)this.init();const gl=this.gl;gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  for(const [i,n,offset] of [[0,2,0],[1,2,8],[2,1,16],[3,1,20],[4,1,24]]){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,n,gl.FLOAT,false,28,offset);if(this.instancing)this.instancing.vertexAttribDivisorANGLE(i,0);}
  gl.disableVertexAttribArray(5);gl.uniform2f(this.u.viewport,w,h);gl.uniform1f(this.u.time,time);
  gl.uniform3f(this.u.tintA,...(palette[0]||[.4,.6,.8]));gl.uniform3f(this.u.tintB,...(palette[2]||palette[0]||[.4,.6,.8]));
  gl.uniform3f(this.u.tintC,...(palette[4]||palette[2]||palette[0]||[.4,.6,.8]));
  gl.uniform1f(this.u.backdrop,1);gl.drawArrays(gl.TRIANGLES,0,6);
  gl.uniform1f(this.u.backdrop,0);gl.drawArrays(gl.TRIANGLES,0,48);
 }
}
