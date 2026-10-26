// Multi-scale bloom (WebGL1): scene → FBO, soft-threshold prefilter, dual-filter
// downsample chain, additive tent upsample, then composite with highlight
// compression, vignette and dither. Half-float targets when available.
const FULL=new Float32Array([-1,-1,3,-1,-1,3]);
const VS=`attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;
function compile(gl,fs){const p=gl.createProgram();for(const [t,src] of [[gl.VERTEX_SHADER,VS],[gl.FRAGMENT_SHADER,fs]]){const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);}gl.bindAttribLocation(p,0,'p');gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));const u={};return {p,u:name=>u[name]??=gl.getUniformLocation(p,name)};}

export class Bloom {
 constructor(gl,instancing){
  this.gl=gl;this.instancing=instancing;this.ok=false;this.grain=.06;this.intensity=2.2;this.threshold=.12;this.levels=[];this.w=0;this.h=0;
  try{this.setup();}catch(e){this.ok=false;}
 }
 setup(){
  const gl=this.gl;if(typeof gl.createFramebuffer!=='function'||typeof gl.FRAMEBUFFER_COMPLETE!=='number')return;
  const half=gl.getExtension('OES_texture_half_float');gl.getExtension('OES_texture_half_float_linear');gl.getExtension('EXT_color_buffer_half_float');
  this.halfType=half&&half.HALF_FLOAT_OES;
  this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,FULL,gl.STATIC_DRAW);
  const head='precision mediump float;varying vec2 uv;uniform sampler2D src;uniform vec2 texel;';
  this.prefilter=compile(gl,head+`uniform float threshold;uniform vec3 background;
   vec3 tap(vec2 o){return texture2D(src,uv+o*texel).rgb;}
   void main(){vec3 c=max((tap(vec2(-1.,-1.))+tap(vec2(1.,-1.))+tap(vec2(-1.,1.))+tap(vec2(1.,1.)))*.25-background,0.);
    float b=max(c.r,max(c.g,c.b));const float knee=.12;float soft=clamp(b-threshold+knee,0.,2.*knee);soft=soft*soft/(4.*knee);float w=max(soft,b-threshold)/max(b,1e-4);
    gl_FragColor=vec4(c*max(w,0.),1.);}`);
  this.down=compile(gl,head+`void main(){vec2 h=texel*.8;vec3 c=texture2D(src,uv).rgb*4.+texture2D(src,uv-h).rgb+texture2D(src,uv+h).rgb+texture2D(src,uv+vec2(h.x,-h.y)).rgb+texture2D(src,uv-vec2(h.x,-h.y)).rgb;gl_FragColor=vec4(c/8.,1.);}`);
  this.up=compile(gl,head+`uniform float weight;void main(){vec2 h=texel*2.;vec3 c=texture2D(src,uv+vec2(-h.x*2.,0.)).rgb+texture2D(src,uv+vec2(-h.x,h.y)).rgb*2.+texture2D(src,uv+vec2(0.,h.y*2.)).rgb+texture2D(src,uv+vec2(h.x,h.y)).rgb*2.+texture2D(src,uv+vec2(h.x*2.,0.)).rgb+texture2D(src,uv+vec2(h.x,-h.y)).rgb*2.+texture2D(src,uv+vec2(0.,-h.y*2.)).rgb+texture2D(src,uv+vec2(-h.x,-h.y)).rgb*2.;gl_FragColor=vec4(c/12.*weight,1.);}`);
  this.composite=compile(gl,`precision mediump float;varying vec2 uv;uniform sampler2D scene;uniform sampler2D bloom;uniform sampler2D backdrop;uniform float intensity;uniform vec3 tint;uniform float seed;uniform float grain;uniform float pop;uniform float scan;uniform float time;uniform float pixel;
   float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+seed)*43758.5453);}
   void main(){
    // Old TV / VHS: faint tracking wobble, chromatic fringe growing toward the edges (scene only).
    vec2 st=uv;st.x+=scan*.0009*sin(uv.y*140.+time*5.)+scan*.0006*sin(uv.y*23.-time*1.7);
    vec2 ca=(uv-.5)*scan*.006;
    vec3 s=vec3(texture2D(scene,st+ca).r,texture2D(scene,st).g,texture2D(scene,st-ca).b);vec3 b=texture2D(bloom,uv).rgb;vec3 c=texture2D(backdrop,uv).rgb+s+b*intensity+b*b*intensity*.35;
    // Pop: keep flat fills at full vividness (soft clip only above white) and a lighter vignette.
    float m=max(c.r,max(c.g,c.b)),t=pop>.5?.92:.72;if(m>t){float n=t+(1.-t)*(1.-exp(-(m-t)/(1.-t)));c*=n/m;}
    vec2 q=uv-.5;c*=mix(1.,pop>.5?.88:.78,smoothstep(.25,.75,dot(q,q)*2.2));c=max(c,tint*.0);
    // VHS chroma jitter: hue rotates and saturation breathes a little, per horizontal band and over time.
    {float band=floor(uv.y*48.+time*3.),n=fract(sin(dot(vec2(band,floor(time*12.)),vec2(12.9898,78.233)))*43758.5453);
     float a=scan*(.10*sin(time*1.3+uv.y*6.)+.12*(n-.5)),sat=1.+scan*(.16*sin(time*.9+uv.y*2.)+.18*(n-.5));
     vec3 k=vec3(.57735);c=c*cos(a)+cross(k,c)*sin(a)+k*dot(k,c)*(1.-cos(a));float lum=dot(c,vec3(.299,.587,.114));c=max(mix(vec3(lum),c,sat),0.);}
    // (Scanlines, rolling band and grain are drawn by the #screen-fx overlay so they also cover the UI.)
    // Film grain: per-frame noise, slightly stronger in midtones.
    float l=dot(c,vec3(.299,.587,.114));float g=(hash(gl_FragCoord.xy*.73+seed*91.7)+hash(gl_FragCoord.xy*1.37-seed*53.1)-1.)*grain*1.8*(.55+.9*l*(1.-l)*2.);
    c+=g+(hash(gl_FragCoord.xy)-.5)/255.;gl_FragColor=vec4(c,1.);}`);
  this.ok=true;
 }
 target(w,h,type){
  const gl=this.gl,tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
  for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,type,null);
  const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
  const complete=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  if(!complete){gl.deleteFramebuffer(fb);gl.deleteTexture(tex);return null;}
  return {tex,fb,w,h};
 }
 release(){const gl=this.gl;for(const t of [this.scene,this.backdrop,...this.levels])if(t){gl.deleteFramebuffer(t.fb);gl.deleteTexture(t.tex);}this.scene=null;this.backdrop=null;this.levels=[];}
 resize(w,h){
  if(w===this.w&&h===this.h&&this.scene)return true;this.release();this.w=w;this.h=h;
  this.scene=this.target(w,h,this.gl.UNSIGNED_BYTE);if(!this.scene){this.ok=false;return false;}
  this.backdrop=this.target(w,h,this.gl.UNSIGNED_BYTE);if(!this.backdrop){this.ok=false;this.release();return false;}
  let type=this.halfType;let lw=Math.max(1,w>>1),lh=Math.max(1,h>>1);
  for(let i=0;i<5&&lw>=4&&lh>=4;i++){let t=type?this.target(lw,lh,type):null;if(!t){type=null;t=this.target(lw,lh,this.gl.UNSIGNED_BYTE);}if(!t)break;this.levels.push(t);lw=Math.max(1,lw>>1);lh=Math.max(1,lh>>1);}
  if(this.levels.length<2){this.ok=false;this.release();return false;}
  return true;
 }
 // Returns true when the scene should be drawn into the bloom FBO.
 begin(w,h){
  if(!this.ok||(this.intensity<=0&&this.grain<=0&&!(this.scan>0)))return false;if(!this.resize(w,h))return false;
  const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,this.backdrop.fb);gl.viewport(0,0,w,h);return true;
 }
 foreground(){const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,this.scene.fb);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);}
 pass(prog,src,dst){const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,dst?dst.fb:null);gl.viewport(0,0,dst?dst.w:this.w,dst?dst.h:this.h);gl.useProgram(prog.p);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,src.tex);gl.uniform1i(prog.u('src'),0);gl.uniform2f(prog.u('texel'),1/src.w,1/src.h);gl.drawArrays(gl.TRIANGLES,0,3);}
 end(background){
  const gl=this.gl,L=this.levels;
  gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);if(this.instancing)this.instancing.vertexAttribDivisorANGLE(0,0);
  for(let i=1;i<6;i++)gl.disableVertexAttribArray(i);
  gl.disable(gl.BLEND);
  gl.useProgram(this.prefilter.p);gl.uniform1f(this.prefilter.u('threshold'),this.threshold);gl.uniform3f(this.prefilter.u('background'),0,0,0);this.pass(this.prefilter,this.scene,L[0]);
  for(let i=1;i<L.length;i++)this.pass(this.down,L[i-1],L[i]);
  gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);
  for(let i=L.length-1;i>0;i--){gl.useProgram(this.up.p);gl.uniform1f(this.up.u('weight'),.95);this.pass(this.up,L[i],L[i-1]);}
  gl.disable(gl.BLEND);
  const c=this.composite;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,this.w,this.h);gl.useProgram(c.p);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.scene.tex);gl.uniform1i(c.u('scene'),0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,L[0].tex);gl.uniform1i(c.u('bloom'),1);
  gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,this.backdrop.tex);gl.uniform1i(c.u('backdrop'),2);
  gl.uniform1f(c.u('intensity'),this.intensity*1.6/L.length);gl.uniform3f(c.u('tint'),...background);gl.uniform1f(c.u('seed'),(performance.now()%1000)*.001);gl.uniform1f(c.u('grain'),this.grain||0);gl.uniform1f(c.u('pop'),this.pop?1:0);gl.uniform1f(c.u('scan'),this.scan||0);gl.uniform1f(c.u('time'),(performance.now()/1000)%3600);gl.uniform1f(c.u('pixel'),Math.max(1,this.pixel||1));
  gl.drawArrays(gl.TRIANGLES,0,3);gl.activeTexture(gl.TEXTURE0);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 }
}
