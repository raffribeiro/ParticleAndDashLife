// Semantic painter layers. Identity breaks ties, avoiding per-frame depth flicker.
const rank=c=>c.role==='tail'?0:c.role==='leg'?1:c.role==='head'?3:2;
export function splitDrawLayers(list=[]){
 const sorted=[...list].sort((a,b)=>rank(a)-rank(b)||(a.id??0)-(b.id??0));
 return {under:sorted.filter(c=>rank(c)<2),over:sorted.filter(c=>rank(c)>=2)};
}
