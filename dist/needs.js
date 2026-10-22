import {featureLevel,feedingFeatures} from './features.js?v=1.25.1';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function ensureNeeds(a){return a.needs??={reserve:.75,health:1,hunger:.25,resistance:1};}
export function nourish(a,amount){
 const n=ensureNeeds(a),food=Math.max(0,amount);feedingFeatures(a,food);n.reserve=clamp(n.reserve+food*(1+.12*featureLevel(a,'digestion')),0,1.5);
 a.growth=clamp((a.growth||0)+food*.09,0,1);
 a.strength=1+(a.traits?.hunt||0)*.5+a.growth*.6+featureLevel(a,'muscle')*.12;
 n.hunger=clamp(1-n.reserve,0,1);n.resistance=1+a.growth*.8+n.health*.25+featureLevel(a,'armor')*.2;
}
export function metabolize(a,food,dt=1){
 const n=ensureNeeds(a),activity=a.behavior?.resting?.35:1;
 n.reserve=clamp(n.reserve-(.00045+activity*.00035+(a.growth||0)*.00025)*dt,0,1.5);
 nourish(a,food*dt);
 n.health=clamp(n.health+(n.reserve>.55?.0007*(1+.3*featureLevel(a,'regeneration')):n.reserve<.15?-.0012:0)*dt,0,1);
 n.resistance=1+(a.growth||0)*.8+n.health*.25+featureLevel(a,'armor')*.2;
 return n;
}
export function damageFactor(a){const n=ensureNeeds(a);return 1/(1+(a.growth||0)*.8+n.health*.25+featureLevel(a,'armor')*.2);}
