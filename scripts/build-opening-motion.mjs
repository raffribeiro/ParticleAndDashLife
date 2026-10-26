// Remotion is an authoring dependency only. Bake its springs into lightweight browser keyframes.
import {spring,interpolate} from 'remotion';
import {writeFileSync} from 'node:fs';
const round=v=>+v.toFixed(5),fps=60,clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'};
function frames(count,button=false){return Array.from({length:count+1},(_,frame)=>{
 const settle=spring({frame:Math.max(0,frame-3),fps,config:{damping:12,stiffness:620,mass:.5}});
 const scale=frame<3?interpolate(frame,[0,3],[.06,.16],clamp):interpolate(settle,[0,1],[.16,1]);
 const squash=Math.sin(Math.min(1,settle)*Math.PI)*(button?.14:.2);
 return {offset:frame/count,visibility:frame===0?'hidden':'visible',transform:frame===count?'translateY(0px) rotate(0deg) scale(1,1)':`translateY(${round((1-settle)*(button?24:30))}px) rotate(${round((1-settle)*(button?-4:-12))}deg) scale(${round(scale*(1-squash))},${round(scale*(1+squash))})`};
 });}
const data={fps,titleDelay:220,letterStagger:18,letterDuration:350,buttonDelay:900,buttonDuration:400,letters:frames(21),button:frames(24,true)};
writeFileSync(new URL('../dist/opening-motion-data.js',import.meta.url),'// Generated with Remotion spring() and interpolate(). Rebuild: npm run build:opening\nexport const openingMotion='+JSON.stringify(data)+';\n');
