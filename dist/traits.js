import {featureLevel} from './features.js?v=1.26.1';
const clamp=v=>Math.max(.05,Math.min(.95,v));
export function ensureTraits(a){if(!a.traits){const hunt=a.id%2?.72+(a.id%3)*.06:.12+(a.id%3)*.06;a.traits={hunt,escape:1-hunt,fecundity:1-hunt};}a.growth??=0;return a.traits;}
export function inheritTraits(parent,rng=Math.random){const p=ensureTraits(parent),hunt=clamp(p.hunt+(rng()-.5)*.16);return {hunt,escape:1-hunt,fecundity:1-hunt};}
export function reproductionRules(a){const t=ensureTraits(a);return {maturity:Math.round(720-360*t.fecundity),reserve:.95-.6*t.fecundity,cooldown:Math.round((1500-840*t.fecundity)/(1+.12*featureLevel(a,'fertility'))),energyCost:.25-.1*t.fecundity};}
