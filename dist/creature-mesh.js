// Builds procedural creature geometry on the CPU and draws it in one WebGL call.
// Vertex: x,y | r,g,b,a | u,v,kind. kind 0 membrane strip, 1 halo, 2 membrane fan, 3 glow dot, 5 opaque stroke.
const STRIDE=9,INK=[.067,.067,.067];
const angleBetween=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
function compile(gl,vs,fs,attrs){const p=gl.createProgram();for(const [t,src] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]]){const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);}attrs.forEach((a,i)=>gl.bindAttribLocation(p,i,a));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}

export class CreatureMesh {
 constructor(gl,instancing){this.gl=gl;this.instancing=instancing;this.data=new Float32Array(STRIDE*6*4096);this.n=0;this.palette=null;this.glow=.65;}
 init(){
  const gl=this.gl;
  this.program=compile(gl,`attribute vec2 pos;attribute vec4 color;attribute vec3 shape;uniform vec2 world;varying vec4 tint;varying vec3 sh;
   void main(){gl_Position=vec4(pos/world*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);tint=color;sh=shape;}`,
   `precision mediump float;varying vec4 tint;varying vec3 sh;uniform float glow;uniform float pop;
   void main(){
    // Agar cells: crisp flat disc (6) and capsule (7), no glow.
    if(sh.z>5.5){float dd=sh.z<6.5?length(sh.xy):abs(sh.y);gl_FragColor=vec4(clamp(tint.rgb,0.,.98),tint.a*(1.-smoothstep(.9,1.,dd)));return;}
    // Solid strokes: only geometric edge coverage may blend. Life, mood, energy and glow never reduce the fill.
    if(sh.z>4.5){float edge=1.-smoothstep(.9,1.,abs(sh.y));float shade=pop>.5?1.:.78+.19*(1.-sh.x)+.1*(1.-sh.y*sh.y);gl_FragColor=vec4(clamp(tint.rgb*shade,0.,.98),edge);return;}
    float k=sh.z,d=k<.5||(k>.5&&k<1.5)||k>4.5?abs(sh.y):k>3.5?max(abs(sh.x),abs(sh.y)):length(sh.xy),a;
    if(k<.5||(k>1.5&&k<2.5)){float edge=1.-smoothstep(.82,1.,d);float rim=smoothstep(.5,.96,d);a=edge*(.22+.78*rim*rim);}
    else if(k<1.5)a=1.-smoothstep(.15,1.,d);
    else if(k<3.5)a=exp(-d*d*3.5)*(1.-smoothstep(.85,1.,d));
    else a=1.-smoothstep(.82,1.,d);
    float shade=k>4.5?.78+.19*(1.-sh.x)+.1*(1.-sh.y*sh.y):1.;
    gl_FragColor=vec4(clamp(tint.rgb*shade,0.,.98),tint.a*a*(.75+.5*glow));}`,['pos','color','shape']);
  this.uWorld=gl.getUniformLocation(this.program,'world');this.uGlow=gl.getUniformLocation(this.program,'glow');this.uPop=gl.getUniformLocation(this.program,'pop');this.buffer=gl.createBuffer();
 }
 ensure(extra){if(this.n*STRIDE+extra*STRIDE>this.data.length){const next=new Float32Array(Math.max(this.data.length*2,(this.n+extra)*STRIDE));next.set(this.data);this.data=next;}}
 vertex(x,y,c,a,u,v,k){const o=this.n++*STRIDE,d=this.data;d[o]=x;d[o+1]=y;d[o+2]=c[0];d[o+3]=c[1];d[o+4]=c[2];d[o+5]=a;d[o+6]=u;d[o+7]=v;d[o+8]=k;}
 // Ribbon along a polyline; width/alpha can be functions of the point index.
 strip(px,py,count,width,color,alpha,kind){
  if(count<2)return;
  // Pop art direction: soft glows/halos are dropped; every solid stroke gets a black ink contour drawn first.
  if(this.palette?.pop&&!this.inking){if(kind!==5)return;this.inking=true;this.strip(px,py,count,typeof width==='function'?i=>width(i)+1.9:width+1.9,INK,1,5);this.inking=false;}this.ensure((count-1)*6);let pnx=0,pny=0;const L=[],R=[];
  for(let i=0;i<count;i++){
   const a=Math.max(0,i-1),b=Math.min(count-1,i+1);let tx=px[b]-px[a],ty=py[b]-py[a];const d=Math.hypot(tx,ty);
   if(d>1e-6){tx/=d;ty/=d;pnx=-ty;pny=tx;}const w=typeof width==='function'?width(i):width;
   L.push(px[i]+pnx*w,py[i]+pny*w);R.push(px[i]-pnx*w,py[i]-pny*w);
  }
  for(let i=0;i<count-1;i++){
   const u0=i/(count-1),u1=(i+1)/(count-1),a0=typeof alpha==='function'?alpha(i):alpha,a1=typeof alpha==='function'?alpha(i+1):alpha;
   const c0=typeof color==='function'?color(i):color,c1=typeof color==='function'?color(i+1):color;
   this.vertex(L[i*2],L[i*2+1],c0,a0,u0,1,kind);this.vertex(R[i*2],R[i*2+1],c0,a0,u0,-1,kind);this.vertex(L[i*2+2],L[i*2+3],c1,a1,u1,1,kind);
   this.vertex(R[i*2],R[i*2+1],c0,a0,u0,-1,kind);this.vertex(R[i*2+2],R[i*2+3],c1,a1,u1,-1,kind);this.vertex(L[i*2+2],L[i*2+3],c1,a1,u1,1,kind);
  }
  // Solid strokes get round caps and round joins (a flat disc at every vertex, same width and colour),
  // so ends are rounded and bends never show miter gaps.
  if(kind===5){const pop=!!this.palette?.pop,shade=pop?1:.92;for(let i=0;i<count;i++){if(!pop&&i>0&&i<count-1)continue;const w=typeof width==='function'?width(i):width,c=typeof color==='function'?color(i):color,a=typeof alpha==='function'?alpha(i):alpha;if(w>.4&&a>0)this.disc(px[i],py[i],w,shade===1?c:c.map(v=>v*shade),a);}}
 }
 dot(x,y,r,c,a){if(this.palette?.pop){if(a<.4)return;this.ensure(12);this.disc(x,y,r+1.3,INK,1);this.disc(x,y,r,c,1);return;}this.ensure(6);const k=3;this.vertex(x-r,y-r,c,a,-1,-1,k);this.vertex(x+r,y-r,c,a,1,-1,k);this.vertex(x-r,y+r,c,a,-1,1,k);this.vertex(x+r,y-r,c,a,1,-1,k);this.vertex(x+r,y+r,c,a,1,1,k);this.vertex(x-r,y+r,c,a,-1,1,k);}
 // Fan from a centre through rim points; uv runs centre (0) → rim (1) so the membrane shader rims it.
 fan(cx,cy,rim,c,a){const m=rim.length/2;this.ensure(m*3);for(let i=0;i<m;i++){const j=(i+1)%m,ai=i/m*6.2832,aj=j/m*6.2832;this.vertex(cx,cy,c,a,0,0,2);this.vertex(rim[i*2],rim[i*2+1],c,a,Math.cos(ai),Math.sin(ai),2);this.vertex(rim[j*2],rim[j*2+1],c,a,Math.cos(aj),Math.sin(aj),2);}}
 build(list,state){
  this.n=0;const P=this.palette;if(!P)return;
  // Bonds between particles: thin soft lines in the colours of both ends, drawn under the fish.
  // Walker legs: two-segment lines from the hip particle through the knee to the planted foot.
  if(state?.walkers)for(const wk of state.walkers){if(wk.materialParts)continue;const sp=P.species[wk.species]||P.species[0],L=wk.legs,life=Math.max(0,Math.min(1,wk.life??1));
   // Line anatomy grows out of the connected particle body.
   const startBody=this.n;
   if(wk.tail){const n=wk.tail.length/2,X=[],Y=[];for(let i=0;i<n;i++){X.push(wk.tail[i*2]);Y.push(wk.tail[i*2+1]);}this.strip(X,Y,n,i=>1.8*(1-i/n)+.25,sp.rgb,1,5);}
   if(wk.head){const h=wk.head,nx=-h[5],ny=h[4],x=h[2],y=h[3];
    this.strip([h[0],x],[h[1],y],2,1.6,sp.rim,1,5);
    this.strip([x-h[4]*4+nx*4,x+h[4]*5,x-h[4]*4-nx*4],[y-h[5]*4+ny*4,y+h[5]*5,y-h[5]*4-ny*4],3,1.3,sp.rim,1,5);
    // (no eye dots: no circles inside bodies)
   }
   this.wrapCopies(startBody);
   for(let k=0;k<L.length;k+=7){const start=this.n,lift=L[k+6];this.strip([L[k],L[k+2],L[k+4]],[L[k+1],L[k+3],L[k+5]],3,i=>[1.6,1.3,.9][i],sp.rim,1,5);this.dot(L[k+4],L[k+5],2.4+lift*1.8,sp.rim,(.7+.3*lift)*life);this.wrapCopies(start);}}
  const B=this.showBonds?state?.bonds:null;if(B&&B.length&&state.x){const X=state.x,Y=state.y,T=state.type,W=this.world[0],H=this.world[1];
   for(let q=0;q<B.length;q+=2){const a=B[q],b=B[q+1];if(a>=state.count||b>=state.count)continue;const start=this.n,xa=X[a],ya=Y[a];let dx=X[b]-xa,dy=Y[b]-ya;dx-=Math.round(dx/W)*W;dy-=Math.round(dy/H)*H;
    const ca=P.species[T[a]].rgb,cb=P.species[T[b]].rgb;this.strip([xa,xa+dx],[ya,ya+dy],2,.8,i=>i?cb:ca,.5*this.glowBond,1);this.wrapCopies(start);}}
  for(const c of list){const start=this.n;this[c.kind]?.(c,P.species[c.species]);this.wrapCopies(start,c);}
 }
 wrapCopies(start,c){
  const end=this.n,d=this.data,W=this.world[0],H=this.world[1];let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
  for(let v=start;v<end;v++){const x=d[v*STRIDE],y=d[v*STRIDE+1];if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
  const offsets=[];const ox=x0<0?W:x1>W?-W:0,oy=y0<0?H:y1>H?-H:0;if(ox)offsets.push([ox,0]);if(oy)offsets.push([0,oy]);if(ox&&oy)offsets.push([ox,oy]);
  for(const [dx,dy] of offsets){this.ensure(end-start);const base=this.n;this.data.copyWithin(base*STRIDE,start*STRIDE,end*STRIDE);for(let v=0;v<end-start;v++){this.data[(base+v)*STRIDE]+=dx;this.data[(base+v)*STRIDE+1]+=dy;}this.n+=end-start;}
 }
 split(c){const n=c.points.length/2,x=new Float32Array(n),y=new Float32Array(n);for(let i=0;i<n;i++){x[i]=c.points[i*2];y[i]=c.points[i*2+1];}return [x,y,n];}
 vigor(c){return .7+.3*Math.min(1.6,c.energy)/1.6;}
 // Short local rings and sparks, alpha blended with the organism's colour.
 event(c,sp){
  const t=c.t,fade=Math.pow(1-t,1.5),burst=c.event==='death'||c.event==='break',ease=1-Math.pow(1-t,6);
  const radius=burst?4+ease*25:22*(1-ease)+4,X=[],Y=[];
  for(let k=0;k<=24;k++){const a=k/24*Math.PI*2;X.push(c.x+Math.cos(a)*radius);Y.push(c.y+Math.sin(a)*radius);}
  this.strip(X,Y,25,.8+fade*.8,sp.rim,fade*.55,1);
  for(let k=0;k<8;k++){
   const a=k/8*Math.PI*2+.3,travel=burst?ease*32:18*(1-ease),x=c.x+Math.cos(a)*travel,y=c.y+Math.sin(a)*travel;
   if(t<.3){const inner=travel*.45;this.strip([c.x+Math.cos(a)*inner,x],[c.y+Math.sin(a)*inner,y],2,.9,sp.rim,fade*.75*(1-t/.3),1);}
   this.dot(x,y,(burst?2.4:1.8)*(.5+fade),k%3===0?sp.rim:sp.rgb,fade*.85);
  }
 }
 // Circle outline (soft line), optional partial arc starting at the top.
 ring(cx,cy,r,w,color,alpha,arc=1,start=-Math.PI/2){const n=Math.max(6,Math.round(32*arc)),X=[],Y=[];for(let k=0;k<=n;k++){const a=start+k/n*arc*Math.PI*2;X.push(cx+Math.cos(a)*r);Y.push(cy+Math.sin(a)*r);}this.strip(X,Y,n+1,w,color,alpha,1);}
 rainbow(k){const S=this.palette.species;return S[((k%6)+6)%6].rgb;}
 // Organism status: HP arc, shield ring, star aura, ability flash.
 cbOrg(c,sp){const now=performance.now()/1000,r=c.r+9;
  this.ring(c.x,c.y,r,.7,sp.rim,.1);this.ring(c.x,c.y,r,1.1,c.hp<.3?sp.accent:sp.rim,(c.engaged?.7:.35),Math.max(.02,c.hp));
  if(c.shield){const p=.6+.4*Math.sin(now*12);this.ring(c.x,c.y,r+5,1.8,sp.accent,.75*p);this.dot(c.x,c.y,r+6,sp.accent,.08);}
  if(c.star>0){const spin=now*4;this.dot(c.x,c.y,r+14,[1,1,1],.12+.1*Math.sin(now*20));for(let k=0;k<6;k++){const a=spin+k/6*Math.PI*2;this.dot(c.x+Math.cos(a)*(r+6),c.y+Math.sin(a)*(r+6),3.2,this.rainbow(k+Math.floor(now*8)),.95);}this.ring(c.x,c.y,r+3,1.6,this.rainbow(Math.floor(now*10)),.8);}
  if(c.flash)this.ring(c.x,c.y,r+8,1.4,sp.accent,.6);
 }
 cbOrb(c,sp){const n=Math.hypot(c.vx,c.vy)||1;this.strip([c.x-c.vx/n*14,c.x],[c.y-c.vy/n*14,c.y],2,i=>i?2.2:.4,sp.rgb,i=>i?.7:0,1);this.dot(c.x,c.y,8,sp.rgb,.35);this.dot(c.x,c.y,3.6,sp.accent,.95);}
 cbStar(c,sp){const tt=performance.now()/1000,f=Math.min(1,c.life/60),k=1+.35*Math.sin(tt*2.2);this.dot(c.x,c.y,9*k,[1,1,1],.16*f);this.dot(c.x,c.y,3.2*k,[1,1,1],.9*f);}
 cbStarOld(c,sp){const now=performance.now()/1000,pulse=1+.2*Math.sin(now*9),fade=Math.min(1,c.life/60);this.dot(c.x,c.y,30*pulse,[1,1,1],.2*fade);
  for(let k=0;k<5;k++){const a=now*2+k/5*Math.PI*2;this.strip([c.x,c.x+Math.cos(a)*17*pulse],[c.y,c.y+Math.sin(a)*17*pulse],2,i=>i?.5:3,this.rainbow(k+Math.floor(now*6)),.9*fade,1);}
  this.dot(c.x,c.y,7.5,[1,1,1],.95*fade);}
 cbFx(c,sp){const t=c.t,f=Math.pow(1-t,1.4),e=1-Math.pow(1-t,4),k=c.fx;
  if(k==='shock'){const R=c.radius||90;for(let j=0;j<12;j++){const a=j/12*Math.PI*2;this.strip([c.x+Math.cos(a)*e*R*.5,c.x+Math.cos(a)*e*R],[c.y+Math.sin(a)*e*R*.5,c.y+Math.sin(a)*e*R],2,i=>i?.3:1.6,sp.rim,.7*f,1);}return;}
  if(k==='kill'||k==='starget'||k==='rise'||k==='starspawn'){const R=k==='kill'?40:30;
   for(let j=0;j<10;j++){const a=j/10*Math.PI*2+.4,d=e*R*1.2;this.dot(c.x+Math.cos(a)*d,c.y+Math.sin(a)*d,2.2*f+.6,k==='kill'?sp.rgb:this.rainbow(j),.85*f);}return;}
  if(k==='engulf')return;
  if(k==='split'){for(const s of [1,-1])this.dot(c.x+s*e*18,c.y,4*f+1,sp.rim,.8*f);return;}
  if(k==='dodge'||k==='deflect')return;
  if(k==='pellet'||k==='regrow'||k==='shed'){this.dot(c.x,c.y,3+6*(k==='shed'?e:1-e),sp.rim,.6*f);return;}
  // hit / burst / sever / limb: sparks
  const n=k==='sever'||k==='limb'?7:5,R=(k==='sever'||k==='limb'?20:12)*(1+(c.power||0));
  for(let j=0;j<n;j++){const a=j/n*Math.PI*2+(c.x*.13%1),d0=e*R*.3,d1=e*R;this.strip([c.x+Math.cos(a)*d0,c.x+Math.cos(a)*d1],[c.y+Math.sin(a)*d0,c.y+Math.sin(a)*d1],2,i=>i?.3:1.4,j%2?sp.accent:sp.rim,.9*f,1);}
 }
 disc(x,y,r,c,a){this.ensure(6);const k=6;this.vertex(x-r,y-r,c,a,-1,-1,k);this.vertex(x+r,y-r,c,a,1,-1,k);this.vertex(x-r,y+r,c,a,-1,1,k);this.vertex(x+r,y-r,c,a,1,-1,k);this.vertex(x+r,y+r,c,a,1,1,k);this.vertex(x-r,y+r,c,a,-1,1,k);}
 // agar.io look: every bonded particle is a cell; every bond is a thick bridge of the same fill, so connected
 // groups read as one assembled blob with a single dark outline (outline pass first, fill pass on top).
 blobs(c){
  const S=c.state,X=S.x,Y=S.y,T=S.type,B=S.bonds,W=this.world[0],H=this.world[1],P=this.palette.species,border=3.4,dark=P.map(p=>p.deep.map(v=>v*.5));
  if(!B||!B.length||!X)return;
  const radius=new Map();for(let q=0;q<B.length;q++){const i=B[q];if(i<S.count&&!radius.has(i))radius.set(i,7.5);}
  for(const w of S.walkers||[])if(w.members){const r=9+1.6*Math.sqrt(w.members.length);for(const i of w.members)if(i<S.count)radius.set(i,r);}
  const edges=[];for(let q=0;q<B.length;q+=2){const a=B[q],b=B[q+1];if(a>=S.count||b>=S.count)continue;let dx=X[b]-X[a],dy=Y[b]-Y[a];dx-=Math.round(dx/W)*W;dy-=Math.round(dy/H)*H;if(Math.hypot(dx,dy)>90)continue;edges.push([a,b,dx,dy]);}
  for(const pass of [0,1]){
   for(const [a,b,dx,dy] of edges){const start=this.n,w=Math.min(radius.get(a),radius.get(b))*.8+(pass?0:border);this.strip([X[a],X[a]+dx],[Y[a],Y[a]+dy],2,w,i=>pass?P[i?T[b]:T[a]].rgb:dark[i?T[b]:T[a]],1,7);this.wrapCopies(start);}
   for(const [i,r] of radius){const start=this.n;this.disc(X[i],Y[i],r+(pass?0:border),pass?P[T[i]].rgb:dark[T[i]],1);this.wrapCopies(start);}
  }
 }
 // Oriented box (kind 4 crisp, uv −1..1).
 box(cx,cy,ux,uy,halfL,halfW,c,a,k=4){this.ensure(6);const px=-uy,py=ux,P=(su,sv)=>[cx+ux*halfL*su+px*halfW*sv,cy+uy*halfL*su+py*halfW*sv];
  const q=[[-1,-1],[1,-1],[-1,1],[1,-1],[1,1],[-1,1]];for(const [su,sv] of q){const [x,y]=P(su,sv);this.vertex(x,y,c,a,su,sv,k);}}
 // Fish as a rigged rectangle: constant-width ribbon skinned to the spine, square ends, crisp edges (kind 5).
 rectangle(c,sp){
  const [x,y,n]=this.split(c),life=Math.max(0,Math.min(1,c.life??1)),bright=Math.min(1.15,this.vigor(c)*(c.fleeing?1.15:1))*life,friend=Math.max(0,c.mood??-1),foe=Math.max(0,-(c.mood??-1)),half=3.2/Math.sqrt(c.stretch||1);
  // Extend the spine half a segment at both ends so the box covers the whole body.
  const X=new Float32Array(n+2),Y=new Float32Array(n+2);X.set(x,1);Y.set(y,1);
  const fx=x[0]-x[1],fy=y[0]-y[1],fl=Math.hypot(fx,fy)||1,bx=x[n-1]-x[n-2],by=y[n-1]-y[n-2],bl=Math.hypot(bx,by)||1;
  X[0]=x[0]+fx/fl*2;Y[0]=y[0]+fy/fl*2;X[n+1]=x[n-1]+bx/bl*2;Y[n+1]=y[n-1]+by/bl*2;
  this.strip(X,Y,n+2,half+5+4*friend,sp.deep,(.16+.14*friend)*bright,1);
  // Solid material along the whole body; mood and energy affect the halo, never its opacity.
  const ageTint=(c.maturity||0)*.18,bodyColour=sp.rgb.map((v,k)=>v*(1-ageTint)+sp.accent[k]*ageTint);
  this.strip(X,Y,n+2,half,bodyColour,1,5);
  // Age leaves a small, stable signature; the original organism remains recognisable.
  const maturity=c.maturity||0;
  // Fish mounted as limbs (leg/tail) are plain strokes: no age dots, no stomach contents.
  const limb=!!c.role&&c.role!=='head';
  // No circles inside fish, ever: age dots, eyes and stomach dots are not drawn.
  if(false)for(let k=0;k<Math.floor(maturity*5);k++){const i=1+((k*3+c.id)%Math.max(1,n-2));this.dot(x[i],y[i],1.25,sp.accent,.65*bright);}
  if(false&&(!c.role||c.role==='head')&&Number.isFinite(c.gaze)){
   const a=c.gaze,nx=-Math.sin(a),ny=Math.cos(a),ux=Math.cos(a),uy=Math.sin(a);
   for(const side of [-1,1])this.dot(x[0]+ux*2+nx*side*2.2,y[0]+uy*2+ny*side*2.2,1.2,sp.rim,.85*bright);
  }
  if(false)c.stomach.forEach((t,j)=>{const i=Math.min(n-1,2+j*3),[ux,uy]=[x[Math.max(0,i-1)]-x[i+1>n-1?i:i+1],y[Math.max(0,i-1)]-y[i+1>n-1?i:i+1]],l=Math.hypot(ux,uy)||1;this.box(x[i],y[i],ux/l,uy/l,1.4,1.4,this.palette.species[t].rgb,.95*bright);});
 }
 // Abstract living line: tapered glowing stroke along the spine; eaten particles ride along it.
 line(c,sp){
  const [x,y,n]=this.split(c),life=Math.max(0,Math.min(1,c.life??1)),bright=Math.min(1.15,this.vigor(c)*(c.fleeing?1.15:1))*life,friend=Math.max(0,c.mood??-1),foe=Math.max(0,-(c.mood??-1));
  const w=i=>(1-i/n)*(1.7+.5*foe)+.35+.8*friend*(1-i/n);
  this.strip(x,y,n,i=>w(i)*2.6,sp.deep,i=>(.22+.12*friend)*(1-i/n)*bright,1);
  this.strip(x,y,n,w,i=>i<2?sp.rim:sp.rgb,1,5);
  if(false)c.stomach.forEach((t,k)=>{const i=Math.min(n-1,3+k*3);this.dot(x[i],y[i],2.2,this.palette.species[t].rgb,.95*bright);});
  if(false)this.dot(x[0],y[0],2+1.2*foe+(c.hunting?.8:0),foe>.3?sp.accent:sp.rim,(.8+.2*foe)*bright);
 }
 // Procedural fish (unused): tail fin (fork / fan / veil), pectoral + pelvic fins, membrane body, pattern, eyes.
 fish(c,sp){
  const [x,y,n]=this.split(c),fat=.85+.15*Math.min(2,c.energy),bright=Math.min(1.15,this.vigor(c)*(c.fleeing?1.15:1))*Math.max(0,Math.min(1,c.life??1)),hx=Math.cos(c.heading),hy=Math.sin(c.heading);
  const W=i=>c.widths[i]*fat,maxW=Math.max(...c.widths)*fat;
  const tan=i=>{const a=Math.max(0,i-1),b=Math.min(n-1,i+1);let tx=x[a]-x[b],ty=y[a]-y[b];const l=Math.hypot(tx,ty)||1;return [tx/l,ty/l];};
  const rot=(vx,vy,a)=>[vx*Math.cos(a)-vy*Math.sin(a),vx*Math.sin(a)+vy*Math.cos(a)];
  // Tail fin, lagging the body wave.
  {const [tx,ty]=tan(n-1),dx=-tx,dy=-ty,flap=Math.sin(c.phase-1.4)*.45,[ddx,ddy]=rot(dx,dy,flap),bx=x[n-1],by=y[n-1],px=-ddy,py=ddx,wp=W(n-1),len=maxW*1.7*c.fin,rim=[];
   if(c.tail==='fork'){const [ax,ay]=rot(ddx,ddy,.55),[bx2,by2]=rot(ddx,ddy,-.55);rim.push(bx+px*wp,by+py*wp,bx+ax*len,by+ay*len,bx+ddx*len*.42,by+ddy*len*.42,bx+bx2*len,by+by2*len,bx-px*wp,by-py*wp);this.fan(bx+ddx*len*.3,by+ddy*len*.3,rim,sp.rgb,.8*bright);}
   else{const veil=c.tail==='veil',span=veil?1.05:.85,steps=veil?14:9,radius=len*(veil?1.3:1);rim.push(bx+px*wp,by+py*wp);
    for(let k=0;k<=steps;k++){const t=k/steps,a=span-2*span*t,ripple=veil?1+.12*Math.sin(k*1.7+c.phase*1.5):.88+.12*Math.cos((t-.5)*Math.PI),[rx,ry]=rot(ddx,ddy,a+flap*(veil?.5:.2)*(1-Math.abs(t-.5)));rim.push(bx+rx*radius*ripple,by+ry*radius*ripple);}
    rim.push(bx-px*wp,by-py*wp);this.fan(bx+ddx*radius*.3,by+ddy*radius*.3,rim,sp.rgb,(veil?.55:.75)*bright);}}
  // Paired fins: pectoral near the head, pelvic mid-body for the larger styles.
  const fins=(i,size,flapAmp,alpha)=>{const [tx,ty]=tan(i),w=W(i);for(const s of [1,-1]){const nx=-ty*s,ny=tx*s,bx=x[i]+nx*w*.65,by=y[i]+ny*w*.65,flap=Math.sin(c.phase*1.25+s)*flapAmp,base=Math.atan2(ny,nx),back=Math.atan2(-ty,-tx),a=base+angleBetween(back,base)*.55+flap*s,len=w*1.9*size,dx=Math.cos(a),dy=Math.sin(a),a2=a+angleBetween(back,a)*.45,dx2=Math.cos(a2),dy2=Math.sin(a2);
   this.fan(bx+dx*len*.35,by+dy*len*.35,[bx+tx*w*.45,by+ty*w*.45,bx+dx*len,by+dy*len,bx+dx2*len*.85,by+dy2*len*.85,bx-tx*w*.7,by-ty*w*.7],sp.rgb,alpha*bright);}};
  fins(Math.max(1,Math.round(n*.24)),c.fin,.35,.7);
  if(c.style==='koi'||c.style==='betta')fins(Math.round(n*.55),c.fin*.6,.25,.55);
  // Body with a rounded snout.
  const X=new Float32Array(n+1),Y=new Float32Array(n+1);X[0]=x[0]+hx*c.widths[0]*.9;Y[0]=y[0]+hy*c.widths[0]*.9;X.set(x,1);Y.set(y,1);
  const width=i=>i===0?W(0)*.55:W(i-1);
  this.strip(X,Y,n+1,i=>width(i)*2,sp.deep,.16*bright,0);
  this.strip(X,Y,n+1,width,i=>i<3?sp.rim:sp.rgb,i=>(.95-.25*i/n)*bright,0);
  if(c.style==='koi'||c.style==='betta'){const a=Math.round(n*.3),b=Math.round(n*.75);this.strip(x.subarray(a,b),y.subarray(a,b),b-a,.9,sp.rim,.5*bright,1);}
  if(c.pattern==='stripe'){const b=Math.max(2,Math.round(n*.8));this.strip(x.subarray(1,b),y.subarray(1,b),b-1,i=>W(i+1)*.28,sp.accent,.85*bright,1);}
  else if(c.pattern==='spots'){for(let i=2;i<n-2;i++){const h=Math.sin(c.id*12.9898+i*78.233)*43758.5453,r=h-Math.floor(h);if(r<.45)continue;const [tx,ty]=tan(i),o=(r-.7)*2*W(i);this.dot(x[i]-ty*o,y[i]+tx*o,W(i)*(.3+.25*r),r>.8?sp.accent:sp.deep,.75*bright);}}
  else this.strip(x.subarray(1,n-1),y.subarray(1,n-1),n-2,i=>W(i+1)*.18,sp.rim,i=>.45*(1-i/n)*bright,1);
  // Swallowed particles glow inside the belly in their own colour until excreted.
  if(c.stomach)c.stomach.forEach((t,k)=>{const i=1+((k*3+c.id)%Math.max(1,n-2));this.dot(x[i],y[i],Math.max(1.6,W(i)*.55),this.palette.species[t].rgb,.9*bright);});
  // Mood: friends wear a soft halo and gentle eyes; enemies get bright, larger eyes.
  const friend=Math.max(0,c.mood??-1),foe=Math.max(0,-(c.mood??-1));
  if(friend>.05){const m=Math.floor(n*.4);this.dot(x[m],y[m],c.spacing*n*.55,sp.rim,.14*friend*bright);}
  const w0=W(0);for(const s of [1,-1])this.dot(x[0]+hx*w0*.3-hy*s*w0*.55,y[0]+hy*w0*.3+hx*s*w0*.55,Math.max(1.2,w0*(.28+.12*foe)),foe>.3?sp.accent:sp.rim,Math.min(1,.65+.35*foe+(c.hunting?.2:0)));
 }
 draw(list,world,glow,state=null){
  if((!list||!list.length)&&!state?.bonds?.length&&!state?.walkers?.length)return;list=list||[];this.glowBond=.6+.4*glow;const gl=this.gl;if(!this.program)this.init();
  gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  // Geometry is rebuilt and uploaded only when a new snapshot (or palette) arrives.
  if(list!==this.lastList||state?.bonds!==this.lastBonds||state?.walkers!==this.lastWalkers||this.palette!==this.lastPalette||world[0]!==this.world?.[0]||world[1]!==this.world?.[1]){
   this.world=world;this.build(list,state);this.lastList=list;this.lastBonds=state?.bonds;this.lastWalkers=state?.walkers;this.lastPalette=this.palette;
   if(this.capacity!==this.data.length){gl.bufferData(gl.ARRAY_BUFFER,this.data.byteLength,gl.DYNAMIC_DRAW);this.capacity=this.data.length;}
   gl.bufferSubData(gl.ARRAY_BUFFER,0,this.data.subarray(0,this.n*STRIDE));
  }
  if(!this.n)return;
  for(const [i,size,off] of [[0,2,0],[1,4,8],[2,3,24]]){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,size,gl.FLOAT,false,STRIDE*4,off);if(this.instancing)this.instancing.vertexAttribDivisorANGLE(i,0);}
  for(let i=3;i<6;i++)gl.disableVertexAttribArray(i);
  gl.uniform2f(this.uWorld,world[0],world[1]);gl.uniform1f(this.uPop,this.palette?.pop?1:0);gl.uniform1f(this.uGlow,glow);gl.drawArrays(gl.TRIANGLES,0,this.n);
 }
}
