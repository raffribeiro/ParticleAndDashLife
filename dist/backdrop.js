// Animated palette backdrop: dominant base with slow secondary/accent clouds, vignette, dither.
const VS=`attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;
const FS=`precision highp float;varying vec2 uv;uniform vec3 base;uniform vec3 mid;uniform vec3 glow;uniform float time;uniform vec2 aspect;
vec2 gradient(vec2 p){float a=fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453)*6.2831853;return vec2(cos(a),sin(a));}
float perlin(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*f*(f*(f*6.-15.)+10.);return mix(mix(dot(gradient(i),f),dot(gradient(i+vec2(1.,0.)),f-vec2(1.,0.)),u.x),mix(dot(gradient(i+vec2(0.,1.)),f-vec2(0.,1.)),dot(gradient(i+1.),f-1.),u.x),u.y);}
vec3 ramp(float v){float x=clamp(v,0.,1.)*7.;
if(x<1.)return mix(vec3(0.004432,0.004432,0.004432),vec3(0.101508,0.077805,0.172419),smoothstep(0.,1.,x));
if(x<2.)return mix(vec3(0.101508,0.077805,0.172419),vec3(0.020028,0.113590,0.186532),smoothstep(1.,2.,x));
if(x<3.)return mix(vec3(0.020028,0.113590,0.186532),vec3(0.000000,0.143670,0.140297),smoothstep(2.,3.,x));
if(x<4.)return mix(vec3(0.000000,0.143670,0.140297),vec3(0.064635,0.150568,0.066073),smoothstep(3.,4.,x));
if(x<5.)return mix(vec3(0.064635,0.150568,0.066073),vec3(0.165163,0.136417,0.012548),smoothstep(4.,5.,x));
if(x<6.)return mix(vec3(0.165163,0.136417,0.012548),vec3(0.221912,0.117868,0.062329),smoothstep(5.,6.,x));
if(x<7.)return mix(vec3(0.221912,0.117868,0.062329),vec3(0.232732,0.118211,0.155307),smoothstep(6.,7.,x));
return vec3(0.233720,0.118014,0.164846);}
void main(){
 // Match the ColorAtlas splash's single octave, 30-second frequency breathing and contrast ramp.
 float breathe=.5-.5*cos(time*6.2831853/30.);
 vec2 frequency=mix(vec2(.0018,.0024),vec2(.0028,.0018),breathe);
 vec2 reference=(uv-.5)*aspect/max(aspect.y,.001)*800.+vec2(600.,400.);
 float field=clamp((.5+perlin(reference*frequency+vec2(11.))*.75)*3.-1.,0.,1.);
 vec3 c=ramp(field)*.28;gl_FragColor=vec4(c,1.);
}`;
export class Backdrop {
 constructor(gl,instancing){this.gl=gl;this.instancing=instancing;this.colors=[[0,0,0],[0,0,0],[0,0,0]];}
 init(){
  const gl=this.gl,p=this.program=gl.createProgram();
  for(const [t,src] of [[gl.VERTEX_SHADER,VS],[gl.FRAGMENT_SHADER,FS]]){const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);}
  gl.bindAttribLocation(p,0,'p');gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
  this.u=Object.fromEntries(['base','mid','glow','time','aspect'].map(n=>[n,gl.getUniformLocation(p,n)]));
  this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
 }
 draw(width,height,time){
  const gl=this.gl;if(!this.program)this.init();
  gl.disable(gl.BLEND);gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);if(this.instancing)this.instancing.vertexAttribDivisorANGLE(0,0);
  for(let i=1;i<6;i++)gl.disableVertexAttribArray(i);
  const [a,b,c]=this.colors;gl.uniform3f(this.u.base,...a);gl.uniform3f(this.u.mid,...b);gl.uniform3f(this.u.glow,...c);
  gl.uniform1f(this.u.time,time);const m=Math.max(width,height);gl.uniform2f(this.u.aspect,width/m,height/m);
  gl.drawArrays(gl.TRIANGLES,0,3);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 }
}
