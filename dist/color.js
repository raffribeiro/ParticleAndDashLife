// OKLab / OKLCH utilities (Björn Ottosson). All palette work happens in OKLab so
// lightness and chroma stay perceptually even across hues.
const clamp01=v=>v<0?0:v>1?1:v;
export function srgbToLinear(c){return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);}
export function linearToSrgb(c){return c<=.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-.055;}
export function oklabToLinearRgb(L,a,b){
 const l_=L+.3963377774*a+.2158037573*b,m_=L-.1055613458*a-.0638541728*b,s_=L-.0894841775*a-1.291485548*b;
 const l=l_*l_*l_,m=m_*m_*m_,s=s_*s_*s_;
 return [4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];
}
export function linearRgbToOklab(r,g,b){
 const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];
}
export function oklchToOklab(L,C,h){const r=h*Math.PI/180;return [L,C*Math.cos(r),C*Math.sin(r)];}
const inGamut=rgb=>rgb.every(v=>v>=-1e-4&&v<=1+1e-4);
// OKLCH → sRGB (0–1), reducing chroma at constant L/h until the colour fits the gamut.
export function oklchToSrgb(L,C,h){
 L=clamp01(L);let rgb=oklabToLinearRgb(...oklchToOklab(L,C,h));
 if(!inGamut(rgb)){let lo=0,hi=C;for(let k=0;k<20;k++){const mid=(lo+hi)/2,test=oklabToLinearRgb(...oklchToOklab(L,mid,h));if(inGamut(test)){lo=mid;rgb=test;}else hi=mid;}rgb=oklabToLinearRgb(...oklchToOklab(L,lo,h));}
 return rgb.map(v=>clamp01(linearToSrgb(clamp01(v))));
}
export function srgbToOklch(rgb){const [L,a,b]=linearRgbToOklab(...rgb.map(srgbToLinear));return [L,Math.hypot(a,b),(Math.atan2(b,a)*180/Math.PI+360)%360];}
export const toHex=rgb=>'#'+rgb.map(v=>Math.round(clamp01(v)*255).toString(16).padStart(2,'0')).join('');
export const fromHex=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
// Interpolate in OKLab (perceptually smooth, no muddy midpoints).
export function mixOklab(c1,c2,t){const a=linearRgbToOklab(...c1.map(srgbToLinear)),b=linearRgbToOklab(...c2.map(srgbToLinear));const m=a.map((v,i)=>v+(b[i]-v)*t);return oklabToLinearRgb(...m).map(v=>clamp01(linearToSrgb(clamp01(v))));}

// 60-30-10 in OKLCH. Species 0–1 dominant (60% of particles): low chroma, mid value.
// Species 2–3 secondary (30%): medium chroma/value. Species 4–5 accent (10%): high chroma, high value.
export const ROLES=[
 // Vibrant set (v1.23): chroma raised across all roles; the 60-30-10 hierarchy (chroma and value) is kept.
 {role:'dominant',L:.62,C:.1,dh:-10,minL:.58},{role:'dominant',L:.68,C:.11,dh:10,minL:.62},
 {role:'secondary',L:.76,C:.16,dh:-12,minL:.68},{role:'secondary',L:.79,C:.17,dh:12,minL:.7},
 {role:'accent',L:.93,C:.26,dh:-8,minL:.74},{role:'accent',L:.95,C:.24,dh:8,minL:.76}
];
// Stable ±6% chroma variation adds subtle colour separation without flickering.
export const CHROMA_VARIATION=[.94,1.04,.96,1.05,1.03,.95];
export const SPECIES_SHARE=[.3,.3,.15,.15,.05,.05];
// Triadic hue triples (120° apart in OKLCH): d = dominant, s = secondary, a = accent.
export const PALETTES={
 abyss:{name:'Abissal',d:250,s:130,a:10},
 reef:{name:'Recife',d:200,s:320,a:80},
 aurora:{name:'Aurora',d:160,s:280,a:40},
 ember:{name:'Brasa',d:30,s:270,a:150},
 lagoon:{name:'Lagoa',d:180,s:60,a:300},
 orchid:{name:'Orquídea',d:310,s:70,a:190}
};
const wrapHue=h=>((h%360)+360)%360;
const chromaCache=new Map();
export function maxChroma(L,h){const key=Math.round(L*100)+':'+Math.round(h);let v=chromaCache.get(key);if(v!==undefined)return v;let lo=0,hi=.4;for(let k=0;k<16;k++){const mid=(lo+hi)/2;if(inGamut(oklabToLinearRgb(...oklchToOklab(L,mid,h))))lo=mid;else hi=mid;}chromaCache.set(key,lo);return lo;}
export function makePalette(preset='abyss',rotate=0){
 const P=typeof preset==='string'?(PALETTES[preset]||PALETTES.abyss):preset,hues=[P.d,P.d,P.s,P.s,P.a,P.a];
 // Vivid roles are built accent → secondary → dominant so each tier's chroma is capped by the tier above
 // (sRGB cannot hold very light + very saturated for some hues); keeps the 60-30-10 hierarchy.
 const build=(r,i,cap)=>{
  const h=wrapHue(hues[i]+r.dh+rotate);let L=r.L;
  // Keep chroma: some hues (blue, magenta) cannot be very light and saturated in sRGB, so lower L just enough.
  while(L>r.minL&&maxChroma(L,h)<r.C*.92)L-=.01;const C=Math.min(r.C*CHROMA_VARIATION[i],cap,maxChroma(L,h));
  return {_C:C,role:r.role,hue:h,rgb:oklchToSrgb(L,C,h),rim:oklchToSrgb(Math.min(.97,L+.1),C*.7,h),deep:oklchToSrgb(Math.max(.3,L-.24),C*1.1,h),accent:oklchToSrgb(.94,Math.min(.1,Math.max(.06,C*.55)),(h+180)%360)};
 };
 const out=[],chroma=i=>out[i]._C;
 for(const i of [4,5])out[i]=build(ROLES[i],i,Infinity);
 const accentMin=Math.min(chroma(4),chroma(5));for(const i of [2,3])out[i]=build(ROLES[i],i,accentMin+.015);
 const secondaryMin=Math.min(chroma(2),chroma(3));for(const i of [0,1])out[i]=build(ROLES[i],i,secondaryMin-.012);
 const species=out;
 const background=oklchToSrgb(.11,.025,wrapHue(P.d+rotate));
 // Backdrop layers: dominant base, secondary and accent clouds at very low value; panel tint for the UI.
 const backdrop=[background,oklchToSrgb(.155,.045,wrapHue(P.s+rotate)),oklchToSrgb(.17,.065,wrapHue(P.a+rotate))],panel=oklchToSrgb(.18,.022,wrapHue(P.d+rotate));
 return {backdrop,panel,preset:typeof preset==='string'?preset:'generated',triple:{d:P.d,s:P.s,a:P.a},rotate,species,colors:species.map(s=>toHex(s.rgb)),rgb:species.map(s=>s.rgb),background};
}
// Generated palettes are triads: secondary and accent at ±120° (which one is the accent varies), small jitter.
export function randomTriple(rng=Math.random,avoid=null){
 for(let k=0;k<12;k++){const d=rng()*360,flip=rng()<.5?1:-1,j=()=>(rng()-.5)*12,t={name:'Gerada',d,s:wrapHue(d+120*flip+j()),a:wrapHue(d-120*flip+j())};
  if(!avoid||Math.abs(Math.atan2(Math.sin((t.d-avoid.d)*Math.PI/180),Math.cos((t.d-avoid.d)*Math.PI/180)))>Math.PI/4)return t;}
 const d=wrapHue((avoid?.d??0)+90);return {name:'Gerada',d,s:wrapHue(d+120),a:wrapHue(d+240)};
}
// Smooth palette transition in OKLab.
export function lerpPalette(p,q,t){
 const species=p.species.map((a,i)=>{const b=q.species[i];return {...b,rgb:mixOklab(a.rgb,b.rgb,t),rim:mixOklab(a.rim,b.rim,t),deep:mixOklab(a.deep,b.deep,t),accent:mixOklab(a.accent,b.accent,t)};});
 return {...q,species,colors:species.map(s=>toHex(s.rgb)),rgb:species.map(s=>s.rgb),background:mixOklab(p.background,q.background,t),backdrop:p.backdrop.map((c,i)=>mixOklab(c,q.backdrop[i],t)),panel:mixOklab(p.panel,q.panel,t)};
}
export const OPENING_PALETTE={name:'Amarelo e laranja',d:75,s:45,a:295};
export const DEFAULT_PALETTE=makePalette(OPENING_PALETTE);
